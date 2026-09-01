import "server-only";

import { createHash } from "node:crypto";

import { canonicalRadarJson } from "@/lib/radar-engine-contract";
import { isSafeHttpsUrl, type RadarRun } from "@/lib/radar-control-plane";

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
  coverSvg: string;
};

type GitHubReference = { object?: { sha?: unknown } };
type GitHubCommit = { tree?: { sha?: unknown } };
type GitHubBlob = { sha?: unknown };
type GitHubTree = { sha?: unknown };
type GitHubPullRequest = { number?: unknown; html_url?: unknown };

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

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function wrapSvgText(value: string, width = 30) {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  for (const word of words) {
    const current = lines.at(-1) ?? "";
    if (!current || `${current} ${word}`.length > width) lines.push(word);
    else lines[lines.length - 1] = `${current} ${word}`;
  }
  return lines.slice(0, 4);
}

export function renderRadarCoverSvg(input: { title: string; topic: string; visualType: string }) {
  const lines = wrapSvgText(input.title);
  const title = lines.map((line, index) => `<text x="118" y="${330 + index * 84}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="68" font-weight="700">${escapeXml(line)}</text>`).join("");
  const motif = input.visualType === "data-flow"
    ? '<path d="M1030 270h260v120h180v190h-260v120h-180" fill="none" stroke="#9ef3d4" stroke-width="22" stroke-linecap="round"/><circle cx="1030" cy="270" r="34" fill="#ffffff"/><circle cx="1470" cy="580" r="34" fill="#ffffff"/>'
    : '<rect x="1040" y="260" width="360" height="360" rx="42" fill="#ffffff" fill-opacity=".08" stroke="#c7baff" stroke-width="6"/><path d="M1100 535l88-120 84 72 82-138" fill="none" stroke="#9ef3d4" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/><circle cx="1188" cy="415" r="22" fill="#ffffff"/><circle cx="1272" cy="487" r="22" fill="#ffffff"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-label="${escapeXml(input.title)}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#23104f"/><stop offset=".58" stop-color="#5b3db8"/><stop offset="1" stop-color="#0b7f76"/></linearGradient><radialGradient id="r"><stop stop-color="#ffffff" stop-opacity=".18"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><rect width="1600" height="900" fill="url(#g)"/><circle cx="1410" cy="80" r="520" fill="url(#r)"/><text x="118" y="108" fill="#bfb1ff" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" letter-spacing="5">RADAR BY NEXOPS</text><rect x="118" y="160" width="128" height="8" rx="4" fill="#9ef3d4"/>${title}<text x="118" y="790" fill="#d9d2f8" font-family="Arial, Helvetica, sans-serif" font-size="30">${escapeXml(input.topic)}</text>${motif}</svg>`;
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

export function normalizeRadarPublicationComposition(input: RadarPublicationComposition) {
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
  if (!normalized.sourceVerified || !normalized.rightsVerified || !normalized.clientClaimsAuthorizedOrAbsent) {
    throw new Error("Confirmá fuente, derechos y ausencia de afirmaciones no autorizadas antes de publicar.");
  }
  markdownToRadarContent(normalized.bodyMarkdown);
  return normalized;
}

export function radarPublicationCompositionDigest(composition: RadarPublicationComposition) {
  return createHash("sha256").update(canonicalRadarJson(normalizeRadarPublicationComposition(composition)), "utf8").digest("hex");
}

export function buildRadarPublicationBundle(input: {
  run: RadarRun;
  composition: RadarPublicationComposition;
  approvedBy: string;
  approvedAt: string;
  callbackUrl: string;
}): RadarPublicationBundle {
  const candidate = input.run.candidate;
  if (input.run.status !== "approved" || input.run.autonomyMode !== "review" || !candidate?.draft) {
    throw new Error("La nota no está aprobada para composición manual.");
  }
  if (!isSafeHttpsUrl(candidate.sourceUrl) || !isSafeHttpsUrl(input.callbackUrl)) throw new Error("La fuente o el callback no son seguros.");
  const composition = normalizeRadarPublicationComposition(input.composition);
  const compositionDigest = radarPublicationCompositionDigest(composition);
  const coverImage = `/assets/insights/editorial/${composition.slug}.svg`;
  const article = {
    title: composition.title,
    slug: composition.slug,
    contentPurpose: "actualidad",
    contentType: "actualidad",
    territory: composition.territory,
    category: candidate.topic,
    publishedAt: new Date(input.approvedAt).toISOString(),
    excerpt: composition.excerpt,
    seoTitle: composition.seoTitle,
    metaDescription: composition.metaDescription,
    primaryKeyword: composition.primaryKeyword,
    searchIntent: composition.searchIntent,
    sourceName: candidate.sourceName,
    sourceUrl: candidate.sourceUrl,
    sources: [{ name: candidate.sourceName, url: candidate.sourceUrl }],
    content: markdownToRadarContent(composition.bodyMarkdown),
    relatedSlugs: [],
    topicFingerprint: `${composition.territory}:${composition.primaryKeyword.toLowerCase().replace(/\s+/g, "-")}:${input.run.id}`,
    engineRunId: input.run.id,
    engineScore: candidate.score,
    generatedByEngine: true,
    cta: { label: "Conversar con NexOps", href: "/#contacto" },
    coverImage,
    visualType: composition.visualType,
    primaryEntity: "NexOps",
    secondaryEntities: [candidate.topic],
    visualSubject: composition.visualSubject,
    assetSource: "nexops-original",
    assetCredit: "Composición editorial original de NexOps, aprobada manualmente desde Radar.",
    coverAlt: composition.coverAlt,
    ogImage: coverImage,
    coverWidth: 1600,
    coverHeight: 900,
    coverFocus: { mobile: "50% 50%", desktop: "50% 50%" },
  };
  const decision = {
    outcome: "PUBLICATION",
    engineRunId: input.run.id,
    publicationMode: "manual_review",
    article: "./article.json",
    coverAsset: "./cover.svg",
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
      coverSemantic: true,
      coverResponsive: true,
      clientClaimsAuthorizedOrAbsent: composition.clientClaimsAuthorizedOrAbsent,
      noCriticalWarnings: true,
      criticalWarnings: [],
    },
  };
  return {
    compositionDigest,
    article,
    decision,
    coverSvg: renderRadarCoverSvg({ title: composition.title, topic: candidate.topic, visualType: composition.visualType }),
  };
}

