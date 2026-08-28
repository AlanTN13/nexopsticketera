import { MAX_TICKET_CONTEXT_URLS } from "@/lib/ticketing";

const MAX_TICKET_CONTEXT_URL_LENGTH = 2048;

function parseSafeContextUrl(value: unknown) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_TICKET_CONTEXT_URL_LENGTH) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return trimmed;
  } catch {
    return null;
  }
}

export function getSafeTicketContextUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const uniqueUrls = new Set<string>();
  for (const item of value) {
    const safeUrl = parseSafeContextUrl(item);
    if (!safeUrl) continue;
    uniqueUrls.add(safeUrl);
    if (uniqueUrls.size === MAX_TICKET_CONTEXT_URLS) break;
  }

  return Array.from(uniqueUrls);
}

export function normalizeTicketContextUrls(contextUrls: string[]): string[] {
  const submittedUrls = Array.from(new Set(contextUrls.map((url) => url.trim()).filter(Boolean)));
  if (submittedUrls.length > MAX_TICKET_CONTEXT_URLS) {
    throw new Error(`Solo podés adjuntar hasta ${MAX_TICKET_CONTEXT_URLS} links por ticket.`);
  }

  for (const item of submittedUrls) {
    if (!parseSafeContextUrl(item)) {
      throw new Error("Los links del ticket deben ser URLs válidas con http:// o https://.");
    }
  }

  return submittedUrls;
}
