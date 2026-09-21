import { RADAR_STATUS_COPY, type RadarRun } from "@/lib/radar-control-plane";

export function radarPhase(run: Pick<RadarRun, "status" | "editorialPhase">) {
  if (run.status !== "running") return RADAR_STATUS_COPY[run.status];
  if (/^(review|quality|draft_ready|fix)/.test(run.editorialPhase ?? "")) return "QA";
  if (/^research/.test(run.editorialPhase ?? "")) return "Investigando";
  return "Preparando";
}

export function radarCandidateEligible(run: Pick<RadarRun, "status" | "candidate" | "eligibility">) {
  return Boolean(run.candidate && run.eligibility === "ELIGIBLE" && run.candidate.qa?.verdict === "PASS" &&
    ["review_pending", "approved", "postponed", "published"].includes(run.status));
}

export function radarResultTitle(run: RadarRun) {
  return run.candidate?.title ?? run.manualNote?.title ?? (run.requestKind === "manual_note" ? "Fuente ingresada" : "Búsqueda de oportunidad");
}
