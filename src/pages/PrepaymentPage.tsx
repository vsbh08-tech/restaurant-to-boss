import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon, CheckCircle2, Columns3, DollarSign, Plus, RotateCcw, Search, Wallet } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/supabase-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const paymentMethods = ["Нал", "Р/С", "QR-код"];

type ActionMode = "create" | "close" | "refund" | "transfer";
type ColumnKey =
  | "prepaymentDate"
  | "client"
  | "banquetDate"
  | "amount"
  | "createdBy"
  | "comment"
  | "paymentMethod"
  | "status"
  | "changedBy"
  | "changedAt";

type PrepaymentWorkflowFields = {
  "Комментарий"?: string | null;
  "Сотрудник_Создал"?: string | null;
  "Сотрудник_Изменил"?: string | null;
  "Дата_Изменения"?: string | null;
};
type Prepayment = Database["public"]["Tables"]["prepayments"]["Row"] & PrepaymentWorkflowFields;
type PrepaymentInsert = Database["public"]["Tables"]["prepayments"]["Insert"] & PrepaymentWorkflowFields;
type PrepaymentUpdate = Database["public"]["Tables"]["prepayments"]["Update"] & PrepaymentWorkflowFields;
type PrepaymentCalendarKey = "period" | "prepayment" | "banquet" | "transfer";
type PrepaymentOptionalColumn = "Сотрудник_Создал" | "Сотрудник_Изменил" | "Дата_Изменения" | "Комментарий";

const PREPAYMENT_OPTIONAL_COLUMNS: PrepaymentOptionalColumn[] = [
  "Сотрудник_Создал",
  "Сотрудник_Изменил",
  "Дата_Изменения",
  "Комментарий",
];

const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = [
  "prepaymentDate",
  "client",
  "banquetDate",
  "amount",
  "createdBy",
  "comment",
];

const COLUMN_LABELS: Record<ColumnKey, string> = {
  prepaymentDate: "Дата предоплаты",
  client: "Клиент",
  banquetDate: "Дата банкета",
  amount: "Сумма",
  createdBy: "Сотрудник",
  comment: "Комментарий",
  paymentMethod: "Способ оплаты",
  status: "Статус",
  changedBy: "Сотрудник изменил",
  changedAt: "Дата изменения",
};

function formatDisplayDate(value: string | null) {
  return value ? format(new Date(value), "dd.MM.yyyy") : "—";
}

function formatDisplayDateTime(value: string | null) {
  return value ? format(new Date(value), "dd.MM.yyyy HH:mm") : "—";
}

function appendWorkflowComment(nextComment: string, currentComment?: string | null) {
  const normalizedComment = currentComment?.trim();
  return normalizedComment ? `${normalizedComment}; ${nextComment}` : nextComment;
}

function buildTransferComment(previousDate: string | null, nextDate: string, currentComment?: string | null) {
  const transferComment = `Перенос даты банкета: ${formatDisplayDate(previousDate)} -> ${formatDisplayDate(nextDate)}`;
  return appendWorkflowComment(transferComment, currentComment);
}

function buildRefundComment(amount: number | null, currentComment?: string | null) {
  const refundComment = `Возврат предоплаты: ${formatCurrency(amount || 0)} ₽`;
  return appendWorkflowComment(refundComment, currentComment);
}

function getPrepaymentBalanceAmount(item: Pick<Prepayment, "Статус" | "Сумма">) {
  return item["Статус"] === "Открыт" ? item["Сумма"] || 0 : 0;
}

function getPrepaymentMetricAmount(item: Pick<Prepayment, "Сумма">) {
  return item["Сумма"] || 0;
}

function extractMissingPrepaymentColumn(message: string) {
  const match = message.match(/Could not find the '([^']+)' column/);
  const columnName = match?.[1];

  if (!columnName) {
    return null;
  }

  return PREPAYMENT_OPTIONAL_COLUMNS.includes(columnName as PrepaymentOptionalColumn)
    ? (columnName as PrepaymentOptionalColumn)
    : null;
}

