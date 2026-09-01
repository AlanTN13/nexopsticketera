import "server-only";

import { isSafeHttpsUrl, type RadarAutonomyMode, type RadarManualNoteRequest, type RadarRequestKind } from "@/lib/radar-control-plane";

const DEFAULT_REPOSITORY = "AlanTN13/radar-history";
const DEFAULT_BASE_BRANCH = "history";
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const BRANCH = /^[A-Za-z0-9._/-]{1,120}$/;

export type RadarQueueRequest = {
  schemaVersion: 1;
  requestId: string;
  requestedAt: string;
  workspaceId: string;
  trigger: "manual" | "scheduled";
  mode: Exclude<RadarAutonomyMode, "automatic">;
  intent: RadarRequestKind;
  manualNote: RadarManualNoteRequest | null;
  callbackUrl: string;
  publicationGate: false;
};

type GitHubReference = { object?: { sha?: unknown } };
type GitHubPullRequest = { number?: unknown; html_url?: unknown };
type GitHubRepository = { private?: unknown; visibility?: unknown };
type GitHubContent = { content?: unknown; encoding?: unknown };

function queueToken() {
  return (process.env.RADAR_QUEUE_GITHUB_TOKEN ?? "").trim();
}

function queueRepository() {
  return (process.env.RADAR_QUEUE_GITHUB_REPOSITORY ?? DEFAULT_REPOSITORY).trim();
}

function queueBaseBranch() {
  return (process.env.RADAR_QUEUE_GITHUB_BASE_BRANCH ?? DEFAULT_BASE_BRANCH).trim();
}

function githubHeaders(token: string) {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "user-agent": "NexOps-Portal-Radar-Queue",
    "x-github-api-version": "2022-11-28",
  };
}

async function githubJson<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const response = await githubFetch(url, token, init);
  if (!response.ok) throw new Error(`La cola editorial rechazó la solicitud (${response.status}).`);
  return response.json() as Promise<T>;
}

async function githubFetch(url: string, token: string, init?: RequestInit) {
  return fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    headers: { ...githubHeaders(token), ...init?.headers },
  });
}

export function radarEngineConnected() {
  return Boolean(queueToken() && process.env.RADAR_ENGINE_CALLBACK_SECRET?.trim());
}

export function buildRadarQueueRequest(input: {
  runId: string;
  requestedAt: string;
  workspaceId: string;
  triggerKind: "manual" | "scheduled";
  autonomyMode: Exclude<RadarAutonomyMode, "automatic">;
  requestKind?: RadarRequestKind;
  manualNote?: RadarManualNoteRequest | null;
  callbackUrl: string;
}): RadarQueueRequest {
  if (!/^[0-9a-f-]{36}$/i.test(input.runId) || !/^[a-z0-9][a-z0-9._-]{2,80}$/.test(input.workspaceId) ||
      !Number.isFinite(Date.parse(input.requestedAt)) || !isSafeHttpsUrl(input.callbackUrl) ||
      (input.manualNote && !isSafeHttpsUrl(input.manualNote.sourceUrl)) ||
      (input.requestKind === "manual_note" && (!input.manualNote || input.autonomyMode !== "review"))) {
    throw new Error("La solicitud para la cola editorial no es válida.");
  }
  const manualNote = input.manualNote ? {
    title: input.manualNote.title?.trim() || null,
    sourceUrl: input.manualNote.sourceUrl.trim(),
    instructions: input.manualNote.instructions?.trim() || null,
  } : null;
  return {
    schemaVersion: 1,
    requestId: input.runId.toLowerCase(),
    requestedAt: new Date(input.requestedAt).toISOString(),
    workspaceId: input.workspaceId.toLowerCase(),
    trigger: input.triggerKind,
    mode: input.autonomyMode,
    intent: input.requestKind ?? "opportunity_search",
    manualNote,
    callbackUrl: input.callbackUrl.trim(),
    publicationGate: false,
  };
}

function requestBranch(requestId: string) {
  return `radar-request/${requestId}`;
}

function requestPath(requestId: string) {
  return `queue/requests/${requestId}.json`;
}

async function findPullRequest(repository: string, branch: string, token: string) {
  const [owner] = repository.split("/");
  const query = new URLSearchParams({ state: "all", head: `${owner}:${branch}`, per_page: "1" });
  const pulls = await githubJson<GitHubPullRequest[]>(
    `https://api.github.com/repos/${repository}/pulls?${query}`,
    token,
  );
  const pull = pulls[0];
  return pull && typeof pull.number === "number" && typeof pull.html_url === "string"
    ? { externalRunId: String(pull.number), externalRunUrl: pull.html_url, reused: true }
    : null;
}

