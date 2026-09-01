"use server";

import { revalidatePath } from "next/cache";

import { dispatchRadarRun } from "@/lib/radar-engine-client";
import { getPublicAppUrl } from "@/lib/public-app-url";
import { requireRadarWorkspaceAccess } from "@/lib/radar-control-plane-auth";
import {
  decideRadarRun,
  createRadarRun,
  markRadarDispatch,
  updateRadarPreferences,
  updateRadarSchedule,
} from "@/lib/radar-control-plane-store";
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
  if (!/^[a-z0-9][a-z0-9._-]{2,80}$/.test(workspaceId) || !uuid(idempotencyKey) || !["suggest", "review"].includes(mode)) {
    return { error: "La solicitud de Radar no es válida." };
  }

  try {
    await requireRadarWorkspaceAccess(workspaceId, "operate");
    const origin = getPublicAppUrl();
    if (!origin) throw new Error("Falta configurar la URL pública del Portal.");
    const run = await createRadarRun({ workspaceId, idempotencyKey, mode: mode as "suggest" | "review" });
    await markRadarDispatch(run.id, "dispatching");
    try {
      await dispatchRadarRun({
        runId: run.id,
        workspaceId,
        autonomyMode: mode as "suggest" | "review",
        requestKind: "opportunity_search",
        callbackUrl: `${origin}/api/radar/runs/${run.id}/events`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo contactar al motor.";
      await markRadarDispatch(run.id, "failed", message);
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
  if (!/^[a-z0-9][a-z0-9._-]{2,80}$/.test(workspaceId) || !uuid(idempotencyKey) || !isSafeHttpsUrl(sourceUrl)) {
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
    await markRadarDispatch(run.id, "dispatching");
    try {
      await dispatchRadarRun({
        runId: run.id,
        workspaceId,
        autonomyMode: "review",
        requestKind: "manual_note",
        manualNote,
        callbackUrl: `${origin}/api/radar/runs/${run.id}/events`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo contactar al motor.";
      await markRadarDispatch(run.id, "failed", message);
      throw error;
    }
    revalidateRadarOperation();
    return { error: null, success: "Nota recibida. Radar la envió a revisión sin publicarla." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No pudimos dar de alta la nota." };
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
    !/^[a-z0-9][a-z0-9._-]{2,80}$/.test(workspaceId) ||
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
  if (!/^[a-z0-9][a-z0-9._-]{2,80}$/.test(workspaceId) || !isRadarAutonomyMode(autonomyMode)) {
    return { error: "La programación de Radar no es válida." };
  }
  try {
    await requireRadarWorkspaceAccess(workspaceId, "admin");
    await updateRadarSchedule({
      workspaceId,
      schedulerEnabled,
      scheduleDays,
      scheduleHour,
      scheduleTimezone: "America/Argentina/Buenos_Aires",
      autonomyMode,
    });
    revalidateRadarOperation();
    return { error: null, success: "Configuración guardada. El scheduler productivo continúa pausado." };
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
