"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Eye, Palette, ShieldCheck } from "lucide-react";

import { publishApprovedRadarRunAction } from "@/app/portal/radar/operacion/actions";
import { PendingForm, PendingSubmitButton } from "@/components/pending-form";
import type { RadarPublicationComposition } from "@/lib/radar-publication";
import type { RadarRunCandidate } from "@/lib/radar-control-plane";

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

function territoryFor(topic: string) {
  const normalized = topic.toLowerCase();
  if (normalized.includes("crm") || normalized.includes("venta")) return "crm-automatizacion-comercial";
  if (normalized.includes("data") || normalized.includes("analytics")) return "data-analytics";
  if (normalized.includes("ia") || normalized.includes("inteligencia")) return "ia-aplicada-empresas";
  return "automatizacion-procesos";
}

function fitMeta(value: string, fallback: string) {
  const base = (value || fallback).trim();
  if (base.length >= 70) return base.slice(0, 180);
  return `${base} Conocé el criterio operativo de NexOps y qué implica para empresas que buscan resultados medibles.`.slice(0, 180);
}

export function radarPreviewComposition(data: FormData, candidate: RadarRunCandidate, editable: boolean): RadarPublicationComposition {
  const composition = !editable && candidate.composition
    ? { ...candidate.composition }
    : Object.fromEntries(data.entries()) as unknown as RadarPublicationComposition;
  composition.sourceVerified = data.get("sourceVerified") === "true";
  composition.rightsVerified = data.get("rightsVerified") === "true";
  composition.clientClaimsAuthorizedOrAbsent = data.get("clientClaimsAuthorizedOrAbsent") === "true";
  return composition;
}

