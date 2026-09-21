// Generated from webneoxps/scripts/news-contract.mjs; run scripts/build-radar-n8n.cjs --sync-site-contract to synchronize.
const CONTENT_TYPES = new Set(["actualidad", "guia", "analisis", "caso"]);
const CONTENT_PURPOSES = new Set(["seo", "actualidad", "criterio", "caso"]);
const TERRITORIES = new Set(["automatizacion-procesos", "ia-aplicada-empresas", "crm-automatizacion-comercial", "data-analytics"]);
const INTERNAL_ROUTES = new Set(["/", "/noticias", "/servicios/data-engineering", "/servicios/data-visualization", "/servicios/ai-infrastructure", "/servicios/ai-agents", "/servicios/software-integrations", "/servicios/process-automation", "/servicios/frontend-ux"]);
const isKnownInternalRoute = (href) => href?.startsWith("/noticias/") || INTERNAL_ROUTES.has(href?.split("#")[0].split("?")[0]);

const HTTP_URL = /^https?:\/\//i;
const LOWER_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LEGACY_SLUG = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;
const CONTENT_BLOCKS = new Set(["paragraph", "heading", "list", "quote", "link", "image"]);

const text = (value) => typeof value === "string" && value.trim().length > 0;
const comparable = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

export function normalizeSourceUrl(value = "") {
  try {
    const url = new URL(value);
    url.hash = "";
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().toLowerCase();
  } catch {
    return comparable(value);
  }
}

function validateUrl(value, label) {
  if (!text(value) || !HTTP_URL.test(value)) return [`${label} debe ser una URL http(s)`];
  try { new URL(value); return []; } catch { return [`${label} debe ser una URL válida`]; }
}

function validateContent(content) {
  const errors = [];
  if (!Array.isArray(content) || content.length === 0) return ["content debe ser un array no vacío"];
  content.forEach((block, index) => {
    const label = `content[${index}]`;
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      errors.push(`${label} debe ser un objeto`); return;
    }
    if (!CONTENT_BLOCKS.has(block.type)) {
      errors.push(`${label}.type inválido: ${String(block.type)}`); return;
    }
    if (block.type === "list") {
      if (!Array.isArray(block.items) || block.items.length === 0 || block.items.some((item) => !text(item))) errors.push(`${label}.items debe ser un array no vacío de textos`);
      if (block.ordered != null && typeof block.ordered !== "boolean") errors.push(`${label}.ordered debe ser booleano`);
      return;
    }
    if (block.type === "heading") {
      if (!text(block.text)) errors.push(`${label}.text es obligatorio`);
      if (block.level != null && ![2, 3].includes(block.level)) errors.push(`${label}.level debe ser 2 o 3`);
      return;
    }
    if (block.type === "link") {
      if (!text(block.text)) errors.push(`${label}.text es obligatorio`);
      if (!text(block.href) || (!block.href.startsWith("/") && !HTTP_URL.test(block.href))) errors.push(`${label}.href debe ser ruta interna o URL http(s)`);
      if (block.href?.startsWith("/") && !isKnownInternalRoute(block.href)) errors.push(`${label}.href apunta a una ruta interna desconocida`);
      return;
    }
    if (block.type === "image") {
      if (!text(block.src)) errors.push(`${label}.src es obligatorio`);
      return;
    }
    if (!text(block.text)) errors.push(`${label}.text es obligatorio`);
  });
  return errors;
}

