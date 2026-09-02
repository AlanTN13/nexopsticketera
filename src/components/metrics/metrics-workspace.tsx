"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";

import { MetricsDateFilter } from "@/components/metrics/metrics-date-filter";
import { KommoEmbed } from "@/components/metrics/kommo-embed";
import { filterMailchimpRowsForClient } from "@/features/metrics/csv-parser";
import {
  createDateRange,
  filterByDateRange,
  getDateRangeLabel,
} from "@/features/metrics/date-range";
import { getInitialMetricsChannel, type MetricsChannel as Channel } from "@/lib/metrics-channels";
import type {
  Client,
  DateRangeFilter,
  MailchimpCampaignRow,
  SheetRow,
} from "@/features/metrics/types";

const ClientDashboard = dynamic(() =>
  import("@/components/metrics/client-dashboard").then((module) => module.ClientDashboard),
);
const ClientEmailingDashboard = dynamic(() =>
  import("@/components/metrics/client-emailing-dashboard").then(
    (module) => module.ClientEmailingDashboard,
  ),
);

export function MetricsWorkspace({
  client,
  metaRows,
  mailchimpRows,
  metaAdsEnabled,
  kommoEmbedUrl,
}: {
  client: Client;
  metaRows: SheetRow[];
  mailchimpRows: MailchimpCampaignRow[];
  metaAdsEnabled: boolean;
  kommoEmbedUrl?: string;
}) {
  const [channel, setChannel] = useState<Channel | null>(() =>
    getInitialMetricsChannel({
      metaAdsEnabled,
      emailingEnabled: Boolean(client.mailchimpName),
      kommoEnabled: Boolean(kommoEmbedUrl),
    }),
  );
  const [dateRange, setDateRange] = useState<DateRangeFilter>(() => createDateRange("30d"));
  const filteredMetaRows = useMemo(
    () => filterByDateRange(metaRows, dateRange, (row) => row.day),
    [dateRange, metaRows],
  );
  const clientMailchimpRows = useMemo(
    () => filterMailchimpRowsForClient(mailchimpRows, client),
    [client, mailchimpRows],
  );
  const filteredMailchimpRows = useMemo(
    () => filterByDateRange(clientMailchimpRows, dateRange, (row) => row.sendDate),
    [clientMailchimpRows, dateRange],
  );
  const dateRangeLabel = getDateRangeLabel(dateRange);

  return (
    <section className="portal-metrics-skin overflow-hidden rounded-xl border border-slate-200 bg-[#f9fafb] shadow-sm">
      <div className="border-b border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold text-[#6d5bd0]">Reportería de marketing</p>
            <h2 className="mt-1 text-lg font-bold tracking-[-0.02em] text-[#111827]">{client.name}</h2>
            <p className="mt-1 text-sm text-[#596273]">Indicadores y campañas de la cuenta vinculada a tu empresa.</p>
          </div>
          <div className="flex flex-col gap-3 xl:items-end">
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1" aria-label="Canal de reportería">
              {metaAdsEnabled ? (
                <button
                  type="button"
                  onClick={() => setChannel("meta")}
                  aria-pressed={channel === "meta"}
                  className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${channel === "meta" ? "bg-[#4330a6] text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-950"}`}
                >
                  Meta Ads
                </button>
              ) : null}
              {client.mailchimpName ? (
                <button
                  type="button"
                  onClick={() => setChannel("emailing")}
                  aria-pressed={channel === "emailing"}
                  className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${channel === "emailing" ? "bg-[#4330a6] text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-950"}`}
                >
                  Emailing
                </button>
              ) : null}
              {kommoEmbedUrl ? (
                <button
                  type="button"
                  onClick={() => setChannel("kommo")}
                  aria-pressed={channel === "kommo"}
                  className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${channel === "kommo" ? "bg-[#4330a6] text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-950"}`}
                >
                  Kommo
                </button>
              ) : null}
            </div>
            {channel && channel !== "kommo" ? (
              <MetricsDateFilter value={dateRange} onChange={setDateRange} />
            ) : channel === "kommo" ? (
              <p className="text-xs font-medium text-slate-500">
                El período se controla dentro del reporte de Kommo.
              </p>
            ) : null}
            {!kommoEmbedUrl ? (
              <p className="max-w-md rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                Kommo no está disponible para esta empresa porque todavía no tiene un reporte configurado.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {channel === "meta" && metaAdsEnabled ? (
        <ClientDashboard
          client={client}
          rows={filteredMetaRows}
          hasSourceData={metaRows.length > 0}
          dateRangeLabel={dateRangeLabel}
        />
      ) : channel === "emailing" && client.mailchimpName ? (
        <ClientEmailingDashboard
          client={client}
          rows={filteredMailchimpRows}
          hasSourceData={clientMailchimpRows.length > 0}
          dateRangeLabel={dateRangeLabel}
        />
      ) : channel === "kommo" ? (
        <KommoEmbed companyName={client.name} url={kommoEmbedUrl} />
      ) : (
        <div className="grid min-h-72 place-items-center bg-white px-6 py-12 text-center">
          <div className="max-w-md">
            <h3 className="text-base font-semibold text-slate-950">No hay canales de reportería disponibles</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              NexOps todavía no configuró una fuente de métricas para esta empresa.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
