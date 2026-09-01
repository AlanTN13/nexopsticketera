"use server";

import { revalidatePath } from "next/cache";

import { dispatchRadarRun } from "@/lib/radar-engine-client";
import { getPublicAppUrl } from "@/lib/public-app-url";
import { requireRadarWorkspaceAccess } from "@/lib/radar-control-plane-auth";
import {
  decideRadarRun,
  createRadarRun,
  markRadarDispatch,
  updateRadarSchedule,
} from "@/lib/radar-control-plane-store";
import {
  isRadarAutonomyMode,
  type RadarDecisionAction,
} from "@/lib/radar-control-plane";

export type RadarControlMutationState = { error: string | null; success?: string };

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function uuid(valueToValidate: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valueToValidate);
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
        callbackUrl: `${origin}/api/radar/runs/${run.id}/events`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo contactar al motor.";
      await markRadarDispatch(run.id, "failed", message);
      throw error;
    }
    revalidatePath("/portal/radar");
    revalidatePath("/portal/radar/operacion");
    return { error: null, success: "Radar recibió una única solicitud y comenzó la preparación." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No pudimos iniciar Radar." };
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
    revalidatePath("/portal/radar");
    revalidatePath("/portal/radar/operacion");
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
    revalidatePath("/portal/radar/operacion");
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