export function validateArticle(article, label = "noticia") {
  const errors = [];
  if (!article || typeof article !== "object" || Array.isArray(article)) return { errors: [`${label}: debe ser un objeto JSON`], warnings: [] };
  for (const field of ["title", "slug", "contentType", "category", "publishedAt", "excerpt", "seoTitle", "metaDescription"]) {
    if (!text(article[field])) errors.push(`${label}: falta ${field}`);
  }

  if (text(article.slug)) {
    const pattern = article.legacySanityId ? LEGACY_SLUG : LOWER_SLUG;
    if (!pattern.test(article.slug)) errors.push(`${label}: slug inválido "${article.slug}"`);
  }
  if (text(article.contentType) && !CONTENT_TYPES.has(article.contentType)) errors.push(`${label}: contentType inválido "${article.contentType}"`);
  if (!article.legacySanityId && !text(article.contentPurpose)) errors.push(`${label}: falta contentPurpose`);
  if (article.contentPurpose != null && (!text(article.contentPurpose) || !CONTENT_PURPOSES.has(article.contentPurpose))) errors.push(`${label}: contentPurpose inválido "${String(article.contentPurpose)}"`);
  if (article.territory != null && (!text(article.territory) || !TERRITORIES.has(article.territory))) errors.push(`${label}: territory inválido "${String(article.territory)}"`);
  if (text(article.publishedAt) && Number.isNaN(new Date(article.publishedAt).valueOf())) errors.push(`${label}: publishedAt debe ser fecha ISO válida`);
  if (text(article.seoTitle) && (article.seoTitle.length < 20 || article.seoTitle.length > 70)) errors.push(`${label}: seoTitle debe tener entre 20 y 70 caracteres`);
  if (text(article.metaDescription) && (article.metaDescription.length < 70 || article.metaDescription.length > 180)) errors.push(`${label}: metaDescription debe tener entre 70 y 180 caracteres`);
  if (text(article.excerpt) && article.excerpt.length > 280) errors.push(`${label}: excerpt no debe superar 280 caracteres`);

  const hasSourceName = text(article.sourceName);
  const hasSourceUrl = text(article.sourceUrl);
  if (hasSourceName !== hasSourceUrl) errors.push(`${label}: sourceName y sourceUrl deben declararse juntos`);
  if (hasSourceUrl) errors.push(...validateUrl(article.sourceUrl, `${label}: sourceUrl`));
  if (article.sources != null) {
    if (!Array.isArray(article.sources)) errors.push(`${label}: sources debe ser array`);
    else article.sources.forEach((source, index) => {
      if (!source || typeof source !== "object" || !text(source.name)) errors.push(`${label}: sources[${index}].name es obligatorio`);
      else errors.push(...validateUrl(source.url, `${label}: sources[${index}].url`));
    });
  }
  const sourceCount = (hasSourceUrl ? 1 : 0) + (Array.isArray(article.sources) ? article.sources.length : 0);
  if (article.contentPurpose === "actualidad" && sourceCount === 0) errors.push(`${label}: contentPurpose actualidad requiere al menos una fuente`);

  if (article.engineScore != null && (!Number.isInteger(article.engineScore) || article.engineScore < 0 || article.engineScore > 100)) errors.push(`${label}: engineScore debe ser entero 0-100 o null`);
  if (article.generatedByEngine != null && typeof article.generatedByEngine !== "boolean") errors.push(`${label}: generatedByEngine debe ser booleano`);
  for (const field of ["topicFingerprint", "engineRunId", "primaryKeyword", "searchIntent", "coverImage", "legacySanityId"]) {
    if (article[field] != null && !text(article[field])) errors.push(`${label}: ${field} debe ser texto no vacío cuando está presente`);
  }
  if (article.relatedSlugs != null && (!Array.isArray(article.relatedSlugs) || article.relatedSlugs.some((slug) => !text(slug)))) errors.push(`${label}: relatedSlugs debe ser array de slugs`);
  if (article.cta != null) {
    if (!article.cta || typeof article.cta !== "object" || !text(article.cta.label) || !text(article.cta.href)) errors.push(`${label}: cta requiere label y href`);
    else if (article.cta.href.startsWith("/") && !isKnownInternalRoute(article.cta.href)) errors.push(`${label}: cta.href apunta a ruta interna desconocida`);
  }
  errors.push(...validateContent(article.content).map((error) => `${label}: ${error}`));
  return { errors, warnings: [] };
}

function duplicateErrors(articles, field, normalize = comparable) {
  const seen = new Map(); const errors = [];
  for (const article of articles) {
    const raw = article?.[field];
    if (!text(raw)) continue;
    const key = normalize(raw);
    if (seen.has(key)) errors.push(`${field} duplicado entre ${seen.get(key)} y ${article.slug}: ${raw}`);
    else seen.set(key, article.slug || "<sin-slug>");
  }
  return errors;
}

export function validateCollection(articles) {
  const errors = []; const warnings = [];
  const publishedSlugs = new Set(articles.map((article) => article?.slug).filter(text));
  for (const article of articles) {
    const result = validateArticle(article, article?.slug || "<sin-slug>");
    errors.push(...result.errors); warnings.push(...result.warnings);

    const relatedSlugs = Array.isArray(article?.relatedSlugs) ? article.relatedSlugs : [];
    const uniqueRelatedSlugs = new Set();
    for (const relatedSlug of relatedSlugs) {
      if (!text(relatedSlug)) continue;
      if (relatedSlug === article.slug) errors.push(`${article.slug}: relatedSlugs no puede apuntar al propio artículo`);
      if (!publishedSlugs.has(relatedSlug)) errors.push(`${article.slug}: relatedSlugs apunta a una noticia inexistente: ${relatedSlug}`);
      if (uniqueRelatedSlugs.has(relatedSlug)) errors.push(`${article.slug}: relatedSlugs contiene un duplicado: ${relatedSlug}`);
      uniqueRelatedSlugs.add(relatedSlug);
    }

    for (const block of article?.content || []) {
      if (block?.type !== "link" || !block.href?.startsWith("/noticias/")) continue;
      const linkedSlug = block.href.slice("/noticias/".length).split("#")[0].split("?")[0];
      if (!publishedSlugs.has(linkedSlug)) errors.push(`${article.slug}: content contiene un enlace a una noticia inexistente: ${block.href}`);
    }
  }
  errors.push(...duplicateErrors(articles, "slug"));

  const sourceOwners = new Map();
  for (const article of articles) {
    if (!text(article?.sourceUrl)) continue;
    const key = normalizeSourceUrl(article.sourceUrl);
    if (!sourceOwners.has(key)) {
      sourceOwners.set(key, article);
      continue;
    }
    const previous = sourceOwners.get(key);
    const message = `sourceUrl duplicado entre ${previous.slug} y ${article.slug}: ${article.sourceUrl}`;
    if (previous.legacySanityId && article.legacySanityId) warnings.push(`legacy: ${message}`);
    else errors.push(message);
  }

  errors.push(...duplicateErrors(articles, "engineRunId"));
  errors.push(...duplicateErrors(articles, "topicFingerprint"));
  return { errors, warnings };
}

export function detectAddAction(existingArticles, candidate) {
  const validation = validateArticle(candidate, candidate?.slug || "candidato");
  if (validation.errors.length) return { action: "conflict", article: candidate, ...validation };
  const result = validateCollection([...existingArticles, candidate]);
  if (result.errors.length) return { action: "conflict", article: candidate, errors: result.errors, warnings: result.warnings };
  return { action: "add", article: candidate, errors: [], warnings: result.warnings };
}
