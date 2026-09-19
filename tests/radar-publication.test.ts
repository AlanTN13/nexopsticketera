import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildRadarPublicationBundle,
  buildRadarPublicationPackage,
  prepareRadarPublicationCandidate,
  radarTopicFingerprint,
  radarPublicationPackageDigest,
  markdownToRadarContent,
  renderRadarCoverSvg,
} from "@/lib/radar-publication";
import sharp from "sharp";
import { renderRadarCover, RADAR_COVER_TYPES } from "@/lib/radar-cover";
import { issueRadarPreviewToken, verifyRadarPreviewToken } from "@/lib/radar-preview";
import type { RadarRun } from "@/lib/radar-control-plane";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260901194500_radar_manual_publication_gate.sql"), "utf8");

const run: RadarRun = {
  id: "c40b81b7-6ac4-4da1-92e8-86a7a50f9dc4",
  workspaceId: "nexops",
  companyId: null,
  requestedBy: "a40b81b7-6ac4-4da1-92e8-86a7a50f9dc4",
  triggerKind: "manual",
  requestKind: "manual_note",
  manualNote: { title: "Nota", sourceUrl: "https://example.org/research", instructions: null },
  autonomyMode: "review",
  status: "approved",
  externalRunId: "12",
  externalRunUrl: "https://github.com/AlanTN13/radar-history/pull/12",
  candidate: {
    title: "Agentes operativos con controles verificables",
    topic: "IA aplicada",
    sourceName: "Fuente oficial",
    sourceUrl: "https://example.org/research",
    score: 91,
    businessReasons: ["Relevancia operativa"],
    draft: {
      headline: "Cómo gobernar agentes operativos sin perder trazabilidad",
      deck: "Una guía concreta para aplicar agentes con controles, responsables y evidencia verificable en cada paso.",
      bodyMarkdown: "## Del piloto a la operación\n\nLos agentes necesitan controles claros, responsables y evidencia verificable para operar con seguridad.\n\n## Qué cambia\n\n- Se registra cada decisión\n- Se mantiene revisión humana\n- Se mide el resultado operativo",
    },
  },
  resultReason: null,
  finalUrl: null,
  errorMessage: null,
  startedAt: "2026-09-01T20:00:00.000Z",
  completedAt: null,
  createdAt: "2026-09-01T20:00:00.000Z",
  updatedAt: "2026-09-01T20:00:00.000Z",
  events: [],
  decisions: [],
  publication: null,
};

const composition = {
  title: "Cómo gobernar agentes operativos sin perder trazabilidad",
  slug: "gobernar-agentes-operativos-sin-perder-trazabilidad",
  excerpt: "Una guía concreta para aplicar agentes con controles, responsables y evidencia verificable en cada paso.",
  seoTitle: "Cómo gobernar agentes operativos con trazabilidad",
  metaDescription: "Conocé cómo aplicar agentes operativos con controles, responsables y evidencia verificable para sostener resultados seguros en empresas.",
  primaryKeyword: "agentes operativos",
  searchIntent: "Evaluar agentes de IA para operaciones empresariales",
  territory: "ia-aplicada-empresas",
  visualType: "editorial-diagram",
  visualSubject: "Un circuito operativo con controles humanos y trazabilidad",
  coverAlt: "Diagrama editorial de un agente operativo con controles humanos",
  bodyMarkdown: run.candidate!.draft!.bodyMarkdown,
  sourceVerified: true,
  rightsVerified: true,
  clientClaimsAuthorizedOrAbsent: true,
};

describe("Radar manual publication gate", () => {
  it("builds a real PNG and a bundle carrying the two-step approval proof", async () => {
    vi.stubEnv("RADAR_PREVIEW_SECRET", "test-only-secret-".repeat(4));
    const prepared = await buildRadarPublicationPackage(run, composition);
    const previewToken = issueRadarPreviewToken({ runId: run.id, workspaceId: run.workspaceId, actorId: run.requestedBy, compositionDigest: prepared.compositionDigest });
    const bundle = await buildRadarPublicationBundle({
      previewToken,
      run,
      composition,
      approvedBy: run.requestedBy,
      approvedAt: "2026-09-01T20:30:00.000Z",
      callbackUrl: `https://portal.nexopstech.com/api/radar/runs/${run.id}/publication`,
    });
    expect(bundle.compositionDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(bundle.decision).toMatchObject({
      publicationMode: "manual_review",
      approval: { type: "portal_explicit_manual_review", runId: run.id },
      portalCallback: { runId: run.id },
    });
    expect(bundle.article).toMatchObject({ generatedByEngine: true, engineRunId: run.id, coverWidth: 1600, coverHeight: 900 });
    expect(await sharp(Buffer.from(bundle.cover.pngBase64, "base64")).metadata()).toMatchObject({ format: "png", width: 1600, height: 900 });
    expect(bundle.article.coverImage).toMatch(/\.png$/);
    expect(bundle.decision.coverAsset).toBe("./cover.png");
  });

  it("converts the reviewed markdown to the webneoxps content contract", () => {
    expect(markdownToRadarContent(composition.bodyMarkdown)).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "heading", level: 2 }),
      expect.objectContaining({ type: "list", ordered: false }),
    ]));
    expect(renderRadarCoverSvg({ title: "Menor que <script>", topic: "IA & datos", visualType: "data-flow" })).not.toContain("<script>");
  });

  it("enforces admin authorization, idempotency and manual-review-only at the database boundary", () => {
    expect(migration).toContain("private.radar_workspace_has_access(run.workspace_id, 'admin')");
    expect(migration).toContain("run.status <> 'approved'");
    expect(migration).toContain("run.autonomy_mode <> 'review'");
    expect(migration).toContain("or settings.scheduler_enabled");
    expect(migration).toContain("constraint radar_publication_jobs_idempotency unique");
    expect(migration).toContain("record_radar_publication_result");
  });

});

