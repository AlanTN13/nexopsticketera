export type MetricsChannel = "meta" | "emailing" | "kommo";

export function getInitialMetricsChannel({
  metaAdsEnabled,
  emailingEnabled,
  kommoEnabled,
}: {
  metaAdsEnabled: boolean;
  emailingEnabled: boolean;
  kommoEnabled: boolean;
}): MetricsChannel | null {
  if (metaAdsEnabled) return "meta";
  if (emailingEnabled) return "emailing";
  if (kommoEnabled) return "kommo";
  return null;
}
