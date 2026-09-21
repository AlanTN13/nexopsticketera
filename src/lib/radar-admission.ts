import "server-only";

import { radarApiConfiguration } from "@/lib/radar-api-provider";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export type RadarAdmission = {
  allowed: boolean;
  code: "available" | "budget_exhausted" | "active_run" | "disabled" | "unavailable";
  message: string;
  reservedUsd: number | null;
  maxUsd: number;
  remainingRuns: number | null;
};

const messages: Record<RadarAdmission["code"], string> = {
  available: "Radar está disponible para recibir una oportunidad.",
  budget_exhausted: "El presupuesto autorizado del piloto está agotado. No se inició ninguna investigación nueva.",
  active_run: "Hay una investigación o una revisión pendiente. Resolvela antes de iniciar otra.",
  disabled: "Radar no está habilitado para nuevas investigaciones en este espacio.",
  unavailable: "No pudimos verificar la disponibilidad de Radar. No se inició ninguna investigación nueva.",
};

/** Privileged read: authorize workspace first; retry ID comes from its authenticated lookup. Never reserves usage. */
export async function getRadarAdmission(workspaceId: string, existingQueuedRunId?: string): Promise<RadarAdmission> {
  const unavailable = (code: "disabled" | "unavailable"): RadarAdmission => ({
    allowed: false, code, message: messages[code], reservedUsd: null, maxUsd: 9, remainingRuns: null,
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
    const { code, reservedUsd, remainingRuns } = data;
    if (typeof code !== "string" || !Object.hasOwn(messages, code) || data.maxUsd !== 9 || typeof data.allowed !== "boolean" ||
        data.allowed !== (code === "available")) return unavailable("unavailable");
    if (code === "disabled" || code === "unavailable") return unavailable(code);
    if (typeof reservedUsd !== "number" || !Number.isFinite(reservedUsd) || reservedUsd < 0 || reservedUsd > 9 ||
        !Number.isInteger(remainingRuns) || remainingRuns < 0 || remainingRuns > Math.min(config.maxRuns, 6) ||
        (code === "available" && (remainingRuns < 1 || reservedUsd + 1.5 > 9)) ||
        (code === "budget_exhausted" && remainingRuns !== 0)) return unavailable("unavailable");
    return { allowed: data.allowed, code: code as RadarAdmission["code"], message: messages[code as RadarAdmission["code"]], reservedUsd, maxUsd: 9, remainingRuns };
  } catch {
    return unavailable("unavailable");
  }
}
