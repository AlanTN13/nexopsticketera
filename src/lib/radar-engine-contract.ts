import { createHash } from "node:crypto";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, entry]) => [key, sortValue(entry)]),
    );
  }
  return value;
}

export function canonicalRadarJson(value: unknown) {
  return JSON.stringify(sortValue(value));
}

export function radarPayloadDigest(value: unknown) {
  return createHash("sha256").update(canonicalRadarJson(value), "utf8").digest("hex");
}
