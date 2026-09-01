import { randomUUID } from "node:crypto";

import { refreshContentAction } from "@/app/portal/contenido/actions";
import { ContentShell, ContentStatus } from "@/components/content/content-shell";
import { PendingForm, PendingSubmitButton } from "@/components/pending-form";
import { InlineNotice, SectionCard } from "@/components/ui";
import { getContentPortalPageContext } from "@/lib/content-page-context";

export const dynamic = "force-dynamic";

export default async function ContentHistoryPage({ searchParams }: { searchParams: Promise<{ success?: string; wait?: string; company?: string }> }) {
  const params = await searchParams;
  const context = await getContentPortalPageContext(params.company);
  return (
    <ContentShell context={context} active="history" title="Historial de recolección" description="Trazabilidad por corrida: origen, estado, cuentas procesadas y nuevos registros.">
      {params.success ? <InlineNotice tone="success">{params.success}</InlineNotice> : null}
      {params.wait ? <InlineNotice tone="info">Ya hay una consulta reciente o en curso. Podés volver a intentar en {params.wait} segundos.</InlineNotice> : null}
      <SectionCard title="Operación semanal" description={`Programación ${context.workspace.scheduledEnabled ? "habilitada" : "desactivada hasta completar el smoke test oficial"}.`} tone="light" actions={context.canOperate ? <PendingForm action={refreshContentAction}><input type="hidden" name="company" value={context.company.id} /><input type="hidden" name="requestKey" value={randomUUID()} /><PendingSubmitButton disabled={context.connection?.status !== "connected"} idleLabel="Recolectar ahora" pendingLabel="Recolectando…" className="min-h-10 rounded-lg bg-indigo-700 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300" /></PendingForm> : null}>
        <div className="grid gap-2">
          {context.runs.map((run) => (
            <article key={run.id} className="grid gap-3 rounded-xl border border-slate-200 p-4 lg:grid-cols-[140px_130px_minmax(0,1fr)_auto] lg:items-center">
              <div><ContentStatus status={run.status} /><p className="mt-2 text-[11px] font-mono text-slate-400">{run.id.slice(0, 8)}</p></div>
              <div><p className="text-xs font-bold text-slate-900">{run.trigger === "manual" ? "Manual" : "Programada"}</p><p className="mt-1 text-xs text-slate-500">{new Date(run.startedAt).toLocaleString("es-AR")}</p></div>
              <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-slate-50 p-2"><p className="text-lg font-black text-slate-950">{run.accountsSucceeded}/{run.accountsAttempted}</p><p className="text-[10px] text-slate-500">cuentas</p></div><div className="rounded-lg bg-slate-50 p-2"><p className="text-lg font-black text-slate-950">{run.publicationsNew}</p><p className="text-[10px] text-slate-500">nuevas</p></div><div className="rounded-lg bg-slate-50 p-2"><p className="text-lg font-black text-slate-950">{run.snapshotsCreated}</p><p className="text-[10px] text-slate-500">snapshots</p></div></div>
              <p className={`text-xs font-bold ${run.errorCount ? "text-rose-700" : "text-emerald-700"}`}>{run.errorCount ? `${run.errorCount} error(es)` : "Sin errores"}</p>
              {context.runAccounts.filter((row) => row.runId === run.id).length ? <div className="lg:col-span-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">{context.runAccounts.filter((row) => row.runId === run.id).map((row) => <span key={`${row.runId}-${row.accountId}`} className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">@{context.accounts.find((account) => account.id === row.accountId)?.username ?? "cuenta"}: {row.status}{row.retryable ? " · reintenta" : ""}</span>)}</div> : null}
              {context.events.filter((event) => event.runId === run.id).map((event) => <p key={`${event.runId}-${event.accountId}-${event.code}`} className="lg:col-span-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">{event.message}</p>)}
            </article>
          ))}
          {!context.runs.length ? <p className="py-10 text-center text-sm text-slate-500">Todavía no se ejecutó ninguna recolección.</p> : null}
        </div>
      </SectionCard>
    </ContentShell>
  );
}
