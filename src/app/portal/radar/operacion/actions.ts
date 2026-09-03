"use server";

import { revalidatePath } from "next/cache";

import { dispatchRadarRun, radarEngineConnected } from "@/lib/radar-engine-client";
import { isRadarWorkerWorkspaceId } from "@/lib/radar-engine-contract";
import { getPublicAppUrl } from "@/lib/public-app-url";
import { requireRadarWorkspaceAccess } from "@/lib/radar-control-plane-auth";
import {
  acceptRadarPublicationDispatch,
  decideRadarRun,
  createRadarRun,
  cancelStalledRadarRun,
  acceptRadarDispatch,
  failRadarDispatch,
  failRadarPublicationDispatch,
  getRadarRunForPublication,
  reserveRadarDispatch,
  reserveRadarPublication,
  updateRadarPreferences,
  updateRadarSchedule,
} from "@/lib/radar-control-plane-store";
import {
  buildRadarPublicationBundle,
  dispatchRadarPublication,
  radarPublicationConnected,
  type RadarPublicationComposition,
} from "@/lib/radar-publication";
import {
  isSafeHttpsUrl,
  isRadarAutonomyMode,
  type RadarDecisionAction,
} from "@/lib/radar-control-plane";
import {
  normalizeRadarTopics,
  RADAR_OPPORTUNITY_BEHAVIORS,
  RADAR_PUBLICATIONS_PER_WEEK,
  RADAR_PUBLISHING_MODES,
} from "@/lib/radar-preferences";

export type RadarControlMutationState = { error: string | null; success?: string };

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function uuid(valueToValidate: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valueToValidate);
}

function revalidateRadarOperation() {
  revalidatePath("/portal/radar");
  revalidatePath("/portal/radar/operacion");
  revalidatePath("/backoffice/radar");
  revalidatePath("/backoffice/radar/operacion");
}

