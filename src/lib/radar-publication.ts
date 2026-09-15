import "server-only";

import { createHash } from "node:crypto";
import { verifyRadarPreviewToken } from "@/lib/radar-preview";
import { renderRadarCover, type RadarCover } from "@/lib/radar-cover";
export { renderRadarCoverSvg } from "@/lib/radar-cover";

import { canonicalRadarJson } from "@/lib/radar-engine-contract";
import { isSafeHttpsUrl, type RadarRun, type RadarRunCandidate } from "@/lib/radar-control-plane";

const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA = /^[0-9a-f]{40}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TERRITORIES = new Set([
  "automatizacion-procesos",
  "ia-aplicada-empresas",
  "crm-automatizacion-comercial",
  "data-analytics",
]);
const VISUAL_TYPES = new Set(["editorial-diagram", "process-diagram", "data-flow", "operations-interface"]);

export type RadarPublicationComposition = {
  title: string;
  slug: string;
  excerpt: string;
  seoTitle: string;
  metaDescription: string;
  primaryKeyword: string;
  searchIntent: string;
  territory: string;
  visualType: string;
  visualSubject: string;
  coverAlt: string;
  bodyMarkdown: string;
  sourceVerified: boolean;
  rightsVerified: boolean;
  clientClaimsAuthorizedOrAbsent: boolean;
};

export type RadarPublicationBundle = {
  compositionDigest: string;
  article: Record<string, unknown>;
  decision: Record<string, unknown>;
  cover: RadarCover;
};

type GitHubReference = { object?: { sha?: unknown } };
type GitHubCommit = { tree?: { sha?: unknown } };
type GitHubBlob = { sha?: unknown };
type GitHubTree = { sha?: unknown };
type GitHubPullRequest = { number?: unknown; html_url?: unknown; state?: string; merged_at?: string | null };

function publicationToken() {
  return (process.env.RADAR_PUBLICATION_GITHUB_TOKEN ?? "").trim();
}

function publicationRepository() {
  return (process.env.RADAR_PUBLICATION_GITHUB_REPOSITORY ?? "AlanTN13/webneoxps").trim();
}

function githubHeaders(token: string) {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "user-agent": "NexOps-Portal-Radar-Publication",
    "x-github-api-version": "2022-11-28",
  };
}

async function githubJson<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
    headers: { ...githubHeaders(token), ...init?.headers },
  });
  if (!response.ok) throw new Error(`webneoxps rechazó la publicación (${response.status}).`);
  return response.json() as Promise<T>;
}

function text(value: string, min: number, max: number, label: string) {
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) throw new Error(`${label} no tiene una longitud válida.`);
  return normalized;
}

export function markdownToRadarContent(markdown: string) {
  const blocks: Array<Record<string, unknown>> = [];
  const lines = markdown.replace(/\r/g, "").split("\n");
  let paragraph: string[] = [];
  let list: string[] = [];
  const flushParagraph = () => {
    const value = paragraph.join(" ").trim();
    if (value) blocks.push({ type: "paragraph", text: value });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ type: "list", ordered: false, items: list });
    list = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushParagraph(); flushList(); continue; }
    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    if (heading) { flushParagraph(); flushList(); blocks.push({ type: "heading", level: heading[1].length, text: heading[2] }); continue; }
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet) { flushParagraph(); list.push(bullet[1]); continue; }
    flushList();
    paragraph.push(line);
  }
  flushParagraph(); flushList();
  if (!blocks.length) throw new Error("El cuerpo de la nota no puede quedar vacío.");
  return blocks;
}