function omitPrepaymentColumn<T extends Record<string, unknown>>(payload: T, column: PrepaymentOptionalColumn) {
  const nextPayload = { ...payload };
  Reflect.deleteProperty(nextPayload, column);
  return nextPayload;
}

async function insertPrepaymentWithFallback(payload: PrepaymentInsert) {
  const omittedColumns: PrepaymentOptionalColumn[] = [];
  let nextPayload = { ...payload };

  while (true) {
    const { error } = await supabase.from("prepayments").insert([nextPayload]);

    if (!error) {
      return omittedColumns;
    }

    const missingColumn = extractMissingPrepaymentColumn(error.message);
    if (!missingColumn || omittedColumns.includes(missingColumn) || !(missingColumn in nextPayload)) {
      throw error;
    }

    nextPayload = omitPrepaymentColumn(nextPayload, missingColumn);
    omittedColumns.push(missingColumn);
  }
}

async function updatePrepaymentWithFallback(id: string, payload: PrepaymentUpdate) {
  const omittedColumns: PrepaymentOptionalColumn[] = [];
  let nextPayload = { ...payload };

  while (true) {
    const { error } = await supabase.from("prepayments").update(nextPayload).eq("id", id);

    if (!error) {
      return omittedColumns;
    }

    const missingColumn = extractMissingPrepaymentColumn(error.message);
    if (!missingColumn || omittedColumns.includes(missingColumn) || !(missingColumn in nextPayload)) {
      throw error;
    }

    nextPayload = omitPrepaymentColumn(nextPayload, missingColumn);
    omittedColumns.push(missingColumn);
  }
}

function getActionTitle(mode: ActionMode) {
  switch (mode) {
    case "close":
      return "Закрытие банкета";
    case "refund":
      return "Возврат";
    case "transfer":
      return "Перенос даты банкета";
    case "create":
    default:
      return "Новая предоплата";
  }
}

