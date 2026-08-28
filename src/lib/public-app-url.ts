import "server-only";

export function getPublicAppUrl() {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;

  if (!configured) {
    console.warn("[app-url] No se pudo construir el origen público: falta NEXT_PUBLIC_APP_URL.");
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
  try {
    return new URL(withProtocol).origin;
  } catch {
    console.warn("[app-url] No se pudo construir el origen público: la URL configurada es inválida.");
    return null;
  }
}
