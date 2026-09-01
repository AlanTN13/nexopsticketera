import { describe, expect, it } from "vitest";

import {
  createCustomDateRange,
  createDateRange,
  filterByDateRange,
  getDateRangeLabel,
} from "@/features/metrics/date-range";

const TODAY = new Date(2026, 7, 31, 12);

describe("shared metrics date ranges", () => {
  it.each([
    ["7d", "2026-08-25"],
    ["14d", "2026-08-18"],
    ["30d", "2026-08-02"],
  ] as const)("builds an inclusive %s range", (preset, expectedStart) => {
    expect(createDateRange(preset, TODAY)).toEqual({
      start: expectedStart,
      end: "2026-08-31",
      preset,
    });
  });

  it("builds current and previous calendar months", () => {
    expect(createDateRange("this_month", TODAY)).toEqual({
      start: "2026-08-01",
      end: "2026-08-31",
      preset: "this_month",
    });
    expect(createDateRange("last_month", new Date(2026, 0, 15, 12))).toEqual({
      start: "2025-12-01",
      end: "2025-12-31",
      preset: "last_month",
    });
  });

  it("uses open bounds for all history", () => {
    expect(createDateRange("all", TODAY)).toEqual({ start: "", end: "", preset: "all" });
  });

  it("filters any channel through its ISO date field", () => {
    const rows = [
      { id: "before", sentAt: "2026-08-17" },
      { id: "start", sentAt: "2026-08-18" },
      { id: "end", sentAt: "2026-08-31" },
      { id: "after", sentAt: "2026-09-01" },
      { id: "undated", sentAt: "" },
    ];

    expect(filterByDateRange(rows, createDateRange("14d", TODAY), (row) => row.sentAt)).toEqual([
      rows[1],
      rows[2],
    ]);
  });

  it("formats custom ranges for the dashboard", () => {
    const range = createCustomDateRange("2026-08-18", "2026-09-01");
    expect(getDateRangeLabel(range)).toBe("18/08/2026 al 01/09/2026");
  });
});