export default function PrepaymentPage() {
  const queryClient = useQueryClient();
  const { role, selectedRestaurantId, userName } = useRole();
  const canManagePrepayments = role === "manager";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionMode, setActionMode] = useState<ActionMode>("create");
  const [periodDate, setPeriodDate] = useState<Date>(new Date());
  const [isExactPeriodFilter, setIsExactPeriodFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);
  const [calendarOpen, setCalendarOpen] = useState<Record<PrepaymentCalendarKey, boolean>>({
    period: false,
    prepayment: false,
    banquet: false,
    transfer: false,
  });

  const [client, setClient] = useState("");
  const [prepaymentDate, setPrepaymentDate] = useState<Date>(new Date());
  const [banquetDate, setBanquetDate] = useState<Date>(new Date());
  const [newBanquetDate, setNewBanquetDate] = useState<Date>(new Date());
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [operationSearch, setOperationSearch] = useState("");
  const [selectedPrepaymentId, setSelectedPrepaymentId] = useState<string | null>(null);

  const { data: prepayments = [], isLoading } = useQuery({
    queryKey: ["prepayments", selectedRestaurantId],
    enabled: Boolean(selectedRestaurantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prepayments")
        .select("*")
        .eq("restaurant_id", selectedRestaurantId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return data as Prepayment[];
    },
  });

  const resetForm = () => {
    setActionMode("create");
    setClient("");
    setPrepaymentDate(new Date());
    setBanquetDate(new Date());
    setNewBanquetDate(new Date());
    setAmount("");
    setPaymentMethod("");
    setOperationSearch("");
    setSelectedPrepaymentId(null);
    setCalendarOpen((current) => ({
      ...current,
      prepayment: false,
      banquet: false,
      transfer: false,
    }));
  };
  const selectedDateKey = format(periodDate, "yyyy-MM-dd");
  const selectedMonthKey = format(periodDate, "yyyy-MM");

  const periodFiltered = useMemo(() => {
    return prepayments.filter((item) => {
      const prepaymentDateKey = item["Дата предоплаты"] || "";
      const banquetDateKey = item["Дата банкета"] || "";

      if (isExactPeriodFilter) {
        return prepaymentDateKey === selectedDateKey || banquetDateKey === selectedDateKey;
      }

      return prepaymentDateKey.startsWith(selectedMonthKey) || banquetDateKey.startsWith(selectedMonthKey);
    });
  }, [isExactPeriodFilter, prepayments, selectedDateKey, selectedMonthKey]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return periodFiltered.filter((item) => {
      if (statusFilter !== "all" && item["Статус"] !== statusFilter) {
        return false;
      }

      if (paymentFilter !== "all" && item["Способ оплаты"] !== paymentFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [
        item["Клиент"] || "",
        item["Комментарий"] || "",
        item["Сотрудник_Создал"] || "",
        item["Сотрудник_Изменил"] || "",
        item["Дата банкета"] || "",
        item["Дата предоплаты"] || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [paymentFilter, periodFiltered, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const openRows = periodFiltered.filter((item) => item["Статус"] === "Открыт");
    const closedRows = periodFiltered.filter((item) => item["Статус"] === "Закрыт");
    const refundRows = periodFiltered.filter((item) => item["Статус"] === "Возврат");

    return {
      totalCount: periodFiltered.length,
      totalSum: periodFiltered.reduce((sum, item) => sum + getPrepaymentMetricAmount(item), 0),
      openCount: openRows.length,
      openSum: openRows.reduce((sum, item) => sum + getPrepaymentMetricAmount(item), 0),
      closedCount: closedRows.length,
      closedSum: closedRows.reduce((sum, item) => sum + getPrepaymentMetricAmount(item), 0),
      refundCount: refundRows.length,
      refundSum: refundRows.reduce((sum, item) => sum + getPrepaymentMetricAmount(item), 0),
    };
  }, [periodFiltered]);

  const openCandidates = useMemo(() => {
    const normalizedQuery = operationSearch.trim().toLowerCase();

    return prepayments
      .filter((item) => item["Статус"] === "Открыт")
      .filter((item) => {
        if (!normalizedQuery) {
          return true;
        }

        return [
          item["Клиент"] || "",
          item["Дата банкета"] || "",
          item["Дата предоплаты"] || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => (left["Дата банкета"] || "").localeCompare(right["Дата банкета"] || ""));
  }, [operationSearch, prepayments]);

  const selectedCandidate = useMemo(
    () => openCandidates.find((item) => item.id === selectedPrepaymentId) ?? null,
    [openCandidates, selectedPrepaymentId],
  );

const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRestaurantId) {
        throw new Error("Сначала выберите ресторан.");
      }

      const nowIso = new Date().toISOString();

      if (actionMode === "create") {
        if (!client.trim()) {
          throw new Error("Укажите клиента.");
        }

        if (!paymentMethod) {
          throw new Error("Выберите способ оплаты.");
        }

        const parsedAmount = parseFloat(amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
          throw new Error("Укажите сумму.");
        }

        const payload: PrepaymentInsert = {
          restaurant_id: selectedRestaurantId,
          "Клиент": client.trim(),
          "Дата предоплаты": format(prepaymentDate, "yyyy-MM-dd"),
          "Дата банкета": format(banquetDate, "yyyy-MM-dd"),
          "Сумма": parsedAmount,
          "Способ оплаты": paymentMethod,
          "Статус": "Открыт",
          "Сотрудник_Создал": userName || null,
        };

        const omittedColumns = await insertPrepaymentWithFallback(payload);
        return { omittedColumns };
      }

      if (!selectedCandidate) {
        throw new Error("Выберите предоплату из списка.");
      }

      let updatePayload: PrepaymentUpdate = {
        "Сотрудник_Изменил": userName || null,
        "Дата_Изменения": nowIso,
      };

      if (actionMode === "close") {
        updatePayload = {
          ...updatePayload,
          "Сумма": selectedCandidate["Сумма"] ?? null,
          "Статус": "Закрыт",
        };
      } else if (actionMode === "refund") {
        updatePayload = {
          ...updatePayload,
          "Сумма": selectedCandidate["Сумма"] ?? null,
          "Статус": "Возврат",
          "Комментарий": buildRefundComment(
            selectedCandidate["Сумма"] || 0,
            selectedCandidate["Комментарий"] || null,
          ),
        };
      } else {
        const previousDate = selectedCandidate["Дата банкета"];
        const nextDate = format(newBanquetDate, "yyyy-MM-dd");

        if (previousDate === nextDate) {
          throw new Error("Выберите новую дату банкета.");
        }

        updatePayload = {
          ...updatePayload,
          "Сумма": selectedCandidate["Сумма"] ?? null,
          "Дата банкета": nextDate,
          "Комментарий": buildTransferComment(
            previousDate,
            nextDate,
            selectedCandidate["Комментарий"] || null,
          ),
        };
      }

      const omittedColumns = await updatePrepaymentWithFallback(selectedCandidate.id, updatePayload);
      return { omittedColumns };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["prepayments", selectedRestaurantId] });
      setDialogOpen(false);
      resetForm();

      const successMessage =
        actionMode === "create"
          ? "Предоплата добавлена"
          : actionMode === "close"
            ? "Банкет закрыт"
            : actionMode === "refund"
              ? "Возврат сохранен"
              : "Дата банкета изменена";

      toast.success(successMessage);

      if (result.omittedColumns.length > 0) {
        toast.warning("История изменений сохранена не полностью", {
          description: `В базе пока нет колонок: ${result.omittedColumns.join(", ")}. Чтобы комментарии и даты изменений записывались полностью, примените миграцию Supabase.`,
        });
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const periodLabel = isExactPeriodFilter
    ? format(periodDate, "dd.MM.yyyy", { locale: ru })
    : format(periodDate, "LLLL yyyy", { locale: ru });

  const toggleColumn = (column: ColumnKey) => {
    setVisibleColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column],
    );
  };

  const renderCell = (row: Prepayment, column: ColumnKey) => {
    switch (column) {
      case "prepaymentDate":
        return formatDisplayDate(row["Дата предоплаты"]);
      case "client":
        return row["Клиент"] || "—";
      case "banquetDate":
        return formatDisplayDate(row["Дата банкета"]);
      case "amount":
        return `${formatCurrency(getPrepaymentBalanceAmount(row))} ₽`;
      case "createdBy":
        return row["Сотрудник_Создал"] || "—";
      case "comment":
        return row["Комментарий"] || "—";
      case "paymentMethod":
        return row["Способ оплаты"] || "—";
      case "status":
        return row["Статус"] || "—";
      case "changedBy":
        return row["Сотрудник_Изменил"] || "—";
      case "changedAt":
        return formatDisplayDateTime(row["Дата_Изменения"]);
      default:
        return "—";
    }
  };

  if (!selectedRestaurantId) {
    return (
      <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        Выберите ресторан, чтобы открыть раздел предоплат.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold font-serif">Предоплаты</h1>

        <div className="flex flex-wrap items-center gap-3">
          <Popover
            open={calendarOpen.period}
            onOpenChange={(open) => setCalendarOpen((current) => ({ ...current, period: open }))}
          >
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {periodLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={periodDate}
                onSelect={(date) => {
                  if (!date) return;
                  setPeriodDate(date);
                  setIsExactPeriodFilter(true);
                  setCalendarOpen((current) => ({ ...current, period: false }));
                }}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {isExactPeriodFilter ? (
            <Button variant="outline" size="sm" onClick={() => setIsExactPeriodFilter(false)}>
              Сбросить дату
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Columns3 className="mr-2 h-4 w-4" />
                Столбцы
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Показывать в таблице</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((column) => (
                <DropdownMenuCheckboxItem
                  key={column}
                  checked={visibleColumns.includes(column)}
                  onCheckedChange={() => toggleColumn(column)}
                >
                  {COLUMN_LABELS[column]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {canManagePrepayments ? (
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) {
                  resetForm();
                }
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Добавить
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-md">
                <div className="space-y-4 pt-2">
                  <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                    <Label className="text-sm font-medium">Режим операции</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        ["create", "Новая предоплата"],
                        ["close", "Закрытие банкета"],
                        ["refund", "Возврат"],
                        ["transfer", "Перенос даты"],
                      ] as Array<[ActionMode, string]>).map(([mode, label]) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => {
                            setActionMode(mode);
                            setSelectedPrepaymentId(null);
                            setOperationSearch("");
                          }}
                          className={cn(
                            "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                            actionMode === mode
                               ? "border-primary bg-primary/10 text-primary"
                               : "border-border bg-background hover:bg-muted/50",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {actionMode === "create" ? (
                    <>
                      <div className="space-y-1.5">
                        <Label>Клиент</Label>
                        <Input value={client} onChange={(event) => setClient(event.target.value)} />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>Дата предоплаты</Label>
                          <Popover
                            open={calendarOpen.prepayment}
                            onOpenChange={(open) => setCalendarOpen((current) => ({ ...current, prepayment: open }))}
                          >
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(prepaymentDate, "dd.MM.yyyy")}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={prepaymentDate}
                                onSelect={(date) => {
                                  if (!date) return;
                                  setPrepaymentDate(date);
                                  setCalendarOpen((current) => ({ ...current, prepayment: false }));
                                }}
                                className="p-3 pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="space-y-1.5">
                          <Label>Дата банкета</Label>
                          <Popover
                            open={calendarOpen.banquet}
                            onOpenChange={(open) => setCalendarOpen((current) => ({ ...current, banquet: open }))}
                          >
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(banquetDate, "dd.MM.yyyy")}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={banquetDate}
                                onSelect={(date) => {
                                  if (!date) return;
                                  setBanquetDate(date);
                                  setCalendarOpen((current) => ({ ...current, banquet: false }));
                                }}
                                className="p-3 pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Сумма</Label>
                        <Input
                          type="number"
                          value={amount}
                          onChange={(event) => setAmount(event.target.value)}
                          className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Способ оплаты</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите" />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentMethods.map((method) => (
                              <SelectItem key={method} value={method}>
                                {method}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <Label>Поиск предоплаты</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={operationSearch}
                            onChange={(event) => setOperationSearch(event.target.value)}
                            placeholder="Клиент или дата банкета"
                            className="pl-9"
                          />
                        </div>
                      </div>

                      <div className="max-h-56 overflow-y-auto space-y-1 rounded-lg border p-2">
                        {openCandidates.length === 0 ? (
                          <div className="py-6 text-center text-sm text-muted-foreground">
                            Открытых предоплат не найдено.
                          </div>
                        ) : (
                          openCandidates.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setSelectedPrepaymentId(item.id);
                                if (item["Дата банкета"]) {
                                  setNewBanquetDate(new Date(item["Дата банкета"]));
                                }
                              }}
                              className={cn(
                                "w-full rounded-md border px-3 py-2 text-left transition-colors",
                               selectedPrepaymentId === item.id
                                   ? "border-primary bg-primary/10"
                                   : "border-transparent hover:bg-muted/50",
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium">{item["Клиент"]}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Банкет: {formatDisplayDate(item["Дата банкета"])}
                                  </div>
                                </div>
                                <div className="shrink-0 text-sm font-medium">
                                  {formatCurrency(item["Сумма"] || 0)} ₽
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>

                      {actionMode === "transfer" ? (
                        <div className="space-y-1.5">
                          <Label>Новая дата банкета</Label>
                          <Popover
                            open={calendarOpen.transfer}
                            onOpenChange={(open) => setCalendarOpen((current) => ({ ...current, transfer: open }))}
                          >
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(newBanquetDate, "dd.MM.yyyy")}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={newBanquetDate}
                                onSelect={(date) => {
                                  if (!date) return;
                                  setNewBanquetDate(date);
                                  setCalendarOpen((current) => ({ ...current, transfer: false }));
                                }}
                                className="p-3 pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      ) : null}
                    </>
                  )}

                  <Button className="w-full" onClick={() => upsertMutation.mutate()} disabled={upsertMutation.isPending}>
                    {actionMode === "create"
                      ? "Сохранить"
                      : actionMode === "close"
                        ? "Закрыть банкет"
                        : actionMode === "refund"
                          ? "Сохранить возврат"
                          : "Сохранить новую дату"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>

       {!canManagePrepayments ? (
         <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
           Для вашей роли раздел доступен только для просмотра.
         </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Card className="kpi-card kpi-card-muted">
          <CardContent className="pb-4 pt-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Всего</p>
            </div>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(stats.totalSum)} ₽</p>
            <p className="text-sm text-muted-foreground">{stats.totalCount} шт.</p>
          </CardContent>
        </Card>

        <Card className="kpi-card kpi-card-primary">
          <CardContent className="pb-4 pt-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Открытые</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-primary">{formatCurrency(stats.openSum)} ₽</p>
            <p className="text-sm text-primary/70">{stats.openCount} шт.</p>
          </CardContent>
        </Card>

        <Card className="kpi-card kpi-card-sky">
          <CardContent className="pb-4 pt-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-light">
                <CheckCircle2 className="h-4 w-4 text-sky" />
              </div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Закрытые</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-sky">{formatCurrency(stats.closedSum)} ₽</p>
            <p className="text-sm text-sky/70">{stats.closedCount} шт.</p>
          </CardContent>
        </Card>

        <Card className="kpi-card kpi-card-accent">
          <CardContent className="pb-4 pt-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-coral-light">
                <RotateCcw className="h-4 w-4 text-accent" />
              </div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Возвраты</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-accent">{formatCurrency(stats.refundSum)} ₽</p>
            <p className="text-sm text-accent/70">{stats.refundCount} шт.</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Поиск по клиенту, комментарию, дате..."
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="Открыт">Открыт</SelectItem>
            <SelectItem value="Закрыт">Закрыт</SelectItem>
            <SelectItem value="Возврат">Возврат</SelectItem>
          </SelectContent>
        </Select>

        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все оплаты</SelectItem>
            {paymentMethods.map((method) => (
              <SelectItem key={method} value={method}>
                {method}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Загрузка...</div>
      ) : filteredRows.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">Нет данных за {periodLabel}</div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {visibleColumns.map((column) => (
                    <th
                      key={column}
                      className={cn(
                        "px-4 py-3 font-medium text-muted-foreground",
                        column === "amount" ? "text-right" : "text-left",
                      )}
                    >
                      {COLUMN_LABELS[column]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b last:border-0 transition-colors",
                      row["Статус"] === "Закрыт"
                        ? "bg-sky/8 hover:bg-sky/12"
                        : row["Статус"] === "Возврат"
                          ? "bg-accent/8 hover:bg-accent/12"
                          : "hover:bg-muted/30",
                    )}
                  >
                    {visibleColumns.map((column) => (
                      <td
                        key={`${row.id}-${column}`}
                        className={cn(
                          "px-4 py-3",
                          column === "amount" &&
                            (row["Статус"] === "Закрыт"
                              ? "text-right font-mono text-sky"
                              : row["Статус"] === "Возврат"
                                ? "text-right font-mono text-accent"
                                : "text-right font-mono"),
                          column !== "amount" && "text-left",
                        )}
                      >
                        {column === "status" ? (
                          <Badge
                            className={cn(
                              row["Статус"] === "Открыт"
                                 ? "status-active"
                                  : row["Статус"] === "Возврат"
                                    ? "border border-accent/25 bg-accent/10 text-accent hover:bg-accent/10"
                                    : "border border-sky/25 bg-sky/10 text-sky hover:bg-sky/10",
                            )}
                          >
                            {renderCell(row, column)}
                          </Badge>
                        ) : (
                          renderCell(row, column)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
