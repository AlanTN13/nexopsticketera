const KOMMO_EMBED_HOSTS = new Set([
  "datastudio.google.com",
  "lookerstudio.google.com",
]);

const KOMMO_EMBED_PATH =
  /^\/embed\/reporting\/[A-Za-z0-9-]+\/page\/[A-Za-z0-9_-]+\/?$/;

export function parseKommoEmbedUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;

  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !KOMMO_EMBED_HOSTS.has(url.hostname) ||
      !KOMMO_EMBED_PATH.test(url.pathname)
    ) {
      return undefined;
    }

    return url.toString();
  } catch {
    return undefined;
  }
}

export function requireKommoEmbedUrl(value: string) {
  const url = parseKommoEmbedUrl(value);
  if (!url) {
    throw new Error(
      "El reporte de Kommo debe ser una URL HTTPS de embed válida de Looker Studio o Data Studio.",
    );
  }
  return url;
}