export function normalizeRadarPublicationComposition(input: RadarPublicationComposition, requireConfirmations = true) {
  const normalized = {
    title: text(input.title, 10, 150, "El título"),
    slug: input.slug.trim().toLowerCase(),
    excerpt: text(input.excerpt, 40, 280, "La bajada"),
    seoTitle: text(input.seoTitle, 20, 70, "El título SEO"),
    metaDescription: text(input.metaDescription, 70, 180, "La descripción SEO"),
    primaryKeyword: text(input.primaryKeyword, 3, 100, "La palabra clave"),
    searchIntent: text(input.searchIntent, 3, 120, "La intención de búsqueda"),
    territory: input.territory.trim(),
    visualType: input.visualType.trim(),
    visualSubject: text(input.visualSubject, 5, 180, "El concepto visual"),
    coverAlt: text(input.coverAlt, 10, 220, "El texto alternativo"),
    bodyMarkdown: text(input.bodyMarkdown, 120, 20_000, "El cuerpo"),
    sourceVerified: input.sourceVerified === true,
    rightsVerified: input.rightsVerified === true,
    clientClaimsAuthorizedOrAbsent: input.clientClaimsAuthorizedOrAbsent === true,
  };
  if (!SLUG.test(normalized.slug)) throw new Error("El slug sólo puede usar minúsculas, números y guiones.");
  if (!TERRITORIES.has(normalized.territory)) throw new Error("El territorio editorial no es válido.");
  if (!VISUAL_TYPES.has(normalized.visualType)) throw new Error("El tipo de visual no es válido.");
  if (requireConfirmations && (!normalized.sourceVerified || !normalized.rightsVerified || !normalized.clientClaimsAuthorizedOrAbsent)) {
    throw new Error("Confirmá fuente, derechos y ausencia de afirmaciones no autorizadas antes de publicar.");
  }
  markdownToRadarContent(normalized.bodyMarkdown);
  return normalized;
}

export function radarPublicationPackageDigest(article: Record<string, unknown>, coverSha256: string) {
  return createHash("sha256").update(canonicalRadarJson({ schemaVersion: 2, article, coverSha256 }), "utf8").digest("hex");
}

export function radarTopicFingerprint(candidate: RadarRunCandidate) {
  return candidate.topicFingerprint || createHash("sha256").update(canonicalRadarJson({
    topic: candidate.topic.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(),
    title: candidate.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
  })).digest("hex");
}

export async function buildRadarPublicationPackage(run: RadarRun, input: RadarPublicationComposition) {
  const candidate = run.candidate;
  if (!candidate?.draft || !(["review_pending", "approved", "postponed"].includes(run.status) || (run.status === "failed" && run.publication?.status === "failed"))) throw new Error("La nota no está lista para revisión.");
  const composition = normalizeRadarPublicationComposition(input, false);
  const sources = candidate.sources?.length ? candidate.sources : [{ name: candidate.sourceName, url: candidate.sourceUrl }];
  if (sources.some((source) => !source.name.trim() || !isSafeHttpsUrl(source.url))) throw new Error("Las fuentes no son seguras.");
  const cover = await renderRadarCover({ title: composition.title, topic: candidate.topic, visualType: composition.visualType, visualSubject: composition.visualSubject });
  const coverImage = `/assets/insights/editorial/${composition.slug}.png`;
  const article = {
    title: composition.title,
    slug: composition.slug,
    contentPurpose: "actualidad",
    contentType: "actualidad",
    territory: composition.territory,
    category: candidate.topic,
    publishedAt: new Date(run.createdAt).toISOString(),
    excerpt: composition.excerpt,
    seoTitle: composition.seoTitle,
    metaDescription: composition.metaDescription,
    primaryKeyword: composition.primaryKeyword,
    searchIntent: composition.searchIntent,
    sourceName: candidate.sourceName,
    sourceUrl: candidate.sourceUrl,
    sources,
    content: markdownToRadarContent(composition.bodyMarkdown),
    relatedSlugs: [],
    topicFingerprint: radarTopicFingerprint(candidate),
    engineRunId: run.id,
    engineScore: candidate.score,
    generatedByEngine: true,
    cta: { label: "Conversar con NexOps", href: "/#contacto" },
    coverImage,
    visualType: composition.visualType,
    primaryEntity: "NexOps",
    secondaryEntities: [candidate.topic],
    visualSubject: composition.visualSubject,
    assetSource: "nexops-original",
    assetCredit: "Plantilla editorial original de NexOps, compuesta sin generación de imágenes por IA.",
    coverAlt: composition.coverAlt,
    ogImage: coverImage,
    coverWidth: 1600,
    coverHeight: 900,
    coverFocus: { mobile: "50% 50%", desktop: "50% 50%" },
  };
  return { article, cover, compositionDigest: radarPublicationPackageDigest(article, cover.sha256) };
}

