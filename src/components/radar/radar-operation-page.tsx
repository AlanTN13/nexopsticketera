import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  FilePlus2,
  PauseCircle,
  Play,
  RadioTower,
  Settings2,
  ShieldCheck,
} from "lucide-react";

import {
  createManualRadarNoteAction,
  decideRadarRunAction,
  requestRadarRunAction,
  updateRadarPreferencesAction,
  updateRadarScheduleAction,
} from "@/app/portal/radar/operacion/actions";
import { PendingForm, PendingSubmitButton } from "@/components/pending-form";
import { RadarShell } from "@/components/radar/radar-shell";
import { RadarPublicationComposer } from "@/components/radar/radar-publication-composer";
import { RadarLiveOperation } from "@/components/radar/radar-live-operation";
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
import {
  RADAR_PUBLICATIONS_PER_WEEK,
  RADAR_TOPIC_OPTIONS,
} from "@/lib/radar-preferences";

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

function RunCard({ run, workspaceId, canOperate, canAdmin, publicationConnected }: { run: RadarRun; workspaceId: string; canOperate: boolean; canAdmin: boolean; publicationConnected: boolean }) {
  const reviewPending = run.status === "review_pending" && run.candidate;
  const readyToCompose = run.status === "approved" && run.candidate?.draft;
  return (
    <article id={`run-${run.id}`} className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-[#4f35b5]">{RADAR_STATUS_COPY[run.status]}</span>
          <p className="mt-3 text-xs text-slate-500">{run.requestKind === "manual_note" ? "Nota ingresada manualmente" : run.triggerKind === "manual" ? "Búsqueda iniciada manualmente" : "Búsqueda programada"} · {formatDateTime(run.createdAt)}</p>
        </div>
        <span className="font-mono text-[10px] text-slate-400">{run.id}</span>
      </div>

      {run.manualNote ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Alta manual</p>
          <h3 className="mt-3 text-lg font-bold text-slate-950">{run.manualNote.title ?? "Nota sin título"}</h3>
          {run.manualNote.instructions ? <p className="mt-2 text-sm leading-6 text-slate-600">{run.manualNote.instructions}</p> : null}
          <a className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#4f35b5]" href={run.manualNote.sourceUrl} target="_blank" rel="noreferrer">Ver fuente <ExternalLink size={12} /></a>
        </div>
      ) : run.candidate ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Oportunidad encontrada</p><strong className="text-sm text-[#4f35b5]">Score {run.candidate.score}/100</strong></div>
          <h3 className="mt-3 text-lg font-bold text-slate-950">{run.candidate.title}</h3>
          <p className="mt-2 text-sm text-slate-600">{run.candidate.topic}</p>
          <ul className="mt-4 grid gap-2">{run.candidate.businessReasons.map((reason) => <li className="flex gap-2 text-sm leading-6 text-slate-700" key={reason}><CheckCircle2 className="mt-1 shrink-0 text-emerald-600" size={14} /> {reason}</li>)}</ul>
          <a className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#4f35b5]" href={run.candidate.sourceUrl} target="_blank" rel="noreferrer">{run.candidate.sourceName} <ExternalLink size={12} /></a>
          {run.candidate.draft ? <div className="mt-5 border-t border-slate-200 pt-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Borrador textual</p><h4 className="mt-3 text-xl font-bold text-slate-950">{run.candidate.draft.headline}</h4><p className="mt-2 text-sm font-medium leading-6 text-slate-700">{run.candidate.draft.deck}</p><pre className="mt-4 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 font-sans text-sm leading-6 text-slate-700">{run.candidate.draft.bodyMarkdown}</pre></div> : null}
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

      {readyToCompose && run.candidate ? <RadarPublicationComposer runId={run.id} workspaceId={workspaceId} candidate={run.candidate} canPublish={canAdmin} publicationConnected={publicationConnected} /> : null}

      {run.publication ? <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><div className="flex flex-wrap items-center justify-between gap-3"><strong>{run.publication.status === "published" ? "Publicación verificada" : run.publication.status === "failed" ? "Publicación detenida" : "Publicación en curso"}</strong>{run.publication.externalPrUrl ? <a className="inline-flex items-center gap-1 text-xs font-bold text-[#4f35b5]" href={run.publication.externalPrUrl} target="_blank" rel="noreferrer">Ver validación <ExternalLink size={12} /></a> : null}</div>{run.publication.finalUrl ? <a className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700" href={run.publication.finalUrl} target="_blank" rel="noreferrer">Abrir nota publicada <ExternalLink size={12} /></a> : null}{run.publication.errorMessage ? <p className="mt-3 text-xs text-rose-700">{run.publication.errorMessage}</p> : null}</div> : null}

      {run.events.length ? <details className="mt-5 border-t border-slate-200 pt-4"><summary className="cursor-pointer text-xs font-bold text-slate-600">Ver progreso ({run.events.length})</summary><ol className="mt-3 grid gap-2">{run.events.map((event) => <li key={event.id} className="grid grid-cols-[8px_minmax(0,1fr)] gap-2 text-xs text-slate-600"><span className="mt-1.5 size-1.5 rounded-full bg-violet-400" /><span>{event.message} · {formatDateTime(event.createdAt)}</span></li>)}</ol></details> : null}
    </article>
  );
}

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
            <label className="grid gap-2 text-xs font-bold text-slate-700">Frecuencia de notas<select name="publicationsPerWeek" defaultValue={preferences.publicationsPerWeek} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900">{RADAR_PUBLICATIONS_PER_WEEK.map((frequency) => <option key={frequency} value={frequency}>{frequency} {frequency === 1 ? "nota" : "notas"} por semana</option>)}</select></label>
            <label className="grid gap-2 text-xs font-bold text-slate-700">Si encuentra una oportunidad<select name="opportunityBehavior" defaultValue={preferences.opportunityBehavior} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"><option value="suggest">La sugiere</option><option value="discard">La descarta si no alcanza el criterio</option></select></label>
          </div>
          <label className="grid gap-2 text-xs font-bold text-slate-700">Salida de las notas<select name="publishingMode" defaultValue={preferences.publishingMode} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"><option value="review">Siempre enviar a revisión</option><option value="automatic" disabled={!preferences.siteIntegrated}>Publicar directo en el sitio integrado</option></select><span className="font-normal text-slate-500">{preferences.siteIntegrated ? "El sitio está integrado; la publicación automática requiere además el gate productivo." : "La publicación directa se habilita cuando el sitio queda integrado."}</span></label>
        </fieldset>
        <PendingSubmitButton disabled={!canAdmin} idleLabel="Guardar preferencias" pendingLabel="Guardando…" className="min-h-11 rounded-xl bg-[#4f35b5] px-4 text-sm font-bold text-white disabled:bg-slate-300" />
      </PendingForm>
    </article>
  );
}

function ControlPlane({ snapshot, workspaceId, canOperate, canAdmin }: { snapshot: RadarControlPlaneSnapshot; workspaceId: string; canOperate: boolean; canAdmin: boolean }) {
  const settings = snapshot.settings;
  const activeRun = snapshot.runs.find((run) => ["queued", "dispatching", "running", "review_pending", "approved", "validating", "publishing"].includes(run.status));
  const lastRun = snapshot.runs[0] ?? null;
  const defaultMode = settings?.autonomyMode === "suggest" ? "suggest" : "review";
  const workerReady = snapshot.engineConnected;

  return (
    <div className="grid gap-7">
      <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-7 lg:flex-row lg:items-end">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6749c7]">Operación</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-slate-950 sm:text-4xl">Goberná Radar desde acá.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Iniciá búsquedas, definí el modo de trabajo y seguí cada resultado sin exponer el cerebro editorial.</p></div>
        <span className={`w-fit rounded-full border px-3 py-1.5 text-xs font-bold ${activeRun ? "border-sky-200 bg-sky-50 text-sky-700" : settings?.enabled && workerReady ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{activeRun ? "Ejecutando" : settings?.enabled && workerReady ? "Panel activo" : settings?.enabled ? "Trabajador pendiente" : "Pausado"}</span>
      </header>

      {snapshot.availability !== "ready" || !settings ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex gap-3"><CircleAlert className="shrink-0 text-amber-700" size={20} /><div><h2 className="font-bold text-amber-950">Control plane preparado, todavía sin activar</h2><p className="mt-2 text-sm leading-6 text-amber-800">La interfaz está lista, pero la migración y la conexión con el motor permanecen fuera de producción hasta el gate explícito.</p></div></div></section>
      ) : (
        <>
          <section className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-slate-200">
            <div className="p-5"><RadioTower className="text-[#6749c7]" size={18} /><p className="mt-3 text-xs font-semibold text-slate-500">Estado</p><p className="mt-1 font-bold text-slate-950">{activeRun ? RADAR_STATUS_COPY[activeRun.status] : settings?.enabled && workerReady ? "Panel activo · trabajador editorial conectado" : settings?.enabled ? "Panel activo · trabajador editorial pendiente" : "Pausado"}</p></div>
            <div className="p-5"><Clock3 className="text-sky-600" size={18} /><p className="mt-3 text-xs font-semibold text-slate-500">Última corrida</p><p className="mt-1 font-bold text-slate-950">{formatDateTime(lastRun?.createdAt ?? null)}</p></div>
            <div className="p-5"><CalendarClock className="text-emerald-600" size={18} /><p className="mt-3 text-xs font-semibold text-slate-500">Próxima corrida</p><p className="mt-1 font-bold text-slate-950">{settings ? scheduleLabel(settings) : "No configurada"}</p></div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <EditorialPreferences settings={settings} workspaceId={workspaceId} canAdmin={canAdmin} />
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
              <div className="flex items-center gap-2"><PauseCircle size={17} className="text-amber-700" /><h2 className="font-bold text-slate-950">Programación</h2></div><p className="mt-2 text-xs leading-5 text-slate-600">Corrida de lunes a sábado, entre las 07:00 y las 07:59, siempre en modo revisión. Se activa después de validar manualmente el trabajador.</p>
              <PendingForm action={updateRadarScheduleAction} className="mt-5 grid gap-4">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <fieldset key={`${settings.schedulerEnabled}-${workerReady}`} disabled={!canAdmin} className="grid gap-4 disabled:opacity-60"><label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-700"><input type="checkbox" name="schedulerEnabled" value="true" defaultChecked={settings.schedulerEnabled} disabled={!workerReady} /> Activar corridas programadas</label><input type="hidden" name="autonomyMode" value="review" /><input type="hidden" name="scheduleHour" value="7" />{[1,2,3,4,5,6].map((day) => <input key={day} type="hidden" name="scheduleDays" value={day} />)}<div className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-sm text-slate-700"><strong className="block text-xs text-slate-600">Horario fijo del piloto</strong><span className="mt-1 block">Lunes a sábado · 07:00 ART · siempre a revisión</span></div></fieldset>
                <PendingSubmitButton disabled={!canAdmin} idleLabel="Guardar programación" pendingLabel="Guardando…" className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700" />
              </PendingForm>
              <div className="mt-4 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800"><ShieldCheck className="mt-0.5 shrink-0" size={15} /> La publicación productiva sigue bloqueada por un gate independiente.</div>
            </article>
          </section>

          {activeRun ? (
            <RadarLiveOperation
              runId={activeRun.id}
              status={activeRun.status}
              requestKind={activeRun.requestKind}
              createdAt={activeRun.createdAt}
              updatedAt={activeRun.updatedAt}
              events={activeRun.events}
            />
          ) : <section className="grid gap-5 xl:grid-cols-2">
            <article id="nueva-nota" className="rounded-2xl border border-[#d9cff7] bg-[#faf8ff] p-5 sm:p-7">
              <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#5b3db8] shadow-sm ring-1 ring-[#e2daf9]"><FilePlus2 size={18} /></span><div><h2 className="text-lg font-bold text-slate-950">Nueva nota</h2><p className="mt-1 text-sm leading-6 text-slate-600">Pegá una fuente, agregá contexto si querés y mandala a revisión sin esperar la próxima corrida.</p></div></div>
              <PendingForm action={createManualRadarNoteAction} className="mt-5 grid gap-4">
                <input type="hidden" name="workspaceId" value={workspaceId} /><input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
                <fieldset disabled={!canOperate || Boolean(activeRun) || !workerReady} className="grid gap-4 disabled:opacity-60"><label className="grid gap-2 text-xs font-bold text-slate-700">URL de la fuente<input required type="url" name="sourceUrl" inputMode="url" placeholder="https://…" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900" /></label><label className="grid gap-2 text-xs font-bold text-slate-700">Título <span className="font-normal text-slate-400">(opcional)</span><input name="title" maxLength={300} placeholder="Cómo querés identificarla" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900" /></label><label className="grid gap-2 text-xs font-bold text-slate-700">Indicaciones <span className="font-normal text-slate-400">(opcional)</span><textarea name="instructions" maxLength={1000} rows={3} placeholder="Enfoque, audiencia o dato que no debería faltar" className="rounded-lg border border-slate-300 bg-white p-3 text-sm font-normal text-slate-900" /></label></fieldset>
                <PendingSubmitButton disabled={!canOperate || Boolean(activeRun) || !workerReady} idleLabel={activeRun ? "Radar ya está trabajando" : workerReady ? "Dar de alta y enviar a revisión" : "Trabajador editorial pendiente"} pendingLabel="Dando de alta…" className="min-h-11 rounded-xl bg-[#4f35b5] px-4 text-sm font-bold text-white disabled:bg-slate-300" />
              </PendingForm>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
              <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-[#5b3db8]"><Play size={17} /></span><div><h2 className="text-lg font-bold text-slate-950">Buscar oportunidades ahora</h2><p className="mt-1 text-sm leading-6 text-slate-600">Crea una única solicitud y deja la publicación desactivada durante esta validación.</p></div></div>
              <PendingForm action={requestRadarRunAction} className="mt-5 grid gap-4">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
                <fieldset disabled={!canOperate || Boolean(activeRun) || !workerReady} className="grid gap-3 disabled:opacity-60"><legend className="mb-2 text-xs font-bold text-slate-600">Modo de esta corrida</legend><label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"><input type="radio" name="mode" value="suggest" defaultChecked={defaultMode === "suggest"} /><span><strong className="block text-sm text-slate-900">Sólo sugerir</strong><small className="mt-1 block text-xs text-slate-500">Muestra la oportunidad y no avanza.</small></span></label><label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"><input type="radio" name="mode" value="review" defaultChecked={defaultMode === "review"} /><span><strong className="block text-sm text-slate-900">Enviar a revisión</strong><small className="mt-1 block text-xs text-slate-500">Espera aprobación, descarte o postergación.</small></span></label></fieldset>
                <PendingSubmitButton disabled={!canOperate || Boolean(activeRun) || !workerReady} idleLabel={activeRun ? "Radar ya está trabajando" : workerReady ? "Buscar oportunidades ahora" : "Trabajador editorial pendiente"} pendingLabel="Enviando solicitud…" className="min-h-11 rounded-xl bg-[#4f35b5] px-4 text-sm font-bold text-white disabled:bg-slate-300" />
              </PendingForm>
            </article>

          </section>}

          <section><div className="mb-4 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6749c7]">Historial operativo</p><h2 className="mt-2 text-2xl font-bold text-slate-950">Corridas y decisiones</h2></div><span className="text-xs text-slate-500">{snapshot.runs.length} registradas</span></div>{snapshot.runs.length ? <div className="grid gap-4">{snapshot.runs.map((run) => <RunCard key={run.id} run={run} workspaceId={workspaceId} canOperate={canOperate} canAdmin={canAdmin} publicationConnected={snapshot.publicationConnected} />)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">Todavía no hay corridas iniciadas desde el Portal.</div>}</section>
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