describe("Radar exact preview package", () => {
  it("preserves every source and fingerprints topics independently of runs", async () => {
    const multi = structuredClone(run);
    multi.candidate!.sources = [
      { name: "Official", url: "https://example.org/research", evidence: "Initial evidence" },
      { name: "Second", url: "https://example.com/context", publishedAt: "2026-09-01" },
    ];
    const prepared = await buildRadarPublicationPackage(multi, composition);
    expect(prepared.article.sources).toEqual(multi.candidate!.sources);
    expect(radarTopicFingerprint(multi.candidate!)).toBe(radarTopicFingerprint(run.candidate!));
    const otherRun = await buildRadarPublicationPackage({ ...multi, id: "different-run" }, composition);
    expect(prepared.article.topicFingerprint).toBe(otherRun.article.topicFingerprint);
    expect(prepared.compositionDigest).not.toBe(radarPublicationPackageDigest({ ...prepared.article, sources: prepared.article.sources.slice(0, 1) }, prepared.cover.sha256));
    expect(prepared.compositionDigest).not.toBe(radarPublicationPackageDigest(prepared.article, "a".repeat(64)));
    const edited = await buildRadarPublicationPackage(multi, { ...composition, visualSubject: "Otro concepto operativo para revisión" });
    expect(edited.cover.sha256).not.toBe(prepared.cover.sha256);
    expect(edited.compositionDigest).not.toBe(prepared.compositionDigest);
  });

  it("generates four distinct deterministic PNG templates with the article subject", async () => {
    const covers = await Promise.all(RADAR_COVER_TYPES.map((visualType) => renderRadarCover({ title: composition.title, topic: run.candidate!.topic, visualType, visualSubject: composition.visualSubject })));
    expect(new Set(covers.map((cover) => cover.sha256)).size).toBe(4);
    expect(await renderRadarCover({ title: composition.title, topic: run.candidate!.topic, visualType: RADAR_COVER_TYPES[0], visualSubject: composition.visualSubject })).toEqual(covers[0]);
    const draft = await prepareRadarPublicationCandidate(run.candidate!);
    expect(draft.composition.sourceVerified).toBe(false);
    expect(draft.composition.rightsVerified).toBe(false);
    expect(draft.composition.clientClaimsAuthorizedOrAbsent).toBe(false);
  });

  it("allows preview before approval, rejects publication until human checks and PASS", async () => {
    const draftComposition = { ...composition, sourceVerified: false };
    await expect(buildRadarPublicationPackage({ ...run, status: "review_pending" }, draftComposition)).resolves.toHaveProperty("cover");
    await expect(buildRadarPublicationBundle({ run, composition: draftComposition, approvedBy: run.requestedBy, approvedAt: run.createdAt, previewToken: "", callbackUrl: "https://portal.nexopstech.com/callback" })).rejects.toThrow("Confirmá");
    await expect(buildRadarPublicationBundle({ run: { ...run, candidate: { ...run.candidate!, qa: { verdict: "FIX", reason: "Unresolved" } } }, composition, approvedBy: run.requestedBy, approvedAt: run.createdAt, previewToken: "", callbackUrl: "https://portal.nexopstech.com/callback" })).rejects.toThrow("QA");
  });

  it("binds signed preview to the exact package, actor, workspace, run and expiry", () => {
    vi.stubEnv("RADAR_PREVIEW_SECRET", "test-only-secret-".repeat(4));
    const claim = { runId: run.id, workspaceId: run.workspaceId, actorId: run.requestedBy, compositionDigest: "a".repeat(64) };
    const token = issueRadarPreviewToken(claim, 1000);
    expect(verifyRadarPreviewToken({ ...claim, token }, 2000)).toBe(true);
    for (const key of ["runId", "workspaceId", "actorId", "compositionDigest"]) expect(() => verifyRadarPreviewToken({ ...claim, [key]: "changed", token }, 2000)).toThrow();
    expect(() => verifyRadarPreviewToken({ ...claim, token }, 1_801_000)).toThrow();
    expect(() => verifyRadarPreviewToken({ ...claim, token: `${token}x` }, 2000)).toThrow();
    vi.unstubAllEnvs();
  });
});
