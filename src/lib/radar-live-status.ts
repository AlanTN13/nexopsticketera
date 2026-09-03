import type { RadarRequestKind, RadarRunStatus } from "@/lib/radar-control-plane";

export type RadarLiveStage = {
  name: string;
  role: string;
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
  { name: "Nexus Enlace", role: "Recibe la misión y protege el contexto." },
  { name: "Nexus Coordinador", role: "Reserva el trabajo y confirma la cola." },
  { name: "Nexus Scout", role: "Busca fuentes, contrasta y evita duplicados." },
  { name: "Nexus Editor", role: "Prepara la nota y la deja lista para decidir." },
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
      title: "Los Nexus volvieron con una propuesta.",
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
      title: "Nexus Guardián está verificando la salida.",
      description: "La nota ya está preparada. Radar valida el circuito productivo sin habilitar nuevas órdenes ni publicación automática.",
      actionLabel: null,
      stages,
    };
  }

  if (status === "running" || eventTypes.includes("queue_accepted")) {
    return {
      mode: "working",
      phaseLabel: eventTypes.includes("queue_accepted") && status !== "running" ? "Misión en cola editorial" : "Investigación en curso",
      title: requestKind === "manual_note" ? "Los Nexus están leyendo tu fuente." : "Los Nexus están buscando una oportunidad.",
      description: eventTypes.includes("queue_accepted") && status !== "running"
        ? "La misión fue aceptada por el circuito privado. El Nexus Scout toma el turno y Radar te avisa apenas vuelve con evidencia."
        : "Radar contrasta fuentes, filtra duplicados y prepara una devolución verificable. Esta vista se actualiza sola.",
      actionLabel: null,
      stages,
    };
  }

  if (status === "dispatching") {
    return {
      mode: "working",
      phaseLabel: "Abriendo el circuito",
      title: "Nexus Coordinador está reservando la misión.",
      description: "La orden ya salió del Portal. Radar está confirmando su lugar en la cola editorial privada.",
      actionLabel: null,
      stages,
    };
  }

  return {
    mode: "working",
    phaseLabel: "Misión recibida",
    title: "Nexus Enlace tomó la orden.",
    description: "Radar registró la solicitud y está preparando el circuito de trabajo. No necesitás actualizar la página.",
    actionLabel: null,
    stages,
  };
}