export function RadarPublicationComposer({
  runId,
  workspaceId,
  candidate,
  canPublish,
  publicationConnected,
  onPreviewReviewed,
  canPreview = true,
  editable = true,
}: {
  runId: string;
  workspaceId: string;
  candidate: RadarRunCandidate;
  canPublish: boolean;
  publicationConnected: boolean;
  onPreviewReviewed?: (receipt: { token: string; digest: string } | null) => void;
  canPreview?: boolean;
  editable?: boolean;
}) {
  const draft = candidate.draft;
  const initial = candidate.composition;
  const initialTitle = initial?.title ?? draft?.headline ?? candidate.title;
  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(initial?.slug ?? slugify(initialTitle));
  const [visualType, setVisualType] = useState(initial?.visualType ?? "editorial-diagram");
  const [visualSubject, setVisualSubject] = useState(initial?.visualSubject ?? initialTitle);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [previewToken, setPreviewToken] = useState("");
  const [previewImage, setPreviewImage] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [previewPending, setPreviewPending] = useState(false);
  const section = useRef<HTMLElement>(null);
  const revision = useRef(0);
  const cleanup = useRef<() => void>(() => {});
  const enabled = canPublish && publicationConnected && Boolean(previewToken);
  useEffect(() => () => cleanup.current(), []);
  async function preview() {
    const form = section.current?.querySelector("form");
    if (!form || previewPending) return;
    cleanup.current();
    setPreviewToken(""); onPreviewReviewed?.(null);
    setPreviewError("");
    const requestRevision = revision.current;
    const data = new FormData(form);
    const composition = radarPreviewComposition(data, candidate, editable);
    const child = window.open("about:blank", "_blank");
    if (!child) { setPreviewError("Permití abrir ventanas para revisar la nota en webneoxps."); return; }
    setPreviewPending(true);
    try {
      const response = await fetch(`/api/radar/runs/${runId}/preview`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, composition }),
      });
      const prepared = await response.json();
      if (!response.ok) throw new Error(prepared.error || "No se pudo preparar la vista previa.");
      if (revision.current !== requestRevision) throw new Error("La nota cambió. Abrí una nueva vista previa.");
      setPreviewImage(`data:image/png;base64,${prepared.cover.pngBase64}`);
      const url = new URL(prepared.webUrl);
      const nonce = crypto.randomUUID();
      url.hash = new URLSearchParams({ origin: window.location.origin, nonce }).toString();
      const receive = (event: MessageEvent) => {
        if (revision.current !== requestRevision) return;
        if (event.source !== child || event.origin !== url.origin || event.data?.nonce !== nonce) return;
        if (event.data.type === "radar.preview.ready") child.postMessage({ type: "radar.preview.package", nonce, package: { article: prepared.article, cover: prepared.cover, compositionDigest: prepared.compositionDigest } }, url.origin);
        if (event.data.type === "radar.preview.viewed" && event.data.compositionDigest === prepared.compositionDigest) {
          setPreviewToken(prepared.token); onPreviewReviewed?.({ token: prepared.token, digest: prepared.compositionDigest });
          cleanup.current();
        }
      };
      window.addEventListener("message", receive);
      cleanup.current = () => window.removeEventListener("message", receive);
      child.location.href = url.href;
    } catch (error) { child.close(); setPreviewError(error instanceof Error ? error.message : "No se pudo abrir la vista previa."); }
    finally { setPreviewPending(false); }
  }

  return (
    <section ref={section} onChangeCapture={() => { revision.current += 1; setPreviewToken(""); onPreviewReviewed?.(null); setPreviewImage(""); cleanup.current(); }} className="mt-6 overflow-hidden rounded-2xl border border-[#cfc3f4] bg-[#f8f5ff]">
      <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
        <div className="p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#5b3db8] shadow-sm ring-1 ring-[#e2daf9]"><Palette size={18} /></span>
            <div><h3 className="text-xl font-bold text-slate-950">Vista previa y revisión</h3><p className="mt-1 text-sm leading-6 text-slate-600">Abrí la nota completa con su portada. Cualquier edición requiere revisar de nuevo esa versión.</p></div>
          </div>
          <PendingForm action={publishApprovedRadarRunAction} className="mt-6 grid gap-5">
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="runId" value={runId} />
            <input type="hidden" name="previewToken" value={previewToken} />
            <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
            <fieldset className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <legend className="px-1 text-xs font-bold text-slate-700">Confirmación editorial obligatoria</legend>
              <label className="flex gap-3 text-xs leading-5 text-slate-700"><input required type="checkbox" name="sourceVerified" value="true" /> Verifiqué que la fuente respalda la nota.</label>
              <label className="flex gap-3 text-xs leading-5 text-slate-700"><input required type="checkbox" name="rightsVerified" value="true" /> El visual es original de NexOps y puede publicarse.</label>
              <label className="flex gap-3 text-xs leading-5 text-slate-700"><input required type="checkbox" name="clientClaimsAuthorizedOrAbsent" value="true" /> No hay afirmaciones de clientes sin autorización ni advertencias editoriales críticas pendientes.</label>
            </fieldset>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><strong className="block">Último gate manual</strong>Este clic inicia una sola publicación real. webneoxps todavía ejecuta validaciones, despliegue y verificación antes de declararla publicada.</div>
            <button type="button" onClick={preview} disabled={previewPending || !canPreview} className="min-h-12 rounded-xl border border-[#4f35b5] bg-white px-5 text-sm font-bold text-[#4f35b5] disabled:opacity-50">{!canPreview ? "Preview requiere permiso de operación" : previewPending ? "Preparando vista previa…" : "Revisar nota completa en webneoxps"}</button>
            {previewError && <p role="alert" className="text-sm text-rose-800">{previewError}</p>}
            <p role="status" className="text-xs text-slate-600">{previewToken ? "Vista previa revisada. La aprobación corresponde a esta versión exacta." : "Revisá la vista previa y confirmala en la ventana del sitio. Cualquier edición requiere una nueva revisión."}</p>
            <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-bold text-slate-700">{editable ? "Editar pieza y portada" : "Consultar composición · edición después de aprobar"}</summary><fieldset disabled={!editable}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-xs font-bold text-slate-700 sm:col-span-2">Título<input required name="title" value={title} onChange={(event) => { setTitle(event.target.value); setSlug(slugify(event.target.value)); }} minLength={10} maxLength={150} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900" /></label>
              <label className="grid gap-2 text-xs font-bold text-slate-700 sm:col-span-2">Dirección web<input required name="slug" value={slug} onChange={(event) => setSlug(slugify(event.target.value))} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs font-normal text-slate-900" /></label>
              <label className="grid gap-2 text-xs font-bold text-slate-700 sm:col-span-2">Bajada<textarea required name="excerpt" defaultValue={initial?.excerpt ?? draft?.deck ?? candidate.businessReasons[0]} minLength={40} maxLength={280} rows={3} className="rounded-lg border border-slate-300 bg-white p-3 text-sm font-normal text-slate-900" /></label>
              <label className="grid gap-2 text-xs font-bold text-slate-700">Título para buscadores<input required name="seoTitle" defaultValue={initial?.seoTitle ?? initialTitle.slice(0, 70)} minLength={20} maxLength={70} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900" /></label>
              <label className="grid gap-2 text-xs font-bold text-slate-700">Palabra clave<input required name="primaryKeyword" defaultValue={initial?.primaryKeyword ?? candidate.topic} minLength={3} maxLength={100} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900" /></label>
              <label className="grid gap-2 text-xs font-bold text-slate-700 sm:col-span-2">Descripción para buscadores<textarea required name="metaDescription" defaultValue={initial?.metaDescription ?? fitMeta(draft?.deck ?? "", candidate.title)} minLength={70} maxLength={180} rows={3} className="rounded-lg border border-slate-300 bg-white p-3 text-sm font-normal text-slate-900" /></label>
              <input type="hidden" name="searchIntent" value="Entender el impacto operativo y evaluar una aplicación concreta" />
              <label className="grid gap-2 text-xs font-bold text-slate-700">Territorio<select name="territory" defaultValue={initial?.territory ?? territoryFor(candidate.topic)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"><option value="automatizacion-procesos">Automatización de procesos</option><option value="ia-aplicada-empresas">IA aplicada</option><option value="crm-automatizacion-comercial">CRM y ventas</option><option value="data-analytics">Data & Analytics</option></select></label>
              <label className="grid gap-2 text-xs font-bold text-slate-700">Estilo visual<select name="visualType" value={visualType} onChange={(event) => setVisualType(event.target.value)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"><option value="editorial-diagram">Diagrama editorial</option><option value="process-diagram">Proceso</option><option value="data-flow">Flujo de datos</option><option value="operations-interface">Interfaz operativa</option></select></label>
              <label className="grid gap-2 text-xs font-bold text-slate-700 sm:col-span-2">Concepto del visual<input required name="visualSubject" value={visualSubject} onChange={(event) => setVisualSubject(event.target.value)} minLength={5} maxLength={180} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900" /></label>
              <label className="grid gap-2 text-xs font-bold text-slate-700 sm:col-span-2">Texto accesible de portada<input required name="coverAlt" defaultValue={initial?.coverAlt ?? `Ilustración editorial de NexOps sobre ${candidate.topic}`} minLength={10} maxLength={220} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900" /></label>
              <label className="grid gap-2 text-xs font-bold text-slate-700 sm:col-span-2">Cuerpo de la nota<textarea required name="bodyMarkdown" defaultValue={initial?.bodyMarkdown ?? draft?.bodyMarkdown ?? ""} minLength={120} maxLength={20_000} rows={16} className="rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs font-normal leading-6 text-slate-900" /></label>
            </div>
            </fieldset></details>
            <PendingSubmitButton disabled={!enabled} idleLabel={publicationConnected ? "Publicar versión revisada" : "Publicación no habilitada"} pendingLabel="Iniciando publicación…" className="min-h-12 rounded-xl bg-[#4f35b5] px-5 text-sm font-bold text-white disabled:bg-slate-300" />
          </PendingForm>
        </div>
        <aside className="border-t border-[#d9cff7] bg-[#25124f] p-5 text-white lg:border-l lg:border-t-0 sm:p-7">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-[#c9baff]"><Eye size={15} /> Vista previa</div>
          <div className="mt-5 aspect-video overflow-hidden rounded-2xl border border-white/15 bg-[#211245]">
            {previewImage ? <Image unoptimized src={previewImage} alt={`Portada final: ${title}`} width={1600} height={900} className="h-full w-full object-contain" /> : <p className="p-6 text-sm leading-6 text-[#d9d2f8]">Abrí la vista previa para ver la portada PNG final de esta versión.</p>}
          </div>
          <div className="mt-5 grid gap-3 text-xs leading-5 text-[#ddd6f7]"><p><strong className="text-white">Concepto:</strong> {visualSubject}</p><p><strong className="text-white">Formato:</strong> 1600 × 900, preparado para portada y redes.</p><p><strong className="text-white">Estilo:</strong> {visualType}</p></div>
          <div className="mt-6 flex gap-2 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-3 text-xs leading-5 text-emerald-100"><ShieldCheck className="mt-0.5 shrink-0" size={15} /> La composición no utiliza generadores de imágenes ni publica por sí sola.</div>
        </aside>
      </div>
    </section>
  );
}
