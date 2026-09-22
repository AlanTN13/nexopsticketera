import Link from "next/link";
import { Settings2 } from "lucide-react";
import { createManualRadarNoteAction, requestRadarRunAction, updateRadarPreferencesAction, releaseStalledRadarRunAction } from "@/app/portal/radar/operacion/actions";
import { PendingForm, PendingSubmitButton } from "@/components/pending-form";
import { RadarShell } from "@/components/radar/radar-shell";
import { RadarRunDetail } from "@/components/radar/radar-run-detail";
import { RadarLiveOperation } from "@/components/radar/radar-live-operation";
import { RadarLegacyRunLink } from "@/components/radar/radar-legacy-run-link";
import { getRadarProductContext } from "@/lib/radar-context";
import { getPlatformRadarContext } from "@/lib/platform-radar";
import { RADAR_RUN_STATUSES, RADAR_STATUS_COPY, type RadarControlPlaneSnapshot } from "@/lib/radar-control-plane";
import { loadRadarControlPlane } from "@/lib/radar-control-plane-store";
import { getEffectiveModuleAccess, moduleLevelSatisfies } from "@/lib/authorization";
import { RADAR_PUBLICATIONS_PER_WEEK, RADAR_TOPIC_OPTIONS } from "@/lib/radar-preferences";
import { getRadarAdmission } from "@/lib/radar-admission";
import { radarPhase, radarResultTitle, radarResultReason } from "@/lib/radar-presentation";
import { isRadarRunStalled } from "@/lib/radar-live-status";

export type RadarOperationView = "review" | "history" | "configuration";
export type RadarHistoryFilters = { status?: string; kind?: string; run?: string };
const buttonClass = "min-h-11 rounded-xl bg-[#4f35b5] px-5 text-sm font-bold text-white disabled:bg-slate-300 disabled:text-slate-600";
const inputClass = "min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900";
const dateFormat = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });

