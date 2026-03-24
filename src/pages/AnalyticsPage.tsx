import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, Download, Minus } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  ANALYTICS_ROUTE_PATHS,
  ANALYTICS_WORKSPACE_META,
  getAnalyticsWorkspaceView,
} from "@/lib/analytics-navigation";
import { formatCurrency, parsePeriodDate, parseTextNumeric } from "@/lib/supabase-helpers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnalyticsImportDialog } from "@/components/AnalyticsImportDialog";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { useRole } from "@/lib/roles";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";

type FinanceFlow = {
  id: string;
  "Ресторан": string | null;
  "Период": string | null;
  "Поток": string | null;
  "ФинТип": string | null;
  "БалансТип": string | null;
  "СтатьяKey": string | null;
  "Сумма": string | null;
  "IsOpExp": string | null;
};

type BalanceFact = {
  id: string;
  "Ресторан": string | null;
  "Период": string | null;
  "БалансТип": string | null;
  "СтатьяKey": string | null;
  "Сумма": string | null;
};

type OwnersFact = {
  id: string;
  "Ресторан": string | null;
  "Период": string | null;
  "Псевдо": string | null;
  "Группа": string | null;
  "Движение": string | null;
  "Начислено": string | null;
  "Оплачено": string | null;
};

type PeriodOption = {
  key: string;
  label: string;
  date: Date;
};

type FinancialFlowRow = {
  id: string;
  restaurant: string;
  periodDate: Date;
  periodKey: string;
  flowType: string;
  finType: string;
  article: string;
  amount: number;
  isOperationalExpense: boolean;
};

type BalanceFactRow = {
  id: string;
  restaurant: string;
  periodDate: Date;
  periodKey: string;
  balanceType: string;
  article: string;
  amount: number;
};

type OwnersFactRow = {
  id: string;
  restaurant: string;
  periodDate: Date;
  periodKey: string;
  owner: string;
  article: string;
  accrued: number;
  paid: number;
  net: number;
};

type OwnersReportRow = {
  article: string;
  opening: number;
  accrued: number;
  paid: number;
  net: number;
  closing: number;
};

type OwnersAuditRow = {
  restaurant: string;
  owner: string;
  article: string;
  periodDate: Date;
  periodKey: string;
  opening: number;
  accrued: number;
  paid: number;
  sourceNet: number;
  closing: number;
  sourceClosing: number;
  delta: number;
  sourceRowCount: number;
  hasSourceRow: boolean;
  isSyntheticGap: boolean;
  hasMismatch: boolean;
};

type IntragroupTransferRow = {
  id: string;
  lenderRestaurant: string;
  recipientRestaurant: string;
  periodDate: Date;
  periodKey: string;
  amount: number;
};

type TransferMatrixCell = {
  restaurant: string;
  amount: number;
};

type TransferMatrixRow = {
  restaurant: string;
  cells: TransferMatrixCell[];
  totalOut: number;
};

type TransferLeader = {
  restaurant: string | null;
  amount: number;
};

type TransferMatrixSummary = {
  restaurants: string[];
  rows: TransferMatrixRow[];
  columnTotals: number[];
  grandTotal: number;
  topRecipient: TransferLeader;
  topDonor: TransferLeader;
  topRepayer: TransferLeader;
  topReturnReceiver: TransferLeader;
  maxMagnitude: number;
};

type TransferKpiCardProps = {
  icon: any;
  label: string;
  value: string;
  subtitle?: string;
  tone: "primary" | "accent" | "success";
};

type TransferMatrixCardProps = {
  title: string;
  periodLabel: string;
  summary: TransferMatrixSummary;
  description?: string;
};

type TransferNetChartDatum = {
  restaurant: string;
  net: number;
};

type TransferTimelineDatum = {
  periodKey: string;
  label: string;
  fullLabel: string;
  amount: number;
};

type OwnersTimelineDatum = {
  periodKey: string;
  label: string;
  fullLabel: string;
  closing: number;
  accrued: number;
  paid: number;
};

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob | BufferSource | string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

type StructureRow = {
  article: string;
  value: number;
  magnitude: number;
  share: number;
};

type MetricSummary = {
  income: number;
  expense: number;
  profit: number;
};

type CashBreakdownRow = {
  label: string;
  amount: number;
  noteLabel?: string;
  noteAmount?: number;
};

type CashArticleGroup = {
  label: string;
  aliases: string[];
};

type CashWaterfallDatum = {
  key: string;
  label: string;
  fullLabel: string;
  offset: number;
  value: number;
  delta: number;
  total: number;
  kind: "total" | "positive" | "negative";
};

type MetricKind = "income" | "expense" | "profit";

type FilterChipGroupProps<T extends string | number> = {
  label: string;
  options: T[];
  selection: T[];
  onChange: (next: T[]) => void;
  renderOption?: (value: T) => string;
  className?: string;
  compact?: boolean;
  matchPeriodHeight?: boolean;
  singleSelect?: boolean;
  toggleSelect?: boolean;
  allowSelectAll?: boolean;
};

type PeriodSelectorProps = {
  selection: string[];
  onChange: (next: string[]) => void;
  options: PeriodOption[];
  refsMap: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
  compact?: boolean;
  allowSelectAll?: boolean;
};

