import { Clock3, RefreshCw } from "lucide-react";

import { PendingForm, PendingSubmitButton } from "@/components/pending-form";
import type { MetricsSyncState } from "@/lib/metrics-sync";

function formatUpdatedAt(value: string | null | undefined) {
  if (!value) return "Todavía no hay una actualización guardada";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(value));
}

export function MetricsSyncControl({
  sync,
  action,
}: {
  sync: MetricsSyncState | null;
  action: () => Promise<{ error: string | null }>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
            <Clock3 aria-hidden size={19} />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-950">Datos actualizados automáticamente</p>
            <p className="mt-1 text-sm text-slate-600">
              Todos los días a las 00:05 · Última actualización: {formatUpdatedAt(sync?.lastSuccessAt)}
            </p>
          </div>
        </div>

        <PendingForm action={action} className="shrink-0">
          <PendingSubmitButton
            idleLabel="Actualizar datos"
            pendingLabel="Actualizando…"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#4330a6] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#37258f] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          />
        </PendingForm>
      </div>
      <p className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-500">
        <RefreshCw aria-hidden size={13} />
        La actualización manual puede usarse una vez por minuto y nunca borra el último dato válido.
      </p>
    </section>
  );
}
