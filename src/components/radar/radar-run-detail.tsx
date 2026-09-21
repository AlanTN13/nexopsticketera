import { decideRadarRunAction } from "@/app/portal/radar/operacion/actions";
import { PendingForm, PendingSubmitButton } from "@/components/pending-form";
import { ExternalLink } from "lucide-react";
import { RadarHumanReview } from "@/components/radar/radar-human-review";
import { RadarPublicationComposer } from "@/components/radar/radar-publication-composer";
import type { RadarRun } from "@/lib/radar-control-plane";
import { radarCandidateEligible, radarPhase, radarResultTitle } from "@/lib/radar-presentation";

export function RadarRunDetail({ run, canOperate, canAdmin, publicationConnected, historical = false }: { run: RadarRun; canOperate: boolean; canAdmin: boolean; publicationConnected: boolean; historical?: boolean }) {
  const eligible = radarCandidateEligible(run);
  const candidate = run.candidate;
  return <article id={`run-${run.id}`} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
    <span className="text-xs font-bold text-[#4f35b5]">{radarPhase(run)}</span>
    <h2 className="mt-2 text-xl font-bold text-slate-950">{radarResultTitle(run)}</h2>
    {(run.errorMessage || run.resultReason) && <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{run.errorMessage ?? run.resultReason}</p>}
    {candidate && <section className="mt-5 grid gap-4">
      <p className="text-sm text-slate-600">{candidate.topic}</p>
      {eligible ? <p className="text-sm font-semibold text-[#4f35b5]">Criterio editorial: {candidate.score}/100</p> : <p className="text-sm font-semibold text-slate-600">Material de referencia · sin score publicable</p>}
      <div><h3 className="text-sm font-bold">Fuentes consultadas</h3><ul className="mt-2 grid gap-2">{(candidate.sources?.length ? candidate.sources : [{ name: candidate.sourceName, url: candidate.sourceUrl }]).map((source, i) => <li key={`${source.url}-${i}`}><a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 break-words text-sm text-[#4f35b5] underline">{source.name}<ExternalLink size={13} /></a></li>)}</ul></div>
      <div className="rounded-xl border border-slate-200 p-4"><h3 className="text-sm font-bold">Revisión de calidad</h3><p className="mt-1 text-sm leading-6 text-slate-600">{candidate.qa ? `${candidate.qa.verdict}: ${candidate.qa.reason}` : "Este registro no conserva un veredicto QA separado."}</p></div>
      {eligible && candidate.draft ? <RadarHumanReview key={run.id} run={run} canOperate={canOperate} canAdmin={canAdmin} publicationConnected={publicationConnected} /> : candidate.draft && <details><summary className="cursor-pointer text-sm font-semibold text-slate-600">Consultar borrador de referencia</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap font-sans text-sm leading-6">{candidate.draft.bodyMarkdown}</pre></details>}
      {historical && run.status === "failed" && run.publication?.status === "failed" && candidate.draft && <details><summary className="cursor-pointer text-sm text-slate-600">Consultar preview histórica · no habilita publicación</summary><RadarPublicationComposer key={run.id} runId={run.id} workspaceId={run.workspaceId} candidate={candidate} canPublish={false} canPreview={canOperate} publicationConnected={false} /></details>}
    </section>}
    {!eligible && ["review_pending", "postponed"].includes(run.status) && <section className="mt-5 rounded-xl border border-amber-200 p-4"><p className="text-sm text-amber-900">Este registro no conserva elegibilidad y QA PASS confirmados. No puede aprobarse. Podés descartarlo conservando su historial.</p><PendingForm action={decideRadarRunAction} className="mt-3"><input type="hidden" name="workspaceId" value={run.workspaceId} /><input type="hidden" name="runId" value={run.id} /><input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} /><input type="hidden" name="decision" value="discard" /><PendingSubmitButton disabled={!canOperate} idleLabel="Descartar registro" pendingLabel="Guardando…" className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold" /></PendingForm></section>}
    {run.manualNote && <details className="mt-5 rounded-xl bg-slate-50 p-4"><summary className="cursor-pointer text-sm font-semibold">Fuente ingresada manualmente</summary><a href={run.manualNote.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 block break-all text-sm text-[#4f35b5] underline">{run.manualNote.sourceUrl}</a>{run.manualNote.instructions && <p className="mt-2 text-sm text-slate-600">Indicaciones originales: {run.manualNote.instructions}</p>}</details>}
    {(run.finalUrl || run.publication?.finalUrl) && run.status === "published" && <a href={run.finalUrl ?? run.publication!.finalUrl!} target="_blank" rel="noreferrer" className="mt-5 inline-flex text-sm font-bold text-emerald-700 underline">Abrir nota publicada</a>}
    <details className="mt-5 border-t border-slate-200 pt-4"><summary className="cursor-pointer text-xs font-semibold text-slate-500">Detalle técnico y progreso</summary><p className="mt-3 break-all font-mono text-xs">{run.id}</p><ol className="mt-3 grid gap-2 text-xs text-slate-600">{run.events.map(event => <li key={event.id}>{event.message} · {event.createdAt}</li>)}</ol>{run.publication?.errorMessage && <p className="mt-2 text-xs text-rose-700">{run.publication.errorMessage}</p>}</details>
  </article>;
}