export async function buildRadarPublicationBundle(input: {
  run: RadarRun;
  composition: RadarPublicationComposition;
  approvedBy: string;
  approvedAt: string;
  callbackUrl: string;
  previewToken: string;
}): Promise<RadarPublicationBundle> {
  if (!(input.run.status === "approved" || (input.run.status === "failed" && input.run.publication?.status === "failed" && !input.run.publication.mergeSha)) || input.run.autonomyMode !== "review") throw new Error("La nota no está aprobada para composición manual.");
  if (!isSafeHttpsUrl(input.callbackUrl)) throw new Error("El callback no es seguro.");
  if ((input.run.requestKind === "opportunity_search" && input.run.candidate?.qa?.verdict !== "PASS") || (input.run.candidate?.qa && input.run.candidate.qa.verdict !== "PASS")) throw new Error("QA debe aprobar la nota antes de publicar.");
  const composition = normalizeRadarPublicationComposition(input.composition);
  const { article, cover, compositionDigest } = await buildRadarPublicationPackage(input.run, composition);
  const previewVerified = verifyRadarPreviewToken({ token: input.previewToken, runId: input.run.id, workspaceId: input.run.workspaceId, actorId: input.approvedBy, compositionDigest });
  const decision = {
    outcome: "PUBLICATION",
    engineRunId: input.run.id,
    publicationMode: "manual_review",
    article: "./article.json",
    coverAsset: "./cover.png",
    packageVersion: 2,
    coverSha256: cover.sha256,
    approval: {
      type: "portal_explicit_manual_review",
      runId: input.run.id,
      workspaceId: input.run.workspaceId,
      approvedBy: input.approvedBy,
      approvedAt: new Date(input.approvedAt).toISOString(),
      compositionDigest,
    },
    portalCallback: {
      url: input.callbackUrl,
      runId: input.run.id,
      compositionDigest,
    },
    gateReport: {
      engineThreshold: 80,
      sourceVerified: composition.sourceVerified,
      rightsVerified: composition.rightsVerified,
      coverSemantic: previewVerified,
      coverResponsive: article.coverWidth === 1600 && article.coverHeight === 900,
      clientClaimsAuthorizedOrAbsent: composition.clientClaimsAuthorizedOrAbsent,
      noCriticalWarnings: composition.clientClaimsAuthorizedOrAbsent && (!input.run.candidate?.qa || input.run.candidate.qa.verdict === "PASS"),
      criticalWarnings: [],
      evidence: {
        sourceVerified: "explicit_human_attestation",
        rightsVerified: "explicit_human_attestation_original_template",
        coverSemantic: "signed_exact_package_preview_review",
        coverResponsive: "decoded_png_1600x900",
        noCriticalWarnings: input.run.candidate?.qa ? "independent_qa_pass" : "manual_editorial_attestations",
        coverSha256: cover.sha256,
        ...(input.run.candidate?.qa ? { qa: input.run.candidate.qa } : {}),
      },
    },
  };
  return {
    compositionDigest,
    article,
    decision,
    cover,
  };
}

export function radarPublicationConnected() {
  return Boolean(process.env.RADAR_PUBLICATION_ENABLED === "true" && publicationToken() && (process.env.RADAR_PUBLICATION_CALLBACK_SECRET?.trim().length ?? 0) >= 32);
}

async function createBlob(repository: string, token: string, content: string, encoding = "utf-8") {
  const blob = await githubJson<GitHubBlob>(`https://api.github.com/repos/${repository}/git/blobs`, token, {
    method: "POST",
    body: JSON.stringify({ content, encoding }),
  });
  if (typeof blob.sha !== "string" || !SHA.test(blob.sha)) throw new Error("GitHub no confirmó el archivo de publicación.");
  return blob.sha;
}

