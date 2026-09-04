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
    role: "Reserva el trabajo y confirma la cola.",
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

function stageIndex(status: RadarRunStatus, eventTypes: string[]) {
  if (["review_pending", "approved", "validating", "publishing"].includes(status)) return 3;
  if (status === "running" || eventTypes.includes("queue_accepted")) return 2;
  if (status === "dispatching" || eventTypes.includes("dispatch_started")) return 1;
  return 0;
}

export function getRadarLiveView(
  status: RadarRunStatus,
  requestKind: RadarRequestKind,
  eventTypes: string[],
): RadarLiveView {
  const currentStage = stageIndex(status, eventTypes);
  const stages = STAGES.map((stage, index): RadarLiveStage => ({
    ...stage,
    role: requestKind === "manual_note" && index === 2
      ? "Lee la fuente indicada y extrae la evidencia útil."
      : stage.role,
    state: index < currentStage ? "done" : index === currentStage ? "active" : "waiting",
  }));

  if (status === "review_pending") {
    return {
      mode: "action",
      phaseLabel: "Resultado listo",
      title: "Los Nexys volvieron con una propuesta.",
      description: "La investigación terminó. La nota quedó abajo, esperando tu decisión antes de avanzar.",
      actionLabel: "Revisar propuesta",
      stages: stages.map((stage) => ({ ...stage, state: "done" })),
    };
  }

  if (status === "approved") {
    return {
      mode: "action",
      phaseLabel: "Aprobación registrada",
      title: "La propuesta está lista para componer.",
      description: "La idea ya fue aprobada. El compositor visual está abajo y la publicación continúa bajo control manual.",
      actionLabel: "Abrir compositor",
      stages: stages.map((stage) => ({ ...stage, state: "done" })),
    };
  }

  if (status === "validating" || status === "publishing") {
    return {
      mode: "working",
      phaseLabel: status === "publishing" ? "Publicación supervisada" : "Controles finales",
      title: "Nexy Growth está verificando la salida.",
      description: "La nota ya está preparada. Radar valida el circuito productivo sin habilitar nuevas órdenes ni publicación automática.",
      actionLabel: null,
      stages,
    };
  }

  if (status === "running" || eventTypes.includes("queue_accepted")) {
    return {
      mode: "working",
      phaseLabel: eventTypes.includes("queue_accepted") && status !== "running" ? "Misión en cola editorial" : "Investigación en curso",
      title: eventTypes.includes("queue_accepted") && status !== "running"
        ? "La misión ya está en manos de los Nexys."
        : requestKind === "manual_note"
          ? "Los Nexys están leyendo tu fuente."
          : "Los Nexys están buscando una oportunidad.",
      description: eventTypes.includes("queue_accepted") && status !== "running"
        ? "La misión fue aceptada por el circuito privado. Nexy AI toma el turno apenas queda disponible. Podés salir: el trabajo queda guardado y Radar te avisa cuando vuelve."
        : "Radar contrasta fuentes, filtra duplicados y prepara una devolución verificable. Esta vista se actualiza sola y podés salir sin perder el trabajo.",
      actionLabel: null,
      stages,
    };
  }

  if (status === "dispatching") {
    return {
      mode: "working",
      phaseLabel: "Abriendo el circuito",
      title: "Nexy Flow está reservando la misión.",
      description: "La orden ya salió del Portal. Radar está confirmando su lugar en la cola editorial privada.",
      actionLabel: null,
      stages,
    };
  }

  return {
    mode: "working",
    phaseLabel: "Misión recibida",
    title: "Nexy Core tomó la orden.",
    description: "Radar registró la solicitud y está preparando el circuito de trabajo. No necesitás actualizar la página.",
    actionLabel: null,
    stages,
  };
}