type PeriodRangeSelectorProps = {
  fromPeriodKey: string | null;
  toPeriodKey: string | null;
  onFromChange: (next: string) => void;
  onToChange: (next: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  options: PeriodOption[];
};

type KpiCardProps = {
  label: string;
  valueText: string;
  kind: MetricKind;
  changePct: number | null;
  comparisonText: string;
  changeText?: string;
  tone?: "primary" | "accent" | "muted" | "secondary";
};

type StructureCardProps = {
  title: string;
  rows: StructureRow[];
  barClassName: string;
  footerLabel?: string;
  footerValue?: number;
  showBars?: boolean;
  showShare?: boolean;
};

type AnalyticsScopeConfig = {
  fixedRestaurantNames?: string[];
  fixedOwnerNames?: string[];
  hideRestaurantFilter?: boolean;
  hideOwnerFilter?: boolean;
  hideArticleFilter?: boolean;
  hideImportAction?: boolean;
  hideTransfersTab?: boolean;
  title?: string;
  description?: string;
};

type AnalyticsPageProps = {
  scope?: AnalyticsScopeConfig;
};

const OWNER_OPTIONS = ["ГЛ", "Друзья", "ЗМ", "МЗ"] as const;
const ANALYTICS_PAGE_SIZE = 1000;
const SHOW_ANALYTICS_VERIFICATION_TAB = false;
const OWNERS_REVERSED_FLOW_ARTICLES = new Set(["Снятие с р/с"]);
const CANONICAL_INTRAGROUP_TRANSFER_GROUP = "займы выданные";
const LEGACY_INTRAGROUP_TRANSFER_GROUP = "займы";
const FILTER_CHIP_BASE_CLASS =
  "h-7 rounded-md border border-border px-2.5 text-xs hover:border-primary hover:bg-primary/5 hover:text-primary";
const FILTER_CHIP_ACTIVE_CLASS =
  "border-primary bg-primary text-primary-foreground font-semibold shadow-sm hover:border-primary hover:bg-primary hover:text-primary-foreground";
const CASH_ACCOUNT_GROUPS: CashArticleGroup[] = [
  { label: "Касса", aliases: ["касса", "хранение"] },
  { label: "Расчетный счет", aliases: ["расчетный счет", "расчетный счёт"] },
  { label: "Деньги в пути", aliases: ["деньги в пути"] },
  { label: "Снятие с р/с", aliases: ["снятие с р/с"] },
];
const CASH_REQUIRED_PAYMENT_GROUPS: CashArticleGroup[] = [
  { label: "ЗП начисленная", aliases: ["зп начисленная", "зп нач", "зп. нач"] },
  { label: "Комиссия начисленная", aliases: ["комиссия начисленная", "комиссия нач"] },
];
const CASH_DIVIDEND_ARTICLE_ALIASES = ["доли"];
const CASH_EXPLICIT_OTHER_INFLOW_ALIASES = ["займы полученные", "предоплата", "предоплаты"];
const CASH_EXPLICIT_OTHER_OUTFLOW_ALIASES = ["п/о суммы", "расходы будущих периодов", "займы выданные"];
const CASH_OWNER_WITHDRAWAL_GROUP_ALIASES = ["снятие с р/с", "снятие с р\\с"];

function makePeriodKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatPeriodChip(date: Date) {
  return makePeriodKey(date);
}

function formatPeriodRangeLabel(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

function formatShortMonthYear(date: Date) {
  const monthNames = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return `${monthNames[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`;
}

function normalizeFileNamePart(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "_");
}

function normalizeLookupText(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU");
}

function matchesArticleAlias(article: string, aliases: string[]) {
  const normalizedArticle = normalizeLookupText(article);
  return aliases.includes(normalizedArticle);
}

function normalizeBalanceArticle(article: string) {
  if (matchesArticleAlias(article, ["хранение"])) {
    return "Касса";
  }

  return article;
}

function sumAmountsByArticleAliases<T extends { article: string; amount: number }>(rows: T[], aliases: string[]) {
  return rows
    .filter((row) => matchesArticleAlias(row.article, aliases))
    .reduce((sum, row) => sum + row.amount, 0);
}

function buildCashBreakdownRows(rows: BalanceFactRow[], groups: CashArticleGroup[]) {
  return groups.map((group) => ({
    label: group.label,
    amount: sumAmountsByArticleAliases(rows, group.aliases),
  }));
}

function getUniqueValues<T extends string | number>(values: T[]) {
  return Array.from(new Set(values));
}

function isOwnersReversedFlowArticle(article: string) {
  return OWNERS_REVERSED_FLOW_ARTICLES.has(article.trim());
}

function normalizeOwnersFactAmounts(article: string, accrued: number, paid: number, net: number) {
  if (!isOwnersReversedFlowArticle(article)) {
    return { accrued, paid, net };
  }

  return {
    accrued: accrued * -1,
    paid,
    net: net * -1,
  };
}

function calculateOwnersClosing(article: string, opening: number, accrued: number, paid: number) {
  if (isOwnersReversedFlowArticle(article)) {
    return opening + accrued + paid;
  }

  return opening + accrued - paid;
}

function resolveSelection<T extends string | number>(selection: T[], options: T[]) {
  return selection.length === 0 ? options : options.filter((option) => selection.includes(option));
}

function resolveScopedSelection<T extends string | number>(selection: T[], options: T[], fixedSelection: T[] = []) {
  if (fixedSelection.length > 0) {
    return options.filter((option) => fixedSelection.includes(option));
  }

  return selection;
}

function getNextSelection<T extends string | number>(selection: T[], value: T, isMultiSelect: boolean) {
  if (!isMultiSelect) {
    return [value];
  }

  if (selection.includes(value)) {
    return selection.filter((item) => item !== value);
  }

  return [...selection, value];
}

function enumerateMonths(from: Date, to: Date) {
  const months: Date[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);

  while (cursor.getTime() <= end.getTime()) {
    months.push(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function isNearlyZero(value: number, precision = 0.005) {
  return Math.abs(value) < precision;
}

function getPreviousYearPeriodKeys(selectedKeys: string[], periodOptions: PeriodOption[]) {
  if (selectedKeys.length === 0) return null;

  const selected = periodOptions
    .filter((option) => selectedKeys.includes(option.key))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (selected.length !== selectedKeys.length) {
    return null;
  }

  const periodKeySet = new Set(periodOptions.map((option) => option.key));
  const previousKeys = selected.map((option) => {
    const previousDate = new Date(option.date.getFullYear() - 1, option.date.getMonth(), 1);
    const previousKey = makePeriodKey(previousDate);

    if (!periodKeySet.has(previousKey)) {
      return null;
    }

    return previousKey;
  });

  if (previousKeys.some((key) => key === null)) {
    return null;
  }

  return previousKeys as string[];
}

function getChangePercent(currentValue: number, previousValue: number) {
  if (previousValue === 0) return null;
  return ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
}

function formatComparisonMonthYear(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "short",
    year: "numeric",
  })
    .format(date)
    .replace(/\./g, "")
    .replace(/\u00A0/g, " ");
}

function getYearComparisonLabel(selectedKeys: string[], periodOptions: PeriodOption[]) {
  const selected = periodOptions
    .filter((option) => selectedKeys.includes(option.key))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (selected.length === 0) {
    return "к прошлому году";
  }

  const shiftedDates = selected.map((option) => new Date(option.date.getFullYear() - 1, option.date.getMonth(), 1));

  if (shiftedDates.length === 1) {
    return `к ${formatComparisonMonthYear(shiftedDates[0])}`;
  }

  return `к ${formatComparisonMonthYear(shiftedDates[0])} - ${formatComparisonMonthYear(shiftedDates[shiftedDates.length - 1])}`;
}

function buildPeriodOptions(dates: Date[]) {
  return Array.from(
    new Map(
      dates.map((date) => {
        const normalizedDate = new Date(date.getFullYear(), date.getMonth(), 1);
        const key = makePeriodKey(normalizedDate);
        return [key, { key, label: formatPeriodChip(normalizedDate), date: normalizedDate }];
      }),
    ).values(),
  ).sort((a, b) => b.date.getTime() - a.date.getTime());
}

function resolvePreferredOption<T extends string | number>(options: T[], preferredOption: T | null | undefined) {
  if (preferredOption !== null && preferredOption !== undefined && options.includes(preferredOption)) {
    return preferredOption;
  }

  return options[0] ?? null;
}

function useInitializeMultiSelection<T extends string | number>({
  selection,
  options,
  onChange,
  preferredSelection = [],
}: {
  selection: T[];
  options: T[];
  onChange: (next: T[]) => void;
  preferredSelection?: T[];
}) {
  const hasInitialized = useRef(false);

  useEffect(() => {
    const validSelection = selection.filter((item) => options.includes(item));
    if (validSelection.length !== selection.length) {
      hasInitialized.current = validSelection.length > 0;
      onChange(validSelection);
      return;
    }

    if (selection.length > 0) {
      hasInitialized.current = true;
      return;
    }

    if (options.length === 0) {
      hasInitialized.current = false;
      return;
    }

    if (hasInitialized.current || options.length === 0) {
      return;
    }

    const nextSelection = preferredSelection.filter((item) => options.includes(item));
    onChange(nextSelection.length > 0 ? nextSelection : options);
    hasInitialized.current = true;
  }, [onChange, options, preferredSelection, selection]);
}

function useInitializeSingleSelection<T extends string | number>({
  selection,
  options,
  onChange,
  preferredOption,
}: {
  selection: T[];
  options: T[];
  onChange: (next: T[]) => void;
  preferredOption?: T | null;
}) {
  const hasInitialized = useRef(false);

  useEffect(() => {
    const validSelection = selection.filter((item) => options.includes(item));
    if (validSelection.length !== selection.length) {
      hasInitialized.current = false;
      onChange(validSelection);
      return;
    }

    if (selection.length > 0) {
      hasInitialized.current = true;
      return;
    }

    if (hasInitialized.current || options.length === 0) {
      return;
    }

    const defaultOption = resolvePreferredOption(options, preferredOption);
    if (defaultOption === null) {
      return;
    }

    onChange([defaultOption]);
    hasInitialized.current = true;
  }, [onChange, options, preferredOption, selection]);
}

function useAnalyticsAccess(scope?: AnalyticsScopeConfig) {
  const { availableRestaurants } = useRole();
  const fixedRestaurantNames = useMemo(
    () => getUniqueValues(scope?.fixedRestaurantNames ?? []),
    [scope?.fixedRestaurantNames],
  );
  const fixedOwnerNames = useMemo(
    () => getUniqueValues(scope?.fixedOwnerNames ?? []),
    [scope?.fixedOwnerNames],
  );
  const accessibleRestaurantNames = useMemo(
    () =>
      fixedRestaurantNames.length > 0
        ? fixedRestaurantNames
        : getUniqueValues(availableRestaurants.map((restaurant) => restaurant.name)),
    [availableRestaurants, fixedRestaurantNames],
  );
  const accessibleRestaurantNameSet = useMemo(
    () => new Set(accessibleRestaurantNames),
    [accessibleRestaurantNames],
  );
  const preferredRestaurantSelection = useMemo(
    () => (fixedRestaurantNames.length > 0 ? fixedRestaurantNames : []),
    [fixedRestaurantNames],
  );

  return {
    accessibleRestaurantNames,
    accessibleRestaurantNameSet,
    preferredRestaurantSelection,
    fixedRestaurantNames,
    fixedOwnerNames,
  };
}

function buildStructureRows(
  rows: Array<{ article: string; amount: number }>,
  options?: { absoluteDisplay?: boolean },
) {
  const grouped = new Map<string, number>();

  rows.forEach((row) => {
    grouped.set(row.article, (grouped.get(row.article) || 0) + row.amount);
  });

  const prepared = Array.from(grouped.entries())
    .map(([article, total]) => {
      const value = options?.absoluteDisplay ? Math.abs(total) : total;
      const magnitude = Math.abs(value);
      return { article, value, magnitude };
    })
    .filter((row) => row.magnitude > 0);

  const totalMagnitude = prepared.reduce((sum, row) => sum + row.magnitude, 0);

  return prepared
    .map((row) => ({
      ...row,
      share: totalMagnitude === 0 ? 0 : (row.magnitude / totalMagnitude) * 100,
    }))
    .sort((a, b) => b.magnitude - a.magnitude);
}

function pickPositiveTransferLeader(items: Array<{ restaurant: string; amount: number }>) {
  return items.reduce<TransferLeader>(
    (best, item) => {
      if (item.amount <= 0) {
        return best;
      }

      if (item.amount > best.amount) {
        return item;
      }

      if (
        item.amount === best.amount &&
        best.restaurant !== null &&
        item.restaurant.localeCompare(best.restaurant, "ru") < 0
      ) {
        return item;
      }

      return best;
    },
    { restaurant: null, amount: 0 },
  );
}

function pickNegativeTransferLeader(items: Array<{ restaurant: string; amount: number }>) {
  return items.reduce<TransferLeader>(
    (best, item) => {
      if (item.amount >= 0) {
        return best;
      }

      if (best.restaurant === null || item.amount < best.amount) {
        return item;
      }

      if (item.amount === best.amount && item.restaurant.localeCompare(best.restaurant, "ru") < 0) {
        return item;
      }

      return best;
    },
    { restaurant: null, amount: 0 },
  );
}

function buildTransferMatrix(rows: IntragroupTransferRow[], restaurants: string[]): TransferMatrixSummary {
  const pairTotals = new Map<string, number>();

  rows.forEach((row) => {
    const key = [row.lenderRestaurant, row.recipientRestaurant].join("\u0001");
    pairTotals.set(key, (pairTotals.get(key) ?? 0) + row.amount);
  });

  const matrixRows = restaurants.map((restaurant) => {
    const cells = restaurants.map((targetRestaurant) => ({
      restaurant: targetRestaurant,
      amount:
        restaurant === targetRestaurant
          ? 0
          : pairTotals.get([restaurant, targetRestaurant].join("\u0001")) ?? 0,
    }));

    return {
      restaurant,
      cells,
      totalOut: cells.reduce((sum, cell) => sum + cell.amount, 0),
    };
  });

  const columnTotals = restaurants.map((_, index) =>
    matrixRows.reduce((sum, row) => sum + (row.cells[index]?.amount ?? 0), 0),
  );

  const grandTotal = matrixRows.reduce((sum, row) => sum + row.totalOut, 0);
  const maxMagnitude = matrixRows.reduce(
    (maxValue, row) => Math.max(maxValue, ...row.cells.map((cell) => Math.abs(cell.amount))),
    0,
  );

  return {
    restaurants,
    rows: matrixRows,
    columnTotals,
    grandTotal,
    topDonor: pickPositiveTransferLeader(matrixRows.map((row) => ({ restaurant: row.restaurant, amount: row.totalOut }))),
    topRecipient: pickPositiveTransferLeader(
      restaurants.map((restaurant, index) => ({ restaurant, amount: columnTotals[index] ?? 0 })),
    ),
    topRepayer: pickNegativeTransferLeader(
      restaurants.map((restaurant, index) => ({ restaurant, amount: columnTotals[index] ?? 0 })),
    ),
    topReturnReceiver: pickNegativeTransferLeader(
      matrixRows.map((row) => ({ restaurant: row.restaurant, amount: row.totalOut })),
    ),
    maxMagnitude,
  };
}

function roundTransferDisplayAmount(amount: number) {
  const roundedAmount = Math.round(amount);
  return Object.is(roundedAmount, -0) ? 0 : roundedAmount;
}

function roundMoneyDisplayAmount(amount: number) {
  const roundedAmount = Math.round(amount);
  return Object.is(roundedAmount, -0) ? 0 : roundedAmount;
}

const transferNetChartConfig = {
  net: {
    label: "Чистое движение",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

const transferTimelineChartConfig = {
  amount: {
    label: "Внутригрупповое движение",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

const ownersTimelineChartConfig = {
  closing: {
    label: "Баланс на конец месяца",
    color: "#2563eb",
  },
  paid: {
    label: "Выплаты за месяц",
    color: "#f97316",
  },
  accrued: {
    label: "Начисления за месяц",
    color: "#16a34a",
  },
} satisfies ChartConfig;

const cashWaterfallChartConfig = {
  offset: {
    label: "База",
    color: "transparent",
  },
  value: {
    label: "Движение денег",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

function buildTransferNetChartData(summary: TransferMatrixSummary): TransferNetChartDatum[] {
  return summary.restaurants.map((restaurant, index) => {
    const totalReceived = summary.columnTotals[index] ?? 0;
    const totalIssued = summary.rows[index]?.totalOut ?? 0;

    return {
      restaurant,
      net: roundTransferDisplayAmount(totalReceived - totalIssued),
    };
  });
}

function buildTransferTimelineData(
  rows: IntragroupTransferRow[],
  selectedPeriodDate: Date | null,
  mode: "monthly" | "cumulative",
  limit = 6,
): TransferTimelineDatum[] {
  if (!selectedPeriodDate) {
    return [];
  }

  const windowOptions = Array.from({ length: limit }, (_, index) => {
    const offset = limit - index - 1;
    const date = new Date(selectedPeriodDate.getFullYear(), selectedPeriodDate.getMonth() - offset, 1);
    const key = makePeriodKey(date);

    return {
      key,
      label: formatPeriodChip(date),
      date,
    };
  });

  return windowOptions.map((option) => {
    const amount = rows
      .filter((row) =>
        mode === "monthly"
          ? row.periodKey === option.key
          : row.periodDate.getTime() <= option.date.getTime(),
      )
      .reduce((sum, row) => sum + row.amount, 0);

    return {
      periodKey: option.key,
      label: formatShortMonthYear(option.date),
      fullLabel: option.label,
      amount: roundTransferDisplayAmount(amount),
    };
  });
}

function buildOwnersTimelineData(
  rows: OwnersFactRow[],
  selectedPeriodDate: Date | null,
  limit = 6,
): OwnersTimelineDatum[] {
  if (!selectedPeriodDate) {
    return [];
  }

  const windowOptions = Array.from({ length: limit }, (_, index) => {
    const offset = limit - index - 1;
    const date = new Date(selectedPeriodDate.getFullYear(), selectedPeriodDate.getMonth() - offset, 1);
    const key = makePeriodKey(date);

    return {
      key,
      label: formatShortMonthYear(date),
      fullLabel: formatPeriodChip(date),
      date,
    };
  });

  return windowOptions.map((option) => {
    const opening = rows
      .filter((row) => row.periodDate.getTime() < option.date.getTime())
      .reduce((sum, row) => sum + row.net, 0);
    const periodRows = rows.filter((row) => row.periodKey === option.key);
    const accrued = periodRows.reduce((sum, row) => sum + row.accrued, 0);
    const paid = periodRows.reduce((sum, row) => sum + row.paid, 0);
    const net = periodRows.reduce((sum, row) => sum + row.net, 0);

    return {
      periodKey: option.key,
      label: option.label,
      fullLabel: option.fullLabel,
      closing: Math.round(opening + net),
      accrued: Math.round(accrued),
      paid: Math.round(paid),
    };
  });
}

function buildCashWaterfallData({
  openingTotal,
  income,
  expense,
  dividends,
  otherInflows,
  otherOutflows,
  closingTotal,
}: {
  openingTotal: number;
  income: number;
  expense: number;
  dividends: number;
  otherInflows: number;
  otherOutflows: number;
  closingTotal: number;
}) {
  const normalizedExpense = expense === 0 ? 0 : -Math.abs(expense);
  const steps = [
    {
      key: "income",
      label: "Доход",
      fullLabel: "Поступления (Доход)",
      delta: income,
    },
    {
      key: "expense",
      label: "Расход",
      fullLabel: "Выплаты (Расход)",
      delta: normalizedExpense,
    },
    {
      key: "dividends",
      label: "Доли",
      fullLabel: "Доли",
      delta: dividends,
    },
    {
      key: "otherInflows",
      label: "Прочие +",
      fullLabel: "Прочие поступления",
      delta: otherInflows,
    },
    {
      key: "otherOutflows",
      label: "Прочие -",
      fullLabel: "Прочие выплаты",
      delta: otherOutflows,
    },
  ];

  const data: CashWaterfallDatum[] = [
    {
      key: "opening",
      label: "Начало",
      fullLabel: "Остаток денег на начало",
      offset: Math.min(0, openingTotal),
      value: Math.abs(openingTotal),
      delta: openingTotal,
      total: openingTotal,
      kind: "total",
    },
  ];

  let runningTotal = openingTotal;

  steps.forEach((step) => {
    const nextTotal = runningTotal + step.delta;
    data.push({
      key: step.key,
      label: step.label,
      fullLabel: step.fullLabel,
      offset: Math.min(runningTotal, nextTotal),
      value: Math.abs(step.delta),
      delta: step.delta,
      total: nextTotal,
      kind: step.delta >= 0 ? "positive" : "negative",
    });
    runningTotal = nextTotal;
  });

  data.push({
    key: "closing",
    label: "Конец",
    fullLabel: "Остаток денег на конец",
    offset: Math.min(0, closingTotal),
    value: Math.abs(closingTotal),
    delta: closingTotal,
    total: closingTotal,
    kind: "total",
  });

  return data;
}

function getTransferCellStyle(amount: number, maxMagnitude: number) {
  const roundedAmount = roundTransferDisplayAmount(amount);

  if (roundedAmount === 0 || maxMagnitude === 0) {
    return {
      className: "text-muted-foreground",
      style: undefined,
    };
  }

  const intensity = Math.min(0.78, 0.16 + (Math.abs(amount) / maxMagnitude) * 0.48);
  const rgb = roundedAmount > 0 ? "239, 68, 68" : "59, 130, 246";

  return {
    className: roundedAmount > 0 ? "text-white" : "text-foreground",
    style: {
      backgroundColor: `rgba(${rgb}, ${intensity})`,
    } as const,
  };
}

function summarizeFinancialMetrics(rows: FinancialFlowRow[]): MetricSummary {
  const operationalRows = rows.filter((row) => row.finType === "Операционная");
  const income = operationalRows
    .filter((row) => row.flowType === "Поступления")
    .reduce((sum, row) => sum + row.amount, 0);
  const expenseRaw = operationalRows
    .filter((row) => row.flowType === "Платежи")
    .reduce((sum, row) => sum + row.amount, 0);
  const expense = Math.abs(expenseRaw);

  return {
    income,
    expense,
    profit: income - expense,
  };
}

function usePeriodSelection(periodOptions: PeriodOption[]) {
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [hasInitializedPeriods, setHasInitializedPeriods] = useState(false);
  const periodRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const periodKeys = useMemo(() => periodOptions.map((option) => option.key), [periodOptions]);

  useEffect(() => {
    if (periodKeys.length === 0) return;
    setSelectedPeriods((current) => current.filter((key) => periodKeys.includes(key)));
  }, [periodKeys]);

  useEffect(() => {
    if (hasInitializedPeriods || periodOptions.length === 0) {
      return;
    }

    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const defaultKey = makePeriodKey(previousMonth);
    const fallbackKey = periodOptions[0]?.key;

    setSelectedPeriods(periodKeys.includes(defaultKey) ? [defaultKey] : fallbackKey ? [fallbackKey] : []);
    setHasInitializedPeriods(true);
  }, [hasInitializedPeriods, periodKeys, periodOptions]);

  useEffect(() => {
    if (selectedPeriods.length !== 1) {
      return;
    }

    periodRefs.current[selectedPeriods[0]]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [selectedPeriods]);

  return {
    selectedPeriods,
    setSelectedPeriods,
    activePeriods: selectedPeriods,
    periodRefs,
  };
}

function FilterChipGroup<T extends string | number>({
  label,
  options,
  selection,
  onChange,
  renderOption = (value) => String(value),
  className,
  compact = false,
  matchPeriodHeight = false,
  singleSelect = false,
  toggleSelect = false,
  allowSelectAll = false,
}: FilterChipGroupProps<T>) {
  const allSelected = options.length > 0 && selection.length === options.length;

  return (
    <div
      className={cn(
        "w-full rounded-lg border bg-muted/20 sm:w-fit",
        className,
        compact && matchPeriodHeight
          ? "min-h-[88px] p-2 pb-3"
          : matchPeriodHeight
            ? "min-h-[102px] p-2.5 pb-3"
            : compact
              ? "p-2"
              : "p-2.5",
      )}
    >
      <div className={cn("flex items-center justify-between gap-2", compact ? "mb-1" : "mb-1.5")}>
        <p className={cn("font-semibold", compact ? "text-xs" : "text-sm")}>{label}</p>
        <div className="flex items-center gap-1">
          {allowSelectAll && !singleSelect && options.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={cn(
                compact ? "h-5 px-1.5 text-[10px]" : "h-6 px-2 text-[11px]",
                allSelected
                  ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                  : "text-primary hover:bg-primary/5 hover:text-primary",
              )}
              onClick={() => onChange(options)}
            >
              Все
            </Button>
          )}
          {selection.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={cn(
                compact ? "h-5 px-1.5 text-[10px]" : "h-6 px-2 text-[11px]",
                "text-primary hover:bg-primary/5 hover:text-primary",
              )}
              onClick={() => onChange([])}
            >
              Сбросить
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selection.includes(option);

          return (
            <Button
              key={String(option)}
              type="button"
              size="sm"
              variant="outline"
              className={cn(FILTER_CHIP_BASE_CLASS, active && FILTER_CHIP_ACTIVE_CLASS)}
              onClick={(event) => {
                if (singleSelect) {
                  onChange(active ? [] : [option]);
                  return;
                }

                if (toggleSelect) {
                  onChange(getNextSelection(selection, option, true));
                  return;
                }

                onChange(getNextSelection(selection, option, event.ctrlKey || event.metaKey));
              }}
            >
              {renderOption(option)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function PeriodRangeSelector({
  fromPeriodKey,
  toPeriodKey,
  onFromChange,
  onToChange,
  onSelectAll,
  onClear,
  options,
}: PeriodRangeSelectorProps) {
  const orderedOptions = [...options].sort((a, b) => a.date.getTime() - b.date.getTime());
  const hasSelection = fromPeriodKey !== null || toPeriodKey !== null;

  return (
    <div className="w-full rounded-lg border bg-muted/20 p-2 sm:w-auto sm:min-w-[280px]">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Период</p>
        <div className="flex items-center gap-1">
          {orderedOptions.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px] text-primary hover:bg-primary/5 hover:text-primary"
              onClick={onSelectAll}
            >
              Все
            </Button>
          )}
          {hasSelection && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px] text-primary hover:bg-primary/5 hover:text-primary"
              onClick={onClear}
            >
              Сбросить
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">С</p>
          <Select value={fromPeriodKey ?? undefined} onValueChange={onFromChange}>
            <SelectTrigger className="h-9 w-full min-w-0 bg-background/85 sm:min-w-[136px]">
              <SelectValue placeholder="Начальный период" />
            </SelectTrigger>
            <SelectContent>
              {orderedOptions.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {formatPeriodRangeLabel(option.date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">По</p>
          <Select value={toPeriodKey ?? undefined} onValueChange={onToChange}>
            <SelectTrigger className="h-9 w-full min-w-0 bg-background/85 sm:min-w-[136px]">
              <SelectValue placeholder="Конечный период" />
            </SelectTrigger>
            <SelectContent>
              {orderedOptions.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {formatPeriodRangeLabel(option.date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function PeriodSelector({
  selection,
  onChange,
  options,
  refsMap,
  compact = false,
  allowSelectAll = true,
}: PeriodSelectorProps) {
  const allSelected = options.length > 0 && selection.length === options.length;

  return (
    <div className={cn("min-w-0 flex-1 rounded-lg border bg-muted/20", compact ? "p-2" : "p-2.5")}>
      <div className={cn("flex items-center justify-between gap-2", compact ? "mb-1" : "mb-1.5")}>
        <p className={cn("font-semibold", compact ? "text-xs" : "text-sm")}>Период</p>
        <div className="flex items-center gap-1">
          {allowSelectAll && options.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={cn(
                compact ? "h-5 px-1.5 text-[10px]" : "h-6 px-2 text-[11px]",
                allSelected
                  ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                  : "text-primary hover:bg-primary/5 hover:text-primary",
              )}
              onClick={() => onChange(options.map((option) => option.key))}
            >
              Все
            </Button>
          )}
          {selection.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={cn(
                compact ? "h-5 px-1.5 text-[10px]" : "h-6 px-2 text-[11px]",
                "text-primary hover:bg-primary/5 hover:text-primary",
              )}
              onClick={() => onChange([])}
            >
              Сбросить
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="w-full whitespace-nowrap pb-3">
        <div className={cn("flex gap-2", compact ? "pb-1.5" : "pb-2")}>
          {options.map((option) => {
            const active = selection.includes(option.key);

            return (
              <Button
                key={option.key}
                ref={(element) => {
                  refsMap.current[option.key] = element;
                }}
                type="button"
                size="sm"
                variant="outline"
                className={cn(FILTER_CHIP_BASE_CLASS, "shrink-0", active && FILTER_CHIP_ACTIVE_CLASS)}
                onClick={(event) =>
                  onChange(getNextSelection(selection, option.key, event.ctrlKey || event.metaKey))
                }
              >
                {option.label}
              </Button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

function KpiCard({ label, valueText, kind, changePct, comparisonText, changeText, tone = "primary" }: KpiCardProps) {
  const Icon = changePct === null ? Minus : changePct >= 0 ? ArrowUpRight : ArrowDownRight;
  const normalizedValueText = valueText.replace(/\s+₽$/, "₽");
  const toneClass =
    changePct === null
      ? "text-muted-foreground"
      : changePct >= 0
        ? "text-primary"
        : "text-destructive";

  const cardToneMap = {
    primary: "kpi-card-primary",
    accent: "kpi-card-accent",
    muted: "kpi-card-muted",
    secondary: "kpi-card-sky",
  };
  const cardToneClass = cardToneMap[tone];

  return (
    <div className={cn("kpi-card min-h-[94px] px-2.5 py-2.5", cardToneClass)}>
      <p className="text-sm font-semibold leading-none text-foreground">{label}</p>
      <p className="mt-1.5 whitespace-nowrap text-lg font-semibold leading-tight tracking-tight sm:text-xl">
        {normalizedValueText}
      </p>
      <div className="mt-1.5 min-w-0">
        <div className={cn("flex items-center gap-1 text-[13px] font-bold", toneClass)}>
          <Icon className="h-4 w-4 shrink-0" strokeWidth={2.6} />
          <span className="font-bold">
            {changeText || (changePct === null ? "n/a" : `${changePct > 0 ? "+" : ""}${Math.round(changePct)}%`)}
          </span>
        </div>
        <p
          className={cn(
            "mt-0.5 text-xs leading-tight whitespace-normal",
            kind === "profit" ? "text-foreground/70" : "text-muted-foreground",
          )}
        >
          {comparisonText}
        </p>
      </div>
    </div>
  );
}

function TransferKpiCard({ icon: Icon, label, value, subtitle, tone }: TransferKpiCardProps) {
  const toneMap = {
    primary: {
      cardClassName: "border-primary/20 bg-gradient-to-br from-primary/5 via-card to-background",
      iconClassName: "text-primary",
      valueClassName: "text-foreground",
    },
    accent: {
      cardClassName: "border-destructive/20 bg-gradient-to-br from-destructive/5 via-card to-background",
      iconClassName: "text-destructive",
      valueClassName: "text-destructive",
    },
    success: {
      cardClassName: "border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-card to-background",
      iconClassName: "text-emerald-600",
      valueClassName: "text-emerald-700",
    },
  } as const;

  const toneConfig = toneMap[tone];

  return (
    <div className={cn("rounded-xl border px-3 py-2 shadow-sm", toneConfig.cardClassName)}>
      <div className="flex items-start gap-2.5">
        <div className={cn("mt-0.5 rounded-lg bg-background/80 p-1.5 shadow-sm", toneConfig.iconClassName)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs leading-snug text-muted-foreground">{label}</p>
          <p
            className={cn(
              "mt-0.5 text-lg font-semibold leading-tight tracking-tight xl:text-xl",
              toneConfig.valueClassName,
            )}
          >
            {value}
          </p>
          {subtitle ? <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  );
}

function TransferPeriodCard({
  selectedPeriodKey,
  options,
  onChange,
}: {
  selectedPeriodKey: string | null;
  options: PeriodOption[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-background px-3 py-1.5 shadow-sm">
      <div className="flex h-full min-h-[60px] flex-col justify-center gap-1.5">
        <p className="text-[11px] leading-snug text-muted-foreground">Период</p>
        <Select value={selectedPeriodKey ?? undefined} onValueChange={(value) => onChange([value])}>
          <SelectTrigger className="h-8 w-full bg-background/90 text-left text-sm">
            <SelectValue placeholder="Выберите период" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function TransferMatrixCard({ title, periodLabel, summary, description }: TransferMatrixCardProps) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 px-4 py-2.5">
        <div>
          <CardTitle className="text-sm font-serif">{title}</CardTitle>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <div className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
          Период: {periodLabel}
        </div>
      </CardHeader>

      <CardContent className="px-0 pt-0">
        <Table className="min-w-[594px] table-fixed sm:min-w-max">
            <TableHeader>
              <TableRow>
                <TableHead
                  rowSpan={2}
                  className="sticky left-0 z-40 w-[128px] min-w-[128px] border-r border-border bg-muted px-3 py-2 text-left text-xs font-semibold leading-tight text-foreground shadow-[8px_0_10px_-8px_rgba(15,23,42,0.25)] sm:w-[140px] sm:min-w-[140px] sm:px-2.5 sm:py-2.5 sm:text-sm"
                >
                  Откуда ↓
                </TableHead>
                <TableHead
                  colSpan={summary.restaurants.length}
                  className="bg-muted px-2 py-2 text-center text-xs font-semibold text-foreground sm:py-2.5 sm:text-sm"
                >
                  Куда →
                </TableHead>
                <TableHead
                  rowSpan={2}
                  className="w-[112px] min-w-[112px] bg-muted px-2 py-2 text-right text-xs font-semibold leading-tight text-foreground sm:w-[112px] sm:min-w-[112px] sm:px-2 sm:py-2.5 sm:text-sm"
                >
                  Итого выдано
                </TableHead>
              </TableRow>
              <TableRow>
                {summary.restaurants.map((restaurant) => (
                  <TableHead
                    key={restaurant}
                    className="w-[118px] min-w-[118px] bg-muted px-2 py-2 text-center text-[10px] font-semibold leading-tight whitespace-nowrap text-foreground sm:w-[112px] sm:min-w-[112px] sm:px-2 sm:py-2.5 sm:text-sm"
                  >
                    {restaurant}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.rows.map((row) => (
                <TableRow key={row.restaurant}>
                  <TableCell className="sticky left-0 z-30 w-[128px] min-w-[128px] overflow-hidden border-r border-border bg-muted px-3 py-2 text-xs font-semibold leading-tight shadow-[8px_0_10px_-8px_rgba(15,23,42,0.25)] sm:w-[140px] sm:min-w-[140px] sm:px-2.5 sm:py-2.5 sm:text-sm">
                    {row.restaurant}
                  </TableCell>
                  {row.cells.map((cell) => {
                    const cellStyle = getTransferCellStyle(cell.amount, summary.maxMagnitude);
                    const displayAmount = roundTransferDisplayAmount(cell.amount);

                    return (
                      <TableCell
                        key={[row.restaurant, cell.restaurant].join("::")}
                        className={cn("w-[118px] min-w-[118px] px-2 py-2 text-right text-[10px] font-mono whitespace-nowrap sm:w-[112px] sm:min-w-[112px] sm:px-2 sm:py-2.5 sm:text-xs", cellStyle.className)}
                        style={cellStyle.style}
                      >
                        {formatCurrency(displayAmount)} ₽
                      </TableCell>
                    );
                  })}
                  <TableCell
                    className={cn(
                      "w-[112px] min-w-[112px] bg-muted/20 px-2 py-2 text-right text-[10px] font-mono font-semibold whitespace-nowrap sm:w-[112px] sm:min-w-[112px] sm:px-2 sm:py-2.5 sm:text-xs",
                      roundTransferDisplayAmount(row.totalOut) < 0 ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {formatCurrency(roundTransferDisplayAmount(row.totalOut))} ₽
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-muted/20 hover:bg-muted/30">
                <TableCell className="sticky left-0 z-40 w-[128px] min-w-[128px] overflow-hidden border-r border-border bg-muted px-3 py-2 text-xs font-bold shadow-[8px_0_10px_-8px_rgba(15,23,42,0.25)] sm:w-[140px] sm:min-w-[140px] sm:px-3 sm:py-2.5 sm:text-sm">
                  Итого получено
                </TableCell>
                {summary.columnTotals.map((amount, index) => (
                  <TableCell
                    key={summary.restaurants[index]}
                    className={cn(
                      "w-[118px] min-w-[118px] bg-muted/20 px-2 py-2 text-right text-[10px] font-mono font-bold whitespace-nowrap sm:w-[112px] sm:min-w-[112px] sm:px-2 sm:py-2.5 sm:text-xs",
                      roundTransferDisplayAmount(amount) < 0 ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {formatCurrency(roundTransferDisplayAmount(amount))} ₽
                  </TableCell>
                ))}
                <TableCell
                  className={cn(
                    "w-[112px] min-w-[112px] bg-muted/30 px-2 py-2 text-right text-[10px] font-mono font-bold whitespace-nowrap sm:w-[112px] sm:min-w-[112px] sm:px-2 sm:py-2.5 sm:text-xs",
                    roundTransferDisplayAmount(summary.grandTotal) < 0 ? "text-destructive" : "text-foreground",
                  )}
                >
                  {formatCurrency(roundTransferDisplayAmount(summary.grandTotal))} ₽
                </TableCell>
              </TableRow>
            </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}

function TransferTimelineChartCard({
  title,
  description,
  data,
}: {
  title: string;
  description?: string;
  data: TransferTimelineDatum[];
}) {
  const hasData = data.some((item) => item.amount !== 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-sm font-serif">{title}</CardTitle>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0">
        {hasData ? (
          <ChartContainer config={transferTimelineChartConfig} className="h-[220px] w-full sm:h-[260px]">
            <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                type="category"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
                interval={0}
                tickMargin={6}
              />
              <YAxis
                type="number"
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => formatCurrency(Math.abs(Number(value)))}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideIndicator
                    labelFormatter={(_, payload) =>
                      payload?.[0] && "payload" in payload[0]
                        ? (payload[0] as { payload?: { fullLabel?: string } }).payload?.fullLabel ?? ""
                        : ""
                    }
                    formatter={(value) => {
                      const numericValue = Number(value);
                      const amountText = `${formatCurrency(Math.abs(numericValue))} ₽`;

                      if (numericValue > 0) {
                        return [amountText, "Чисто получено"];
                      }

                      if (numericValue < 0) {
                        return [amountText, "Чисто отдано"];
                      }

                      return [amountText, "Без движения"];
                    }}
                  />
                }
              />
              <Bar dataKey="amount" radius={6}>
                {data.map((entry) => (
                  <Cell
                    key={entry.periodKey}
                    fill={entry.amount >= 0 ? "rgba(37, 99, 235, 0.8)" : "rgba(239, 68, 68, 0.8)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            Нет движений за выбранный период.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OwnersTimelineChartCard({
  data,
}: {
  data: OwnersTimelineDatum[];
}) {
  const hasData = data.some((item) => item.closing !== 0 || item.accrued !== 0 || item.paid !== 0);

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-sm font-serif">Динамика расчетов с собственниками</CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">Последние 6 месяцев до выбранного периода.</p>
      </CardHeader>

      <CardContent className="px-3 pb-3 pt-0 sm:px-4 sm:pb-4">
        {hasData ? (
          <ChartContainer config={ownersTimelineChartConfig} className="h-[190px] w-full sm:h-[280px]">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
                tickMargin={6}
                interval={0}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={74}
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => formatCurrency(roundMoneyDisplayAmount(Number(value)))}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) =>
                      payload?.[0] && "payload" in payload[0]
                        ? (payload[0] as { payload?: { fullLabel?: string } }).payload?.fullLabel ?? ""
                        : ""
                    }
                    formatter={(value, name) => {
                      const label =
                        typeof name === "string"
                          ? ownersTimelineChartConfig[name as keyof typeof ownersTimelineChartConfig]?.label ?? name
                          : String(name);

                      return [`${formatCurrency(roundMoneyDisplayAmount(Number(value)))} ₽`, String(label)];
                    }}
                  />
                }
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Line
                type="monotone"
                dataKey="closing"
                stroke="var(--color-closing)"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="paid"
                stroke="var(--color-paid)"
                strokeWidth={2}
                dot={{ r: 2.5 }}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="accrued"
                stroke="var(--color-accrued)"
                strokeWidth={2}
                dot={{ r: 2.5 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            Нет данных за выбранный период.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CashBreakdownCard({
  title,
  rows,
  total,
  footerNoteLabel,
  footerNoteAmount,
}: {
  title: string;
  rows: CashBreakdownRow[];
  total: number;
  footerNoteLabel?: string;
  footerNoteAmount?: number;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-sm font-serif">{title}</CardTitle>
      </CardHeader>

      <CardContent className="px-0 pt-0">
        <Table>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="px-4 py-2.5 text-sm">
                  <div>{row.label}</div>
                  {row.noteLabel ? (
                    <div className="mt-0.5 text-xs text-muted-foreground">{row.noteLabel}</div>
                  ) : null}
                </TableCell>
                <TableCell
                  className={cn(
                    "px-4 py-2.5 text-right text-sm font-mono font-medium whitespace-nowrap",
                    row.amount < 0 ? "text-destructive" : "text-foreground",
                  )}
                >
                  <div>{formatCurrency(roundMoneyDisplayAmount(row.amount))} ₽</div>
                  {typeof row.noteAmount === "number" ? (
                    <div
                      className={cn(
                        "mt-0.5 text-xs text-muted-foreground",
                        row.noteAmount < 0 && "text-destructive",
                      )}
                    >
                      {formatCurrency(roundMoneyDisplayAmount(row.noteAmount))} ₽
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-muted/50">
              <TableCell className="px-4 py-2.5 text-sm font-bold">Итого</TableCell>
              <TableCell
                className={cn(
                  "px-4 py-2.5 text-right text-sm font-mono font-bold whitespace-nowrap",
                  total < 0 ? "text-destructive" : "text-foreground",
                )}
              >
                {formatCurrency(roundMoneyDisplayAmount(total))} ₽
              </TableCell>
            </TableRow>
            {footerNoteLabel && typeof footerNoteAmount === "number" ? (
              <TableRow className="hover:bg-muted/30">
                <TableCell className="px-4 py-2 text-xs text-muted-foreground">{footerNoteLabel}</TableCell>
                <TableCell
                  className={cn(
                    "px-4 py-2 text-right text-xs font-mono whitespace-nowrap text-muted-foreground",
                    footerNoteAmount < 0 && "text-destructive",
                  )}
                >
                  {formatCurrency(roundMoneyDisplayAmount(footerNoteAmount))} ₽
                </TableCell>
              </TableRow>
            ) : null}
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}

function CashWaterfallChartCard({
  data,
  periodLabel,
}: {
  data: CashWaterfallDatum[];
  periodLabel: string;
}) {
  const hasMovement = data.some((item) => item.kind !== "total" && item.value !== 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-serif">Движение денег</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Из чего изменился остаток денег за выбранный период.
            </p>
          </div>
          <div className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            Период: {periodLabel}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-3 pb-3 pt-0 sm:px-4 sm:pb-4">
        <ChartContainer config={cashWaterfallChartConfig} className="h-[260px] w-full sm:h-[320px]">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              tickMargin={6}
              interval={0}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={78}
              tick={{ fontSize: 10 }}
              tickFormatter={(value) => formatCurrency(roundMoneyDisplayAmount(Number(value)))}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  hideLabel={false}
                  labelFormatter={(_, payload) =>
                    payload?.[0] && "payload" in payload[0]
                      ? (payload[0] as { payload?: { fullLabel?: string } }).payload?.fullLabel ?? ""
                      : ""
                  }
                  formatter={(_, __, item) => {
                    const payload = item?.payload as CashWaterfallDatum | undefined;

                    if (!payload) {
                      return ["—", "Значение"];
                    }

                    if (payload.kind === "total") {
                      return [`${formatCurrency(roundMoneyDisplayAmount(payload.total))} ₽`, "Остаток"];
                    }

                    const roundedDelta = roundMoneyDisplayAmount(payload.delta);
                    const amountText = `${roundedDelta > 0 ? "+" : ""}${formatCurrency(roundedDelta)} ₽`;
                    return [amountText, "Изменение"];
                  }}
                />
              }
            />
            <Bar dataKey="offset" stackId="cash-waterfall" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="value" stackId="cash-waterfall" radius={6} isAnimationActive={false}>
              {data.map((entry) => {
                const fill =
                  entry.kind === "total"
                    ? "rgba(37, 99, 235, 0.8)"
                    : entry.kind === "positive"
                      ? "rgba(22, 163, 74, 0.78)"
                      : "rgba(239, 68, 68, 0.8)";

                return <Cell key={entry.key} fill={fill} />;
              })}
            </Bar>
          </BarChart>
        </ChartContainer>

        {!hasMovement ? (
          <p className="mt-2 text-xs text-muted-foreground">
            За выбранный период нет движений, которые меняли денежный остаток.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StructureCard({
  title,
  rows,
  barClassName,
  footerLabel,
  footerValue,
  showBars = true,
  showShare = false,
}: StructureCardProps) {
  const maxMagnitude = rows.reduce((max, row) => Math.max(max, row.magnitude), 0);

  return (
    <Card>
      <CardHeader className="px-3 py-2.5">
        <CardTitle className="text-sm font-serif">{title}</CardTitle>
      </CardHeader>

      <CardContent className="px-3 pb-3 pt-0">
        {rows.length === 0 ? (
          <div className="py-6 text-sm text-muted-foreground">Нет данных по выбранному срезу.</div>
        ) : (
          <>
            <ScrollArea className="h-[220px] pr-3">
              <div className="space-y-2 pr-2">
                {rows.map((row) => (
                  <div
                    key={row.article}
                    className={cn(
                      "items-center gap-2",
                      showBars
                        ? "grid grid-cols-[minmax(0,1.45fr)_minmax(80px,1fr)_auto]"
                        : "grid grid-cols-[minmax(0,1fr)_auto]",
                    )}
                  >
                    <p className="truncate text-sm">{row.article}</p>
                    {showBars ? (
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full", barClassName)}
                          style={{ width: `${maxMagnitude === 0 ? 0 : Math.max((row.magnitude / maxMagnitude) * 100, 4)}%` }}
                        />
                      </div>
                    ) : null}
                    <div className="min-w-[112px] text-right text-sm">
                      <span className={cn("font-medium", row.value < 0 && "text-destructive")}>
                        {formatCurrency(roundMoneyDisplayAmount(row.value))} ₽
                      </span>
                      {showShare ? <span className="ml-2 text-xs text-muted-foreground">{Math.round(row.share)}%</span> : null}
                    </div>
                  </div>
                ))}
              </div>
              <ScrollBar />
            </ScrollArea>

            {typeof footerValue === "number" && footerLabel ? (
              <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm font-semibold">
                <span>{footerLabel}</span>
                <span>{formatCurrency(roundMoneyDisplayAmount(footerValue))} ₽</span>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function calculateRentability(metrics: MetricSummary) {
  if (metrics.income === 0) return 0;
  return (metrics.profit / metrics.income) * 100;
}

async function fetchAllRows<T>(tableName: "finance_flows" | "balance_fact" | "owners_fact") {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + ANALYTICS_PAGE_SIZE - 1;
    const { data, error } = await supabase.from(tableName).select("*").range(from, to);

    if (error) {
      throw error;
    }

    const batch = (data ?? []) as T[];
    rows.push(...batch);

    if (batch.length < ANALYTICS_PAGE_SIZE) {
      break;
    }

    from += ANALYTICS_PAGE_SIZE;
  }

  return rows;
}

function useOwnersFactRows(scope?: AnalyticsScopeConfig) {
  const { accessibleRestaurantNameSet, fixedOwnerNames } = useAnalyticsAccess(scope);
  const fixedOwnerNameSet = useMemo(() => new Set(fixedOwnerNames), [fixedOwnerNames]);

  const { data: owners = [], isLoading } = useQuery({
    queryKey: ["owners_fact"],
    queryFn: async () => {
      return fetchAllRows<OwnersFact>("owners_fact");
    },
  });

  const ownerRows = useMemo<OwnersFactRow[]>(
    () =>
      owners
        .map((row) => {
          const periodDate = parsePeriodDate(row["Период"]);
          const owner = row["Псевдо"] || "";
          const article = row["Группа"] || "Без статьи";

          if (!periodDate || !OWNER_OPTIONS.includes(owner as (typeof OWNER_OPTIONS)[number])) {
            return null;
          }

          const normalizedAmounts = normalizeOwnersFactAmounts(
            article,
            parseTextNumeric(row["Начислено"]),
            parseTextNumeric(row["Оплачено"]),
            parseTextNumeric(row["Движение"]),
          );

          return {
            id: row.id,
            restaurant: row["Ресторан"] || "Без ресторана",
            periodDate,
            periodKey: makePeriodKey(periodDate),
            owner,
            article,
            accrued: normalizedAmounts.accrued,
            paid: normalizedAmounts.paid,
            net: normalizedAmounts.net,
          };
        })
        .filter((row): row is OwnersFactRow => row !== null)
        .filter((row) => accessibleRestaurantNameSet.has(row.restaurant))
        .filter((row) => fixedOwnerNameSet.size === 0 || fixedOwnerNameSet.has(row.owner)),
    [accessibleRestaurantNameSet, fixedOwnerNameSet, owners],
  );

  return { ownerRows, isLoading };
}

function buildOwnersAuditRows(ownerRows: OwnersFactRow[]) {
  if (ownerRows.length === 0) return [] as OwnersAuditRow[];

  const groupMap = new Map<string, OwnersFactRow[]>();

  ownerRows.forEach((row) => {
    const key = [row.restaurant, row.owner, row.article].join("\u0001");
    const bucket = groupMap.get(key);

    if (bucket) {
      bucket.push(row);
    } else {
      groupMap.set(key, [row]);
    }
  });

  return Array.from(groupMap.entries())
    .flatMap(([key, rows]) => {
      const [restaurant, owner, article] = key.split("\u0001");
      const monthMap = new Map<
        string,
        {
          periodDate: Date;
          accrued: number;
          paid: number;
          sourceNet: number;
          sourceRowCount: number;
        }
      >();

      rows.forEach((row) => {
        const existing = monthMap.get(row.periodKey);

        if (existing) {
          existing.accrued += row.accrued;
          existing.paid += row.paid;
          existing.sourceNet += row.net;
          existing.sourceRowCount += 1;
          return;
        }

        monthMap.set(row.periodKey, {
          periodDate: new Date(row.periodDate.getFullYear(), row.periodDate.getMonth(), 1),
          accrued: row.accrued,
          paid: row.paid,
          sourceNet: row.net,
          sourceRowCount: 1,
        });
      });

      const activeMonths = Array.from(monthMap.values()).sort((a, b) => a.periodDate.getTime() - b.periodDate.getTime());
      if (activeMonths.length === 0) return [];

      let opening = 0;

      return enumerateMonths(activeMonths[0].periodDate, activeMonths[activeMonths.length - 1].periodDate).map(
        (periodDate) => {
          const periodKey = makePeriodKey(periodDate);
          const sourceMonth = monthMap.get(periodKey);
          const accrued = sourceMonth?.accrued ?? 0;
          const paid = sourceMonth?.paid ?? 0;
          const sourceNet = sourceMonth?.sourceNet ?? 0;
          const closing = calculateOwnersClosing(article, opening, accrued, paid);
          const sourceClosing = opening + sourceNet;
          const delta = closing - sourceClosing;

          const auditRow = {
            restaurant,
            owner,
            article,
            periodDate,
            periodKey,
            opening,
            accrued,
            paid,
            sourceNet,
            closing,
            sourceClosing,
            delta,
            sourceRowCount: sourceMonth?.sourceRowCount ?? 0,
            hasSourceRow: Boolean(sourceMonth),
            isSyntheticGap: !sourceMonth,
            hasMismatch: !isNearlyZero(delta),
          };

          opening = sourceClosing;
          return auditRow;
        },
      );
    })
    .sort((a, b) => {
      const restaurantCompare = a.restaurant.localeCompare(b.restaurant, "ru");
      if (restaurantCompare !== 0) return restaurantCompare;

      const ownerCompare = a.owner.localeCompare(b.owner, "ru");
      if (ownerCompare !== 0) return ownerCompare;

      const articleCompare = a.article.localeCompare(b.article, "ru");
      if (articleCompare !== 0) return articleCompare;

      return a.periodDate.getTime() - b.periodDate.getTime();
    });
}

function FinancialResultTab({ scope }: { scope?: AnalyticsScopeConfig }) {
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([]);
  const {
    accessibleRestaurantNames,
    accessibleRestaurantNameSet,
    preferredRestaurantSelection,
    fixedRestaurantNames,
  } = useAnalyticsAccess(scope);

  const { data: flows = [], isLoading: flowsLoading } = useQuery({
    queryKey: ["finance_flows"],
    queryFn: async () => {
      return fetchAllRows<FinanceFlow>("finance_flows");
    },
  });

  const { data: balances = [], isLoading: balancesLoading } = useQuery({
    queryKey: ["balance_fact"],
    queryFn: async () => {
      return fetchAllRows<BalanceFact>("balance_fact");
    },
  });

  const flowRows = useMemo<FinancialFlowRow[]>(
    () =>
      flows
        .map((row) => {
          const periodDate = parsePeriodDate(row["Период"]);
          if (!periodDate) return null;

          return {
            id: row.id,
            restaurant: row["Ресторан"] || "Без ресторана",
            periodDate,
            periodKey: makePeriodKey(periodDate),
            flowType: row["Поток"] || "",
            finType: row["ФинТип"] || "",
            article: row["СтатьяKey"] || "Без статьи",
            amount: parseTextNumeric(row["Сумма"]),
            isOperationalExpense: row["IsOpExp"] === "1",
          };
        })
        .filter((row): row is FinancialFlowRow => row !== null)
        .filter((row) => accessibleRestaurantNameSet.has(row.restaurant)),
    [accessibleRestaurantNameSet, flows],
  );

  const balanceRows = useMemo<BalanceFactRow[]>(
    () =>
      balances
        .map((row) => {
          const periodDate = parsePeriodDate(row["Период"]);
          if (!periodDate) return null;

          return {
            id: row.id,
            restaurant: row["Ресторан"] || "Без ресторана",
            periodDate,
            periodKey: makePeriodKey(periodDate),
            balanceType: row["БалансТип"] || "",
            article: normalizeBalanceArticle(row["СтатьяKey"] || "Без статьи"),
            amount: parseTextNumeric(row["Сумма"]),
          };
        })
        .filter((row): row is BalanceFactRow => row !== null)
        .filter((row) => accessibleRestaurantNameSet.has(row.restaurant)),
    [accessibleRestaurantNameSet, balances],
  );

  const restaurantOptions = useMemo(
    () =>
      getUniqueValues([...accessibleRestaurantNames, ...flowRows.map((row) => row.restaurant), ...balanceRows.map((row) => row.restaurant)]).sort((a, b) =>
        a.localeCompare(b, "ru"),
      ),
    [accessibleRestaurantNames, balanceRows, flowRows],
  );

  const periodOptions = useMemo(
    () => buildPeriodOptions([...flowRows.map((row) => row.periodDate), ...balanceRows.map((row) => row.periodDate)]),
    [balanceRows, flowRows],
  );

  useInitializeSingleSelection({
    selection: selectedRestaurants,
    options: restaurantOptions,
    onChange: setSelectedRestaurants,
    preferredOption: preferredRestaurantSelection[0] ?? null,
  });

  const { selectedPeriods, setSelectedPeriods, activePeriods, periodRefs } = usePeriodSelection(periodOptions);
  const activeRestaurants = useMemo(
    () => resolveScopedSelection(selectedRestaurants, restaurantOptions, fixedRestaurantNames),
    [fixedRestaurantNames, restaurantOptions, selectedRestaurants],
  );

  const filteredFlowRows = useMemo(
    () =>
      flowRows.filter(
        (row) => activeRestaurants.includes(row.restaurant) && activePeriods.includes(row.periodKey),
      ),
    [activePeriods, activeRestaurants, flowRows],
  );

  const balanceSnapshotDate = useMemo(() => {
    if (activePeriods.length === 0) return null;

    const activePeriodSet = new Set(activePeriods);
    return periodOptions
      .filter((option) => activePeriodSet.has(option.key))
      .reduce<Date | null>(
        (latest, option) =>
          latest === null || option.date.getTime() > latest.getTime() ? option.date : latest,
        null,
      );
  }, [activePeriods, periodOptions]);

  const accumulatedBalanceRows = useMemo(() => {
    if (!balanceSnapshotDate) return [];

    const nextMonthStart = new Date(
      balanceSnapshotDate.getFullYear(),
      balanceSnapshotDate.getMonth() + 1,
      1,
    );

    return balanceRows.filter(
      (row) =>
        activeRestaurants.includes(row.restaurant) &&
        row.periodDate.getTime() < nextMonthStart.getTime(),
    );
  }, [activeRestaurants, balanceRows, balanceSnapshotDate]);

  const comparisonPeriodKeys = useMemo(
    () => getPreviousYearPeriodKeys(selectedPeriods, periodOptions),
    [periodOptions, selectedPeriods],
  );

  const previousFlowRows = useMemo(() => {
    if (!comparisonPeriodKeys) return [];

    return flowRows.filter(
      (row) => activeRestaurants.includes(row.restaurant) && comparisonPeriodKeys.includes(row.periodKey),
    );
  }, [activeRestaurants, comparisonPeriodKeys, flowRows]);

  const currentMetrics = useMemo(() => summarizeFinancialMetrics(filteredFlowRows), [filteredFlowRows]);
  const previousMetrics = useMemo(() => summarizeFinancialMetrics(previousFlowRows), [previousFlowRows]);
  const currentRentability = useMemo(() => calculateRentability(currentMetrics), [currentMetrics]);
  const previousRentability = useMemo(() => calculateRentability(previousMetrics), [previousMetrics]);
  const hasComparisonData = comparisonPeriodKeys !== null && previousFlowRows.length > 0;

  const comparisonText = useMemo(() => {
    if (selectedPeriods.length === 0) return "выберите период";
    return getYearComparisonLabel(selectedPeriods, periodOptions);
  }, [periodOptions, selectedPeriods]);

  const assetRowsRaw = useMemo(
    () => buildStructureRows(accumulatedBalanceRows.filter((row) => row.balanceType === "Актив")),
    [accumulatedBalanceRows],
  );
  const liabilityRowsRaw = useMemo(
    () => buildStructureRows(accumulatedBalanceRows.filter((row) => row.balanceType === "Обязательство")),
    [accumulatedBalanceRows],
  );
  const assetRows = useMemo(
    () => assetRowsRaw.filter((row) => row.magnitude >= 50),
    [assetRowsRaw],
  );
  const liabilityRows = useMemo(
    () => liabilityRowsRaw.filter((row) => row.magnitude >= 50),
    [liabilityRowsRaw],
  );
  const expenseStructureRows = useMemo(
    () =>
      buildStructureRows(
        filteredFlowRows
          .filter((row) => row.finType === "Операционная" && row.isOperationalExpense)
          .map((row) => ({ article: row.article, amount: row.amount })),
        { absoluteDisplay: true },
      ),
    [filteredFlowRows],
  );

  const expenseStructureTotal = useMemo(
    () => expenseStructureRows.reduce((sum, row) => sum + row.value, 0),
    [expenseStructureRows],
  );
  const assetStructureTotal = useMemo(
    () => assetRowsRaw.reduce((sum, row) => sum + row.value, 0),
    [assetRowsRaw],
  );
  const liabilityStructureTotal = useMemo(
    () => liabilityRowsRaw.reduce((sum, row) => sum + row.value, 0),
    [liabilityRowsRaw],
  );

  const kpiCards: Array<{
    label: string;
    kind: MetricKind;
    valueText: string;
    changePct: number | null;
    changeText?: string;
    tone: "primary" | "accent" | "muted" | "secondary";
  }> = [
    {
      label: "Доход",
      kind: "income",
      valueText: `${formatCurrency(roundMoneyDisplayAmount(currentMetrics.income))} ₽`,
      changePct: hasComparisonData ? getChangePercent(currentMetrics.income, previousMetrics.income) : null,
      changeText: hasComparisonData ? undefined : "нет данных",
      tone: "primary",
    },
    {
      label: "Расход",
      kind: "expense",
      valueText: `${formatCurrency(roundMoneyDisplayAmount(currentMetrics.expense))} ₽`,
      changePct: hasComparisonData ? getChangePercent(currentMetrics.expense, previousMetrics.expense) : null,
      changeText: hasComparisonData ? undefined : "нет данных",
      tone: "accent",
    },
    {
      label: "Прибыль",
      kind: "profit",
      valueText: `${formatCurrency(roundMoneyDisplayAmount(currentMetrics.profit))} ₽`,
      changePct: hasComparisonData ? getChangePercent(currentMetrics.profit, previousMetrics.profit) : null,
      changeText: hasComparisonData ? undefined : "нет данных",
      tone: "secondary",
    },
    {
      label: "Рентабельность",
      kind: "profit",
      valueText: `${Math.round(currentRentability)}%`,
      changePct:
        hasComparisonData && previousMetrics.income !== 0 ? currentRentability - previousRentability : null,
      tone: "muted",
      changeText:
        !hasComparisonData
          ? "нет данных"
          : previousMetrics.income === 0
            ? "нет данных"
          : `${currentRentability - previousRentability > 0 ? "+" : ""}${Math.round(currentRentability - previousRentability)} п.п.`,
    },
  ];

  const isLoading = flowsLoading || balancesLoading;

  return (
    <div className="space-y-3">
      <div className="grid items-start gap-2 xl:grid-cols-[minmax(0,1.05fr)_minmax(480px,1fr)]">
        <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/3 via-card to-accent/3">
          <CardContent className="flex flex-wrap items-start gap-2 px-3 py-3">
            {!scope?.hideRestaurantFilter && (
              <FilterChipGroup
                label="Рестораны"
                options={restaurantOptions}
                selection={selectedRestaurants}
                onChange={setSelectedRestaurants}
                matchPeriodHeight
                allowSelectAll
                compact
              />
            )}
            <PeriodSelector
              selection={selectedPeriods}
              onChange={setSelectedPeriods}
              options={periodOptions}
              refsMap={periodRefs}
              compact
            />
          </CardContent>
        </Card>

        <div className="grid gap-2 self-start sm:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((metric) => (
            <KpiCard
              key={metric.label}
              label={metric.label}
              valueText={metric.valueText}
              kind={metric.kind}
              changePct={metric.changePct}
              comparisonText={comparisonText}
              changeText={metric.changeText}
              tone={metric.tone}
            />
          ))}
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Загрузка...</CardContent>
        </Card>
      ) : flowRows.length === 0 && balanceRows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Нет данных для построения финансового результата.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.2fr)]">
          <StructureCard
            title="Структура активов"
            rows={assetRows}
            barClassName="bg-primary"
            footerLabel="Итого"
            footerValue={assetStructureTotal}
            showBars={false}
          />
          <StructureCard
            title="Структура обязательств"
            rows={liabilityRows}
            barClassName="bg-coral"
            footerLabel="Итого"
            footerValue={liabilityStructureTotal}
            showBars={false}
          />
          <StructureCard
            title="Структура расходов"
            rows={expenseStructureRows}
            barClassName="bg-primary"
            footerLabel="Итого"
            footerValue={expenseStructureTotal}
            showBars
            showShare
          />
        </div>
      )}
    </div>
  );
}

function CashMovementTab({ scope }: { scope?: AnalyticsScopeConfig }) {
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([]);
  const {
    accessibleRestaurantNames,
    accessibleRestaurantNameSet,
    preferredRestaurantSelection,
    fixedRestaurantNames,
  } = useAnalyticsAccess(scope);

  const { data: flows = [], isLoading: flowsLoading } = useQuery({
    queryKey: ["finance_flows"],
    queryFn: async () => {
      return fetchAllRows<FinanceFlow>("finance_flows");
    },
  });

  const { data: balances = [], isLoading: balancesLoading } = useQuery({
    queryKey: ["balance_fact"],
    queryFn: async () => {
      return fetchAllRows<BalanceFact>("balance_fact");
    },
  });
  const { data: owners = [], isLoading: ownersLoading } = useQuery({
    queryKey: ["owners_fact"],
    queryFn: async () => {
      return fetchAllRows<OwnersFact>("owners_fact");
    },
  });

  const flowRows = useMemo<FinancialFlowRow[]>(
    () =>
      flows
        .map((row) => {
          const periodDate = parsePeriodDate(row["Период"]);
          if (!periodDate) return null;

          return {
            id: row.id,
            restaurant: row["Ресторан"] || "Без ресторана",
            periodDate,
            periodKey: makePeriodKey(periodDate),
            flowType: row["Поток"] || "",
            finType: row["ФинТип"] || "",
            article: row["СтатьяKey"] || "Без статьи",
            amount: parseTextNumeric(row["Сумма"]),
            isOperationalExpense: row["IsOpExp"] === "1",
          };
        })
        .filter((row): row is FinancialFlowRow => row !== null)
        .filter((row) => accessibleRestaurantNameSet.has(row.restaurant)),
    [accessibleRestaurantNameSet, flows],
  );

  const ownerRows = useMemo(
    () =>
      owners
        .map((row) => {
          const periodDate = parsePeriodDate(row["Период"]);
          const restaurant = row["Ресторан"]?.trim() ?? "";
          const owner = row["Псевдо"]?.trim() ?? "";
          const article = row["Группа"]?.trim() ?? "";

          if (!periodDate || !restaurant || !owner || !article) {
            return null;
          }

          return {
            id: row.id,
            restaurant,
            owner,
            article,
            periodDate,
            periodKey: makePeriodKey(periodDate),
            amount: parseTextNumeric(row["Движение"]),
          };
        })
        .filter(
          (
            row,
          ): row is {
            id: string;
            restaurant: string;
            owner: string;
            article: string;
            periodDate: Date;
            periodKey: string;
            amount: number;
          } => row !== null && accessibleRestaurantNameSet.has(row.restaurant),
        ),
    [accessibleRestaurantNameSet, owners],
  );

  const balanceRows = useMemo<BalanceFactRow[]>(
    () =>
      balances
        .map((row) => {
          const periodDate = parsePeriodDate(row["Период"]);
          if (!periodDate) return null;

          return {
            id: row.id,
            restaurant: row["Ресторан"] || "Без ресторана",
            periodDate,
            periodKey: makePeriodKey(periodDate),
            balanceType: row["БалансТип"] || "",
            article: normalizeBalanceArticle(row["СтатьяKey"] || "Без статьи"),
            amount: parseTextNumeric(row["Сумма"]),
          };
        })
        .filter((row): row is BalanceFactRow => row !== null)
        .filter((row) => accessibleRestaurantNameSet.has(row.restaurant)),
    [accessibleRestaurantNameSet, balances],
  );

  const restaurantOptions = useMemo(
    () =>
      getUniqueValues([
        ...accessibleRestaurantNames,
        ...flowRows.map((row) => row.restaurant),
        ...balanceRows.map((row) => row.restaurant),
      ]).sort((a, b) => a.localeCompare(b, "ru")),
    [accessibleRestaurantNames, balanceRows, flowRows],
  );

  const periodOptions = useMemo(
    () => buildPeriodOptions([...flowRows.map((row) => row.periodDate), ...balanceRows.map((row) => row.periodDate)]),
    [balanceRows, flowRows],
  );

  useInitializeSingleSelection({
    selection: selectedRestaurants,
    options: restaurantOptions,
    onChange: setSelectedRestaurants,
    preferredOption: preferredRestaurantSelection[0] ?? null,
  });

  const { selectedPeriods, setSelectedPeriods, activePeriods, periodRefs } = usePeriodSelection(periodOptions);
  const activeRestaurants = useMemo(
    () => resolveScopedSelection(selectedRestaurants, restaurantOptions, fixedRestaurantNames),
    [fixedRestaurantNames, restaurantOptions, selectedRestaurants],
  );

  const filteredFlowRows = useMemo(
    () =>
      flowRows.filter(
        (row) => activeRestaurants.includes(row.restaurant) && activePeriods.includes(row.periodKey),
      ),
    [activePeriods, activeRestaurants, flowRows],
  );

  const selectedRangeOptions = useMemo(
    () =>
      periodOptions
        .filter((option) => activePeriods.includes(option.key))
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [activePeriods, periodOptions],
  );

  const rangeStartDate = selectedRangeOptions[0]?.date ?? null;
  const rangeEndDate = selectedRangeOptions[selectedRangeOptions.length - 1]?.date ?? null;

  const rangeLabel = useMemo(() => {
    if (selectedRangeOptions.length === 0) return "—";
    if (selectedRangeOptions.length === 1) return selectedRangeOptions[0].label;
    return `${selectedRangeOptions[0].label} - ${selectedRangeOptions[selectedRangeOptions.length - 1].label}`;
  }, [selectedRangeOptions]);

  const openingBalanceRows = useMemo(() => {
    if (!rangeStartDate) return [];

    return balanceRows.filter(
      (row) => activeRestaurants.includes(row.restaurant) && row.periodDate.getTime() < rangeStartDate.getTime(),
    );
  }, [activeRestaurants, balanceRows, rangeStartDate]);

  const closingBalanceRows = useMemo(() => {
    if (!rangeEndDate) return [];

    const nextMonthStart = new Date(rangeEndDate.getFullYear(), rangeEndDate.getMonth() + 1, 1);
    return balanceRows.filter(
      (row) =>
        activeRestaurants.includes(row.restaurant) &&
        row.periodDate.getTime() < nextMonthStart.getTime(),
    );
  }, [activeRestaurants, balanceRows, rangeEndDate]);

  const openingCashRows = useMemo(
    () => buildCashBreakdownRows(openingBalanceRows, CASH_ACCOUNT_GROUPS),
    [openingBalanceRows],
  );
  const closingCashRows = useMemo(
    () => buildCashBreakdownRows(closingBalanceRows, CASH_ACCOUNT_GROUPS),
    [closingBalanceRows],
  );
  const requiredPaymentRows = useMemo(
    () =>
      buildCashBreakdownRows(
        closingBalanceRows.filter((row) => row.balanceType === "Обязательство"),
        CASH_REQUIRED_PAYMENT_GROUPS,
      ),
    [closingBalanceRows],
  );

  const openingCashTotal = useMemo(
    () => openingCashRows.reduce((sum, row) => sum + row.amount, 0),
    [openingCashRows],
  );
  const closingCashTotal = useMemo(
    () => closingCashRows.reduce((sum, row) => sum + row.amount, 0),
    [closingCashRows],
  );
  const requiredPaymentTotal = useMemo(
    () => requiredPaymentRows.reduce((sum, row) => sum + row.amount, 0),
    [requiredPaymentRows],
  );
  const remainingAfterPayments = closingCashTotal - requiredPaymentTotal;
  const ownerNames = useMemo(() => OWNER_OPTIONS.map((owner) => normalizeLookupText(owner)), []);
  const ownerWithdrawalTotal = useMemo(() => {
    if (!rangeEndDate) return 0;

    const nextMonthStart = new Date(rangeEndDate.getFullYear(), rangeEndDate.getMonth() + 1, 1);

    return ownerRows
      .filter(
        (row) =>
          activeRestaurants.includes(row.restaurant) &&
          row.periodDate.getTime() < nextMonthStart.getTime() &&
          matchesArticleAlias(row.article, CASH_OWNER_WITHDRAWAL_GROUP_ALIASES) &&
          ownerNames.includes(normalizeLookupText(row.owner)),
      )
      .reduce((sum, row) => sum + row.amount, 0);
  }, [activeRestaurants, ownerNames, ownerRows, rangeEndDate]);
  const closingCashRowsWithOwnerNote = useMemo(
    () =>
      closingCashRows.map((row) =>
        row.label === "Снятие с р/с"
          ? {
              ...row,
              noteLabel: "в т.ч перевели собственникам",
              noteAmount: ownerWithdrawalTotal,
            }
          : row,
      ),
    [closingCashRows, ownerWithdrawalTotal],
  );
  const visibleClosingCashRows = useMemo(
    () => closingCashRowsWithOwnerNote.filter((row) => Math.abs(row.amount) >= 50),
    [closingCashRowsWithOwnerNote],
  );
  const closingCashTotalWithoutOwners = closingCashTotal - ownerWithdrawalTotal;

  const cashMovementBreakdown = useMemo(() => {
    let income = 0;
    let expense = 0;
    let dividends = 0;
    let otherInflows = 0;
    let otherOutflows = 0;

    filteredFlowRows.forEach((row) => {
      if (matchesArticleAlias(row.article, CASH_DIVIDEND_ARTICLE_ALIASES)) {
        dividends += row.amount;
        return;
      }

      if (row.finType === "Операционная" && row.flowType === "Поступления") {
        income += row.amount;
        return;
      }

      if (row.finType === "Операционная" && row.flowType === "Платежи") {
        expense += Math.abs(row.amount);
        return;
      }

      if (matchesArticleAlias(row.article, CASH_EXPLICIT_OTHER_INFLOW_ALIASES)) {
        otherInflows += row.amount;
        return;
      }

      if (matchesArticleAlias(row.article, CASH_EXPLICIT_OTHER_OUTFLOW_ALIASES)) {
        otherOutflows += row.amount;
        return;
      }

      if (row.amount > 0) {
        otherInflows += row.amount;
      } else if (row.amount < 0) {
        otherOutflows += row.amount;
      }
    });

    const classifiedDelta = income - expense + dividends + otherInflows + otherOutflows;
    const targetDelta = closingCashTotal - openingCashTotal;
    const residualDelta = targetDelta - classifiedDelta;

    if (!isNearlyZero(residualDelta)) {
      if (residualDelta > 0) {
        otherInflows += residualDelta;
      } else {
        otherOutflows += residualDelta;
      }
    }

    return {
      income,
      expense,
      dividends,
      otherInflows,
      otherOutflows,
    };
  }, [closingCashTotal, filteredFlowRows, openingCashTotal]);

  const waterfallData = useMemo(
    () =>
      buildCashWaterfallData({
        openingTotal: openingCashTotal,
        closingTotal: closingCashTotal,
        income: cashMovementBreakdown.income,
        expense: cashMovementBreakdown.expense,
        dividends: cashMovementBreakdown.dividends,
        otherInflows: cashMovementBreakdown.otherInflows,
        otherOutflows: cashMovementBreakdown.otherOutflows,
      }),
    [cashMovementBreakdown, closingCashTotal, openingCashTotal],
  );

  const isLoading = flowsLoading || balancesLoading || ownersLoading;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">Загрузка...</CardContent>
      </Card>
    );
  }

  if (flowRows.length === 0 && balanceRows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Нет данных для построения отчета по движению денег.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/3 via-card to-accent/3">
        <CardContent className="space-y-3 px-3 py-3">
          <div className="grid items-start gap-2 xl:grid-cols-[minmax(0,1.05fr)_minmax(460px,1fr)]">
            <div className="flex flex-wrap items-start gap-2">
              {!scope?.hideRestaurantFilter && (
                <FilterChipGroup
                  label="Рестораны"
                  options={restaurantOptions}
                  selection={selectedRestaurants}
                  onChange={setSelectedRestaurants}
                  matchPeriodHeight
                  allowSelectAll
                  compact
                />
              )}
              <PeriodSelector
                selection={selectedPeriods}
                onChange={setSelectedPeriods}
                options={periodOptions}
                refsMap={periodRefs}
                compact
                allowSelectAll={false}
              />
            </div>

            <div className="grid gap-2 self-start sm:grid-cols-2 xl:grid-cols-3">
              <TransferKpiCard
                icon={ArrowLeftRight}
                label="Денег всего"
                value={`${formatCurrency(roundMoneyDisplayAmount(closingCashTotal))} ₽`}
                subtitle={`на конец ${rangeLabel}`}
                tone="primary"
              />
              <TransferKpiCard
                icon={ArrowDownRight}
                label="Нужно заплатить"
                value={`${formatCurrency(roundMoneyDisplayAmount(requiredPaymentTotal))} ₽`}
                subtitle="обязательные выплаты"
                tone={requiredPaymentTotal > 0 ? "accent" : "success"}
              />
              <TransferKpiCard
                icon={ArrowUpRight}
                label="Остаток после выплат"
                value={`${formatCurrency(roundMoneyDisplayAmount(remainingAfterPayments))} ₽`}
                tone={remainingAfterPayments < 0 ? "accent" : "success"}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
        <div className="grid gap-3">
          <CashBreakdownCard
            title="Денег всего"
            rows={visibleClosingCashRows}
            total={closingCashTotal}
            footerNoteLabel="без учета собственников"
            footerNoteAmount={closingCashTotalWithoutOwners}
          />
          <CashBreakdownCard
            title="Обязательные выплаты"
            rows={requiredPaymentRows}
            total={requiredPaymentTotal}
          />
        </div>

        <CashWaterfallChartCard data={waterfallData} periodLabel={rangeLabel} />
      </div>
    </div>
  );
}

function TransfersTab({ scope }: { scope?: AnalyticsScopeConfig }) {
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const { accessibleRestaurantNames, accessibleRestaurantNameSet } = useAnalyticsAccess(scope);

  const { data: owners = [], isLoading } = useQuery({
    queryKey: ["owners_fact"],
    queryFn: async () => {
      return fetchAllRows<OwnersFact>("owners_fact");
    },
  });

  const transferCandidates = useMemo(
    () =>
      owners
        .map((row) => {
          const periodDate = parsePeriodDate(row["Период"]);
          const lenderRestaurant = row["Ресторан"]?.trim() ?? "";
          const recipientRestaurant = row["Псевдо"]?.trim() ?? "";
          const groupKey = normalizeLookupText(row["Группа"]);

          if (
            !periodDate ||
            !lenderRestaurant ||
            !recipientRestaurant ||
            lenderRestaurant === recipientRestaurant
          ) {
            return null;
          }

          return {
            id: row.id,
            lenderRestaurant,
            recipientRestaurant,
            periodDate,
            periodKey: makePeriodKey(periodDate),
            amount: parseTextNumeric(row["Движение"]),
            groupKey,
          };
        })
        .filter(
          (
            row,
          ): row is IntragroupTransferRow & {
            groupKey: string;
          } =>
            row !== null &&
            accessibleRestaurantNameSet.has(row.lenderRestaurant) &&
            accessibleRestaurantNameSet.has(row.recipientRestaurant),
        ),
    [accessibleRestaurantNameSet, owners],
  );

  const canonicalTransferRows = useMemo(
    () => transferCandidates.filter((row) => row.groupKey === CANONICAL_INTRAGROUP_TRANSFER_GROUP),
    [transferCandidates],
  );
  const legacyTransferRows = useMemo(
    () => transferCandidates.filter((row) => row.groupKey === LEGACY_INTRAGROUP_TRANSFER_GROUP),
    [transferCandidates],
  );
  const usingLegacyTransferGroup = canonicalTransferRows.length === 0 && legacyTransferRows.length > 0;

  const transferRows = useMemo(
    () =>
      (canonicalTransferRows.length > 0 ? canonicalTransferRows : legacyTransferRows).map(
        ({ groupKey: _groupKey, ...row }) => row,
      ),
    [canonicalTransferRows, legacyTransferRows],
  );

  const restaurants = useMemo(
    () =>
      getUniqueValues([
        ...accessibleRestaurantNames,
        ...transferRows.map((row) => row.lenderRestaurant),
        ...transferRows.map((row) => row.recipientRestaurant),
      ]).sort((a, b) => a.localeCompare(b, "ru")),
    [accessibleRestaurantNames, transferRows],
  );

  const periodOptions = useMemo(() => buildPeriodOptions(transferRows.map((row) => row.periodDate)), [transferRows]);
  const periodKeys = useMemo(() => periodOptions.map((option) => option.key), [periodOptions]);
  const defaultPeriodKey = useMemo(() => {
    const now = new Date();
    const previousMonthKey = makePeriodKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    return periodKeys.includes(previousMonthKey) ? previousMonthKey : periodKeys[0] ?? null;
  }, [periodKeys]);

  useInitializeSingleSelection({
    selection: selectedPeriods,
    options: periodKeys,
    onChange: setSelectedPeriods,
    preferredOption: defaultPeriodKey,
  });

  const selectedPeriodKey = selectedPeriods[0] ?? null;
  const selectedPeriodOption = useMemo(
    () => periodOptions.find((option) => option.key === selectedPeriodKey) ?? null,
    [periodOptions, selectedPeriodKey],
  );

  const monthlyRows = useMemo(
    () => (selectedPeriodKey ? transferRows.filter((row) => row.periodKey === selectedPeriodKey) : []),
    [selectedPeriodKey, transferRows],
  );
  const accumulatedRows = useMemo(
    () =>
      selectedPeriodOption
        ? transferRows.filter((row) => row.periodDate.getTime() <= selectedPeriodOption.date.getTime())
        : [],
    [selectedPeriodOption, transferRows],
  );

  const monthlySummary = useMemo(
    () => buildTransferMatrix(monthlyRows, restaurants),
    [monthlyRows, restaurants],
  );
  const accumulatedSummary = useMemo(
    () => buildTransferMatrix(accumulatedRows, restaurants),
    [accumulatedRows, restaurants],
  );
  const monthlyTimelineData = useMemo(
    () => buildTransferTimelineData(transferRows, selectedPeriodOption?.date ?? null, "monthly"),
    [selectedPeriodOption, transferRows],
  );
  const accumulatedTimelineData = useMemo(
    () => buildTransferTimelineData(transferRows, selectedPeriodOption?.date ?? null, "cumulative"),
    [selectedPeriodOption, transferRows],
  );
  const monthlyGrandTotalDisplay = useMemo(
    () => `${formatCurrency(roundTransferDisplayAmount(monthlySummary.grandTotal))} ₽`,
    [monthlySummary.grandTotal],
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">Загрузка...</CardContent>
      </Card>
    );
  }

  if (transferRows.length === 0 || periodOptions.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Нет данных по внутригрупповым перемещениям. Добавьте строки в `owners_fact` с группой
          `Займы выданные`.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/3 via-card to-accent/3">
        <CardContent className="space-y-3 px-4 py-4">
          <div className="grid gap-2 xl:grid-cols-[220px_minmax(0,1fr)]">
            <TransferPeriodCard
              selectedPeriodKey={selectedPeriodKey}
              options={periodOptions}
              onChange={setSelectedPeriods}
            />
            <TransferKpiCard
              icon={ArrowLeftRight}
              label="Чистое внутригрупповое движение"
              value={monthlyGrandTotalDisplay}
              subtitle={selectedPeriodOption ? `за ${selectedPeriodOption.label}` : undefined}
              tone="primary"
            />
          </div>

          {usingLegacyTransferGroup ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
              Пока использую строки из `owners_fact` с группой `Займы` как временную замену для
              `Займы выданные`.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_340px] 2xl:grid-cols-[minmax(0,1.35fr)_380px]">
        <TransferMatrixCard
          title="Внутригрупповое финансирование"
          periodLabel={selectedPeriodOption?.label ?? "—"}
          summary={monthlySummary}
          description="Кто кого финансировал за выбранный месяц."
        />
        <TransferTimelineChartCard
          title="Динамика внутригруппового движения"
          data={monthlyTimelineData}
          description="Последние 6 месяцев до выбранного периода."
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_340px] 2xl:grid-cols-[minmax(0,1.35fr)_380px]">
        <TransferMatrixCard
          title="Накопленный итог внутригруппового финансирования"
          periodLabel={selectedPeriodOption ? `на конец ${selectedPeriodOption.label}` : "—"}
          summary={accumulatedSummary}
          description="Сколько всего вложено в рестораны на выбранный момент."
        />
        <TransferTimelineChartCard
          title="Накопленная динамика"
          data={accumulatedTimelineData}
          description="Нарастающий итог на конец каждого месяца."
        />
      </div>
    </div>
  );
}

function OwnersReportTab({ scope }: { scope?: AnalyticsScopeConfig }) {
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([]);
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const {
    accessibleRestaurantNames,
    accessibleRestaurantNameSet,
    preferredRestaurantSelection,
    fixedRestaurantNames,
    fixedOwnerNames,
  } = useAnalyticsAccess(scope);
  const formatOwnersWholeCurrency = (value: number) => formatCurrency(Math.round(value));

  const { data: owners = [], isLoading } = useQuery({
    queryKey: ["owners_fact"],
    queryFn: async () => {
      return fetchAllRows<OwnersFact>("owners_fact");
    },
  });

  const ownerRows = useMemo<OwnersFactRow[]>(
    () =>
      owners
        .map((row) => {
          const periodDate = parsePeriodDate(row["Период"]);
          const owner = row["Псевдо"] || "";
          const article = row["Группа"] || "Без статьи";

          if (!periodDate || !OWNER_OPTIONS.includes(owner as (typeof OWNER_OPTIONS)[number])) {
            return null;
          }

          const normalizedAmounts = normalizeOwnersFactAmounts(
            article,
            parseTextNumeric(row["Начислено"]),
            parseTextNumeric(row["Оплачено"]),
            parseTextNumeric(row["Движение"]),
          );

          return {
            id: row.id,
            restaurant: row["Ресторан"] || "Без ресторана",
            periodDate,
            periodKey: makePeriodKey(periodDate),
            owner,
            article,
            accrued: normalizedAmounts.accrued,
            paid: normalizedAmounts.paid,
            net: normalizedAmounts.net,
          };
        })
        .filter((row): row is OwnersFactRow => row !== null)
        .filter((row) => accessibleRestaurantNameSet.has(row.restaurant))
        .filter((row) => fixedOwnerNames.length === 0 || fixedOwnerNames.includes(row.owner)),
    [accessibleRestaurantNameSet, fixedOwnerNames, owners],
  );

  const restaurantOptions = useMemo(
    () =>
      getUniqueValues([...accessibleRestaurantNames, ...ownerRows.map((row) => row.restaurant)]).sort((a, b) =>
        a.localeCompare(b, "ru"),
      ),
    [accessibleRestaurantNames, ownerRows],
  );
  const ownerOptions = useMemo(
    () =>
      getUniqueValues(
        fixedOwnerNames.length > 0 ? [...fixedOwnerNames, ...ownerRows.map((row) => row.owner)] : [...OWNER_OPTIONS],
      ).sort((a, b) => a.localeCompare(b, "ru")),
    [fixedOwnerNames, ownerRows],
  );
  const periodOptions = useMemo(() => buildPeriodOptions(ownerRows.map((row) => row.periodDate)), [ownerRows]);

  useInitializeSingleSelection({
    selection: selectedRestaurants,
    options: restaurantOptions,
    onChange: setSelectedRestaurants,
    preferredOption: preferredRestaurantSelection[0] ?? null,
  });
  useInitializeSingleSelection({
    selection: selectedOwners,
    options: ownerOptions,
    onChange: setSelectedOwners,
    preferredOption: fixedOwnerNames[0] ?? null,
  });

  const { selectedPeriods, setSelectedPeriods, activePeriods, periodRefs } = usePeriodSelection(periodOptions);
  const activeRestaurants = useMemo(
    () => resolveScopedSelection(selectedRestaurants, restaurantOptions, fixedRestaurantNames),
    [fixedRestaurantNames, restaurantOptions, selectedRestaurants],
  );
  const activeOwners = useMemo(
    () => resolveScopedSelection(selectedOwners, ownerOptions, fixedOwnerNames),
    [fixedOwnerNames, ownerOptions, selectedOwners],
  );

  const scopeRows = useMemo(
    () =>
      ownerRows.filter(
        (row) => activeRestaurants.includes(row.restaurant) && activeOwners.includes(row.owner),
      ),
    [activeOwners, activeRestaurants, ownerRows],
  );

  const filteredRows = useMemo(
    () => scopeRows.filter((row) => activePeriods.includes(row.periodKey)),
    [activePeriods, scopeRows],
  );

  const earliestSelectedPeriod = useMemo(() => {
    if (filteredRows.length === 0) return null;

    return filteredRows.reduce((earliest, row) =>
      row.periodDate.getTime() < earliest.periodDate.getTime() ? row : earliest,
    ).periodDate;
  }, [filteredRows]);

  const openingRows = useMemo(() => {
    if (!earliestSelectedPeriod) return [];

    return scopeRows.filter((row) => row.periodDate.getTime() < earliestSelectedPeriod.getTime());
  }, [earliestSelectedPeriod, scopeRows]);

  const reportRows = useMemo<OwnersReportRow[]>(() => {
    if (filteredRows.length === 0) return [];

    const articleMap = new Map<string, OwnersReportRow>();

    const ensureRow = (article: string) => {
      if (!articleMap.has(article)) {
        articleMap.set(article, {
          article,
          opening: 0,
          accrued: 0,
          paid: 0,
          net: 0,
          closing: 0,
        });
      }

      return articleMap.get(article)!;
    };

    openingRows.forEach((row) => {
      ensureRow(row.article).opening += row.net;
    });

    filteredRows.forEach((row) => {
      const article = ensureRow(row.article);
      article.accrued += row.accrued;
      article.paid += row.paid;
      article.net += row.net;
    });

    return Array.from(articleMap.values())
      .map((row) => ({
        ...row,
        closing: row.opening + row.net,
      }))
      .filter((row) => row.opening !== 0 || row.accrued !== 0 || row.paid !== 0 || row.closing !== 0)
      .sort((a, b) => a.article.localeCompare(b.article, "ru"));
  }, [filteredRows, openingRows]);

  const totals = useMemo(
    () =>
      reportRows.reduce(
        (acc, row) => ({
          opening: acc.opening + row.opening,
          accrued: acc.accrued + row.accrued,
          paid: acc.paid + row.paid,
          closing: acc.closing + row.closing,
        }),
        { opening: 0, accrued: 0, paid: 0, closing: 0 },
      ),
    [reportRows],
  );
  const chartAnchorDate = useMemo(() => {
    const selectedOptions = periodOptions.filter((option) => selectedPeriods.includes(option.key));

    if (selectedOptions.length === 0) {
      return periodOptions[0]?.date ?? null;
    }

    return selectedOptions.reduce(
      (latest, option) => (option.date.getTime() > latest.getTime() ? option.date : latest),
      selectedOptions[0].date,
    );
  }, [periodOptions, selectedPeriods]);
  const ownersTimelineData = useMemo(
    () => buildOwnersTimelineData(scopeRows, chartAnchorDate),
    [chartAnchorDate, scopeRows],
  );

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/3 via-card to-accent/3">
        <CardHeader className="hidden">
          <CardTitle className="text-lg font-serif">Отчет Собственников</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3 px-4 py-4">
          <div className="flex flex-wrap items-start gap-2">
            {!scope?.hideRestaurantFilter && (
              <FilterChipGroup
                label="Рестораны"
                options={restaurantOptions}
                selection={selectedRestaurants}
                onChange={setSelectedRestaurants}
                matchPeriodHeight
                allowSelectAll
              />
            )}
            {!scope?.hideOwnerFilter && (
              <FilterChipGroup
                label="Собственник"
                options={ownerOptions}
                selection={selectedOwners}
                onChange={setSelectedOwners}
                matchPeriodHeight
                allowSelectAll
              />
            )}
            <PeriodSelector
              selection={selectedPeriods}
              onChange={setSelectedPeriods}
              options={periodOptions}
              refsMap={periodRefs}
              allowSelectAll={false}
            />
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <div className="kpi-card kpi-card-primary px-2.5 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Остаток на начало</p>
              <p className="mt-1 text-base font-semibold leading-none text-primary">{formatOwnersWholeCurrency(totals.opening)} ₽</p>
            </div>
            <div className="kpi-card kpi-card-sky px-2.5 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Начислено</p>
              <p className="mt-1 text-base font-semibold leading-none text-sky">{formatOwnersWholeCurrency(totals.accrued)} ₽</p>
            </div>
            <div className="kpi-card kpi-card-accent px-2.5 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Выплачено</p>
              <p className="mt-1 text-base font-semibold leading-none text-accent">{formatOwnersWholeCurrency(totals.paid)} ₽</p>
            </div>
            <div className="kpi-card kpi-card-muted px-2.5 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Остаток на конец</p>
              <p className="mt-1 text-base font-semibold leading-none">{formatOwnersWholeCurrency(totals.closing)} ₽</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Загрузка...</CardContent>
        </Card>
      ) : ownerRows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Нет данных. Импортируйте CSV в таблицу owners_fact.
          </CardContent>
        </Card>
      ) : filteredRows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            По выбранным фильтрам данных нет.
          </CardContent>
        </Card>
      ) : (
        <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.45fr)_360px] 2xl:grid-cols-[minmax(0,1.35fr)_420px]">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-base font-serif">Отчет</CardTitle>
            </CardHeader>

            <CardContent className="px-0 pt-0">
                <Table className="min-w-[462px] table-fixed sm:min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-30 w-[106px] min-w-[106px] bg-card px-2 text-[10px] shadow-[8px_0_10px_-8px_rgba(15,23,42,0.2)] sm:w-[152px] sm:min-w-[152px] sm:px-2.5 sm:text-xs">
                      Статья
                    </TableHead>
                    <TableHead className="h-9 w-[88px] min-w-[88px] px-2 text-right text-[10px] sm:w-[104px] sm:min-w-[104px] sm:px-2.5 sm:text-xs">
                      <span className="sm:hidden">Ост. нач.</span>
                      <span className="hidden sm:inline">Остаток на начало</span>
                    </TableHead>
                    <TableHead className="h-9 w-[88px] min-w-[88px] px-2 text-right text-[10px] sm:w-[120px] sm:min-w-[120px] sm:px-2.5 sm:text-xs">
                      <span className="sm:hidden">Начисл.</span>
                      <span className="hidden sm:inline">Начислено / получено / в пути</span>
                    </TableHead>
                    <TableHead className="h-9 w-[88px] min-w-[88px] px-2 text-right text-[10px] sm:w-[120px] sm:min-w-[120px] sm:px-2.5 sm:text-xs">
                      <span className="sm:hidden">Выплата</span>
                      <span className="hidden sm:inline">Выплачено / возврат</span>
                    </TableHead>
                    <TableHead className="h-9 w-[92px] min-w-[92px] px-2 text-right text-[10px] sm:w-[104px] sm:min-w-[104px] sm:px-2.5 sm:text-xs">
                      <span className="sm:hidden">Ост. кон.</span>
                      <span className="hidden sm:inline">Остаток на конец</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportRows.map((row) => (
                    <TableRow key={row.article}>
                      <TableCell className="sticky left-0 z-20 w-[106px] min-w-[106px] bg-background px-2 py-2 text-[10px] font-medium shadow-[8px_0_10px_-8px_rgba(15,23,42,0.2)] sm:w-[152px] sm:min-w-[152px] sm:px-2.5 sm:text-xs">
                        {row.article}
                      </TableCell>
                        <TableCell
                          className={cn(
                            "w-[88px] min-w-[88px] px-2 py-2 text-right text-[10px] font-mono whitespace-nowrap sm:w-[104px] sm:min-w-[104px] sm:px-2.5 sm:text-xs",
                            row.opening < 0 ? "text-destructive" : "text-foreground",
                          )}
                        >
                          {formatOwnersWholeCurrency(row.opening)} ₽
                        </TableCell>
                        <TableCell className="w-[88px] min-w-[88px] px-2 py-2 text-right text-[10px] font-mono whitespace-nowrap sm:w-[120px] sm:min-w-[120px] sm:px-2.5 sm:text-xs">{formatOwnersWholeCurrency(row.accrued)} ₽</TableCell>
                        <TableCell className="w-[88px] min-w-[88px] px-2 py-2 text-right text-[10px] font-mono whitespace-nowrap sm:w-[120px] sm:min-w-[120px] sm:px-2.5 sm:text-xs">{formatOwnersWholeCurrency(row.paid)} ₽</TableCell>
                        <TableCell
                          className={cn(
                            "w-[92px] min-w-[92px] px-2 py-2 text-right text-[10px] font-mono whitespace-nowrap sm:w-[104px] sm:min-w-[104px] sm:px-2.5 sm:text-xs",
                            row.closing < 0 ? "text-destructive" : "text-foreground",
                          )}
                        >
                          {formatOwnersWholeCurrency(row.closing)} ₽
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="font-bold hover:bg-muted/50">
                      <TableCell className="sticky left-0 z-20 w-[106px] min-w-[106px] bg-muted px-2 py-2 text-[10px] font-bold shadow-[8px_0_10px_-8px_rgba(15,23,42,0.2)] sm:w-[152px] sm:min-w-[152px] sm:px-2.5 sm:text-xs">
                        Общий итог
                      </TableCell>
                      <TableCell
                        className={cn(
                          "w-[88px] min-w-[88px] px-2 py-2 text-right text-[10px] font-mono font-bold whitespace-nowrap sm:w-[104px] sm:min-w-[104px] sm:px-2.5 sm:text-xs",
                          totals.opening < 0 ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {formatOwnersWholeCurrency(totals.opening)} ₽
                      </TableCell>
                      <TableCell
                        className={cn(
                          "w-[88px] min-w-[88px] px-2 py-2 text-right text-[10px] font-mono font-bold whitespace-nowrap sm:w-[120px] sm:min-w-[120px] sm:px-2.5 sm:text-xs",
                          totals.accrued < 0 ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {formatOwnersWholeCurrency(totals.accrued)} ₽
                      </TableCell>
                      <TableCell
                        className={cn(
                          "w-[88px] min-w-[88px] px-2 py-2 text-right text-[10px] font-mono font-bold whitespace-nowrap sm:w-[120px] sm:min-w-[120px] sm:px-2.5 sm:text-xs",
                          totals.paid < 0 ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {formatOwnersWholeCurrency(totals.paid)} ₽
                      </TableCell>
                      <TableCell
                        className={cn(
                          "w-[92px] min-w-[92px] px-2 py-2 text-right text-[10px] font-mono font-bold whitespace-nowrap sm:w-[104px] sm:min-w-[104px] sm:px-2.5 sm:text-xs",
                          totals.closing < 0 ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {formatOwnersWholeCurrency(totals.closing)} ₽
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
            </CardContent>
          </Card>

          <OwnersTimelineChartCard data={ownersTimelineData} />
        </div>
      )}
    </div>
  );
}

function OwnersDetailTab({ scope }: { scope?: AnalyticsScopeConfig }) {
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([]);
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<string[]>([]);
  const [fromPeriodKey, setFromPeriodKey] = useState<string | null>(null);
  const [toPeriodKey, setToPeriodKey] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const {
    accessibleRestaurantNames,
    preferredRestaurantSelection,
    fixedRestaurantNames,
    fixedOwnerNames,
  } = useAnalyticsAccess(scope);
  const { ownerRows, isLoading } = useOwnersFactRows(scope);

  const detailRows = useMemo(() => buildOwnersAuditRows(ownerRows), [ownerRows]);
  const restaurantOptions = useMemo(
    () =>
      getUniqueValues([...accessibleRestaurantNames, ...detailRows.map((row) => row.restaurant)]).sort((a, b) =>
        a.localeCompare(b, "ru"),
      ),
    [accessibleRestaurantNames, detailRows],
  );

  const activeRestaurants = useMemo(
    () => resolveScopedSelection(selectedRestaurants, restaurantOptions, fixedRestaurantNames),
    [fixedRestaurantNames, restaurantOptions, selectedRestaurants],
  );
  const selectedRestaurant = activeRestaurants[0] ?? null;
  const restaurantScopedRows = useMemo(
    () =>
      detailRows.filter((row) => {
        if (selectedRestaurant && row.restaurant !== selectedRestaurant) return false;
        return true;
      }),
    [detailRows, selectedRestaurant],
  );
  const ownerOptions = useMemo(
    () => Array.from(new Set(restaurantScopedRows.map((row) => row.owner))).sort((a, b) => a.localeCompare(b, "ru")),
    [restaurantScopedRows],
  );

  useInitializeSingleSelection({
    selection: selectedRestaurants,
    options: restaurantOptions,
    onChange: setSelectedRestaurants,
    preferredOption: preferredRestaurantSelection[0] ?? null,
  });
  useInitializeSingleSelection({
    selection: selectedOwners,
    options: ownerOptions,
    onChange: setSelectedOwners,
    preferredOption: fixedOwnerNames[0] ?? null,
  });

  const activeOwners = useMemo(
    () => resolveScopedSelection(selectedOwners, ownerOptions, fixedOwnerNames),
    [fixedOwnerNames, ownerOptions, selectedOwners],
  );
  const activeSelectedOwner = activeOwners[0] ?? null;

  const scopedRows = useMemo(
    () =>
      detailRows.filter((row) => {
        if (selectedRestaurant && row.restaurant !== selectedRestaurant) return false;
        if (activeSelectedOwner && row.owner !== activeSelectedOwner) return false;
        return true;
      }),
    [activeSelectedOwner, detailRows, selectedRestaurant],
  );
  const articleOptions = useMemo(
    () => Array.from(new Set(scopedRows.map((row) => row.article))).sort((a, b) => a.localeCompare(b, "ru")),
    [scopedRows],
  );
  const previousArticleOptionsRef = useRef<string[]>([]);

  useInitializeMultiSelection({
    selection: selectedArticles,
    options: articleOptions,
    onChange: setSelectedArticles,
    preferredSelection: articleOptions,
  });

  useEffect(() => {
    const previousOptions = previousArticleOptionsRef.current;
    previousArticleOptionsRef.current = articleOptions;

    if (scope?.hideArticleFilter || previousOptions.length === 0) {
      return;
    }

    const previousAllSelected = previousOptions.every((article) => selectedArticles.includes(article));
    if (!previousAllSelected) {
      return;
    }

    const hasNewArticles = articleOptions.some((article) => !selectedArticles.includes(article));
    if (hasNewArticles) {
      setSelectedArticles(articleOptions);
    }
  }, [articleOptions, scope?.hideArticleFilter, selectedArticles]);

  const periodOptions = useMemo(() => buildPeriodOptions(scopedRows.map((row) => row.periodDate)), [scopedRows]);
  const orderedPeriodOptions = useMemo(
    () => [...periodOptions].sort((a, b) => a.date.getTime() - b.date.getTime()),
    [periodOptions],
  );

  useEffect(() => {
    if (orderedPeriodOptions.length === 0) {
      setFromPeriodKey(null);
      setToPeriodKey(null);
      return;
    }

    const validKeys = new Set(orderedPeriodOptions.map((option) => option.key));
    setFromPeriodKey((current) => (current && validKeys.has(current) ? current : orderedPeriodOptions[0].key));
    setToPeriodKey((current) =>
      current && validKeys.has(current) ? current : orderedPeriodOptions[orderedPeriodOptions.length - 1].key,
    );
  }, [orderedPeriodOptions]);

  const fromPeriodDate = useMemo(
    () => orderedPeriodOptions.find((option) => option.key === fromPeriodKey)?.date ?? null,
    [fromPeriodKey, orderedPeriodOptions],
  );
  const toPeriodDate = useMemo(
    () => orderedPeriodOptions.find((option) => option.key === toPeriodKey)?.date ?? null,
    [orderedPeriodOptions, toPeriodKey],
  );
  const hasInvalidRange =
    fromPeriodDate !== null && toPeriodDate !== null && fromPeriodDate.getTime() > toPeriodDate.getTime();
  const activeArticles = useMemo(
    () => (scope?.hideArticleFilter ? articleOptions : selectedArticles),
    [articleOptions, scope?.hideArticleFilter, selectedArticles],
  );

  const visibleRows = useMemo(
    () =>
      scopedRows
        .filter((row) => {
          if (!selectedRestaurant || !activeSelectedOwner || activeArticles.length === 0 || !fromPeriodDate || !toPeriodDate || hasInvalidRange) {
            return false;
          }

          if (!activeArticles.includes(row.article)) {
            return false;
          }

          return row.periodDate.getTime() >= fromPeriodDate.getTime() && row.periodDate.getTime() <= toPeriodDate.getTime();
        })
        .sort((a, b) => {
          const periodCompare = b.periodDate.getTime() - a.periodDate.getTime();
          if (periodCompare !== 0) return periodCompare;
          return a.article.localeCompare(b.article, "ru");
        }),
    [activeArticles, activeSelectedOwner, fromPeriodDate, hasInvalidRange, scopedRows, selectedRestaurant, toPeriodDate],
  );

  const handleExportDetails = async () => {
    if (!selectedRestaurant || !activeSelectedOwner || visibleRows.length === 0) {
      return;
    }

    setIsExporting(true);

    try {
      const XLSX = await import("xlsx");
      const exportRows = [
        ["Дата", "Статья", "Остаток на начало", "Начислено", "Выплачено", "Остаток на конец"],
        ...visibleRows.map((row) => [
          formatPeriodRangeLabel(row.periodDate),
          row.article,
          row.opening,
          row.accrued,
          row.paid,
          row.closing,
        ]),
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(exportRows);
      worksheet["!cols"] = [
        { wch: 12 },
        { wch: 28 },
        { wch: 18 },
        { wch: 16 },
        { wch: 16 },
        { wch: 18 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Детализация");

      const periodSuffix = [fromPeriodDate, toPeriodDate]
        .filter((date): date is Date => date !== null)
        .map((date) => formatPeriodRangeLabel(date).replace(".", "-"))
        .join("_");

      const fileName = [
        "Детализация",
        normalizeFileNamePart(selectedRestaurant),
        normalizeFileNamePart(activeSelectedOwner),
        periodSuffix,
      ]
        .filter(Boolean)
        .join("_")
        .concat(".xlsx");

      const saveFilePickerWindow = window as SaveFilePickerWindow;

      if (typeof saveFilePickerWindow.showSaveFilePicker === "function") {
        const workbookBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const fileHandle = await saveFilePickerWindow.showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: "Excel workbook",
              accept: {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
              },
            },
          ],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(
          new Blob([workbookBuffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        );
        await writable.close();
      } else {
        if (typeof XLSX.writeFileXLSX === "function") {
          XLSX.writeFileXLSX(workbook, fileName);
        } else {
          XLSX.writeFile(workbook, fileName);
        }
      }

      toast.success("Excel выгружен");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.error(error);
      toast.error("Не удалось выгрузить Excel");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/3 via-card to-accent/3">
        <CardContent className="space-y-3 px-4 py-4">
          <div className="flex flex-wrap items-start gap-2">
            {!scope?.hideRestaurantFilter && (
              <FilterChipGroup
                label="Ресторан"
                options={restaurantOptions}
                selection={selectedRestaurants}
                onChange={setSelectedRestaurants}
                matchPeriodHeight
                singleSelect
              />
            )}
            {!scope?.hideOwnerFilter && (
              <FilterChipGroup
                label="Собственник"
                options={ownerOptions}
                selection={selectedOwners}
                onChange={setSelectedOwners}
                matchPeriodHeight
                singleSelect
              />
            )}
            {!scope?.hideArticleFilter && (
              <FilterChipGroup
                label="Статья"
                options={articleOptions}
                selection={selectedArticles}
                onChange={setSelectedArticles}
                className="sm:flex-1 sm:min-w-0"
                matchPeriodHeight
                toggleSelect
                allowSelectAll
              />
            )}
            <PeriodRangeSelector
              fromPeriodKey={fromPeriodKey}
              toPeriodKey={toPeriodKey}
              onFromChange={setFromPeriodKey}
              onToChange={setToPeriodKey}
              onSelectAll={() => {
                if (orderedPeriodOptions.length === 0) return;
                setFromPeriodKey(orderedPeriodOptions[0].key);
                setToPeriodKey(orderedPeriodOptions[orderedPeriodOptions.length - 1].key);
              }}
              onClear={() => {
                setFromPeriodKey(null);
                setToPeriodKey(null);
              }}
              options={periodOptions}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Загрузка...</CardContent>
        </Card>
      ) : detailRows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Нет данных. Импортируйте CSV в таблицу owners_fact.
          </CardContent>
        </Card>
      ) : !selectedRestaurant || !activeSelectedOwner ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Выберите ресторан и собственника.
          </CardContent>
        </Card>
      ) : activeArticles.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Выберите хотя бы одну статью.
          </CardContent>
        </Card>
      ) : periodOptions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Для выбранного ресторана и собственника нет доступных периодов.
          </CardContent>
        </Card>
      ) : !fromPeriodDate || !toPeriodDate ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Выберите период отчета.
          </CardContent>
        </Card>
      ) : hasInvalidRange ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Начальный период не может быть позже конечного.
          </CardContent>
        </Card>
      ) : visibleRows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            По выбранному диапазону данных нет.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base font-serif">
                Детализация
                <span className="ml-2 text-sm font-sans font-normal text-muted-foreground">
                  {selectedRestaurant} • {activeSelectedOwner}
                </span>
              </CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={handleExportDetails}
                disabled={isExporting}
              >
                <Download className="h-4 w-4" />
                {isExporting ? "Выгружаю..." : "Выгрузить в Excel"}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="px-0 pt-0">
              <Table className="min-w-[520px] table-fixed sm:min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-40 w-[58px] min-w-[58px] border-r border-border bg-muted px-1.5 py-2 text-[10px] shadow-[8px_0_10px_-8px_rgba(15,23,42,0.25)] sm:w-[84px] sm:min-w-[84px] sm:px-2 sm:text-[11px]">
                      Дата
                    </TableHead>
                    <TableHead className="sticky left-[58px] z-40 w-[88px] min-w-[88px] border-r border-border bg-muted px-1.5 py-2 text-[10px] shadow-[8px_0_10px_-8px_rgba(15,23,42,0.25)] sm:left-[84px] sm:w-[168px] sm:min-w-[168px] sm:px-2 sm:text-[11px]">
                      Статья
                    </TableHead>
                    <TableHead className="h-10 w-[92px] min-w-[92px] px-2 py-2 text-right text-[10px] sm:w-[110px] sm:min-w-[110px] sm:px-2 sm:text-[11px]">
                      <span className="sm:hidden">Ост. нач.</span>
                      <span className="hidden sm:inline">Остаток на начало</span>
                    </TableHead>
                    <TableHead className="h-10 w-[92px] min-w-[92px] px-2 py-2 text-right text-[10px] sm:w-[110px] sm:min-w-[110px] sm:px-2 sm:text-[11px]">Начислено</TableHead>
                    <TableHead className="h-10 w-[92px] min-w-[92px] px-2 py-2 text-right text-[10px] sm:w-[110px] sm:min-w-[110px] sm:px-2 sm:text-[11px]">Выплачено</TableHead>
                    <TableHead className="h-10 w-[92px] min-w-[92px] px-2 py-2 text-right text-[10px] sm:w-[110px] sm:min-w-[110px] sm:px-2 sm:text-[11px]">
                      <span className="sm:hidden">Ост. кон.</span>
                      <span className="hidden sm:inline">Остаток на конец</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((row) => (
                    <TableRow key={[row.periodKey, row.article].join("::")}>
                      <TableCell
                        className="sticky left-0 z-30 w-[58px] min-w-[58px] overflow-hidden border-r border-border bg-muted px-1.5 py-2 text-[10px] font-medium shadow-[8px_0_10px_-8px_rgba(15,23,42,0.25)] sm:w-[84px] sm:min-w-[84px] sm:px-2 sm:text-xs"
                      >
                        {formatPeriodRangeLabel(row.periodDate)}
                      </TableCell>
                      <TableCell
                        className="sticky left-[58px] z-30 w-[88px] min-w-[88px] overflow-hidden truncate border-r border-border bg-muted px-1.5 py-2 text-[10px] shadow-[8px_0_10px_-8px_rgba(15,23,42,0.25)] sm:left-[84px] sm:w-[168px] sm:min-w-[168px] sm:px-2 sm:text-xs"
                      >
                        {row.article}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "w-[92px] min-w-[92px] px-2 py-2 text-right text-[10px] font-mono whitespace-nowrap sm:w-[110px] sm:min-w-[110px] sm:px-2 sm:text-[11px]",
                          row.opening < 0 ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {formatCurrency(row.opening)} ₽
                      </TableCell>
                      <TableCell className="w-[92px] min-w-[92px] px-2 py-2 text-right text-[10px] font-mono whitespace-nowrap text-sky sm:w-[110px] sm:min-w-[110px] sm:px-2 sm:text-[11px]">{formatCurrency(row.accrued)} ₽</TableCell>
                      <TableCell className="w-[92px] min-w-[92px] px-2 py-2 text-right text-[10px] font-mono whitespace-nowrap text-accent sm:w-[110px] sm:min-w-[110px] sm:px-2 sm:text-[11px]">{formatCurrency(row.paid)} ₽</TableCell>
                      <TableCell
                        className={cn(
                          "w-[92px] min-w-[92px] px-2 py-2 text-right text-[10px] font-mono font-semibold whitespace-nowrap sm:w-[110px] sm:min-w-[110px] sm:px-2 sm:text-[11px]",
                          row.closing < 0 ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {formatCurrency(row.closing)} ₽
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function OwnersVerificationTab() {
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([]);
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<string[]>([]);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [issuesOnly, setIssuesOnly] = useState(true);
  const periodRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const { ownerRows, isLoading } = useOwnersFactRows();

  const restaurantOptions = useMemo(
    () => Array.from(new Set(ownerRows.map((row) => row.restaurant))).sort((a, b) => a.localeCompare(b, "ru")),
    [ownerRows],
  );
  const ownerOptions = useMemo(
    () => Array.from(new Set(ownerRows.map((row) => row.owner))).sort((a, b) => a.localeCompare(b, "ru")),
    [ownerRows],
  );
  const articleOptions = useMemo(
    () => Array.from(new Set(ownerRows.map((row) => row.article))).sort((a, b) => a.localeCompare(b, "ru")),
    [ownerRows],
  );

  const verificationRows = useMemo<OwnersAuditRow[]>(() => buildOwnersAuditRows(ownerRows), [ownerRows]);

  const periodOptions = useMemo(
    () => buildPeriodOptions(verificationRows.map((row) => row.periodDate)),
    [verificationRows],
  );
  const activeRestaurants = useMemo(
    () => resolveSelection(selectedRestaurants, restaurantOptions),
    [restaurantOptions, selectedRestaurants],
  );
  const activeOwners = useMemo(() => resolveSelection(selectedOwners, ownerOptions), [ownerOptions, selectedOwners]);
  const activeArticles = useMemo(
    () => resolveSelection(selectedArticles, articleOptions),
    [articleOptions, selectedArticles],
  );
  const activePeriods = useMemo(
    () => resolveSelection(
      selectedPeriods,
      periodOptions.map((option) => option.key),
    ),
    [periodOptions, selectedPeriods],
  );

  const filteredRows = useMemo(
    () =>
      verificationRows.filter((row) => {
        if (!activeRestaurants.includes(row.restaurant)) return false;
        if (!activeOwners.includes(row.owner)) return false;
        if (!activeArticles.includes(row.article)) return false;
        if (!activePeriods.includes(row.periodKey)) return false;
        if (issuesOnly && !row.isSyntheticGap && !row.hasMismatch) return false;
        return true;
      }),
    [activeArticles, activeOwners, activePeriods, activeRestaurants, issuesOnly, verificationRows],
  );

  const gapRowsCount = useMemo(
    () => filteredRows.filter((row) => row.isSyntheticGap).length,
    [filteredRows],
  );
  const mismatchRowsCount = useMemo(
    () => filteredRows.filter((row) => row.hasMismatch).length,
    [filteredRows],
  );
  const sourceRowsCount = useMemo(
    () => filteredRows.reduce((sum, row) => sum + row.sourceRowCount, 0),
    [filteredRows],
  );
  const visiblePeriodRange = useMemo(() => {
    if (filteredRows.length === 0) return null;

    const sorted = [...filteredRows].sort((a, b) => a.periodDate.getTime() - b.periodDate.getTime());
    return {
      from: sorted[0].periodKey,
      to: sorted[sorted.length - 1].periodKey,
    };
  }, [filteredRows]);

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/3 via-card to-accent/3">
        <CardContent className="space-y-3 px-4 py-4">
          <div className="flex flex-wrap items-start gap-2">
            <FilterChipGroup
              label="Рестораны"
              options={restaurantOptions}
              selection={selectedRestaurants}
              onChange={setSelectedRestaurants}
              matchPeriodHeight
            />
            <FilterChipGroup
              label="Собственники"
              options={ownerOptions}
              selection={selectedOwners}
              onChange={setSelectedOwners}
              matchPeriodHeight
            />
            <FilterChipGroup
              label="Статьи"
              options={articleOptions}
              selection={selectedArticles}
              onChange={setSelectedArticles}
              compact
            />
            <PeriodSelector
              selection={selectedPeriods}
              onChange={setSelectedPeriods}
              options={periodOptions}
              refsMap={periodRefs}
              compact
            />
            <div className="flex min-h-[88px] items-start rounded-lg border bg-muted/20 p-2">
              <Button
                type="button"
                size="sm"
                variant={issuesOnly ? "default" : "outline"}
                className="h-7"
                onClick={() => setIssuesOnly((current) => !current)}
              >
                {issuesOnly ? "Только проблемы" : "Все строки"}
              </Button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <div className="kpi-card kpi-card-primary px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Период проверки</p>
              <p className="mt-1 text-sm font-semibold leading-snug">
                {visiblePeriodRange ? `${visiblePeriodRange.from} - ${visiblePeriodRange.to}` : "Нет данных"}
              </p>
            </div>
            <div className="kpi-card kpi-card-sky px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Строки в выборке</p>
              <p className="mt-1 text-lg font-semibold leading-none text-sky">{filteredRows.length}</p>
            </div>
            <div className="kpi-card kpi-card-accent px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Пустые месяцы</p>
              <p className="mt-1 text-lg font-semibold leading-none text-accent">{gapRowsCount}</p>
            </div>
            <div className="kpi-card kpi-card-accent px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Несходящиеся строки</p>
              <p className="mt-1 text-lg font-semibold leading-none text-destructive">{mismatchRowsCount}</p>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Пустой месяц означает, что между первым и последним месяцем по статье не найдено ни одной строки в
            `owners_fact`, но остаток на начало и конец для него все равно рассчитан. Несходящаяся строка означает,
            что `Движение` в источнике не равно `Начислено - Оплачено`.
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Загрузка...</CardContent>
        </Card>
      ) : verificationRows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Нет данных. Импортируйте CSV в таблицу owners_fact.
          </CardContent>
        </Card>
      ) : filteredRows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            По текущим фильтрам проблемных строк не найдено.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-base font-serif">
              Проверка отчета собственников
              <span className="ml-2 text-sm font-sans font-normal text-muted-foreground">
                Источник строк: {sourceRowsCount}
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="px-0 pt-0">
            <ScrollArea className="w-full whitespace-nowrap">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-10 px-3 text-xs">Ресторан</TableHead>
                    <TableHead className="h-10 px-3 text-xs">Собственник</TableHead>
                    <TableHead className="h-10 px-3 text-xs">Статья</TableHead>
                    <TableHead className="h-10 px-3 text-xs">Период</TableHead>
                    <TableHead className="h-10 px-3 text-right text-xs">Остаток на начало</TableHead>
                    <TableHead className="h-10 px-3 text-right text-xs">Начислено</TableHead>
                    <TableHead className="h-10 px-3 text-right text-xs">Выплачено</TableHead>
                    <TableHead className="h-10 px-3 text-right text-xs">Движение в источнике</TableHead>
                    <TableHead className="h-10 px-3 text-right text-xs">Остаток на конец</TableHead>
                    <TableHead className="h-10 px-3 text-right text-xs">Дельта</TableHead>
                    <TableHead className="h-10 px-3 text-xs">Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => {
                    const statuses: string[] = [];

                    if (row.isSyntheticGap) {
                      statuses.push("нет строки за месяц");
                    }

                    if (row.hasMismatch) {
                      statuses.push("движение не сходится");
                    }

                    if (statuses.length === 0) {
                      statuses.push("ok");
                    }

                    return (
                      <TableRow key={[row.restaurant, row.owner, row.article, row.periodKey].join("::")}>
                        <TableCell className="px-3 py-2 text-sm">{row.restaurant}</TableCell>
                        <TableCell className="px-3 py-2 text-sm">{row.owner}</TableCell>
                        <TableCell className="px-3 py-2 text-sm">{row.article}</TableCell>
                        <TableCell className="px-3 py-2 text-sm font-medium">{row.periodKey}</TableCell>
                        <TableCell className="px-3 py-2 text-right text-sm font-mono">{formatCurrency(row.opening)} ₽</TableCell>
                        <TableCell className="px-3 py-2 text-right text-sm font-mono">{formatCurrency(row.accrued)} ₽</TableCell>
                        <TableCell className="px-3 py-2 text-right text-sm font-mono">{formatCurrency(row.paid)} ₽</TableCell>
                        <TableCell className="px-3 py-2 text-right text-sm font-mono">{formatCurrency(row.sourceNet)} ₽</TableCell>
                        <TableCell className="px-3 py-2 text-right text-sm font-mono">{formatCurrency(row.closing)} ₽</TableCell>
                        <TableCell
                          className={cn(
                            "px-3 py-2 text-right text-sm font-mono font-semibold",
                            row.hasMismatch ? "text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {formatCurrency(row.delta)} ₽
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-1 font-medium",
                              row.hasMismatch
                                ? "bg-destructive/10 text-destructive"
                                : row.isSyntheticGap
                                  ? "bg-accent/10 text-accent"
                                  : "bg-primary/10 text-primary",
                            )}
                          >
                            {statuses.join(" / ")}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AnalyticsPlaceholderSection({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-base font-serif">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
          {description ?? "Раздел в разработке."}
        </div>
      </CardContent>
    </Card>
  );
}

function AnalyticsOwnersSection({ scope }: { scope?: AnalyticsScopeConfig }) {
  return (
    <Tabs defaultValue="report" className="space-y-4">
      <TabsList className="h-auto justify-start gap-1 bg-muted">
        <TabsTrigger
          value="report"
          className="shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
        >
          Общий отчет
        </TabsTrigger>
        <TabsTrigger
          value="detail"
          className="shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
        >
          Детализация
        </TabsTrigger>
      </TabsList>
      <TabsContent value="report">
        <OwnersReportTab scope={scope} />
      </TabsContent>
      <TabsContent value="detail">
        <OwnersDetailTab scope={scope} />
      </TabsContent>
    </Tabs>
  );
}

function AnalyticsWorkspacePage() {
  const location = useLocation();
  const view = getAnalyticsWorkspaceView(location.pathname);

  if (!view) {
    return <Navigate to={ANALYTICS_ROUTE_PATHS.financial} replace />;
  }

  const meta = ANALYTICS_WORKSPACE_META[view];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold font-serif">{meta.title}</h1>
          {meta.description ? <p className="text-sm text-muted-foreground">{meta.description}</p> : null}
        </div>
        <AnalyticsImportDialog />
      </div>

      {view === "financial" ? <FinancialResultTab /> : null}
      {view === "owners" ? <AnalyticsOwnersSection /> : null}
      {view === "transfers" ? <TransfersTab /> : null}
      {view === "cashMovement" ? <CashMovementTab /> : null}
      {view === "loans" ? <AnalyticsPlaceholderSection title={meta.title} description={meta.description} /> : null}
    </div>
  );
}

function AnalyticsTabbedPage({ scope }: AnalyticsPageProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold font-serif">{scope?.title ?? "Аналитика"}</h1>
          {scope?.description ? <p className="text-sm text-muted-foreground">{scope.description}</p> : null}
        </div>
        {!scope?.hideImportAction && <AnalyticsImportDialog />}
      </div>
      <Tabs defaultValue="financial" className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <TabsList className="h-auto min-w-max justify-start gap-1 bg-muted">
            <TabsTrigger
              value="financial"
              className="shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
            >
              Финансовый результат
            </TabsTrigger>
            <TabsTrigger
              value="owners"
              className="shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
            >
              Общий отчет
            </TabsTrigger>
            <TabsTrigger
              value="detail"
              className="shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
            >
              Детализация
            </TabsTrigger>
            {!scope?.hideTransfersTab && (
              <TabsTrigger
                value="transfers"
                className="shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
              >
                Перемещения
              </TabsTrigger>
            )}
            {SHOW_ANALYTICS_VERIFICATION_TAB && (
              <TabsTrigger
                value="verification"
                className="shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
              >
                Проверка
              </TabsTrigger>
            )}
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <TabsContent value="financial">
          <FinancialResultTab scope={scope} />
        </TabsContent>
        <TabsContent value="owners">
          <OwnersReportTab scope={scope} />
        </TabsContent>
        <TabsContent value="detail">
          <OwnersDetailTab scope={scope} />
        </TabsContent>
        {!scope?.hideTransfersTab && (
          <TabsContent value="transfers">
            <TransfersTab scope={scope} />
          </TabsContent>
        )}
        {SHOW_ANALYTICS_VERIFICATION_TAB && (
          <TabsContent value="verification">
            <OwnersVerificationTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default function AnalyticsPage({ scope }: AnalyticsPageProps) {
  if (scope) {
    return <AnalyticsTabbedPage scope={scope} />;
  }

  return <AnalyticsWorkspacePage />;
}
