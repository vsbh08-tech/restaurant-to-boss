import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowUpDown, CalendarIcon, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const incomeCategories = ["Предоплата", "Возврат", "Перевод", "Прочие поступления"];
const expenseCategories = [
  "Закупка",
  "Заработная плата",
  "Выплата комиссии",
  "Хоз расходы",
  "П/о суммы",
  "Музыканты",
  "Прочие расходы",
  "Перевод",
];

type EntryMode = "new" | "correction";
type SortKey = "date" | "type" | "category";
type BarCalendarKey = "selected" | "entry" | "manager";

type BarTransaction = {
  id: string;
  created_at: string;
  restaurant_id: string | null;
  "Дата": string | null;
  "Бармен": string | null;
  "Сотрудник": string | null;
  "Тип": string | null;
  "Категория": string | null;
  "Сумма": number | null;
  "Исправление": string | null;
};

type BarEntryView = {
  id: string;
  createdAt: string;
  dateKey: string;
  type: string;
  category: string;
  amount: number;
  correction: "Да" | "Нет";
};

type BarTransactionInsert = Database["public"]["Tables"]["bar_transactions"]["Insert"] & {
  "Исправление"?: string | null;
  "Сотрудник"?: string | null;
};

function formatIsoDate(value: string | null) {
  if (!value) return "—";

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;

  return `${day}.${month}.${year}`;
}

function getSignedAmount(entry: Pick<BarEntryView, "type" | "amount">) {
  return entry.type === "Приход" ? entry.amount : -entry.amount;
}

function getCorrectionKey(entry: Pick<BarEntryView, "dateKey" | "type" | "category" | "amount">) {
  return [entry.dateKey, entry.type, entry.category, Math.abs(entry.amount)].join("::");
}

