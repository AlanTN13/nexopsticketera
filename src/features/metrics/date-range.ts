import type { DateRangeFilter } from "@/features/metrics/types";

export type StandardDateRangePreset = Exclude<DateRangeFilter["preset"], "custom">;

export const DATE_RANGE_PRESETS: ReadonlyArray<{
  value: StandardDateRangePreset;
  label: string;
}> = [
  { value: "7d", label: "Últimos 7 días" },
  { value: "14d", label: "Últimos 14 días" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "this_month", label: "Este mes" },
  { value: "last_month", label: "Mes anterior" },
  { value: "all", label: "Todo el histórico" },
];

function formatLocalDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function moveDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function createDateRange(
  preset: StandardDateRangePreset,
  today = new Date(),
): DateRangeFilter {
  const end = formatLocalDate(today);

  if (preset === "all") {
    return { start: "", end: "", preset };
  }

  if (preset === "this_month") {
    return {
      start: formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      end,
      preset,
    };
  }

  if (preset === "last_month") {
    return {
      start: formatLocalDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      end: formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 0)),
      preset,
    };
  }

  const days = preset === "7d" ? 7 : preset === "14d" ? 14 : 30;
  return {
    start: formatLocalDate(moveDays(today, -(days - 1))),
    end,
    preset,
  };
}

export function createCustomDateRange(start: string, end: string): DateRangeFilter {
  return { start, end, preset: "custom" };
}

function formatDisplayDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function getDateRangeLabel(range: DateRangeFilter): string {
  if (range.preset === "custom") {
    return `${formatDisplayDate(range.start)} al ${formatDisplayDate(range.end)}`;
  }

  return DATE_RANGE_PRESETS.find((item) => item.value === range.preset)?.label ?? "Período";
}

export function filterByDateRange<T>(
  rows: T[],
  range: DateRangeFilter,
  getDate: (row: T) => string,
): T[] {
  if (!range.start && !range.end) return rows;

  return rows.filter((row) => {
    const date = getDate(row);
    if (!date) return false;
    if (range.start && date < range.start) return false;
    if (range.end && date > range.end) return false;
    return true;
  });
}
