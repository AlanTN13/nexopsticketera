import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  PauseCircle,
  Play,
  RadioTower,
  ShieldCheck,
} from "lucide-react";

import {
  decideRadarRunAction,
  requestRadarRunAction,
  updateRadarScheduleAction,
} from "@/app/portal/radar/operacion/actions";
import { PendingForm, PendingSubmitButton } from "@/components/pending-form";
import { RadarShell } from "@/components/radar/radar-shell";
import { getRadarProductContext } from "@/lib/radar-context";
import { getPlatformRadarContext } from "@/lib/platform-radar";
import {
  RADAR_STATUS_COPY,
  scheduleLabel,
  type RadarControlPlaneSnapshot,
  type RadarRun,
} from "@/lib/radar-control-plane";
import { loadRadarControlPlane } from "@/lib/radar-control-plane-store";
import { getEffectiveModuleAccess, moduleLevelSatisfies } from "@/lib/authorization";

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

function formatDateTime(value: string | null) {
  return value ? dateTimeFormatter.format(new Date(value)) : "Todavía no registrada";
}

function RunCard({ run, workspaceId, canOperate }: { run: RadarRun; workspaceId: string; canOperate: boolean }) {
  const reviewPending = run.status === "review_pending" && run.candidate;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-[#4f35b5]">{RADAR_STATUS_COPY[run.status]}</span>
          <p className="mt-3 text-xs text-slate-500">{run.triggerKind === "manual" ? "Iniciada manualmente" : "Programada"} · {formatDateTime(run.createdAt)}</p>
        </div>
        <span className="font-mono text-[10px] text-slate-400">{run.id}</span>
      </div>

      {run.candidate ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Oportunidad encontrada</p><strong className="text-sm text-[#4f35b5]">Score {run.candidate.score}/100</strong></div>
          <h3 className="mt-3 text-lg font-bold text-slate-950">{run.candidate.title}</h3>
          <p className="mt-2 text-sm text-slate-600">{run.candidate.topic}</p>
          <ul className="mt-4 grid gap-2">{run.candidate.businessReasons.map((reason) => <li className="flex gap-2 text-sm leading-6 text-slate-700" key={reason}><CheckCircle2 className="mt-1 shrink-0 text-emerald-600" size={14} /> {reason}</li>)}</ul>
          <a className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#4f35b5]" href={run.candidate.sourceUrl} target="_blank" rel="noreferrer">{run.candidate.sourceName} <ExternalLink size={12} /></a>
        </div>
      ) : run.resultReason ? <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">{run.resultReason}</p> : null}

      {reviewPending ? (
        <div className="mt-5 border-t border-slate-200 pt-5">
          <p className="text-sm font-bold text-slate-900">Decisión pendiente</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Aprobar no publica todavía: deja la pieza preparada detrás del gate productivo.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {([
              ["approve", "Aprobar"],
              ["postpone", "Postergar"],
              ["discard", "Descartar"],
            ] as const).map(([decision, label]) => (
              <PendingForm action={decideRadarRunAction} key={decision}>
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="runId" value={run.id} />
                <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
                <input type="hidden" name="decision" value={decision} />
                <PendingSubmitButton disabled={!canOperate} idleLabel={label} pendingLabel="Registrando…" className={`min-h-10 w-full rounded-lg border px-3 text-xs font-bold ${decision === "approve" ? "border-[#4f35b5] bg-[#4f35b5] text-white" : "border-slate-200 bg-white text-slate-700"}`} />
              </PendingForm>
            ))}
          </div>
        </div>
      ) : null}

      {run.events.length ? <details className="mt-5 border-t border-slate-200 pt-4"><summary className="cursor-pointer text-xs font-bold text-slate-600">Ver progreso ({run.events.length})</summary><ol className="mt-3 grid gap-2">{run.events.map((event) => <li key={event.id} className="grid grid-cols-[8px_minmax(0,1fr)] gap-2 text-xs text-slate-600"><span className="mt-1.5 size-1.5 rounded-full bg-violet-400" /><span>{event.message} · {formatDateTime(event.createdAt)}</span></li>)}</ol></details> : null}
    </article>
  );
}

