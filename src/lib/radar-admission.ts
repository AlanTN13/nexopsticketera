import "server-only";

import { radarApiConfiguration } from "@/lib/radar-api-provider";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export type RadarAdmission = {
  allowed: boolean;
  code: "available" | "budget_exhausted" | "run_limit" | "active_run" | "disabled" | "unavailable";
  message: string;
  spentUsd: number | null;
  heldUsd: number | null;
  availableUsd: number | null;
  legacyReservedUsd: number | null;
  maxUsd: number;
  remainingRuns: number | null;
};

const messages: Record<RadarAdmission["code"], string> = {
  available: "Radar está disponible para recibir una oportunidad.",
  budget_exhausted: "El presupuesto autorizado del piloto está agotado. No se inició ninguna investigación nueva.",
  run_limit: "Se alcanzó el límite autorizado de corridas o frecuencia. No se inició ninguna investigación nueva.",
  active_run: "Hay una investigación o una revisión pendiente. Resolvela antes de iniciar otra.",
  disabled: "Radar no está habilitado para nuevas investigaciones en este espacio.",
  unavailable: "No pudimos verificar la disponibilidad de Radar. No se inició ninguna investigación nueva.",
};

/** Privileged read: authorize workspace first; retry ID comes from its authenticated lookup. Never reserves usage. */
export async function getRadarAdmission(workspaceId: string, existingQueuedRunId?: string): Promise<RadarAdmission> {
  const unavailable = (code: "disabled" | "unavailable"): RadarAdmission => ({
    allowed: false, code, message: messages[code], spentUsd: null, heldUsd: null, availableUsd: null, legacyReservedUsd: null, maxUsd: 5, remainingRuns: null,
  });
  const config = radarApiConfiguration();
  if (!config.enabled || workspaceId !== config.workspaceId) return unavailable("disabled");
  if (existingQueuedRunId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existingQueuedRunId)) return unavailable("unavailable");
  try {
    const { data, error } = await getSupabaseAdminClient().rpc("get_radar_admission", {
      target_workspace_id: workspaceId, pilot_max_runs: config.maxRuns,
      ...(existingQueuedRunId ? { existing_queued_run_id: existingQueuedRunId } : {}),
    });
    if (error || !data || typeof data !== "object" || Array.isArray(data)) return unavailable("unavailable");
    const { code, spentUsd, heldUsd, availableUsd, legacyReservedUsd, remainingRuns } = data;
    if (typeof code !== "string" || !Object.hasOwn(messages, code) || data.maxUsd !== 5 || typeof data.allowed !== "boolean" ||
        data.allowed !== (code === "available")) return unavailable("unavailable");
    if (code === "disabled" || code === "unavailable") return unavailable(code);
    const money = [spentUsd, heldUsd, availableUsd, legacyReservedUsd];
    if (money.some(value => typeof value !== "number" || !Number.isFinite(value) || value < 0) ||
        Math.abs(availableUsd - Math.max(0, 5 - spentUsd - heldUsd)) > 0.0000001 ||
        !Number.isInteger(remainingRuns) || remainingRuns < 0 || remainingRuns > Math.min(config.maxRuns, 1) ||
        (code === "available" && (remainingRuns < 1 || availableUsd < 1.5)) ||
        (code === "run_limit" && remainingRuns !== 0)) return unavailable("unavailable");
    return { allowed: data.allowed, code: code as RadarAdmission["code"], message: messages[code as RadarAdmission["code"]], spentUsd, heldUsd, availableUsd, legacyReservedUsd, maxUsd: 5, remainingRuns };
  } catch {
    return unavailable("unavailable");
  }
}
