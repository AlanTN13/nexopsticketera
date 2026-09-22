import { radarPhase } from "@/lib/radar-presentation";
import type { RadarRequestKind, RadarRunStatus } from "@/lib/radar-control-plane";

const STALLED_RUN_STATUSES = new Set<RadarRunStatus>(["queued", "dispatching", "running"]);

export const RADAR_STALL_TIMEOUT_MS = 15 * 60 * 1_000;

export function isRadarRunStalled(status: RadarRunStatus, updatedAt: string, now = Date.now()) {
  if (!STALLED_RUN_STATUSES.has(status)) return false;
  const lastSignalAt = Date.parse(updatedAt);
  return Number.isFinite(lastSignalAt) && now - lastSignalAt >= RADAR_STALL_TIMEOUT_MS;
}

export type RadarLiveStage = {
  name: string;
  role: string;
  imageSrc: string;
  state: "done" | "active" | "waiting";
};

export type RadarLiveView = {
  mode: "working" | "action";
  phaseLabel: string;
  title: string;
  description: string;
  actionLabel: string | null;
  stages: RadarLiveStage[];
};

const STAGES = [
  {
    name: "Nexy Core",
    role: "Recibe la misión y protege el contexto.",
    imageSrc: "/radar/nexys/nexy-core.png",
  },
  {
    name: "Nexy Flow",
    role: "Comprueba la admisión y entrega la solicitud.",
    imageSrc: "/radar/nexys/nexy-flow.png",
  },
  {
    name: "Nexy AI",
    role: "Busca fuentes, contrasta y evita duplicados.",
    imageSrc: "/radar/nexys/nexy-ai.png",
  },
  {
    name: "Nexy Growth",
    role: "Prepara la nota y la deja lista para decidir.",
    imageSrc: "/radar/nexys/nexy-growth.png",
  },
] as const;

export function getRadarLiveView(
  status: RadarRunStatus,
  requestKind: RadarRequestKind,
  eventTypes: string[],
  editorialPhase?: string | null,
): RadarLiveView {
  const phase = radarPhase({ status, editorialPhase });
  const ready = ["review_pending", "approved"].includes(status);
  const terminal = !["queued", "dispatching", "running", "validating", "publishing"].includes(status);
  const currentStage = phase === "QA" || ready || ["validating", "publishing"].includes(status) ? 3 : phase === "Investigando" ? 2 : status === "queued" ? 0 : 1;
  const stages = STAGES.map((stage, index): RadarLiveStage => ({ ...stage,
    role: requestKind === "manual_note" && index === 2 ? "Lee la fuente indicada y contrasta evidencia." : stage.role,
    state: ready ? "done" : terminal ? "waiting" : index < currentStage ? "done" : index === currentStage ? "active" : "waiting",
  }));
  const description = phase === "QA" ? "Radar está revisando la evidencia y los controles editoriales. Sólo se permite una corrección antes de la revisión final."
    : phase === "Investigando" ? "La solicitud editorial fue autorizada. Radar busca y contrasta fuentes; todavía no hay una pieza aprobada."
    : ready ? "Revisá fuentes, QA y la vista previa antes de decidir. La publicación requiere una confirmación separada."
    : terminal ? "La solicitud terminó. El resultado y su motivo están guardados en el historial."
    : ["validating", "publishing"].includes(status) ? "Radar está verificando una publicación solicitada manualmente. Todavía no se confirmó la URL final."
    : eventTypes.includes("queue_accepted") ? "El circuito recibió la solicitud. Aún no hay confirmación de inicio de investigación ni de consumo del proveedor."
    : "El Portal está preparando la solicitud. La investigación editorial todavía no comenzó.";
  return { mode: terminal ? "action" : "working", phaseLabel: phase,
    title: phase === "Investigando" && requestKind === "manual_note" ? "Radar está leyendo tu fuente." : phase,
    description, actionLabel: ready ? "Revisar pieza" : null, stages };
}
