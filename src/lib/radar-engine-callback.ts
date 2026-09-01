import { createHmac, timingSafeEqual } from "node:crypto";

export function radarCallbackSignature(body: string, secret: string) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export function verifyRadarCallbackSignature(body: string, signature: string | null, secret: string) {
  if (!signature || !secret) return false;
  const expected = Buffer.from(radarCallbackSignature(body, secret));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
