import "server-only";

const ENGINE_RUN_ID = /^[a-z0-9][a-z0-9._-]{5,80}$/;
const SENSITIVE_VALUE =
  /(gh[pousr]_[a-z0-9]{20,}|sk-[a-z0-9_-]{16,}|bearer\s+[a-z0-9._-]{16,}|(?:token|api[_-]?key|secret|signature|x-amz-credential)=)/i;
const MAX_HISTORY_RECORDS = 200;

type FetchLike = typeof fetch;

export type RadarScoreDimension = {
  dimension: "seo" | "business" | "timeliness" | "source" | "novelty";
  label: string;
  score: number;
};

export type RadarPublication = {
  id: string;
  runId: string;
  outcome: "PUBLICATION";
  title: string;
  topic: string;
  category: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  score: number;
  publishedAt: string;
  url: string;
  imageUrl: string | null;
  reason: string;
};

export type RadarDecision = {
  id: string;
  runId: string;
  kind: "opportunity" | "validation";
  outcome: "NO_PUBLICATION";
  detectedAt: string;
  title: string;
  topic: string;
  sourceName: string;
  sourceUrl: string;
  score: number;
  scoreBreakdown: RadarScoreDimension[];
  reason: string;
  category: string;
  territory: string | null;
};

export type RadarSourceState = "ready" | "unavailable" | "error";

export type RadarWorkspace = {
  workspaceId: string;
  publications: RadarPublication[];
  decisions: RadarDecision[];
  publicationsState: RadarSourceState;
  historyState: RadarSourceState;
  generatedAt: string | null;
};

type RadarWorkspaceConfig = {
  publicationsUrl: string;
  historyRepository: string | null;
  historyBranch: string | null;
  historyToken: string | null;
};

