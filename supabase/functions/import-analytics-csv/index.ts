import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ImportRequest = {
  financeFlowsCsv?: string;
  balanceFactCsv?: string;
  ownersFactCsv?: string;
  checkKontragentCsv?: string;
};

type TableName = "finance_flows" | "balance_fact" | "owners_fact" | "check_kontragent";

type TableConfig = {
  tableName: TableName;
  payloadKey: keyof ImportRequest;
  requiredHeaders: string[];
  allowedHeaders: string[];
};

type ParsedRow = Record<string, string | null>;

const TABLE_CONFIGS: TableConfig[] = [
  {
    tableName: "finance_flows",
    payloadKey: "financeFlowsCsv",
    requiredHeaders: ["Ресторан", "Период", "Поток", "ФинТип", "БалансТип", "СтатьяKey", "Сумма", "IsOpExp"],
    allowedHeaders: [
      "Ресторан",
      "Период",
      "Поток",
      "ФинТип",
      "БалансТип",
      "СтатьяKey",
      "Сумма",
      "IsOpExp",
      "Период (Год)",
      "Период (Квартал)",
      "Период (Индекс месяца)",
      "Период (Месяц)",
    ],
  },
  {
    tableName: "balance_fact",
    payloadKey: "balanceFactCsv",
    requiredHeaders: ["Ресторан", "Период", "БалансТип", "СтатьяKey", "Сумма"],
    allowedHeaders: ["Ресторан", "Период", "БалансТип", "СтатьяKey", "Сумма"],
  },
  {
    tableName: "owners_fact",
    payloadKey: "ownersFactCsv",
    requiredHeaders: ["Ресторан", "Период", "Псевдо", "Группа", "Движение", "Начислено", "Оплачено"],
    allowedHeaders: ["Ресторан", "Период", "Псевдо", "Группа", "Движение", "Начислено", "Оплачено"],
  },
  {
    tableName: "check_kontragent",
    payloadKey: "checkKontragentCsv",
    requiredHeaders: ["Ресторан", "Дата", "Период", "Псевдо", "Группа", "Движение", "Начислено", "Оплачено"],
    allowedHeaders: ["Ресторан", "Дата", "Период", "Псевдо", "Группа", "Движение", "Начислено", "Оплачено"],
  },
];

const ANALYTICS_TABLES: TableName[] = ["finance_flows", "balance_fact", "owners_fact"];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getFirstNonEmptyLine(input: string) {
  return input
    .replace(/^\uFEFF/, "")
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? "";
}

function countDelimiter(line: string, delimiter: string) {
  let count = 0;
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && character === delimiter) {
      count += 1;
    }
  }

  return count;
}

function detectDelimiter(input: string) {
  const sample = getFirstNonEmptyLine(input);
  const candidates = [";", ",", "\t"];

  return candidates.reduce(
    (best, candidate) => {
      const score = countDelimiter(sample, candidate);
      return score > best.score ? { delimiter: candidate, score } : best;
    },
    { delimiter: ";", score: -1 },
  ).delimiter;
}

function parseDelimitedText(input: string) {
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      if (inQuotes && text[index + 1] === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && character === delimiter) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if (!inQuotes && character === "\n") {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
      continue;
    }

    currentField += character;
  }

  currentRow.push(currentField);
  rows.push(currentRow);

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