export function radarPublicationConnected() {
  return Boolean(publicationToken() && (process.env.RADAR_PUBLICATION_CALLBACK_SECRET?.trim().length ?? 0) >= 32);
}

async function createBlob(repository: string, token: string, content: string) {
  const blob = await githubJson<GitHubBlob>(`https://api.github.com/repos/${repository}/git/blobs`, token, {
    method: "POST",
    body: JSON.stringify({ content, encoding: "utf-8" }),
  });
  if (typeof blob.sha !== "string" || !SHA.test(blob.sha)) throw new Error("GitHub no confirmó el archivo de publicación.");
  return blob.sha;
}

export async function dispatchRadarPublication(input: { runId: string; bundle: RadarPublicationBundle }) {
  const token = publicationToken();
  const repository = publicationRepository();
  if (!radarPublicationConnected() || !REPOSITORY.test(repository)) throw new Error("El puente de publicación todavía no está configurado.");
  const branch = `radar/${input.runId}`;
  const [owner] = repository.split("/");
  const pulls = await githubJson<GitHubPullRequest[]>(`https://api.github.com/repos/${repository}/pulls?${new URLSearchParams({ state: "all", head: `${owner}:${branch}`, per_page: "1" })}`, token);
  const existing = pulls[0];
  if (existing && typeof existing.number === "number" && typeof existing.html_url === "string") {
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
    createBlob(repository, token, input.bundle.coverSvg),
  ]);
  const tree = await githubJson<GitHubTree>(`https://api.github.com/repos/${repository}/git/trees`, token, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseTree,
      tree: [
        { path: `${root}/decision.json`, mode: "100644", type: "blob", sha: decisionSha },
        { path: `${root}/article.json`, mode: "100644", type: "blob", sha: articleSha },
        { path: `${root}/cover.svg`, mode: "100644", type: "blob", sha: coverSha },
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
