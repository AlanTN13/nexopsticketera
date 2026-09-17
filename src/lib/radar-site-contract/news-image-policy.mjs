// Generated from webneoxps/scripts/news-image-policy.mjs; run scripts/build-radar-n8n.cjs --sync-site-contract to synchronize.
export const VISUAL_TYPES = new Set([
  "architecture-diagram",
  "brand-product",
  "comparison",
  "contextual-photo",
  "data-flow",
  "data-infrastructure",
  "data-visualization",
  "document-visual",
  "editorial-diagram",
  "operations-interface",
  "process-diagram",
  "product-interface",
  "security-diagram",
  "workflow-interface",
]);

export const ASSET_SOURCES = new Set([
  "generated-original",
  "hybrid-editorial",
  "licensed-photo",
  "nexops-original",
  "official-product-reference",
]);

const LOCAL_ASSET = /^\/assets\/insights\/[a-z0-9/_-]+\.(?:jpe?g|png|svg)$/i;
const POSITION = /^(?:100|\d{1,2})(?:\.\d+)?%\s+(?:100|\d{1,2})(?:\.\d+)?%$/;
const text = (value) => typeof value === "string" && value.trim().length > 0;
const integer = (value) => Number.isInteger(value) && value > 0;

export function normalizeCoverImage(value = "") {
  if (String(value).startsWith("/")) return String(value).trim().toLowerCase();
  try {
    const url = new URL(value);
    url.hash = "";
    return `${url.protocol}//${url.host}${url.pathname}`.toLowerCase();
  } catch {
    return String(value || "").trim().toLowerCase();
  }
}

function validateAssetReference(value, label) {
  if (!text(value)) return [`${label} es obligatorio`];
  if (value.startsWith("/")) {
    return LOCAL_ASSET.test(value)
      ? []
      : [`${label} local debe vivir en /assets/insights/ y usar JPG, PNG o SVG`];
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? [] : [`${label} remoto debe usar https`];
  } catch {
    return [`${label} debe ser una ruta local o URL https válida`];
  }
}

export function validateEditorialCover(article, label = article?.slug || "noticia") {
  const errors = [];
  errors.push(...validateAssetReference(article?.coverImage, `${label}: coverImage`));
  errors.push(...validateAssetReference(article?.ogImage, `${label}: ogImage`));

  if (!VISUAL_TYPES.has(article?.visualType)) errors.push(`${label}: visualType inválido`);
  if (!text(article?.primaryEntity)) errors.push(`${label}: primaryEntity es obligatorio`);
  if (!text(article?.visualSubject)) errors.push(`${label}: visualSubject es obligatorio`);
  if (!ASSET_SOURCES.has(article?.assetSource)) errors.push(`${label}: assetSource inválido`);
  if (!text(article?.assetCredit)) errors.push(`${label}: assetCredit es obligatorio`);
  if (!text(article?.coverAlt)) errors.push(`${label}: coverAlt es obligatorio`);
  if (article?.secondaryEntities != null && (
    !Array.isArray(article.secondaryEntities)
    || article.secondaryEntities.some((entity) => !text(entity))
  )) errors.push(`${label}: secondaryEntities debe ser un array de textos`);

  if (!integer(article?.coverWidth) || !integer(article?.coverHeight)) {
    errors.push(`${label}: coverWidth y coverHeight deben ser enteros positivos`);
  } else {
    const ratio = article.coverWidth / article.coverHeight;
    if (article.coverWidth < 1200 || article.coverHeight < 630 || ratio < 1.5 || ratio > 2.1) {
      errors.push(`${label}: la portada debe ser landscape, entre 1.5:1 y 2.1:1, y medir al menos 1200×630`);
    }
  }

  const focus = article?.coverFocus;
  if (!focus || typeof focus !== "object") {
    errors.push(`${label}: coverFocus es obligatorio`);
  } else {
    for (const field of ["mobile", "desktop"]) {
      if (!POSITION.test(focus[field] || "")) errors.push(`${label}: coverFocus.${field} debe usar dos porcentajes`);
    }
  }
  return errors;
}

