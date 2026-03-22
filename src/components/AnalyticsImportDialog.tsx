import { useState } from "react";
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ImportResult = {
  ok: true;
  summary: {
    finance_flows: {
      rowCount: number;
      sliceCount: number;
      periods: string[];
    };
    balance_fact: {
      rowCount: number;
      sliceCount: number;
      periods: string[];
    };
    owners_fact: {
      rowCount: number;
      sliceCount: number;
      periods: string[];
    };
  };
};

type FileState = {
  financeFlows: File | null;
  balanceFact: File | null;
  ownersFact: File | null;
};

const EMPTY_FILES: FileState = {
  financeFlows: null,
  balanceFact: null,
  ownersFact: null,
};

async function getInvokeErrorMessage(error: unknown) {
  if (error instanceof FunctionsHttpError || error instanceof FunctionsRelayError) {
    const response = error.context;

    try {
      const payload = await response.json();
      if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
        return payload.error;
      }
    } catch {
      // ignore json parse errors
    }

    try {
      const text = await response.text();
      if (text.trim()) {
        return text;
      }
    } catch {
      // ignore text read errors
    }
  }

  if (error instanceof FunctionsFetchError) {
    return "Не удалось связаться с Edge Function. Проверьте, что функция import-analytics-csv развернута в Supabase.";
  }

  return error instanceof Error ? error.message : "Не удалось загрузить данные.";
}

function FileField({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="file"
        accept=".csv,text/csv,.txt"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary"
      />
      <p className="text-xs text-muted-foreground">{file ? file.name : "Файл не выбран"}</p>
    </div>
  );
}

export function AnalyticsImportDialog() {
  const queryClient = useQueryClient();
  const { role, isDemoSession } = useRole();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<FileState>(EMPTY_FILES);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (role !== "admin") {
        throw new Error("Загрузка доступна только для администратора.");
      }

      if (isDemoSession) {
        throw new Error("Для загрузки нужен реальный вход под админом, не тестовый режим.");
      }

      if (!files.financeFlows || !files.balanceFact || !files.ownersFact) {
        throw new Error("Выберите все 3 файла.");
      }

      const [financeFlowsCsv, balanceFactCsv, ownersFactCsv] = await Promise.all([
        files.financeFlows.text(),
        files.balanceFact.text(),
        files.ownersFact.text(),
      ]);

      const { data, error } = await supabase.functions.invoke<ImportResult>("import-analytics-csv", {
        body: {
          financeFlowsCsv,
          balanceFactCsv,
          ownersFactCsv,
        },
      });

      if (error) {
        throw new Error(await getInvokeErrorMessage(error));
      }

      if (!data?.ok) {
        throw new Error("Импорт завершился с ошибкой.");
      }

      return data;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["finance_flows"] });
      void queryClient.invalidateQueries({ queryKey: ["balance_fact"] });
      void queryClient.invalidateQueries({ queryKey: ["owners_fact"] });

      setFiles(EMPTY_FILES);
      setOpen(false);

      const importedPeriods = Array.from(
        new Set([
          ...result.summary.finance_flows.periods,
          ...result.summary.balance_fact.periods,
          ...result.summary.owners_fact.periods,
        ]),
      ).sort();

      toast.success(
        `Импорт завершен. Обновлены периоды: ${importedPeriods.join(", ") || "без периода"}.`,
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить данные.");
    },
  });

  if (role !== "admin") {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setFiles(EMPTY_FILES);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={isDemoSession}>
          <Upload className="h-4 w-4" />
          Загрузить новые данные
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Загрузка данных аналитики</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
            Загружайте полный срез только за те периоды, которые хотите заменить.
            <br />
            Пример: если добавляете февраль 2026, выгружайте только февраль 2026. Если пришла корректировка за
            декабрь 2025, загружайте только декабрь 2025.
          </div>

          {isDemoSession ? (
            <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-3 text-sm text-accent">
              В тестовом режиме импорт недоступен. Для загрузки данных войдите под реальным админом.
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <FileField
              label="finance_flows.csv"
              file={files.financeFlows}
              onChange={(file) => setFiles((current) => ({ ...current, financeFlows: file }))}
            />
            <FileField
              label="balance_fact.csv"
              file={files.balanceFact}
              onChange={(file) => setFiles((current) => ({ ...current, balanceFact: file }))}
            />
            <FileField
              label="owners_fact.csv"
              file={files.ownersFact}
              onChange={(file) => setFiles((current) => ({ ...current, ownersFact: file }))}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending || isDemoSession}>
              {importMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Загружаем
                </>
              ) : (
                "Импортировать"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