const DIMENSIONS = new Map<string, RadarScoreDimension>([
  ["seo", { dimension: "seo", label: "Valor SEO", score: 0 }],
  ["search-intent", { dimension: "seo", label: "Valor SEO", score: 0 }],
  ["business", { dimension: "business", label: "Relevancia comercial", score: 0 }],
  ["commercial", { dimension: "business", label: "Relevancia comercial", score: 0 }],
  ["relevance", { dimension: "business", label: "Relevancia comercial", score: 0 }],
  ["timeliness", { dimension: "timeliness", label: "Actualidad", score: 0 }],
  ["recency", { dimension: "timeliness", label: "Actualidad", score: 0 }],
  ["source", { dimension: "source", label: "Calidad de fuente", score: 0 }],
  ["authority", { dimension: "source", label: "Calidad de fuente", score: 0 }],
  ["novelty", { dimension: "novelty", label: "Novedad", score: 0 }],
  ["editorial-fit", { dimension: "novelty", label: "Novedad", score: 0 }],
]);

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function safeUrl(value: unknown) {
  const normalized = cleanText(value, 2_000);
  if (!normalized) return null;

  try {
    const parsed = new URL(normalized);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function safeScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null;
}

function safeDate(value: unknown) {
  const normalized = cleanText(value, 40);
  if (!normalized) return null;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function classifyDecision(record: Record<string, unknown>) {
  const candidate = asRecord(record.candidate);
  const combined = `${cleanText(candidate.title, 300) ?? ""} ${cleanText(candidate.topic, 300) ?? ""}`;
  const source = asRecord(candidate.source);
  let hostname = "";
  try {
    hostname = new URL(String(source.url ?? "")).hostname;
  } catch {
    // Invalid URLs are rejected by the projector below.
  }

  return hostname === "example.com" || /sint[eé]tic|validaci[oó]n post-merge/i.test(combined)
    ? "validation"
    : "opportunity";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function projectScoreBreakdown(value: unknown) {
  if (!Array.isArray(value)) return [];

  const result = new Map<RadarScoreDimension["dimension"], RadarScoreDimension>();
  for (const rawEntry of value) {
    const entry = asRecord(rawEntry);
    const criterion = cleanText(entry.criterion, 64)?.toLowerCase();
    const mapped = criterion ? DIMENSIONS.get(criterion) : null;
    const score = safeScore(entry.score);
    if (!mapped || score === null) continue;

    const previous = result.get(mapped.dimension);
    if (!previous || score < previous.score) result.set(mapped.dimension, { ...mapped, score });
  }
  return [...result.values()];
}

export function projectRadarDecision(value: unknown): RadarDecision | null {
  const record = asRecord(value);
  if (record.schemaVersion !== 1 || record.outcome !== "NO_PUBLICATION") return null;

  const candidate = asRecord(record.candidate);
  const source = asRecord(candidate.source);
  const scoreRecord = asRecord(record.score);
  const editorialMetadata = asRecord(record.editorialMetadata);
  const runId = cleanText(record.engineRunId, 81);
  const detectedAt = safeDate(record.timestamp);
  const title = cleanText(candidate.title, 300);
  const topic = cleanText(candidate.topic, 300);
  const sourceName = cleanText(source.name, 200);
  const sourceUrl = safeUrl(source.url);
  const reason = cleanText(record.rejectionReason, 1_000);
  const score = safeScore(scoreRecord.total);

  if (
    !runId ||
    !ENGINE_RUN_ID.test(runId) ||
    !detectedAt ||
    !title ||
    !topic ||
    !sourceName ||
    !sourceUrl ||
    !reason ||
    score === null
  ) {
    return null;
  }

  const projected: RadarDecision = {
    id: runId,
    runId,
    kind: classifyDecision(record),
    outcome: "NO_PUBLICATION",
    detectedAt,
    title,
    topic,
    sourceName,
    sourceUrl,
    score,
    scoreBreakdown: projectScoreBreakdown(scoreRecord.breakdown),
    reason,
    category: cleanText(editorialMetadata.category, 120) ?? "Radar NexOps",
    territory: cleanText(editorialMetadata.territory, 120),
  };

  return SENSITIVE_VALUE.test(JSON.stringify(projected)) ? null : projected;
}

function projectPublication(value: unknown): RadarPublication | null {
  const record = asRecord(value);
  const id = cleanText(record.id, 140);
  const runId = cleanText(record.runId, 81);
  const title = cleanText(record.title, 300);
  const topic = cleanText(record.topic, 300);
  const category = cleanText(record.category, 120);
  const summary = cleanText(record.summary, 1_000);
  const sourceName = cleanText(record.sourceName, 200);
  const sourceUrl = safeUrl(record.sourceUrl);
  const score = safeScore(record.score);
  const publishedAt = safeDate(record.publishedAt);
  const url = safeUrl(record.url);
  const imageUrl = safeUrl(record.imageUrl);
  const reason = cleanText(record.reason, 1_000);

  if (
    record.outcome !== "PUBLICATION" ||
    !id ||
    !runId ||
    !ENGINE_RUN_ID.test(runId) ||
    !title ||
    !topic ||
    !category ||
    !summary ||
    !sourceName ||
    !sourceUrl ||
    score === null ||
    !publishedAt ||
    !url ||
    !reason
  ) {
    return null;
  }

  const projected: RadarPublication = {
    id,
    runId,
    outcome: "PUBLICATION",
    title,
    topic,
    category,
    summary,
    sourceName,
    sourceUrl,
    score,
    publishedAt,
    url,
    imageUrl,
    reason,
  };

  return SENSITIVE_VALUE.test(JSON.stringify(projected)) ? null : projected;
}

function workspaceConfiguration(workspaceId: string): RadarWorkspaceConfig | null {
  if (workspaceId !== "nexops") return null;

  return {
    publicationsUrl:
      process.env.RADAR_PUBLICATIONS_URL ??
      "https://www.nexopstech.com/radar-publications.json",
    historyRepository: process.env.RADAR_HISTORY_REPOSITORY ?? null,
    historyBranch: process.env.RADAR_HISTORY_BRANCH ?? null,
    historyToken: process.env.RADAR_HISTORY_READ_TOKEN ?? null,
  };
}

async function fetchJson(fetchImpl: FetchLike, url: string, init?: RequestInit) {
  const response = await fetchImpl(url, {
    ...init,
    signal: AbortSignal.timeout(8_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Radar source returned ${response.status}`);
  return body;
}

async function readPublications(fetchImpl: FetchLike, workspaceId: string, url: string) {
  const body = asRecord(
    await fetchJson(fetchImpl, url, {
      cache: "no-store",
      headers: { accept: "application/json" },
    }),
  );
  if (body.schemaVersion !== 1 || body.workspace !== workspaceId || !Array.isArray(body.publications)) {
    throw new Error("Radar publication manifest is invalid");
  }

  return {
    generatedAt: safeDate(body.generatedAt),
    publications: body.publications
      .map(projectPublication)
      .filter((item): item is RadarPublication => Boolean(item))
      .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt)),
  };
}

async function githubApi(
  fetchImpl: FetchLike,
  config: Required<Pick<RadarWorkspaceConfig, "historyRepository" | "historyBranch" | "historyToken">>,
  endpoint: string,
) {
  return fetchJson(
    fetchImpl,
    `https://api.github.com/repos/${config.historyRepository}${endpoint}`,
    {
      cache: "no-store",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${config.historyToken}`,
        "user-agent": "NexOps-Portal-Radar",
        "x-github-api-version": "2022-11-28",
      },
    },
  );
}

async function readHistory(fetchImpl: FetchLike, config: RadarWorkspaceConfig) {
  if (!config.historyRepository || !config.historyBranch || !config.historyToken) return null;
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(config.historyRepository)) {
    throw new Error("Invalid Radar history repository");
  }

  const completeConfig = {
    historyRepository: config.historyRepository,
    historyBranch: config.historyBranch,
    historyToken: config.historyToken,
  };
  const metadata = asRecord(await githubApi(fetchImpl, completeConfig, ""));
  if (metadata.private !== true || metadata.visibility !== "private") {
    throw new Error("Radar history repository must remain private");
  }

  const ref = asRecord(
    await githubApi(
      fetchImpl,
      completeConfig,
      `/git/ref/heads/${encodeURIComponent(completeConfig.historyBranch)}`,
    ),
  );
  const refObject = asRecord(ref.object);
  const sha = cleanText(refObject.sha, 80);
  if (!sha) throw new Error("Radar history branch has no valid head");

  const tree = asRecord(
    await githubApi(fetchImpl, completeConfig, `/git/trees/${sha}?recursive=1`),
  );
  const entries = (Array.isArray(tree.tree) ? tree.tree : [])
    .map(asRecord)
    .filter(
      (entry) =>
        entry.type === "blob" &&
        typeof entry.path === "string" &&
        /^no-publication\/[a-z0-9][a-z0-9._-]{5,80}\.json$/.test(entry.path),
    )
    .sort((left, right) => String(right.path).localeCompare(String(left.path)))
    .slice(0, MAX_HISTORY_RECORDS);

  const decisions: RadarDecision[] = [];
  for (let index = 0; index < entries.length; index += 10) {
    const batch = entries.slice(index, index + 10);
    const blobs = await Promise.all(
      batch.map((entry) => githubApi(fetchImpl, completeConfig, `/git/blobs/${entry.sha}`)),
    );
    for (const rawBlob of blobs) {
      const blob = asRecord(rawBlob);
      try {
        const decoded = Buffer.from(String(blob.content ?? "").replace(/\s/g, ""), "base64").toString(
          "utf8",
        );
        const projected = projectRadarDecision(JSON.parse(decoded));
        if (projected) decisions.push(projected);
      } catch {
        // Invalid history records are omitted and never reach the UI.
      }
    }
  }

  return decisions.sort((left, right) => right.detectedAt.localeCompare(left.detectedAt));
}

export async function loadRadarWorkspace(
  workspaceId: string,
  fetchImpl: FetchLike = fetch,
): Promise<RadarWorkspace> {
  const config = workspaceConfiguration(workspaceId);
  if (!config) {
    return {
      workspaceId,
      publications: [],
      decisions: [],
      publicationsState: "unavailable",
      historyState: "unavailable",
      generatedAt: null,
    };
  }

  const [publicationResult, historyResult] = await Promise.allSettled([
    readPublications(fetchImpl, workspaceId, config.publicationsUrl),
    readHistory(fetchImpl, config),
  ]);

  const historyMissingConfiguration =
    !config.historyRepository || !config.historyBranch || !config.historyToken;

  return {
    workspaceId,
    publications:
      publicationResult.status === "fulfilled" ? publicationResult.value.publications : [],
    decisions:
      historyResult.status === "fulfilled" && historyResult.value ? historyResult.value : [],
    publicationsState: publicationResult.status === "fulfilled" ? "ready" : "error",
    historyState:
      historyResult.status === "rejected"
        ? "error"
        : historyMissingConfiguration
          ? "unavailable"
          : "ready",
    generatedAt:
      publicationResult.status === "fulfilled" ? publicationResult.value.generatedAt : null,
  };
}
