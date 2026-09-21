"use client";

import { useState } from "react";
import { decideRadarRunAction } from "@/app/portal/radar/operacion/actions";
import { PendingForm, PendingSubmitButton } from "@/components/pending-form";
import { RadarPublicationComposer } from "@/components/radar/radar-publication-composer";
import type { RadarRun } from "@/lib/radar-control-plane";

export function RadarHumanReview({ run, canOperate, canAdmin, publicationConnected }: { run: RadarRun; canOperate: boolean; canAdmin: boolean; publicationConnected: boolean }) {
  const [reviewed, setReviewed] = useState<{ token: string; digest: string } | null>(null);
  const [keys] = useState(() => ({ approve: crypto.randomUUID(), postpone: crypto.randomUUID(), discard: crypto.randomUUID() }));
  if (!run.candidate) return null;
  return <>
    <RadarPublicationComposer runId={run.id} workspaceId={run.workspaceId} candidate={run.candidate} canPublish={canAdmin && run.status === "approved"} publicationConnected={publicationConnected} canPreview={canOperate} onPreviewReviewed={setReviewed} />
    {["review_pending", "postponed"].includes(run.status) && <section className="mt-5 rounded-xl border border-slate-200 p-4">
      <h3 className="font-bold text-slate-900">Decisión editorial</h3>
      <p className="mt-2 text-sm text-slate-600">{reviewed ? "Vista previa revisada. Aprobar deja la pieza lista para la confirmación final de publicación." : "Revisá y confirmá la vista previa para aprobar. Podés postergar o descartar sin publicar."}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">{([["approve", "Aprobar"], ["postpone", "Postergar"], ["discard", "Descartar"]] as const).map(([decision, label]) => <PendingForm action={decideRadarRunAction} key={decision}>
        <input type="hidden" name="workspaceId" value={run.workspaceId} /><input type="hidden" name="runId" value={run.id} /><input type="hidden" name="idempotencyKey" value={keys[decision]} /><input type="hidden" name="decision" value={decision} /><input type="hidden" name="previewToken" value={reviewed?.token ?? ""} /><input type="hidden" name="compositionDigest" value={reviewed?.digest ?? ""} />
        <PendingSubmitButton disabled={!canOperate || (decision === "approve" && !reviewed)} idleLabel={label} pendingLabel="Guardando…" className="min-h-11 w-full rounded-xl border border-violet-200 bg-white px-4 text-sm font-bold text-[#4f35b5] disabled:opacity-40" />
      </PendingForm>)}</div>
    </section>}
  </>;
}
