"use client";

import { useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";

import {
  createCustomDateRange,
  createDateRange,
  DATE_RANGE_PRESETS,
  getDateRangeLabel,
} from "@/features/metrics/date-range";
import type { StandardDateRangePreset } from "@/features/metrics/date-range";
import type { DateRangeFilter } from "@/features/metrics/types";

const QUICK_PRESETS: ReadonlyArray<{
  value: StandardDateRangePreset;
  label: string;
}> = [
  { value: "this_month", label: "Este mes" },
  { value: "14d", label: "14 días" },
  { value: "all", label: "Histórico" },
];

export function MetricsDateFilter({
  value,
  onChange,
}: {
  value: DateRangeFilter;
  onChange: (range: DateRangeFilter) => void;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [customStart, setCustomStart] = useState(value.start);
  const [customEnd, setCustomEnd] = useState(value.end);
  const customRangeIsValid = Boolean(customStart && customEnd && customStart <= customEnd);

  const closeMenu = () => menuRef.current?.removeAttribute("open");

  const selectPreset = (preset: StandardDateRangePreset) => {
    onChange(createDateRange(preset));
    closeMenu();
  };

  const applyCustomRange = () => {
    if (!customRangeIsValid) return;
    onChange(createCustomDateRange(customStart, customEnd));
    closeMenu();
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div
        className="grid grid-cols-3 rounded-lg border border-slate-200 bg-slate-100 p-1"
        aria-label="Rangos de fecha rápidos"
      >
        {QUICK_PRESETS.map((item) => {
          const selected = value.preset === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => selectPreset(item.value)}
              aria-pressed={selected}
              className={`min-h-9 rounded-md px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                selected
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <details
        ref={menuRef}
        className="group relative"
        onToggle={(event) => {
          if (!event.currentTarget.open) return;
          const fallback = createDateRange("30d");
          setCustomStart(value.start || fallback.start);
          setCustomEnd(value.end || fallback.end);
        }}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-xs transition hover:border-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 [&::-webkit-details-marker]:hidden">
          <CalendarDays className="h-4 w-4 text-[#6d5bd0]" aria-hidden="true" />
          <span className="min-w-32">{getDateRangeLabel(value)}</span>
          <ChevronDown
            className="ml-auto h-4 w-4 text-slate-400 transition group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>

        <div className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Rangos predefinidos
          </p>
          <div className="space-y-1">
            {DATE_RANGE_PRESETS.map((item) => {
              const selected = value.preset === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => selectPreset(item.value)}
                  aria-pressed={selected}
                  className={`flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                    selected
                      ? "bg-[#151b31] text-white"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  {item.label}
                  {selected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-t border-slate-200 pt-3">
            <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Personalizado
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-slate-600">
                Desde
                <input
                  type="date"
                  value={customStart}
                  max={customEnd || undefined}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Hasta
                <input
                  type="date"
                  value={customEnd}
                  min={customStart || undefined}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={applyCustomRange}
              disabled={!customRangeIsValid}
              className="mt-3 min-h-10 w-full rounded-lg bg-[#4330a6] px-4 text-sm font-bold text-white transition hover:bg-[#37258f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              Aplicar
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}