function EditorialPreferences({ settings, workspaceId, canAdmin }: { settings: NonNullable<RadarControlPlaneSnapshot["settings"]>; workspaceId: string; canAdmin: boolean }) {
  const preferences = settings.preferences;
  const knownTopics = new Set<string>(RADAR_TOPIC_OPTIONS);
  const customTopics = preferences.topics.filter((topic) => !knownTopics.has(topic)).join(", ");

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-[#5b3db8]"><Settings2 size={17} /></span><div><h2 className="text-lg font-bold text-slate-950">Configuración editorial</h2><p className="mt-1 text-sm leading-6 text-slate-600">Elegí qué temas sigue Radar, cuántas notas prepara y qué hace cuando encuentra una oportunidad.</p></div></div>
      <PendingForm action={updateRadarPreferencesAction} className="mt-6 grid gap-5">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <fieldset key={JSON.stringify(preferences)} disabled={!canAdmin} className="grid gap-5 disabled:opacity-60">
          <div><p className="text-xs font-bold text-slate-700">Temáticas</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{RADAR_TOPIC_OPTIONS.map((topic) => <label key={topic} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700"><input type="checkbox" name="topics" value={topic} defaultChecked={preferences.topics.includes(topic)} />{topic}</label>)}</div></div>
          <label className="grid gap-2 text-xs font-bold text-slate-700">Otras temáticas<input name="customTopics" defaultValue={customTopics} maxLength={300} placeholder="Ej.: Operaciones, Industria 4.0" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900" /><span className="font-normal text-slate-500">Separalas con comas. Podés guardar hasta 8 en total.</span></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-xs font-bold text-slate-700">Objetivo semanal (programación apagada)<select name="publicationsPerWeek" defaultValue={preferences.publicationsPerWeek} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900">{RADAR_PUBLICATIONS_PER_WEEK.map((frequency) => <option key={frequency} value={frequency}>{frequency} {frequency === 1 ? "nota" : "notas"} por semana</option>)}</select></label>
            <label className="grid gap-2 text-xs font-bold text-slate-700">Si encuentra una oportunidad<select name="opportunityBehavior" defaultValue={preferences.opportunityBehavior} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"><option value="suggest">La sugiere</option><option value="discard">La descarta si no alcanza el criterio</option></select></label>
          </div>
          <label className="grid gap-2 text-xs font-bold text-slate-700">Salida de las notas<select name="publishingMode" defaultValue="review" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"><option value="review">Siempre enviar a revisión</option><option value="automatic" disabled>Publicar directo en el sitio integrado</option></select><span className="font-normal text-slate-500">Autopublicación no disponible durante el piloto.</span></label>
        </fieldset>
        <PendingSubmitButton disabled={!canAdmin} idleLabel="Guardar preferencias" pendingLabel="Guardando…" className="min-h-11 rounded-xl bg-[#4f35b5] px-4 text-sm font-bold text-white disabled:bg-slate-300" />
      </PendingForm>
    </article>
  );
}


export function RadarControlPlaneView({ snapshot, admission, workspaceId, canOperate, canAdmin, view = "review", basePath, companyLookup, filters = {} }: {
  snapshot: RadarControlPlaneSnapshot; admission: Awaited<ReturnType<typeof getRadarAdmission>>; workspaceId: string; canOperate: boolean; canAdmin: boolean;
  view?: RadarOperationView; basePath: string; companyLookup?: string; filters?: RadarHistoryFilters;
}) {
  const settings = snapshot.settings;
  const activeRun = snapshot.runs.find(run => ["queued", "dispatching", "running", "validating", "publishing"].includes(run.status));
  const pending = snapshot.runs.filter(run => ["review_pending", "approved", "postponed"].includes(run.status));
  const allowed = canOperate && admission.allowed && snapshot.availability === "ready";
  function href(path: string, query: Record<string, string> = {}) {
    const params = new URLSearchParams({ ...(companyLookup ? { company: companyLookup } : {}), ...query });
    return `${basePath}${path}${params.size ? `?${params}` : ""}`;
  }
  const title = { review: "Revisión", history: "Historial", configuration: "Configuración" }[view];
  const filtered = snapshot.runs.filter(run => (!filters.status || filters.status === "all" || run.status === filters.status) && (!filters.kind || filters.kind === "all" || run.requestKind === filters.kind));
  const selected = snapshot.runs.find(run => run.id === filters.run);
  return <div className="grid gap-6">
    <RadarLegacyRunLink historyHref={href("/historial")} />
    <header><p className="text-xs font-semibold uppercase tracking-widest text-[#6749c7]">Radar by NexOps</p><h1 className="mt-2 text-3xl font-bold text-slate-950">{title}</h1><p className="mt-2 text-sm text-slate-600">{view === "review" ? "Buscá una oportunidad y revisá la pieza completa antes de decidir." : view === "history" ? "Consultá cada resultado y su motivo. Los detalles se abren cuando los necesitás." : "Preferencias editoriales y funciones disponibles para esta cuenta."}</p></header>
    {snapshot.availability !== "ready" || !settings ? <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm">No se pudo verificar la disponibilidad de Radar. No se iniciará ninguna búsqueda.</p> : <>
      {view === "review" && <>
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5" aria-label="Disponibilidad de Radar">
          <p className="text-sm font-bold text-slate-900">{admission.allowed ? "Disponible para solicitar una búsqueda" : admission.code === "budget_exhausted" ? "Presupuesto agotado · búsqueda no iniciada" : "Búsqueda no disponible"}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{admission.message}</p>
          {!canOperate && <p className="mt-2 text-sm text-slate-600">Tu acceso permite consultar; iniciar búsquedas requiere permiso de operación.</p>}
          <PendingForm action={requestRadarRunAction} className="mt-4"><input type="hidden" name="workspaceId" value={workspaceId} /><input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} /><input type="hidden" name="mode" value="review" /><PendingSubmitButton disabled={!allowed} idleLabel="Buscar oportunidad" pendingLabel="Comprobando disponibilidad…" className={buttonClass} /></PendingForm>
          <details id="nueva-nota" className="mt-4 border-t border-slate-200 pt-4"><summary className="cursor-pointer text-sm font-semibold text-[#4f35b5]">Agregar fuente</summary><p className="mt-2 text-sm text-slate-600">Radar investigará esta fuente bajo el mismo presupuesto y controles de calidad.</p>
            <PendingForm action={createManualRadarNoteAction} className="mt-4 grid max-w-2xl gap-4"><input type="hidden" name="workspaceId" value={workspaceId} /><input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} /><fieldset disabled={!allowed} className="grid gap-4 disabled:opacity-60"><label className="grid gap-2 text-sm">URL de la fuente<input required type="url" name="sourceUrl" placeholder="https://…" className={inputClass} /></label><label className="grid gap-2 text-sm">Título opcional<input name="title" maxLength={300} className={inputClass} /></label><label className="grid gap-2 text-sm">Indicaciones opcionales<textarea name="instructions" maxLength={1000} rows={3} className="rounded-lg border border-slate-300 p-3" /></label></fieldset><PendingSubmitButton disabled={!allowed} idleLabel="Investigar fuente" pendingLabel="Comprobando disponibilidad…" className={buttonClass} /></PendingForm>
          </details>
        </section>
        {activeRun && <><RadarLiveOperation runId={activeRun.id} status={activeRun.status} editorialPhase={activeRun.editorialPhase} requestKind={activeRun.requestKind} createdAt={activeRun.createdAt} updatedAt={activeRun.updatedAt} events={activeRun.events} />{isRadarRunStalled(activeRun.status, activeRun.updatedAt) && <PendingForm action={releaseStalledRadarRunAction}><input type="hidden" name="workspaceId" value={workspaceId} /><input type="hidden" name="runId" value={activeRun.id} /><p className="mb-3 text-sm text-amber-800">La solicitud no recibió nuevas señales dentro del plazo operativo.</p><PendingSubmitButton disabled={!canOperate} idleLabel="Cerrar solicitud sin respuesta" pendingLabel="Cerrando…" className={buttonClass} /></PendingForm>}</>}
        <section className="grid gap-4"><h2 className="text-xl font-bold">Piezas para revisar</h2>{pending.length ? pending.map(run => <RadarRunDetail key={run.id} run={run} canOperate={canOperate} canAdmin={canAdmin} publicationConnected={snapshot.publicationConnected} />) : <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">No hay piezas elegibles pendientes de revisión.</p>}</section>
        {snapshot.runs[0] && !pending.some(run => run.id === snapshot.runs[0].id) && !activeRun && <section className="rounded-xl border border-slate-200 p-5"><h2 className="text-sm font-bold">Último resultado · {radarPhase(snapshot.runs[0])}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{radarResultReason(snapshot.runs[0]) ?? radarResultTitle(snapshot.runs[0])}</p><Link href={href("/historial", { run: snapshot.runs[0].id })} className="mt-3 inline-flex text-sm font-semibold text-[#4f35b5] underline">Ver resultado y motivo</Link></section>}
      </>}
      {view === "history" && <>
        <form method="get" action={`${basePath}/historial`} className="flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-4">{companyLookup && <input type="hidden" name="company" value={companyLookup} />}<label className="grid gap-2 text-xs font-bold">Resultado<select name="status" defaultValue={filters.status ?? "all"} className={inputClass}><option value="all">Todos</option>{RADAR_RUN_STATUSES.map(status => <option key={status} value={status}>{RADAR_STATUS_COPY[status]}</option>)}</select></label><label className="grid gap-2 text-xs font-bold">Origen<select name="kind" defaultValue={filters.kind ?? "all"} className={inputClass}><option value="all">Todos</option><option value="manual_note">Fuente manual</option><option value="opportunity_search">Búsqueda</option></select></label><button className={buttonClass}>Filtrar</button><Link href={href("/historial")} className="p-3 text-sm underline">Limpiar</Link></form>
        <p className="text-xs text-slate-500">{filtered.length} resultados en las últimas {snapshot.runs.length} solicitudes.</p>
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200">{filtered.map(run => <li key={run.id} id={`history-${run.id}`}><Link href={href("/historial", { ...(filters.status ? { status: filters.status } : {}), ...(filters.kind ? { kind: filters.kind } : {}), run: run.id })} className="grid gap-2 p-4 hover:bg-slate-50 sm:grid-cols-[9rem_minmax(0,1fr)_8rem]"><span className="text-xs font-bold text-[#4f35b5]">{radarPhase(run)}</span><span className="min-w-0"><strong className="block truncate text-sm">{radarResultTitle(run)}</strong><span className="mt-1 block line-clamp-2 text-xs text-slate-600">{radarResultReason(run) ?? "Solicitud registrada"}</span></span><time className="text-xs text-slate-500" dateTime={run.createdAt}>{dateFormat.format(new Date(run.createdAt))}</time></Link></li>)}</ul>
        {!filtered.length && <p className="text-sm text-slate-600">No hay resultados con estos filtros.</p>}
        {filters.run && (selected ? <RadarRunDetail run={selected} canOperate={canOperate} canAdmin={canAdmin} publicationConnected={snapshot.publicationConnected} historical /> : <p role="status" className="text-sm text-slate-600">El registro no está disponible en esta cuenta o en esta ventana del historial.</p>)}
      </>}
      {view === "configuration" && <>
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-5"><h2 className="font-bold">Disponibilidad y piloto</h2><p className="mt-2 text-sm text-slate-600">{admission.message}</p>{admission.spentUsd !== null && <div className="mt-2 text-sm"><p>Costo reconciliado: USD {admission.spentUsd.toFixed(6)} de USD {admission.maxUsd.toFixed(2)}.</p><p>Reserva transitoria: USD {admission.heldUsd!.toFixed(6)} · Disponible: USD {admission.availableUsd!.toFixed(6)}.</p><p className="mt-1 text-slate-600">Estimación según uso registrado del proveedor, no factura. Reservas históricas conservadas: USD {admission.legacyReservedUsd!.toFixed(2)}; no se suman como gasto.</p></div>}<p className="mt-3 text-sm">Programación automática: <strong>{settings.schedulerEnabled ? "Configuración activa inesperada · operación bloqueada" : "No disponible · apagada"}</strong></p><p className="mt-2 text-sm">Autopublicación: <strong>{settings.preferences.publishingMode === "automatic" ? "Configuración activa inesperada · operación bloqueada" : "No disponible · apagada"}</strong></p><p className="mt-2 text-sm text-slate-600">Las preferencias de frecuencia no activan ejecuciones.</p></section>
        <EditorialPreferences settings={settings} workspaceId={workspaceId} canAdmin={canAdmin} />
      </>}
    </>}
  </div>;
}

export async function RadarOperationPage({ companyLookup, view = "review", filters }: { companyLookup?: string; view?: RadarOperationView; filters?: RadarHistoryFilters }) {
  const context = await getRadarProductContext(companyLookup);
  const access = getEffectiveModuleAccess(context.actor, context.company, "radar");
  const [snapshot, admission] = await Promise.all([loadRadarControlPlane(context.workspace.workspaceId), getRadarAdmission(context.workspace.workspaceId)]);
  return <RadarShell active={view === "configuration" ? "strategy" : view === "history" ? "history" : "operation"} actorName={context.actor.name} companyName={context.company.name} workspaceId={context.workspace.workspaceId} health={{ state: "limited", label: admission.allowed ? "Búsqueda disponible" : "Búsqueda no disponible", detail: admission.message }} exitHref={context.exitHref} exitLabel={context.exitLabel} companyLookup={context.internalActor ? context.company.slug : undefined}><RadarControlPlaneView snapshot={snapshot} admission={admission} workspaceId={context.workspace.workspaceId} canOperate={moduleLevelSatisfies(access, "operate")} canAdmin={moduleLevelSatisfies(access, "admin")} view={view} filters={filters} basePath="/portal/radar" companyLookup={context.internalActor ? context.company.slug : undefined} /></RadarShell>;
}

export async function PlatformRadarOperationPage({ basePath = "/portal/radar", view = "review", filters }: { basePath?: string; view?: RadarOperationView; filters?: RadarHistoryFilters }) {
  const context = await getPlatformRadarContext();
  const [snapshot, admission] = await Promise.all([loadRadarControlPlane(context.workspace.workspaceId), getRadarAdmission(context.workspace.workspaceId)]);
  return <RadarShell active={view === "configuration" ? "strategy" : view === "history" ? "history" : "operation"} actorName={context.actor.name} companyName="NexOps · cuenta madre" workspaceId={context.workspace.workspaceId} health={{ state: "limited", label: admission.allowed ? "Búsqueda disponible" : "Búsqueda no disponible", detail: admission.message }} exitHref="/backoffice/queue" exitLabel="Volver al backoffice" basePath={basePath}><RadarControlPlaneView snapshot={snapshot} admission={admission} workspaceId={context.workspace.workspaceId} canOperate canAdmin view={view} filters={filters} basePath={basePath} /></RadarShell>;
}
