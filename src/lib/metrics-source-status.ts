export type MetaSourceStatus = "disabled" | "unconfigured" | "pending" | "error" | "stale" | "empty" | "ready";

// Public messages deliberately exclude source URLs, raw errors and other accounts.
export function getMetaSourceNotice(status: MetaSourceStatus): string | null {
  switch (status) {
    case "unconfigured":
      return "Meta Ads está habilitado. NexOps está preparando la conexión de datos de tu empresa.";
    case "pending":
      return "Meta Ads está habilitado. Los indicadores aparecerán después de la primera actualización de la cuenta vinculada a tu empresa.";
    case "empty":
      return "La fuente de Meta Ads se actualizó, pero todavía no contiene registros de la cuenta vinculada a tu empresa. NexOps debe verificar la vinculación y la exportación.";
    case "error":
      return "No pudimos actualizar Meta Ads y todavía no hay datos disponibles de tu cuenta. Volvé a consultar más tarde.";
    case "stale":
      return "No pudimos actualizar Meta Ads. Mostramos la última información disponible de tu cuenta.";
    default:
      return null;
  }
}
