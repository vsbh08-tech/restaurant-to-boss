import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bar-export-secret",
};

const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SHEET_HEADERS = ["Дата", "Тип", "Категория", "Сумма", "Исправление", "Ресторан", "Сотрудник", "Создано", "ID"];

type ExportRequest = {
  date?: string;
  timezone?: string;
};

type BarTransactionRow = {
  id: string;
  created_at: string | null;
  restaurant_id: string | null;
  Сотрудник: string | null;
  Дата: string | null;
  Категория: string | null;
  Сумма: number | null;
  Тип: string | null;
  Исправление: string | null;
};

type RestaurantRow = {
  id: string;
  name: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function toBase64(input: string | Uint8Array) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function toBase64Url(input: string | Uint8Array) {
  return toBase64(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string) {
  const normalized = pem.replace(/\\n/g, "\n");
  const base64 = normalized
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

async function signGoogleJwt(email: string, privateKeyPem: string) {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: email,
    scope: GOOGLE_SHEETS_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`;
}

async function getGoogleAccessToken(email: string, privateKeyPem: string) {
  const assertion = await signGoogleJwt(email, privateKeyPem);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google OAuth error: ${await response.text()}`);
  }

  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error("Google OAuth error: access token missing in response.");
  }

  return payload.access_token as string;
}

async function googleJson<T>(url: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Google Sheets API error (${response.status}): ${await response.text()}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

function getTimeZoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((item) => item.type === "year")?.value;
  const month = parts.find((item) => item.type === "month")?.value;
  const day = parts.find((item) => item.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`Не удалось определить дату для часового пояса ${timeZone}.`);
  }

  return { year, month, day };
}

function toIsoDate(parts: { year: string; month: string; day: string }) {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getPreviousDayIso(timeZone: string) {
  const today = getTimeZoneParts(new Date(), timeZone);
  const anchor = new Date(Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day), 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() - 1);

  return toIsoDate({
    year: String(anchor.getUTCFullYear()),
    month: String(anchor.getUTCMonth() + 1).padStart(2, "0"),
    day: String(anchor.getUTCDate()).padStart(2, "0"),
  });
}

function formatDateTime(value: string | null, timeZone: string) {
  if (!value) return "";

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function quoteSheetName(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function getMonthSheetTitle(date: string) {
  return date.slice(0, 7);
}

async function ensureSheetExists(spreadsheetId: string, title: string, accessToken: string) {
  const metadata = await googleJson<{
    sheets?: Array<{ properties?: { title?: string } }>;
  }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    accessToken,
  );

  const exists = metadata.sheets?.some((sheet) => sheet.properties?.title === title);
  if (exists) {
    return;
  }

  await googleJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title,
              },
            },
          },
        ],
      }),
    },
  );
}

async function clearSheet(spreadsheetId: string, title: string, accessToken: string) {
  const range = encodeURIComponent(`${quoteSheetName(title)}!A:Z`);

  await googleJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`,
    accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    },
  );
}

async function readSheet(
  spreadsheetId: string,
  title: string,
  accessToken: string,
) {
  const range = encodeURIComponent(`${quoteSheetName(title)}!A:Z`);

  return googleJson<{ values?: string[][] }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    accessToken,
  );
}

async function writeSheet(
  spreadsheetId: string,
  title: string,
  values: Array<Array<string | number>>,
  accessToken: string,
) {
  const range = encodeURIComponent(`${quoteSheetName(title)}!A1`);

  await googleJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
    },
  );
}

function buildMonthlySheetRows(existingRows: string[][], targetDate: string, newRows: string[][]) {
  const dataRows = existingRows.filter((row, index) => {
    if (index === 0 && row[0] === SHEET_HEADERS[0]) {
      return false;
    }

    return row[0] !== targetDate;
  });

  const mergedRows = [...dataRows, ...newRows].sort((left, right) => {
    const leftDate = left[0] ?? "";
    const rightDate = right[0] ?? "";

    if (leftDate === rightDate) {
      const leftCreatedAt = left[7] ?? "";
      const rightCreatedAt = right[7] ?? "";
      return leftCreatedAt.localeCompare(rightCreatedAt, "ru");
    }

    return leftDate.localeCompare(rightDate, "ru");
  });

  return [SHEET_HEADERS, ...mergedRows];
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const expectedSecret = Deno.env.get("BAR_EXPORT_CRON_SECRET");
    const requestSecret = request.headers.get("x-bar-export-secret");

    if (expectedSecret && requestSecret !== expectedSecret) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const googleEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    const googlePrivateKey = Deno.env.get("GOOGLE_PRIVATE_KEY");
    const spreadsheetId = Deno.env.get("GOOGLE_SHEETS_SPREADSHEET_ID");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    }

    if (!googleEmail || !googlePrivateKey || !spreadsheetId) {
      throw new Error(
        "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY or GOOGLE_SHEETS_SPREADSHEET_ID.",
      );
    }

    let payload: ExportRequest = {};
    try {
      payload = (await request.json()) as ExportRequest;
    } catch {
      payload = {};
    }

    const timezone = payload.timezone || "Europe/Moscow";
    const targetDate = payload.date && DATE_PATTERN.test(payload.date) ? payload.date : getPreviousDayIso(timezone);

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
      },
    });

    const { data: transactions, error: transactionsError } = await supabase
      .from("bar_transactions")
      .select("id, created_at, restaurant_id, Сотрудник, Дата, Категория, Сумма, Тип, Исправление")
      .eq("Дата", targetDate)
      .order("created_at", { ascending: true });

    if (transactionsError) {
      throw transactionsError;
    }

    const barTransactions = (transactions ?? []) as BarTransactionRow[];
    const restaurantIds = [
      ...new Set(barTransactions.map((item) => item.restaurant_id).filter((item): item is string => Boolean(item))),
    ];
    let restaurantMap = new Map<string, string>();

    if (restaurantIds.length > 0) {
      const { data: restaurants, error: restaurantsError } = await supabase
        .from("restaurants")
        .select("id, name")
        .in("id", restaurantIds);

      if (restaurantsError) {
        throw restaurantsError;
      }

      restaurantMap = new Map((restaurants as RestaurantRow[]).map((item) => [item.id, item.name]));
    }

    const sheetTitle = getMonthSheetTitle(targetDate);
    const newRows = barTransactions.map((item) => [
      item.Дата ?? "",
      item.Тип ?? "",
      item.Категория ?? "",
      item.Сумма != null ? String(item.Сумма) : "",
      item.Исправление ?? "Нет",
      item.restaurant_id ? restaurantMap.get(item.restaurant_id) ?? item.restaurant_id : "",
      item.Сотрудник ?? "",
      formatDateTime(item.created_at, timezone),
      item.id,
    ]);

    const accessToken = await getGoogleAccessToken(googleEmail, googlePrivateKey);

    await ensureSheetExists(spreadsheetId, sheetTitle, accessToken);
    const existingSheet = await readSheet(spreadsheetId, sheetTitle, accessToken);
    const values = buildMonthlySheetRows(existingSheet.values ?? [], targetDate, newRows);
    await clearSheet(spreadsheetId, sheetTitle, accessToken);
    await writeSheet(spreadsheetId, sheetTitle, values, accessToken);

    return jsonResponse({
      ok: true,
      exportedDate: targetDate,
      sheetTitle,
      rowCount: barTransactions.length,
      timezone,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 500);
  }
});