function parseAmountValue(value: string) {
  const normalized = value.replace(",", ".").trim();
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getVisibleEntries(entries: BarEntryView[]) {
  const originalEntries = entries.filter((entry) => entry.correction === "Нет");
  const correctionEntries = entries.filter((entry) => entry.correction === "Да");

  const correctionCounts = correctionEntries.reduce((map, entry) => {
    const key = getCorrectionKey(entry);
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map<string, number>());

  const visibleOriginals = originalEntries.filter((entry) => {
    const key = getCorrectionKey(entry);
    const matchedCorrections = correctionCounts.get(key) ?? 0;

    if (matchedCorrections === 0) {
      return true;
    }

    correctionCounts.set(key, matchedCorrections - 1);
    return false;
  });

  const originalCounts = originalEntries.reduce((map, entry) => {
    const key = getCorrectionKey(entry);
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map<string, number>());

  const visibleCorrections = correctionEntries.filter((entry) => {
    const key = getCorrectionKey(entry);
    const matchedOriginals = originalCounts.get(key) ?? 0;

    if (matchedOriginals === 0) {
      return true;
    }

    originalCounts.set(key, matchedOriginals - 1);
    return false;
  });

  return [...visibleOriginals, ...visibleCorrections];
}

function getBarErrorMessage(error: Error) {
  if (
    error.message.includes("Исправление") ||
    error.message.includes("schema cache") ||
    error.message.includes("Could not find the")
  ) {
    return "Чтобы удаление записей работало, нужно один раз применить SQL-изменение в Supabase.";
  }

  return error.message;
}

export default function BarPage() {
  const queryClient = useQueryClient();
  const { role, selectedRestaurantId, userName } = useRole();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [managerDialogOpen, setManagerDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isExactDateFilter, setIsExactDateFilter] = useState(false);
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [managerEntryDate, setManagerEntryDate] = useState<Date>(new Date());
  const [entryType, setEntryType] = useState<string>("Приход");
  const [category, setCategory] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [cashAmount, setCashAmount] = useState("");
  const [banquetCashAmount, setBanquetCashAmount] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [entryMode, setEntryMode] = useState<EntryMode>("new");
  const [selectedCorrectionId, setSelectedCorrectionId] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState<Record<BarCalendarKey, boolean>>({
    selected: false,
    entry: false,
    manager: false,
  });

  const selectedDateKey = format(selectedDate, "yyyy-MM-dd");
  const entryDateKey = format(entryDate, "yyyy-MM-dd");
  const categories = entryType === "Приход" ? incomeCategories : expenseCategories;
  const canUseBartenderForm = role === "bartender";
  const canUseManagerForm = role === "manager";
  const isViewOnlyBar = role === "supervisor" || role === "admin";

  const now = new Date();
  const todayKey = format(now, "yyyy-MM-dd");
  const previousDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const previousDayKey = format(previousDay, "yyyy-MM-dd");
  const isBeforeCorrectionCutoff = now.getHours() < 8;
  const editableCorrectionDateKey = isBeforeCorrectionCutoff ? previousDayKey : todayKey;
  const canCorrectSelectedDate = selectedDateKey === editableCorrectionDateKey;
  const editableEntryDateKey = isBeforeCorrectionCutoff ? previousDayKey : todayKey;
  const canCreateForEntryDate = entryDateKey === editableEntryDateKey;

  const correctionHint =
    selectedDateKey !== editableCorrectionDateKey
      ? isBeforeCorrectionCutoff
        ? "До 08:00 исправления доступны только за предыдущий день. Выберите его в календаре."
        : "После 08:00 исправления доступны только за текущий день. Выберите его в календаре."
      : null;
  const newEntryHint =
    entryDateKey !== editableEntryDateKey
      ? isBeforeCorrectionCutoff
        ? "До 08:00 новые записи можно добавлять только за предыдущий день."
        : "После 08:00 новые записи можно добавлять только за текущий день."
      : null;

  const resetForm = (baseDate: Date = selectedDate) => {
    setEntryDate(baseDate);
    setEntryType("Приход");
    setCategory("");
    setAmount("");
    setEntryMode("new");
    setSelectedCorrectionId(null);
    setCalendarOpen((current) => ({ ...current, entry: false }));
  };

  const resetManagerForm = () => {
    setManagerEntryDate(new Date());
    setCashAmount("");
    setBanquetCashAmount("");
    setCalendarOpen((current) => ({ ...current, manager: false }));
  };

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["bar_transactions", selectedRestaurantId],
    enabled: Boolean(selectedRestaurantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bar_transactions")
        .select("*")
        .eq("restaurant_id", selectedRestaurantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as BarTransaction[];
    },
  });

  const normalizedEntries = useMemo<BarEntryView[]>(
    () =>
      entries
        .map((entry) => ({
          id: entry.id,
          createdAt: entry.created_at || "",
          dateKey: entry["Дата"] || "",
          type: entry["Тип"] || "",
          category: entry["Категория"] || "Без категории",
          amount: entry["Сумма"] || 0,
          correction: entry["Исправление"] === "Да" ? ("Да" as const) : ("Нет" as const),
        }))
        .filter((entry) => entry.dateKey),
    [entries],
  );

  const dayEntries = useMemo(
    () =>
      normalizedEntries
        .filter((entry) => entry.dateKey === selectedDateKey)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [normalizedEntries, selectedDateKey],
  );

  const correctionCandidates = useMemo(
    () => {
      const originalEntries = getVisibleEntries(dayEntries)
        .filter((entry) => entry.correction === "Нет")
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      return originalEntries;
    },
    [dayEntries],
  );

  const visibleDayEntries = useMemo(() => {
    return getVisibleEntries(dayEntries).sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }, [dayEntries]);

  const monthEntries = useMemo(() => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);

    return normalizedEntries.filter((entry) => {
      const entryDateValue = new Date(entry.dateKey);
      return entryDateValue >= monthStart && entryDateValue <= monthEnd;
    });
  }, [normalizedEntries, selectedDate]);

  const visibleMonthEntries = useMemo(() => getVisibleEntries(monthEntries), [monthEntries]);

  const tableEntries = useMemo(
    () => (isExactDateFilter ? visibleDayEntries : visibleMonthEntries),
    [isExactDateFilter, visibleDayEntries, visibleMonthEntries],
  );

  const filteredTableEntries = useMemo(() => {
    const normalizedSearch = tableSearch.trim().toLowerCase();
    const filteredEntries = normalizedSearch
      ? tableEntries.filter((entry) => {
          const displayDate = formatIsoDate(entry.dateKey).toLowerCase();
          return (
            displayDate.includes(normalizedSearch) ||
            entry.type.toLowerCase().includes(normalizedSearch) ||
            entry.category.toLowerCase().includes(normalizedSearch)
          );
        })
      : tableEntries;

    return [...filteredEntries].sort((left, right) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;

      if (sortKey === "date") {
        const dateComparison = left.dateKey.localeCompare(right.dateKey) || left.createdAt.localeCompare(right.createdAt);
        return dateComparison * multiplier;
      }

      if (sortKey === "type") {
        const typeComparison = left.type.localeCompare(right.type, "ru") || left.dateKey.localeCompare(right.dateKey);
        return typeComparison * multiplier;
      }

      const categoryComparison =
        left.category.localeCompare(right.category, "ru") || left.dateKey.localeCompare(right.dateKey);

      return categoryComparison * multiplier;
    });
  }, [sortDirection, sortKey, tableEntries, tableSearch]);

  const openingBalance = useMemo(
    () =>
      normalizedEntries
        .filter((entry) => entry.dateKey < selectedDateKey)
        .reduce((sum, entry) => sum + getSignedAmount(entry), 0),
    [normalizedEntries, selectedDateKey],
  );

  const dayTurnover = useMemo(
    () => dayEntries.reduce((sum, entry) => sum + getSignedAmount(entry), 0),
    [dayEntries],
  );

  const closingBalance = openingBalance + dayTurnover;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRestaurantId) {
        throw new Error("Сначала выберите ресторан.");
      }
      if (entryMode === "correction") {
        if (!canCorrectSelectedDate) {
          throw new Error(correctionHint || "Исправление сейчас недоступно.");
        }

        const sourceEntry = correctionCandidates.find((entry) => entry.id === selectedCorrectionId);
        if (!sourceEntry) {
          throw new Error("Выберите операцию, которую хотите удалить.");
        }

        const correctionPayload: BarTransactionInsert = {
          restaurant_id: selectedRestaurantId,
          "Дата": sourceEntry.dateKey,
          "Тип": sourceEntry.type,
          "Категория": sourceEntry.category,
          "Сумма": -sourceEntry.amount,
          "Исправление": "Да",
          "Сотрудник": userName,
        };

        const { error } = await supabase.from("bar_transactions").insert([correctionPayload]);
        if (error) throw error;
        return;
      }

      const numAmount = parseFloat(amount);
      if (!category || isNaN(numAmount) || numAmount <= 0) {
        throw new Error("Заполните все поля.");
      }

      if (!canCreateForEntryDate) {
        throw new Error(newEntryHint || "Эта дата сейчас недоступна для новой записи.");
      }

      const insertPayload: BarTransactionInsert = {
        restaurant_id: selectedRestaurantId,
        "Дата": format(entryDate, "yyyy-MM-dd"),
        "Тип": entryType,
        "Категория": category,
        "Сумма": numAmount,
        "Сотрудник": userName,
        "Исправление": "Нет",
      };

      const { error } = await supabase.from("bar_transactions").insert([insertPayload]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bar_transactions"] });
      setDialogOpen(false);
      resetForm(selectedDate);
      toast.success(entryMode === "correction" ? "Запись удалена" : "Запись добавлена");
    },
    onError: (error) => toast.error(getBarErrorMessage(error)),
  });

  const managerSaveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRestaurantId) {
        throw new Error("Сначала выберите ресторан.");
      }

      const parsedCashAmount = parseAmountValue(cashAmount);
      const parsedBanquetCashAmount = parseAmountValue(banquetCashAmount);

      if (!parsedCashAmount && !parsedBanquetCashAmount) {
        throw new Error("Заполните Наличность или Банкет наличные.");
      }

      const managerEntries: BarTransactionInsert[] = [];

      if (parsedCashAmount) {
        managerEntries.push({
          restaurant_id: selectedRestaurantId,
          "Сотрудник": userName,
          "Исправление": "Нет",
          "Дата": format(managerEntryDate, "yyyy-MM-dd"),
          "Тип": "Приход",
          "Категория": "Наличность",
          "Сумма": parsedCashAmount,
        });
      }

      if (parsedBanquetCashAmount) {
        managerEntries.push({
          restaurant_id: selectedRestaurantId,
          "Сотрудник": userName,
          "Исправление": "Нет",
          "Дата": format(managerEntryDate, "yyyy-MM-dd"),
          "Тип": "Приход",
          "Категория": "Банкет наличные",
          "Сумма": parsedBanquetCashAmount,
        });
      }

      const { error } = await supabase.from("bar_transactions").insert(managerEntries);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bar_transactions"] });
      setManagerDialogOpen(false);
      resetManagerForm();
      toast.success("Данные R-Keeper добавлены");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleTypeChange = (type: string) => {
    setEntryType(type);
    setCategory("");
  };

  const handleAddOpen = () => {
    resetForm(selectedDate);
    setDialogOpen(true);
  };

  const handleManagerOpen = () => {
    resetManagerForm();
    setManagerDialogOpen(true);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(key === "date" ? "desc" : "asc");
  };

  const selectedDateLabel = format(selectedDate, "dd.MM.yyyy");
  const monthLabel = format(selectedDate, "LLLL yyyy", { locale: ru });
  const calendarLabel = isExactDateFilter ? selectedDateLabel : monthLabel;
  const tablePeriodLabel = isExactDateFilter ? selectedDateLabel : monthLabel;
  const tableDescription = isExactDateFilter
    ? `Показаны операции ровно за выбранную дату ${selectedDateLabel}.`
    : `Показаны все операции за ${monthLabel}, остатки выше считаются по выбранной дате ${selectedDateLabel}.`;

  if (!selectedRestaurantId) {
    return (
      <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        Выберите ресторан, чтобы открыть кассу.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold font-serif">Бар</h1>
        <div className="flex items-center gap-3">
          <Popover
            open={calendarOpen.selected}
            onOpenChange={(open) => setCalendarOpen((current) => ({ ...current, selected: open }))}
          >
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {calendarLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (!date) return;
                  setSelectedDate(date);
                  setIsExactDateFilter(true);
                  setCalendarOpen((current) => ({ ...current, selected: false }));
                }}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {isExactDateFilter ? (
            <Button variant="outline" size="sm" onClick={() => setIsExactDateFilter(false)}>
              Сбросить дату
            </Button>
          ) : null}

          {canUseManagerForm ? (
            <Button
              variant="outline"
              onClick={handleManagerOpen}
              className="hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
            >
              R-Keeper
            </Button>
          ) : null}

          {canUseBartenderForm ? (
            <Button onClick={handleAddOpen}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить
            </Button>
          ) : null}
        </div>
      </div>

      {isViewOnlyBar ? (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          Для вашей роли раздел доступен только для просмотра.
        </div>
      ) : null}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm(selectedDate);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Запись по бару</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Режим операции</Label>
                <p className="text-xs text-muted-foreground">Выберите, что вы хотите сделать в этом окне.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEntryMode("new");
                    setSelectedCorrectionId(null);
                  }}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left transition-colors",
                     entryMode === "new"
                       ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-muted/50",
                  )}
                >
                  <div className="text-sm font-medium">Новая запись</div>
                  <div className="mt-1 text-xs text-muted-foreground">Добавить новую операцию</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEntryMode("correction");
                    setSelectedCorrectionId(null);
                  }}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left transition-colors",
                     entryMode === "correction"
                       ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-muted/50",
                  )}
                >
                  <div className="text-sm font-medium">Исправление</div>
                  <div className="mt-1 text-xs text-muted-foreground">Удалить ошибочную операцию</div>
                </button>
              </div>
            </div>

            {entryMode === "correction" ? (
              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                  {correctionHint || "Выберите операцию из таблицы, которую хотите удалить."}
                </div>

                {canCorrectSelectedDate && correctionCandidates.length > 0 ? (
                  <div className="max-h-56 overflow-y-auto space-y-1 rounded-lg border p-2">
                    {correctionCandidates.map((entry) => {
                      const effectiveAmount = getSignedAmount(entry);

                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => setSelectedCorrectionId(entry.id)}
                          className={cn(
                            "w-full rounded-md border px-3 py-2 text-left transition-colors",
                             selectedCorrectionId === entry.id
                               ? "border-primary bg-primary/10"
                              : "border-transparent hover:bg-muted/50",
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{entry.category}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatIsoDate(entry.dateKey)} • {entry.type}
                              </div>
                            </div>
                            <div
                              className={cn(
                                "shrink-0 font-mono text-sm font-medium",
                                 effectiveAmount >= 0 ? "text-primary" : "text-accent",
                              )}
                            >
                              {effectiveAmount >= 0 ? "+" : "−"}
                              {formatCurrency(Math.abs(effectiveAmount))} ₽
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : canCorrectSelectedDate ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    На выбранную дату нет операций для удаления.
                  </div>
                ) : null}

                <Button
                  className="w-full"
                  onClick={() => saveMutation.mutate()}
                  disabled={!canCorrectSelectedDate || !selectedCorrectionId || saveMutation.isPending}
                >
                  Удалить запись
                </Button>

                <p className="text-xs text-muted-foreground">
                  После удаления правильную операцию нужно внести отдельно через режим «Новая запись».
                </p>
              </div>
            ) : (
              <>
                {newEntryHint ? (
                  <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                    {newEntryHint}
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Дата</Label>
                    <Popover
                      open={calendarOpen.entry}
                      onOpenChange={(open) => setCalendarOpen((current) => ({ ...current, entry: open }))}
                    >
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(entryDate, "dd.MM.yyyy")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={entryDate}
                          onSelect={(date) => {
                            if (!date) return;
                            setEntryDate(date);
                            setCalendarOpen((current) => ({ ...current, entry: false }));
                          }}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Тип</Label>
                    <Select value={entryType} onValueChange={handleTypeChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Приход">Приход</SelectItem>
                        <SelectItem value="Расход">Расход</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Категория</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Сумма</Label>
                    <Input
                      type="number"
                      min="0"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="0"
                      className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={!canCreateForEntryDate || saveMutation.isPending}>
                  Сохранить
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={managerDialogOpen}
        onOpenChange={(open) => {
          setManagerDialogOpen(open);
          if (!open) resetManagerForm();
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Данные R-Keeper</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
              Внесите суммы из R-Keeper. Дата - это дата, за которую закрывается отчет.
            </div>

            <div className="space-y-1.5">
              <Label>Дата</Label>
              <Popover
                open={calendarOpen.manager}
                onOpenChange={(open) => setCalendarOpen((current) => ({ ...current, manager: open }))}
              >
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(managerEntryDate, "dd.MM.yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={managerEntryDate}
                    onSelect={(date) => {
                      if (!date) return;
                      setManagerEntryDate(date);
                      setCalendarOpen((current) => ({ ...current, manager: false }));
                    }}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label>Наличность</Label>
              <Input
                type="number"
                min="0"
                value={cashAmount}
                onChange={(event) => setCashAmount(event.target.value)}
                placeholder="0"
                className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Банкет наличные</Label>
              <Input
                type="number"
                min="0"
                value={banquetCashAmount}
                onChange={(event) => setBanquetCashAmount(event.target.value)}
                placeholder="0"
                className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>

            <Button className="w-full" onClick={() => managerSaveMutation.mutate()} disabled={managerSaveMutation.isPending}>
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="kpi-card kpi-card-primary">
          <CardContent className="py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">На начало {selectedDateLabel}</p>
            <p className="mt-1 text-xl font-bold leading-none text-primary">{formatCurrency(openingBalance)} ₽</p>
          </CardContent>
        </Card>

        <Card className="kpi-card kpi-card-accent">
          <CardContent className="py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">На конец {selectedDateLabel}</p>
            <p className="mt-1 text-xl font-bold leading-none text-accent">{formatCurrency(closingBalance)} ₽</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="text-sm font-medium">Записи за {tablePeriodLabel}</p>
            <p className="text-xs text-muted-foreground">{tableDescription}</p>
          </div>

          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={tableSearch}
              onChange={(event) => setTableSearch(event.target.value)}
              placeholder="Поиск по дате, типу, категории"
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  <button type="button" onClick={() => handleSort("date")} className="inline-flex items-center gap-1 hover:text-foreground">
                    Дата
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  <button type="button" onClick={() => handleSort("type")} className="inline-flex items-center gap-1 hover:text-foreground">
                    Тип
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  <button type="button" onClick={() => handleSort("category")} className="inline-flex items-center gap-1 hover:text-foreground">
                    Категория
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Сумма</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                    Загрузка...
                  </td>
                </tr>
              ) : filteredTableEntries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                    Нет записей за {tablePeriodLabel}
                  </td>
                </tr>
              ) : (
                filteredTableEntries.map((entry) => {
                  const effectiveAmount = getSignedAmount(entry);

                  return (
                    <tr key={entry.id} className="border-b last:border-0 transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">{formatIsoDate(entry.dateKey)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                             effectiveAmount >= 0 ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent",
                          )}
                        >
                          {entry.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span>{entry.category}</span>
                          {entry.correction === "Да" ? (
                             <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                               исправление
                             </span>
                          ) : null}
                        </div>
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right font-mono font-medium",
                          effectiveAmount >= 0 ? "text-primary" : "text-accent",
                        )}
                      >
                        {effectiveAmount >= 0 ? "+" : "−"}
                        {formatCurrency(Math.abs(effectiveAmount))} ₽
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