async function assertPrivateQueue(repository: string, token: string) {
  const metadata = await githubJson<GitHubRepository>(`https://api.github.com/repos/${repository}`, token);
  if (metadata.private !== true || metadata.visibility !== "private") {
    throw new Error("Radar sólo puede despachar solicitudes a una cola privada.");
  }
}

async function readQueuedRequest(repository: string, branch: string, request: RadarQueueRequest, token: string) {
  const query = new URLSearchParams({ ref: branch });
  const response = await githubFetch(
    `https://api.github.com/repos/${repository}/contents/${requestPath(request.requestId)}?${query}`,
    token,
  );
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`La cola editorial no pudo verificar la solicitud (${response.status}).`);
  const file = await response.json() as GitHubContent;
  if (file.encoding !== "base64" || typeof file.content !== "string") {
    throw new Error("La cola editorial devolvió un archivo inválido.");
  }
  let stored: unknown;
  try {
    stored = JSON.parse(Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8"));
  } catch {
    throw new Error("La solicitud existente en la cola no es válida.");
  }
  if (JSON.stringify(stored) !== JSON.stringify(request)) {
    throw new Error("La rama de cola ya existe con una solicitud diferente.");
  }
  return true;
}

export async function dispatchRadarRun(input: Parameters<typeof buildRadarQueueRequest>[0]) {
  const token = queueToken();
  const repository = queueRepository();
  const baseBranch = queueBaseBranch();
  if (!token) throw new Error("El trabajador editorial todavía no está configurado.");
  if (!REPOSITORY.test(repository) || !BRANCH.test(baseBranch)) {
    throw new Error("La cola editorial no tiene una configuración válida.");
  }

  const request = buildRadarQueueRequest(input);
  const branch = requestBranch(request.requestId);
  await assertPrivateQueue(repository, token);
  const existing = await findPullRequest(repository, branch, token);
  if (existing) return { repository, branch, ...existing };

  const reference = await githubJson<GitHubReference>(
    `https://api.github.com/repos/${repository}/git/ref/heads/${encodeURIComponent(baseBranch)}`,
    token,
  );
  const baseSha = reference.object?.sha;
  if (typeof baseSha !== "string" || !/^[0-9a-f]{40}$/i.test(baseSha)) {
    throw new Error("La cola editorial no devolvió una referencia válida.");
  }

  const createReference = await githubFetch(`https://api.github.com/repos/${repository}/git/refs`, token, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
  });
  if (!createReference.ok && createReference.status !== 422) {
    throw new Error(`La cola editorial no pudo reservar la solicitud (${createReference.status}).`);
  }
  if (createReference.status === 422) {
    const repeated = await findPullRequest(repository, branch, token);
    if (repeated) return { repository, branch, ...repeated };
  }

  const requestExists = await readQueuedRequest(repository, branch, request, token);
  if (!requestExists) {
    const content = `${JSON.stringify(request, null, 2)}\n`;
    const queued = await githubFetch(
      `https://api.github.com/repos/${repository}/contents/${requestPath(request.requestId)}`,
      token,
      {
        method: "PUT",
        body: JSON.stringify({
          message: `radar: enqueue ${request.requestId}`,
          content: Buffer.from(content, "utf8").toString("base64"),
          branch,
        }),
      },
    );
    if (!queued.ok) {
      if (queued.status !== 422 || !await readQueuedRequest(repository, branch, request, token)) {
        throw new Error(`La cola editorial no pudo guardar la solicitud (${queued.status}).`);
      }
    }
  }

  const pullResponse = await githubFetch(`https://api.github.com/repos/${repository}/pulls`, token, {
    method: "POST",
    body: JSON.stringify({
      title: `[Radar] ${request.requestId}`,
      head: branch,
      base: baseBranch,
      body: "Solicitud editorial privada originada en Portal NexOps. Sin publicación automática.",
      draft: false,
    }),
  });
  if (!pullResponse.ok) {
    const repeated = await findPullRequest(repository, branch, token);
    if (repeated) return { repository, branch, ...repeated };
    throw new Error(`La cola editorial no pudo abrir el PR (${pullResponse.status}).`);
  }
  const pull = await pullResponse.json() as GitHubPullRequest;
  if (typeof pull.number !== "number" || typeof pull.html_url !== "string") {
    throw new Error("La cola editorial no devolvió un PR válido.");
  }
  return {
    repository,
    branch,
    externalRunId: String(pull.number),
    externalRunUrl: pull.html_url,
    reused: false,
  };
}
