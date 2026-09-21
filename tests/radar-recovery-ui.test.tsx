import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }), redirect: vi.fn() }));
vi.mock("@/app/portal/radar/operacion/actions", () => ({ createManualRadarNoteAction: vi.fn(), requestRadarRunAction: vi.fn(), updateRadarPreferencesAction: vi.fn(), releaseStalledRadarRunAction: vi.fn(), decideRadarRunAction: vi.fn(), publishApprovedRadarRunAction: vi.fn() }));
import { RadarControlPlaneView } from "@/components/radar/radar-operation-page";
import { RadarRunDetail } from "@/components/radar/radar-run-detail";
import { RadarShell } from "@/components/radar/radar-shell";
import { radarPhase, radarCandidateEligible, radarResultReason } from "@/lib/radar-presentation";
import { getRadarLiveView } from "@/lib/radar-live-status";
import type { RadarControlPlaneSnapshot, RadarRun } from "@/lib/radar-control-plane";
import type { RadarAdmission } from "@/lib/radar-admission";
const candidate = { title: "Una oportunidad verificable", topic: "IA aplicada", sourceName: "Fuente oficial", sourceUrl: "https://example.com/source", sources: [{ name: "Fuente oficial", url: "https://example.com/source" }], score: 82, businessReasons: ["Reduce tareas repetitivas"], qa: { verdict: "PASS" as const, reason: "Evidencia contrastada" }, draft: { headline: "Una oportunidad verificable", deck: "Detalle de la oportunidad para empresas", bodyMarkdown: "BORRADOR_LARGO_NO_VISIBLE_EN_HISTORIAL" } };
const run: RadarRun = { id: "c40b81b7-6ac4-4da1-92e8-86a7a50f9dc4", workspaceId: "nexops", companyId: null, requestedBy: "actor", triggerKind: "manual", requestKind: "opportunity_search", manualNote: null, autonomyMode: "review", status: "review_pending", eligibility: "ELIGIBLE", externalRunId: null, externalRunUrl: null, candidate, resultReason: "Evidencia lista para revisión", finalUrl: null, errorMessage: null, startedAt: null, completedAt: null, createdAt: "2026-09-21T22:00:00Z", updatedAt: "2026-09-21T22:00:00Z", events: [], decisions: [], publication: null };
const snapshot: RadarControlPlaneSnapshot = { availability: "ready", settings: { workspaceId: "nexops", companyId: null, enabled: true, schedulerEnabled: false, scheduleDays: [1,2,3,4,5,6], scheduleHour: 7, scheduleTimezone: "America/Argentina/Buenos_Aires", autonomyMode: "review", nextRunAt: null, preferences: { topics: ["IA aplicada"], publicationsPerWeek: 2, opportunityBehavior: "suggest", publishingMode: "review", siteIntegrated: true } }, runs: [], engineConnected: true, publicationConnected: false };
const admission: RadarAdmission = { allowed: false, code: "budget_exhausted", message: "Presupuesto agotado. Búsqueda no iniciada.", reservedUsd: 9, maxUsd: 9, remainingRuns: 0 };
const props = { snapshot, admission, workspaceId: "nexops", canOperate: true, canAdmin: true, basePath: "/backoffice/radar" };
const render = (element: React.ReactNode) => renderToStaticMarkup(element);
beforeEach(() => { vi.clearAllMocks(); });
describe("Radar truthful recovery", () => {
  it("shows preparation until a persisted editorial phase exists, independent of webhook acceptance", () => {
    expect(radarPhase({ status: "running", editorialPhase: null })).toBe("Preparando");
    expect(getRadarLiveView("dispatching", "opportunity_search", ["queue_accepted"]).stages[2].state).toBe("waiting");
    expect(radarPhase({ status: "running", editorialPhase: "research" })).toBe("Investigando");
    expect(radarPhase({ status: "running", editorialPhase: "review_after_fix" })).toBe("QA");
    expect(radarPhase({ status: "failed", editorialPhase: "review" })).toBe("Error");
  });
  it.each(["rejected", "failed", "no_publication"] as const)("never scores or presents %s as an opportunity", status => {
    const html = render(<RadarRunDetail run={{ ...run, status, eligibility: "INELIGIBLE", resultReason: "Motivo real del resultado" }} canOperate canAdmin publicationConnected={false} />);
    expect(html).toContain("Motivo real del resultado"); expect(html).toContain("sin score publicable"); expect(html).not.toContain("82/100"); expect(html).not.toContain("Oportunidad encontrada"); expect(html).not.toContain("Decisión editorial");
  });
  it("explains the persisted critical gate even when the historical QA claimed PASS", () => {
    const rejected = { ...run, status: "rejected" as const, eligibility: "INELIGIBLE" as const, failedGates: ["clientClaims"] };
    expect(radarResultReason(rejected)).toContain("clientes sin autorización");
    expect(render(<RadarRunDetail run={rejected} canOperate canAdmin publicationConnected={false} />)).toContain("El PASS original no habilita");
  });
  it("does not infer eligibility from a legacy review status with missing QA", () => {
    expect(radarCandidateEligible({ ...run, eligibility: null, candidate: { ...candidate, qa: undefined } })).toBe(false);
  });
  it("puts manual editorial results ahead of original input", () => {
    const html = render(<RadarRunDetail run={{ ...run, requestKind: "manual_note", manualNote: { title: "Título original", sourceUrl: "https://example.com/manual", instructions: "Instrucción original" } }} canOperate canAdmin publicationConnected={false} />);
    expect(html).toContain(candidate.title); expect(html.indexOf("Revisión de calidad")).toBeLessThan(html.indexOf("Indicaciones originales")); expect(html).toContain("Evidencia contrastada"); expect(html).toContain("Vista previa y revisión");
  });
  it("keeps the primary view free of configuration and historical drafts while blocking both admissions", () => {
    const html = render(<RadarControlPlaneView {...props} snapshot={{ ...snapshot, runs: [{ ...run, status: "rejected" }] }} />);
    expect(html).toContain("Presupuesto agotado"); expect(html).toMatch(/disabled=""[^>]*>Buscar oportunidad/); expect(html).toMatch(/disabled=""[^>]*>Investigar fuente/);
    expect(html).not.toContain("BORRADOR_LARGO"); expect(html).not.toContain("Configuración editorial"); expect(html).not.toContain("Panel activo");
  });
  it("does not enable operation for read-only members even when admitted", () => {
    const html = render(<RadarControlPlaneView {...props} canOperate={false} admission={{ ...admission, allowed: true, code: "available" }} />);
    expect(html).toMatch(/disabled=""[^>]*>Buscar oportunidad/); expect(html).toContain("permiso de operación");
  });
  it("renders compact filtered history, details only on selection, preserving company links", () => {
    const state = { ...snapshot, runs: [run, { ...run, id: "another", status: "rejected" as const, resultReason: "Falta evidencia" }] };
    const html = render(<RadarControlPlaneView {...props} snapshot={state} view="history" companyLookup="cliente-a" filters={{ status: "rejected" }} />);
    expect(html).toContain("Falta evidencia"); expect(html).not.toContain("BORRADOR_LARGO"); expect(html).not.toContain("Vista previa y revisión"); expect(html).toContain("company=cliente-a"); expect(html).toContain("1 resultados");
  });
  it("offers only four task sections on desktop and mobile, retaining tenant and exit navigation", () => {
    const html = render(<RadarShell active="operation" actorName="Operador" companyName="Cliente A" workspaceId="cliente-a" companyLookup="cliente-a" health={{ state: "limited", label: "Búsqueda no disponible", detail: "" }} exitHref="/portal" exitLabel="Volver al Portal"><p>Contenido</p></RadarShell>);
    for (const label of ["Revisión", "Publicadas", "Historial", "Configuración"]) expect(html.split(`>${label}</a>`).length - 1).toBe(2);
    expect(html).toContain('/portal/radar/configuracion?company=cliente-a'); expect(html).toContain('aria-current="page"'); expect(html).toContain('href="/portal"');
  });
});
