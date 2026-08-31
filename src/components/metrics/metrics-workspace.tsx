"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";

import { filterRowsByDateRange } from "@/features/metrics/csv-parser";
import {
  Client,
  DateRangeFilter,
  MailchimpCampaignRow,
  SheetRow,
} from "@/features/metrics/types";

type Channel = "meta" | "emailing";

const ClientDashboard = dynamic(() =>
  import("@/components/metrics/client-dashboard").then((module) => module.ClientDashboard),
);
const ClientEmailingDashboard = dynamic(() =>
  import("@/components/metrics/client-emailing-dashboard").then(
    (module) => module.ClientEmailingDashboard,
  ),
);

const PERIODS: Array<{ label: string; value: DateRangeFilter["preset"]; days?: number }> = [
  { label: "7 días", value: "7d", days: 7 },
  { label: "14 días", value: "14d", days: 14 },
  { label: "30 días", value: "30d", days: 30 },
  { label: "Todo", value: "all" },
];

function period(value: DateRangeFilter["preset"]): DateRangeFilter {
  const today = new Date();
  const end = today.toISOString().split("T")[0];
  const selected = PERIODS.find((item) => item.value === value);
  if (!selected?.days) return { start: "2020-01-01", end: "2035-12-31", preset: "all" };
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - selected.days);
  return { start: startDate.toISOString().split("T")[0], end, preset: value };
}

export function MetricsWorkspace({
  client,
  metaRows,
  mailchimpRows,
}: {
  client: Client;
  metaRows: SheetRow[];
  mailchimpRows: MailchimpCampaignRow[];
}) {
  const [channel, setChannel] = useState<Channel>(metaRows.length > 0 ? "meta" : "emailing");
  const [dateRange, setDateRange] = useState<DateRangeFilter>(() => period("30d"));
  const filteredMetaRows = useMemo(
    () => filterRowsByDateRange(metaRows, dateRange.start, dateRange.end),
    [dateRange, metaRows],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
      <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">Reportería de marketing</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-950">{client.name}</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1" aria-label="Canal de reportería">
              <button
                type="button"
                onClick={() => setChannel("meta")}
                className={`min-h-10 rounded-lg px-4 text-sm font-semibold ${channel === "meta" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
              >
                Meta Ads
              </button>
              {client.mailchimpName ? (
                <button
                  type="button"
                  onClick={() => setChannel("emailing")}
                  className={`min-h-10 rounded-lg px-4 text-sm font-semibold ${channel === "emailing" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
                >
                  Emailing
                </button>
              ) : null}
            </div>
            {channel === "meta" ? (
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
                Período
                <select
                  value={dateRange.preset}
                  onChange={(event) => setDateRange(period(event.target.value as DateRangeFilter["preset"]))}
                  className="bg-transparent font-semibold text-slate-950 outline-none"
                >
                  {PERIODS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </div>
      </div>

      {channel === "meta" ? (
        <ClientDashboard
          client={client}
          rows={filteredMetaRows}
          dateRangeLabel={PERIODS.find((item) => item.value === dateRange.preset)?.label ?? "Período"}
        />
      ) : (
        <ClientEmailingDashboard client={client} allMailchimpRows={mailchimpRows} />
      )}
    </div>
  );
}
