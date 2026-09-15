import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

type PreviewClaim = { runId: string; workspaceId: string; actorId: string; compositionDigest: string };
function secret() {
  const value = process.env.RADAR_PREVIEW_SECRET?.trim() || process.env.RADAR_PUBLICATION_CALLBACK_SECRET?.trim() || "";
  if (value.length < 32) throw new Error("Falta configurar la firma de vista previa de Radar.");
  return value;
}
export function radarPreviewWebUrl() {
  const raw = process.env.RADAR_WEB_PREVIEW_URL?.trim();
  if (!raw) throw new Error("Falta configurar la URL de vista previa de webneoxps.");
  const url = new URL(raw);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("La vista previa requiere HTTPS.");
  if (url.username || url.password || url.pathname !== "/radar/preview" || url.search || url.hash) throw new Error("La URL de vista previa debe terminar en /radar/preview.");
  return url.href;
}
export function issueRadarPreviewToken(claim: PreviewClaim, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ ...claim, expiresAt: now + 30 * 60 * 1000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function verifyRadarPreviewToken(input: PreviewClaim & { token: string }, now = Date.now()) {
  const [payload, signature, extra] = input.token.split(".");
  if (!payload || !signature || extra || input.token.length > 2048) throw new Error("Abrí y revisá la vista previa antes de publicar.");
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("La vista previa no es válida.");
  let claim;
  try { claim = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { throw new Error("La vista previa no es válida."); }
  if (!Number.isFinite(claim.expiresAt) || claim.expiresAt <= now || claim.expiresAt > now + 30 * 60 * 1000 ||
      ["runId", "workspaceId", "actorId", "compositionDigest"].some((key) => claim[key] !== input[key as keyof PreviewClaim])) {
    throw new Error("La pieza cambió o la vista previa venció. Volvé a revisarla.");
  }
  return true;
}
