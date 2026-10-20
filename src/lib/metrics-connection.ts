export function parseMetricsConnection(accountName?: string, metaSheetUrl?: string) {
  const account = accountName?.trim() ?? "";
  const source = metaSheetUrl?.trim() ?? "";
  if (!account && !source) return null;
  if (!account || !source) {
    throw new Error("Completá la cuenta y la fuente de Meta Ads para guardar la asociación.");
  }
  if (account.length > 200 || source.length > 2048) {
    throw new Error("La cuenta o la fuente de Meta Ads supera el largo permitido.");
  }
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new Error("La fuente de Meta Ads debe ser un CSV publicado de Google Sheets.");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "docs.google.com" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    !url.pathname.startsWith("/spreadsheets/")
  ) {
    throw new Error("La fuente de Meta Ads debe ser un CSV publicado de Google Sheets.");
  }
  return { accountName: account, metaSheetUrl: url.toString() };
}