export async function requestRadarRunAction(formData: FormData): Promise<RadarControlMutationState> {
  const workspaceId = value(formData, "workspaceId");
  const idempotencyKey = value(formData, "idempotencyKey");
  const mode = value(formData, "mode");
  if (!isRadarWorkerWorkspaceId(workspaceId) || !uuid(idempotencyKey) || !["suggest", "review"].includes(mode)) {
    return { error: "La solicitud de Radar no es válida." };
  }

  try {
    await requireRadarWorkspaceAccess(workspaceId, "operate");
    const origin = getPublicAppUrl();
    if (!origin) throw new Error("Falta configurar la URL pública del Portal.");
    const run = await createRadarRun({ workspaceId, idempotencyKey, mode: mode as "suggest" | "review" });
    const reserved = await reserveRadarDispatch(run.id);
    if (!reserved) {
      revalidateRadarOperation();
      return { error: null, success: "La solicitud ya estaba registrada en la cola editorial." };
    }
    try {
      const queued = await dispatchRadarRun({
        runId: run.id,
        requestedAt: run.createdAt,
        workspaceId,
        triggerKind: run.triggerKind,
        autonomyMode: mode as "suggest" | "review",
        requestKind: "opportunity_search",
        callbackUrl: `${origin}/api/radar/runs/${run.id}/events`,
      });
      await acceptRadarDispatch({
        runId: run.id,
        externalRunId: queued.externalRunId,
        externalRunUrl: queued.externalRunUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo contactar la cola editorial.";
      await failRadarDispatch(run.id, message);
      throw error;
    }
    revalidateRadarOperation();
    return { error: null, success: "Radar recibió una única solicitud y comenzó la preparación." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No pudimos iniciar Radar." };
  }
}

export async function createManualRadarNoteAction(formData: FormData): Promise<RadarControlMutationState> {
  const workspaceId = value(formData, "workspaceId");
  const idempotencyKey = value(formData, "idempotencyKey");
  const title = value(formData, "title").slice(0, 300) || null;
  const sourceUrl = value(formData, "sourceUrl");
  const instructions = value(formData, "instructions").slice(0, 1_000) || null;
  if (!isRadarWorkerWorkspaceId(workspaceId) || !uuid(idempotencyKey) || !isSafeHttpsUrl(sourceUrl)) {
    return { error: "Completá una URL pública y segura para dar de alta la nota." };
  }

  try {
    await requireRadarWorkspaceAccess(workspaceId, "operate");
    const origin = getPublicAppUrl();
    if (!origin) throw new Error("Falta configurar la URL pública del Portal.");
    const manualNote = { title, sourceUrl, instructions };
    const run = await createRadarRun({
      workspaceId,
      idempotencyKey,
      mode: "review",
      requestKind: "manual_note",
      requestPayload: manualNote,
    });
    const reserved = await reserveRadarDispatch(run.id);
    if (!reserved) {
      revalidateRadarOperation();
      return { error: null, success: "La nota ya estaba registrada en la cola editorial." };
    }
    try {
      const queued = await dispatchRadarRun({
        runId: run.id,
        requestedAt: run.createdAt,
        workspaceId,
        triggerKind: run.triggerKind,
        autonomyMode: "review",
        requestKind: "manual_note",
        manualNote,
        callbackUrl: `${origin}/api/radar/runs/${run.id}/events`,
      });
      await acceptRadarDispatch({
        runId: run.id,
        externalRunId: queued.externalRunId,
        externalRunUrl: queued.externalRunUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo contactar la cola editorial.";
      await failRadarDispatch(run.id, message);
      throw error;
    }
    revalidateRadarOperation();
    return { error: null, success: "Nota recibida. Radar la envió a revisión sin publicarla." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No pudimos dar de alta la nota." };
  }
}

export async function releaseStalledRadarRunAction(formData: FormData): Promise<RadarControlMutationState> {
  const workspaceId = value(formData, "workspaceId");
  const runId = value(formData, "runId");
  if (!isRadarWorkerWorkspaceId(workspaceId) || !uuid(runId)) {
    return { error: "La misión de Radar no es válida." };
  }
  try {
    await requireRadarWorkspaceAccess(workspaceId, "operate");
    await cancelStalledRadarRun({ runId, workspaceId });
    revalidateRadarOperation();
    return { error: null, success: "Panel liberado. Ya podés iniciar una nueva misión." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No pudimos liberar el panel." };
  }
}

export async function updateRadarPreferencesAction(formData: FormData): Promise<RadarControlMutationState> {
  const workspaceId = value(formData, "workspaceId");
  const customTopics = value(formData, "customTopics");
  const topics = normalizeRadarTopics([...formData.getAll("topics"), customTopics]);
  const publicationsPerWeek = Number.parseInt(value(formData, "publicationsPerWeek"), 10);
  const opportunityBehavior = value(formData, "opportunityBehavior");
  const publishingMode = value(formData, "publishingMode");
  if (
    !isRadarWorkerWorkspaceId(workspaceId) ||
    !topics.length ||
    !RADAR_PUBLICATIONS_PER_WEEK.includes(publicationsPerWeek as (typeof RADAR_PUBLICATIONS_PER_WEEK)[number]) ||
    !RADAR_OPPORTUNITY_BEHAVIORS.includes(opportunityBehavior as (typeof RADAR_OPPORTUNITY_BEHAVIORS)[number]) ||
    !RADAR_PUBLISHING_MODES.includes(publishingMode as (typeof RADAR_PUBLISHING_MODES)[number])
  ) {
    return { error: "Las preferencias editoriales no son válidas." };
  }

  try {
    await requireRadarWorkspaceAccess(workspaceId, "admin");
    await updateRadarPreferences({
      workspaceId,
      topics,
      publicationsPerWeek,
      opportunityBehavior: opportunityBehavior as "discard" | "suggest",
      publishingMode: publishingMode as "review" | "automatic",
    });
    revalidateRadarOperation();
    return { error: null, success: "Preferencias y frecuencia de notas guardadas." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No pudimos guardar las preferencias." };
  }
}

export async function updateRadarScheduleAction(formData: FormData): Promise<RadarControlMutationState> {
  const workspaceId = value(formData, "workspaceId");
  const autonomyMode = value(formData, "autonomyMode");
  const scheduleHour = Number.parseInt(value(formData, "scheduleHour"), 10);
  const scheduleDays = formData.getAll("scheduleDays").map(Number).filter((day) => Number.isInteger(day));
  const schedulerEnabled = value(formData, "schedulerEnabled") === "true";
  if (!isRadarWorkerWorkspaceId(workspaceId) || !isRadarAutonomyMode(autonomyMode) ||
      autonomyMode !== "review" || scheduleHour !== 7 || scheduleDays.join(",") !== "1,2,3,4,5,6") {
    return { error: "La programación de Radar no es válida." };
  }
  try {
    await requireRadarWorkspaceAccess(workspaceId, "admin");
    if (schedulerEnabled && !radarEngineConnected()) {
      throw new Error("No se puede activar la programación hasta conectar el trabajador editorial.");
    }
    if (schedulerEnabled && autonomyMode !== "review") {
      throw new Error("La programación temporal sólo puede operar en modo revisión.");
    }
    await updateRadarSchedule({
      workspaceId,
      schedulerEnabled,
      scheduleDays,
      scheduleHour,
      scheduleTimezone: "America/Argentina/Buenos_Aires",
      autonomyMode,
    });
    revalidateRadarOperation();
    return { error: null, success: schedulerEnabled ? "Programación activada en modo revisión." : "Programación guardada y pausada." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No pudimos guardar la programación." };
  }
}

export async function decideRadarRunAction(formData: FormData): Promise<RadarControlMutationState> {
  const workspaceId = value(formData, "workspaceId");
  const runId = value(formData, "runId");
  const idempotencyKey = value(formData, "idempotencyKey");
  const decision = value(formData, "decision") as RadarDecisionAction;
  const reason = value(formData, "reason").slice(0, 500) || null;
  if (!uuid(runId) || !uuid(idempotencyKey) || !["approve", "discard", "postpone"].includes(decision)) {
    return { error: "La decisión de Radar no es válida." };
  }
  try {
    await requireRadarWorkspaceAccess(workspaceId, "operate");
    await decideRadarRun({ runId, idempotencyKey, decision, reason });
    revalidateRadarOperation();
    return {
      error: null,
      success: decision === "approve"
        ? "Oportunidad aprobada. La publicación sigue pausada detrás del gate productivo."
        : "Decisión registrada en el historial.",
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No pudimos registrar la decisión." };
  }
}

export async function publishApprovedRadarRunAction(formData: FormData): Promise<RadarControlMutationState> {
  const workspaceId = value(formData, "workspaceId");
  const runId = value(formData, "runId");
  const idempotencyKey = value(formData, "idempotencyKey");
  if (!isRadarWorkerWorkspaceId(workspaceId) || !uuid(runId) || !uuid(idempotencyKey)) {
    return { error: "La confirmación de publicación no es válida." };
  }
  const composition: RadarPublicationComposition = {
    title: value(formData, "title"),
    slug: value(formData, "slug"),
    excerpt: value(formData, "excerpt"),
    seoTitle: value(formData, "seoTitle"),
    metaDescription: value(formData, "metaDescription"),
    primaryKeyword: value(formData, "primaryKeyword"),
    searchIntent: value(formData, "searchIntent"),
    territory: value(formData, "territory"),
    visualType: value(formData, "visualType"),
    visualSubject: value(formData, "visualSubject"),
    coverAlt: value(formData, "coverAlt"),
    bodyMarkdown: value(formData, "bodyMarkdown"),
    sourceVerified: value(formData, "sourceVerified") === "true",
    rightsVerified: value(formData, "rightsVerified") === "true",
    clientClaimsAuthorizedOrAbsent: value(formData, "clientClaimsAuthorizedOrAbsent") === "true",
  };

  try {
    const { actor } = await requireRadarWorkspaceAccess(workspaceId, "admin");
    if (!radarPublicationConnected()) throw new Error("El puente de publicación todavía no está conectado.");
    const origin = getPublicAppUrl();
    if (!origin) throw new Error("Falta configurar la URL pública del Portal.");
    const run = await getRadarRunForPublication(runId);
    if (run.workspaceId !== workspaceId) throw new Error("La nota no pertenece a este workspace.");
    const approvedAt = new Date().toISOString();
    const bundle = buildRadarPublicationBundle({
      run,
      composition,
      approvedBy: actor.id,
      approvedAt,
      callbackUrl: `${origin}/api/radar/runs/${run.id}/publication`,
    });
    await reserveRadarPublication({
      runId,
      idempotencyKey,
      compositionDigest: bundle.compositionDigest,
      composition: composition as unknown as Record<string, unknown>,
    });
    try {
      const dispatched = await dispatchRadarPublication({ runId, bundle });
      await acceptRadarPublicationDispatch({
        runId,
        compositionDigest: bundle.compositionDigest,
        pullRequestNumber: dispatched.pullRequestNumber,
        pullRequestUrl: dispatched.pullRequestUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo iniciar la publicación.";
      await failRadarPublicationDispatch(runId, message);
      throw error;
    }
    revalidateRadarOperation();
    return { error: null, success: "Publicación confirmada. webneoxps está validando y desplegando la nota." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No pudimos publicar la nota." };
  }
}