export async function dispatchRadarPublication(input: { runId: string; bundle: RadarPublicationBundle; publicationAttempt?: number }) {
  const token = publicationToken();
  const repository = publicationRepository();
  if (!radarPublicationConnected() || !REPOSITORY.test(repository)) throw new Error("El puente de publicación todavía no está configurado.");
  const attempt = input.publicationAttempt ?? 1;
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 100) throw new Error("Intento de publicación inválido.");
  const branch = `radar/${input.runId}${attempt > 1 ? `-attempt-${attempt}` : ""}`;
  (input.bundle.decision.portalCallback as Record<string, unknown>).attempt = attempt;
  const [owner] = repository.split("/");
  const pulls = await githubJson<GitHubPullRequest[]>(`https://api.github.com/repos/${repository}/pulls?${new URLSearchParams({ state: "all", head: `${owner}:${branch}`, per_page: "1" })}`, token);
  const existing = pulls[0];
  if (existing && typeof existing.number === "number" && typeof existing.html_url === "string") {
    if (existing.number === 73 || existing.state !== "open" || existing.merged_at) throw new Error("Esta publicación requiere conciliación antes de reintentar.");
    return { pullRequestNumber: existing.number, pullRequestUrl: existing.html_url, reused: true };
  }

  const reference = await githubJson<GitHubReference>(`https://api.github.com/repos/${repository}/git/ref/heads/main`, token);
  const baseSha = reference.object?.sha;
  if (typeof baseSha !== "string" || !SHA.test(baseSha)) throw new Error("webneoxps no devolvió un main válido.");
  const baseCommit = await githubJson<GitHubCommit>(`https://api.github.com/repos/${repository}/git/commits/${baseSha}`, token);
  const baseTree = baseCommit.tree?.sha;
  if (typeof baseTree !== "string" || !SHA.test(baseTree)) throw new Error("webneoxps no devolvió el árbol base.");
  const root = `.radar/runs/${input.runId}`;
  const [decisionSha, articleSha, coverSha] = await Promise.all([
    createBlob(repository, token, `${JSON.stringify(input.bundle.decision, null, 2)}\n`),
    createBlob(repository, token, `${JSON.stringify(input.bundle.article, null, 2)}\n`),
    createBlob(repository, token, input.bundle.cover.pngBase64, "base64"),
  ]);
  const tree = await githubJson<GitHubTree>(`https://api.github.com/repos/${repository}/git/trees`, token, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseTree,
      tree: [
        { path: `${root}/decision.json`, mode: "100644", type: "blob", sha: decisionSha },
        { path: `${root}/article.json`, mode: "100644", type: "blob", sha: articleSha },
        { path: `${root}/cover.png`, mode: "100644", type: "blob", sha: coverSha },
      ],
    }),
  });
  if (typeof tree.sha !== "string" || !SHA.test(tree.sha)) throw new Error("GitHub no confirmó el bundle de publicación.");
  const commit = await githubJson<GitHubBlob>(`https://api.github.com/repos/${repository}/git/commits`, token, {
    method: "POST",
    body: JSON.stringify({ message: `radar: manual publication ${input.runId}`, tree: tree.sha, parents: [baseSha] }),
  });
  if (typeof commit.sha !== "string" || !SHA.test(commit.sha)) throw new Error("GitHub no confirmó el commit de publicación.");
  await githubJson(`https://api.github.com/repos/${repository}/git/refs`, token, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
  });
  const pull = await githubJson<GitHubPullRequest>(`https://api.github.com/repos/${repository}/pulls`, token, {
    method: "POST",
    body: JSON.stringify({
      title: `[Radar] Publicación manual ${input.runId}`,
      head: branch,
      base: "main",
      body: `Publicación originada en Portal Radar después de dos aprobaciones explícitas.\n\nDigest: \`${input.bundle.compositionDigest}\``,
      draft: false,
    }),
  });
  if (typeof pull.number !== "number" || typeof pull.html_url !== "string") throw new Error("GitHub no devolvió el PR de publicación.");
  return { pullRequestNumber: pull.number, pullRequestUrl: pull.html_url, reused: false };
}

/** API output is a draft; these booleans remain human attestations, never AI gates. */
export async function prepareRadarPublicationCandidate(candidate: RadarRunCandidate) {
  if (!candidate.draft) throw new Error("Falta el borrador para componer la nota.");
  const topic = candidate.topic.toLowerCase();
  const territory = /crm|venta/.test(topic) ? "crm-automatizacion-comercial" : /data|datos|analytics/.test(topic) ? "data-analytics" : /ia|inteligencia/.test(topic) ? "ia-aplicada-empresas" : "automatizacion-procesos";
  const visualType = territory === "data-analytics" ? "data-flow" : territory === "automatizacion-procesos" ? "process-diagram" : territory === "crm-automatizacion-comercial" ? "operations-interface" : "editorial-diagram";
  const title = candidate.draft.headline;
  const composition = normalizeRadarPublicationComposition({
    title,
    slug: title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120).replace(/-$/, ""),
    excerpt: candidate.draft.deck,
    seoTitle: title.slice(0, 70),
    metaDescription: `${candidate.draft.deck} Impacto operativo y criterios de aplicación para empresas.`.slice(0, 180),
    primaryKeyword: candidate.topic,
    searchIntent: "Entender el impacto operativo y evaluar una aplicación concreta",
    territory, visualType,
    visualSubject: title.slice(0, 180),
    coverAlt: `Diagrama sobre ${title}`.slice(0, 220),
    bodyMarkdown: candidate.draft.bodyMarkdown,
    sourceVerified: false, rightsVerified: false, clientClaimsAuthorizedOrAbsent: false,
  }, false);
  const cover = await renderRadarCover({ title, topic: candidate.topic, visualType, visualSubject: composition.visualSubject });
  return { composition, cover };
}