function ControlPlane({ snapshot, workspaceId, canOperate, canAdmin }: { snapshot: RadarControlPlaneSnapshot; workspaceId: string; canOperate: boolean; canAdmin: boolean }) {
  const settings = snapshot.settings;
  const activeRun = snapshot.runs.find((run) => ["queued", "dispatching", "running", "review_pending", "approved", "validating", "publishing"].includes(run.status));
  const lastRun = snapshot.runs[0] ?? null;
  const defaultMode = settings?.autonomyMode === "suggest" ? "suggest" : "review";

  return (
    <div className="grid gap-7">
      <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-7 lg:flex-row lg:items-end">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6749c7]">Operación</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-slate-950 sm:text-4xl">Goberná Radar desde acá.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Iniciá búsquedas, definí el modo de trabajo y seguí cada resultado sin exponer el cerebro editorial.</p></div>
        <span className={`w-fit rounded-full border px-3 py-1.5 text-xs font-bold ${activeRun ? "border-sky-200 bg-sky-50 text-sky-700" : settings?.enabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{activeRun ? "Ejecutando" : settings?.enabled ? "Activo" : "Pausado"}</span>
      </header>

      {snapshot.availability !== "ready" ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex gap-3"><CircleAlert className="shrink-0 text-amber-700" size={20} /><div><h2 className="font-bold text-amber-950">Control plane preparado, todavía sin activar</h2><p className="mt-2 text-sm leading-6 text-amber-800">La interfaz está lista, pero la migración y la conexión con el motor permanecen fuera de producción hasta el gate explícito.</p></div></div></section>
      ) : (
        <>
          <section className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-slate-200">
            <div className="p-5"><RadioTower className="text-[#6749c7]" size={18} /><p className="mt-3 text-xs font-semibold text-slate-500">Estado</p><p className="mt-1 font-bold text-slate-950">{activeRun ? RADAR_STATUS_COPY[activeRun.status] : settings?.enabled ? "Listo para operar" : "Pausado"}</p></div>
            <div className="p-5"><Clock3 className="text-sky-600" size={18} /><p className="mt-3 text-xs font-semibold text-slate-500">Última corrida</p><p className="mt-1 font-bold text-slate-950">{formatDateTime(lastRun?.createdAt ?? null)}</p></div>
            <div className="p-5"><CalendarClock className="text-emerald-600" size={18} /><p className="mt-3 text-xs font-semibold text-slate-500">Próxima corrida</p><p className="mt-1 font-bold text-slate-950">{settings ? scheduleLabel(settings) : "No configurada"}</p></div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
              <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-[#5b3db8]"><Play size={17} /></span><div><h2 className="text-lg font-bold text-slate-950">Buscar oportunidades ahora</h2><p className="mt-1 text-sm leading-6 text-slate-600">Crea una única solicitud y deja la publicación desactivada durante esta validación.</p></div></div>
              <PendingForm action={requestRadarRunAction} className="mt-5 grid gap-4">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
                <fieldset disabled={!canOperate || Boolean(activeRun) || !snapshot.engineConnected} className="grid gap-3 disabled:opacity-60"><legend className="mb-2 text-xs font-bold text-slate-600">Modo de esta corrida</legend><label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"><input type="radio" name="mode" value="suggest" defaultChecked={defaultMode === "suggest"} /><span><strong className="block text-sm text-slate-900">Sólo sugerir</strong><small className="mt-1 block text-xs text-slate-500">Muestra la oportunidad y no avanza.</small></span></label><label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"><input type="radio" name="mode" value="review" defaultChecked={defaultMode === "review"} /><span><strong className="block text-sm text-slate-900">Enviar a revisión</strong><small className="mt-1 block text-xs text-slate-500">Espera aprobación, descarte o postergación.</small></span></label></fieldset>
                <PendingSubmitButton disabled={!canOperate || Boolean(activeRun) || !snapshot.engineConnected} idleLabel={activeRun ? "Radar ya está trabajando" : snapshot.engineConnected ? "Buscar oportunidades ahora" : "Motor pendiente de conexión"} pendingLabel="Enviando solicitud…" className="min-h-11 rounded-xl bg-[#4f35b5] px-4 text-sm font-bold text-white disabled:bg-slate-300" />
              </PendingForm>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
              <div className="flex items-center gap-2"><PauseCircle size={17} className="text-amber-700" /><h2 className="font-bold text-slate-950">Programación</h2></div><p className="mt-2 text-xs leading-5 text-slate-600">Podés preparar frecuencia y autonomía. El scheduler productivo permanece pausado por diseño.</p>
              <PendingForm action={updateRadarScheduleAction} className="mt-5 grid gap-4">
                <input type="hidden" name="workspaceId" value={workspaceId} /><input type="hidden" name="schedulerEnabled" value="false" />
                <fieldset disabled={!canAdmin} className="grid gap-4 disabled:opacity-60"><label className="grid gap-2 text-xs font-bold text-slate-600">Autonomía<select name="autonomyMode" defaultValue={settings?.autonomyMode} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"><option value="suggest">Sólo sugerir</option><option value="review">Enviar a revisión</option><option value="automatic">Automático · requiere gate</option></select></label><label className="grid gap-2 text-xs font-bold text-slate-600">Hora<select name="scheduleHour" defaultValue={settings?.scheduleHour ?? 9} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900">{[8, 9, 10, 12, 15, 18].map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}</select></label><div><p className="text-xs font-bold text-slate-600">Días</p><div className="mt-2 flex flex-wrap gap-2">{[[1,"Lun"],[2,"Mar"],[3,"Mié"],[4,"Jue"],[5,"Vie"]].map(([day,label]) => <label key={day} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"><input className="mr-2" type="checkbox" name="scheduleDays" value={day} defaultChecked={settings?.scheduleDays.includes(Number(day))} />{label}</label>)}</div></div></fieldset>
                <PendingSubmitButton disabled={!canAdmin} idleLabel="Guardar preparación" pendingLabel="Guardando…" className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700" />
              </PendingForm>
              <div className="mt-4 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800"><ShieldCheck className="mt-0.5 shrink-0" size={15} /> Publicación y scheduler siguen bloqueados hasta un gate independiente.</div>
            </article>
          </section>

          <section><div className="mb-4 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6749c7]">Historial operativo</p><h2 className="mt-2 text-2xl font-bold text-slate-950">Corridas y decisiones</h2></div><span className="text-xs text-slate-500">{snapshot.runs.length} registradas</span></div>{snapshot.runs.length ? <div className="grid gap-4">{snapshot.runs.map((run) => <RunCard key={run.id} run={run} workspaceId={workspaceId} canOperate={canOperate} />)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">Todavía no hay corridas iniciadas desde el Portal.</div>}</section>
        </>
      )}
    </div>
  );
}

export async function RadarOperationPage({ companyLookup }: { companyLookup?: string }) {
  const context = await getRadarProductContext(companyLookup);
  const access = getEffectiveModuleAccess(context.actor, context.company, "radar");
  const snapshot = await loadRadarControlPlane(context.workspace.workspaceId);
  return <RadarShell active="operation" actorName={context.actor.name} companyName={context.company.name} workspaceId={context.workspace.workspaceId} health={context.model.health} exitHref={context.exitHref} exitLabel={context.exitLabel} companyLookup={context.internalActor ? context.company.slug : undefined}><ControlPlane snapshot={snapshot} workspaceId={context.workspace.workspaceId} canOperate={moduleLevelSatisfies(access, "operate")} canAdmin={moduleLevelSatisfies(access, "admin")} /></RadarShell>;
}

export async function PlatformRadarOperationPage({ basePath = "/portal/radar" }: { basePath?: string }) {
  const context = await getPlatformRadarContext();
  const snapshot = await loadRadarControlPlane(context.workspace.workspaceId);
  return <RadarShell active="operation" actorName={context.actor.name} companyName="NexOps · cuenta madre" workspaceId={context.workspace.workspaceId} health={context.model.health} exitHref="/backoffice/queue" exitLabel="Volver al backoffice" basePath={basePath} strategyAvailable={false}><ControlPlane snapshot={snapshot} workspaceId={context.workspace.workspaceId} canOperate canAdmin /></RadarShell>;
}
