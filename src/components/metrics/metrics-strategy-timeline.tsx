import { ArrowUpRight, BookOpenCheck, CalendarDays, Megaphone } from "lucide-react";

import type { StrategyEntry } from "@/features/metrics/types";

function formattedDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function typeLabel(type: StrategyEntry["type"]) {
  if (type === "reunion") return "Reunión";
  if (type === "ajuste") return "Ajuste de pauta";
  if (type === "proximos_pasos") return "Próximos pasos";
  return "Observación";
}

export function MetricsStrategyTimeline({
  companyName,
  initialStrategy,
  entries,
}: {
  companyName: string;
  initialStrategy?: string;
  entries: StrategyEntry[];
}) {
  if (!initialStrategy && entries.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 bg-[linear-gradient(135deg,#f7f5ff,#f8fbff)] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700">
            <BookOpenCheck size={19} />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-700">Estrategia conectada</p>
            <h2 className="mt-1 text-xl font-bold tracking-[-0.025em] text-slate-950">
              Bitácora de {companyName}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Decisiones, observaciones y próximos movimientos de las campañas.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <article className="rounded-xl border border-violet-100 bg-violet-50/60 p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
            <Megaphone size={16} className="text-violet-700" /> Norte estratégico
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            {initialStrategy || "La estrategia base todavía no fue cargada en la fuente de clientes."}
          </p>
        </article>

        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-950">Últimas actualizaciones</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
              {entries.length} {entries.length === 1 ? "registro" : "registros"}
            </span>
          </div>

          {entries.length ? (
            <ol className="mt-4 grid gap-3">
              {entries.map((entry) => (
                <li key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-violet-700">{typeLabel(entry.type)}</span>
                    <time className="inline-flex items-center gap-1.5 font-medium text-slate-500">
                      <CalendarDays size={13} /> {formattedDate(entry.date)}
                    </time>
                  </div>
                  <h4 className="mt-3 text-sm font-bold text-slate-950">{entry.title}</h4>
                  {entry.campaignName ? (
                    <p className="mt-1 text-xs font-semibold text-slate-500">{entry.campaignName}</p>
                  ) : null}
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{entry.content}</p>
                  {entry.link ? (
                    <a
                      href={entry.link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 hover:text-violet-900"
                    >
                      Abrir documento <ArrowUpRight size={13} />
                    </a>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-600">
              Todavía no hay movimientos registrados en la bitácora.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
