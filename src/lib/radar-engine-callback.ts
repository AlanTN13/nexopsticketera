import { createHmac, timingSafeEqual } from "node:crypto";

const CALLBACK_TOLERANCE_SECONDS = 300;

export function radarCallbackSignature(body: string, secret: string, timestamp: string) {
  return `v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

export function verifyRadarCallbackSignature(input: {
  body: string;
  signature: string | null;
  timestamp: string | null;
  secret: string;
  now?: number;
}) {
  if (!input.signature || !input.timestamp || input.secret.trim().length < 32 || !/^\d{10}$/.test(input.timestamp)) return false;
  const timestampSeconds = Number(input.timestamp);
  const nowSeconds = Math.floor((input.now ?? Date.now()) / 1_000);
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > CALLBACK_TOLERANCE_SECONDS) {
    return false;
  }
  const expected = Buffer.from(radarCallbackSignature(input.body, input.secret, input.timestamp));
  const received = Buffer.from(input.signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
