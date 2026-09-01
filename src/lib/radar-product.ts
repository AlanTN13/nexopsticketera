import type {
  RadarDecision,
  RadarPublication,
  RadarScoreDimension,
  RadarSourceState,
  RadarWorkspace,
} from "@/lib/radar-workspace";

export type RadarProductStatus = "published" | "discarded";

export type RadarProductOpportunity = {
  id: string;
  status: RadarProductStatus;
  title: string;
  topic: string;
  category: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  score: number;
  occurredAt: string;
  explanation: string | null;
  imageUrl: string | null;
  finalUrl: string | null;
  reasons: RadarScoreDimension[];
};

export type RadarProductEvent = {
  id: string;
  tone: "success" | "neutral" | "attention";
  occurredAt: string;
  title: string;
  detail: string;
  reference: string;
};

export type RadarProductHealth = {
  state: "healthy" | "limited" | "attention";
  label: string;
  detail: string;
};

export type RadarProductModel = {
  opportunities: RadarProductOpportunity[];
  publications: RadarPublication[];
  rejected: RadarDecision[];
  events: RadarProductEvent[];
  health: RadarProductHealth;
  averageScore: number | null;
  latestActivityAt: string | null;
  sources: Array<{ label: string; state: RadarSourceState }>;
};

export const RADAR_STRATEGY = {
  autonomy: "Automático",
  selectivity: "Equilibrado",
  sourcePreference: "Fuentes oficiales y reconocidas",
  maximumPerWeek: 4,
  enabledDays: ["Lun", "Mar", "Mié", "Jue", "Vie"],
  goals: [
    "Atraer demanda orgánica",
    "Abrir conversaciones comerciales",
    "Construir autoridad temática",
  ],
  topics: ["IA aplicada", "Automatización", "CRM & Ventas", "Data & Analytics"],
  safeguards: [
    "Confirmar cada oportunidad con una fuente directa",
    "No mencionar clientes sin autorización",
    "Publicar únicamente con una portada validada",
    "Evitar temas repetidos en ciclos consecutivos",
  ],
} as const;

function publicationReasons(publication: RadarPublication): RadarScoreDimension[] {
  return [
    { dimension: "business", label: "Relevancia comercial", score: publication.score },
    { dimension: "source", label: "Calidad de fuente", score: publication.score },
    { dimension: "novelty", label: "Novedad", score: publication.score },
  ];
}

function distinctExplanation(summary: string, explanation: string) {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
  return normalize(summary) === normalize(explanation) ? null : explanation;
}

function publicationOpportunity(publication: RadarPublication): RadarProductOpportunity {
  return {
    id: publication.id,
    status: "published",
    title: publication.title,
    topic: publication.topic,
    category: publication.category,
    summary: publication.summary,
    sourceName: publication.sourceName,
    sourceUrl: publication.sourceUrl,
    score: publication.score,
    occurredAt: publication.publishedAt,
    explanation: distinctExplanation(publication.summary, publication.reason),
    imageUrl: publication.imageUrl,
    finalUrl: publication.url,
    reasons: publicationReasons(publication),
  };
}

function rejectedOpportunity(decision: RadarDecision): RadarProductOpportunity {
  return {
    id: decision.id,
    status: "discarded",
    title: decision.title,
    topic: decision.topic,
    category: decision.category,
    summary: decision.reason,
    sourceName: decision.sourceName,
    sourceUrl: decision.sourceUrl,
    score: decision.score,
    occurredAt: decision.detectedAt,
    explanation: null,
    imageUrl: null,
    finalUrl: null,
    reasons: decision.scoreBreakdown,
  };
}

function resolveHealth(workspace: RadarWorkspace): RadarProductHealth {
  if (workspace.publicationsState === "error" || workspace.historyState === "error") {
    return {
      state: "attention",
      label: "Requiere atención",
      detail: "Una de las fuentes no respondió y Radar está mostrando únicamente datos verificados.",
    };
  }

  if (workspace.historyState === "unavailable") {
    return {
      state: "limited",
      label: "Publicaciones conectadas",
      detail: "El historial privado se completa al conectar la fuente de decisiones.",
    };
  }

  return {
    state: "healthy",
    label: "Operando normalmente",
    detail: "Radar está conectado a publicaciones y decisiones reales.",
  };
}

export function buildRadarProductModel(workspace: RadarWorkspace): RadarProductModel {
  const rejected = workspace.decisions.filter((decision) => decision.kind === "opportunity");
  const opportunities = [
    ...workspace.publications.map(publicationOpportunity),
    ...rejected.map(rejectedOpportunity),
  ].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  const events: RadarProductEvent[] = [
    ...workspace.publications.map((publication) => ({
      id: `publication-${publication.id}`,
      tone: "success" as const,
      occurredAt: publication.publishedAt,
      title: "Publicación verificada correctamente",
      detail: publication.title,
      reference: publication.runId,
    })),
    ...rejected.map((decision) => ({
      id: `decision-${decision.id}`,
      tone: "neutral" as const,
      occurredAt: decision.detectedAt,
      title: "Radar decidió no publicar",
      detail: `${decision.title}: ${decision.reason}`,
      reference: decision.runId,
    })),
  ].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  const scores = opportunities.map((opportunity) => opportunity.score);

  return {
    opportunities,
    publications: workspace.publications,
    rejected,
    events,
    health: resolveHealth(workspace),
    averageScore: scores.length
      ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
      : null,
    latestActivityAt: opportunities[0]?.occurredAt ?? workspace.generatedAt,
    sources: [
      { label: "Publicaciones", state: workspace.publicationsState },
      { label: "Historial de decisiones", state: workspace.historyState },
    ],
  };
}
