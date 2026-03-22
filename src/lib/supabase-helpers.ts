/** Parse TEXT numeric column: remove spaces, replace comma with dot, cast to number */
export function parseTextNumeric(value: string | null): number {
  if (!value) return 0;
  const cleaned = value.replace(/\s/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/** Parse 'DD.MM.YYYY' text to Date */
export function parsePeriodDate(value: string | null): Date | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return isNaN(date.getTime()) ? null : date;
}

/** Format number as currency */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}