function normalizeCellValue(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeArticleKey(value: string | null) {
  if (!value) return value;

  const trimmed = value.trim();
  const normalized = trimmed.replace(/\s+/g, " ").toLocaleLowerCase("ru-RU");

  if (normalized === "авансы" || normalized === "зп нач" || normalized === "зп. нач") {
    return "ЗП нач";
  }

  return trimmed;
}

function normalizeParsedRow(config: TableConfig, row: ParsedRow) {
  if (config.tableName === "finance_flows" || config.tableName === "balance_fact") {
    return {
      ...row,
      СтатьяKey: normalizeArticleKey(row["СтатьяKey"]),
    };
  }

  return row;
}

function parseCsvRows(input: string, config: TableConfig) {
  const rows = parseDelimitedText(input);
  if (rows.length < 2) {
    throw new Error(`Файл для ${config.tableName} пустой или не содержит данных.`);
  }

  const headers = rows[0].map((header) => header.trim());
  const missingHeaders = config.requiredHeaders.filter((header) => !headers.includes(header));

  if (missingHeaders.length > 0) {
    throw new Error(
      `В файле ${config.tableName} не хватает колонок: ${missingHeaders.join(", ")}.`,
    );
  }

  const parsedRows = rows.slice(1).map((cells, rowIndex) => {
    const row = config.allowedHeaders.reduce<ParsedRow>((accumulator, header) => {
      const headerIndex = headers.indexOf(header);
      accumulator[header] = headerIndex === -1 ? null : normalizeCellValue(cells[headerIndex]);
      return accumulator;
    }, {});

    if (!row["Ресторан"] || !row["Период"]) {
      throw new Error(
        `В файле ${config.tableName} строка ${rowIndex + 2} должна содержать Ресторан и Период.`,
      );
    }

    return normalizeParsedRow(config, row);
  });

  if (parsedRows.length === 0) {
    throw new Error(`Файл для ${config.tableName} не содержит строк с данными.`);
  }

  return parsedRows;
}

function uniquePeriods(rows: ParsedRow[]) {
  return Array.from(new Set(rows.map((row) => row["Период"]).filter((value): value is string => Boolean(value))));
}

function uniqueSlices(rows: ParsedRow[]) {
  return Array.from(
    new Set(
      rows
        .map((row) => {
          if (!row["Ресторан"] || !row["Период"]) return null;
          return `${row["Ресторан"]}|||${row["Период"]}`;
        })
        .filter((value): value is string => Boolean(value)),
    ),
  ).map((value) => {
    const [restaurant, period] = value.split("|||");
    return { restaurant, period };
  });
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("Authorization") ?? request.headers.get("authorization");

  if (!authorization) {
    throw new Error("Нужна авторизация администратора.");
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new Error("Некорректный токен авторизации.");
  }

  return token;
}

async function requireAdmin(request: Request, supabaseUrl: string, supabasePublishableKey: string, supabaseServiceRoleKey: string) {
  const token = getBearerToken(request);

  const authClient = createClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false },
  });

  const { data, error: userError } = await authClient.auth.getClaims(token);
  const userId = data?.claims?.sub;

  if (userError || !userId) {
    throw new Error("Не удалось подтвердить сессию пользователя.");
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: profile, error: profileError } = await serviceClient
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (profile?.role !== "Админ") {
    throw new Error("Загрузка доступна только для администратора.");
  }

  return serviceClient;
}

async function replaceTableSlices(
  serviceClient: ReturnType<typeof createClient>,
  config: TableConfig,
  rows: ParsedRow[],
) {
  const slices = uniqueSlices(rows);

  for (const slice of slices) {
    const { error } = await serviceClient
      .from(config.tableName)
      .delete()
      .eq("Ресторан", slice.restaurant)
      .eq("Период", slice.period);

    if (error) {
      throw error;
    }
  }

  for (const chunk of chunkArray(rows, 500)) {
    const { error } = await serviceClient.from(config.tableName).insert(chunk);
    if (error) {
      throw error;
    }
  }

  return {
    rowCount: rows.length,
    sliceCount: slices.length,
    periods: uniquePeriods(rows),
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabasePublishableKey = Deno.env.get("SB_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabasePublishableKey || !supabaseServiceRoleKey) {
      throw new Error("Missing SUPABASE_URL, publishable key or SUPABASE_SERVICE_ROLE_KEY.");
    }

    const payload = (await request.json()) as ImportRequest;
    const serviceClient = await requireAdmin(request, supabaseUrl, supabasePublishableKey, supabaseServiceRoleKey);

    const parsedByTable = TABLE_CONFIGS.flatMap((config) => {
      const csv = payload[config.payloadKey];

      if (!csv || !csv.trim()) {
        return [];
      }

      return [{
        config,
        rows: parseCsvRows(csv, config),
      }];
    });

    if (parsedByTable.length === 0) {
      throw new Error("Не передан ни один файл для импорта.");
    }

    const parsedTableNames = new Set(parsedByTable.map(({ config }) => config.tableName));
    const providedAnalyticsCount = ANALYTICS_TABLES.filter((tableName) => parsedTableNames.has(tableName)).length;

    if (providedAnalyticsCount > 0 && providedAnalyticsCount !== ANALYTICS_TABLES.length) {
      throw new Error("Для аналитики нужно передать вместе finance_flows, balance_fact и owners_fact.");
    }

    const summaryEntries = await Promise.all(
      parsedByTable.map(async ({ config, rows }) => [config.tableName, await replaceTableSlices(serviceClient, config, rows)] as const),
    );

    return jsonResponse({
      ok: true,
      summary: Object.fromEntries(summaryEntries),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 500);
  }
});
