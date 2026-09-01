import "server-only";

import { createHmac } from "node:crypto";

export const META_REQUIRED_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_manage_insights",
] as const;

export const META_ADAPTER_VERSION = "meta-graph-v1";

type MetaErrorPayload = {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number; fbtrace_id?: string };
};

type MetaUsage = Record<string, unknown> | Array<Record<string, unknown>>;

export type MetaGraphErrorMetadata = {
  metaCode?: number;
  metaSubcode?: number;
  retryAfterSeconds?: number;
  recommendedBackoffMs?: number;
  appUsage?: MetaUsage;
  businessUsage?: MetaUsage;
};

export class MetaGraphError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    readonly requestId?: string,
    readonly metadata: MetaGraphErrorMetadata = {},
  ) {
    super(message);
  }
}

// Fase 1 intentionally caps each cursor walk: at most 500 managed Pages and the
// latest 100 media objects per account. Later runs revisit that window by ID.
export const META_COLLECTION_LIMITS = {
  managedAccountPageSize: 100,
  managedAccountPages: 5,
  mediaPageSize: 50,
  mediaPagesPerAccount: 2,
} as const;

type MetaCursorPaging = {
  cursors?: { after?: string };
  next?: string;
};

type MetaPage<T> = {
  data: T[];
  paging?: MetaCursorPaging;
};

function config() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const graphVersion = process.env.META_GRAPH_VERSION;
  if (!appId || !appSecret || !graphVersion) {
    throw new Error("La aplicación oficial de Meta todavía no está configurada.");
  }
  if (!/^v\d+\.\d+$/.test(graphVersion)) {
    throw new Error("META_GRAPH_VERSION debe fijar una versión explícita, por ejemplo v24.0.");
  }
  return { appId, appSecret, graphVersion };
}

export function isMetaConfigured() {
  return Boolean(
    process.env.META_APP_ID &&
      process.env.META_APP_SECRET &&
      process.env.META_GRAPH_VERSION &&
      process.env.META_TOKEN_ENCRYPTION_KEY &&
      process.env.META_LOGIN_CONFIG_ID &&
      process.env.META_OAUTH_REDIRECT_URI,
  );
}

function appSecretProof(token: string) {
  return createHmac("sha256", config().appSecret).update(token).digest("hex");
}

function parseUsageHeader(value: string | null): MetaUsage | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? parsed as MetaUsage : undefined;
  } catch {
    return undefined;
  }
}

function parseRetryAfter(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

async function graph<T>(path: string, params: Record<string, string>, token?: string): Promise<T> {
  const { graphVersion } = config();
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${path.replace(/^\//, "")}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  if (token) {
    url.searchParams.set("access_token", token);
    url.searchParams.set("appsecret_proof", appSecretProof(token));
  }

  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const payload = (await response.json()) as T & MetaErrorPayload;
  if (!response.ok || payload.error) {
    const code = payload.error?.code;
    const subcode = payload.error?.error_subcode;
    const rateLimited = response.status === 429 || code === 4 || code === 17 || code === 32 || code === 613;
    const retryable = rateLimited || response.status >= 500 || code === 1 || code === 2;
    const retryAfterSeconds = parseRetryAfter(response.headers.get("retry-after"));
    const recommendedBackoffMs = retryable
      ? (retryAfterSeconds ?? (rateLimited ? 60 : 5)) * 1000
      : undefined;
    const classifiedCode = code === 190 || code === 102
      ? "reconnect_required"
      : code ? `meta_${code}` : `http_${response.status}`;
    throw new MetaGraphError(
      retryAfterSeconds !== undefined
        ? `Meta pidió reintentar la consulta en ${retryAfterSeconds} segundos.`
        : "Meta no pudo completar la consulta oficial.",
      classifiedCode,
      retryable,
      payload.error?.fbtrace_id,
      {
        metaCode: code,
        metaSubcode: subcode,
        retryAfterSeconds,
        recommendedBackoffMs,
        appUsage: parseUsageHeader(response.headers.get("x-app-usage")),
        businessUsage: parseUsageHeader(response.headers.get("x-business-use-case-usage")),
      },
    );
  }
  return payload;
}

export function buildMetaOAuthUrl({ state, redirectUri }: { state: string; redirectUri: string }) {
  const { appId, graphVersion } = config();
  const loginConfigId = process.env.META_LOGIN_CONFIG_ID;
  if (!loginConfigId) throw new Error("META_LOGIN_CONFIG_ID todavía no está configurado.");
  const url = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", META_REQUIRED_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("config_id", loginConfigId);
  url.searchParams.set("override_default_response_type", "true");
  return url.toString();
}

export async function exchangeMetaCode(code: string, redirectUri: string) {
  const { appId, appSecret } = config();
  const short = await graph<{ access_token: string; expires_in?: number }>("oauth/access_token", {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });
  const long = await graph<{ access_token: string; expires_in?: number }>("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: short.access_token,
  });
  return long;
}

export type ManagedInstagramAccount = {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  instagramUserId: string;
  instagramUsername?: string;
  tasks: string[];
};

export async function listManagedInstagramAccounts(userToken: string) {
  type ManagedPage = {
    id: string;
    name: string;
    access_token: string;
    tasks?: string[];
    instagram_business_account?: { id: string; username?: string };
  };
  const pages: ManagedPage[] = [];
  const seenCursors = new Set<string>();
  let after: string | undefined;

  for (let page = 0; page < META_COLLECTION_LIMITS.managedAccountPages; page += 1) {
    const response = await graph<MetaPage<ManagedPage>>("me/accounts", {
      fields: "id,name,tasks,access_token,instagram_business_account{id,username}",
      limit: String(META_COLLECTION_LIMITS.managedAccountPageSize),
      ...(after ? { after } : {}),
    }, userToken);
    pages.push(...response.data);
    const next = response.paging?.cursors?.after;
    if (!next || seenCursors.has(next)) break;
    seenCursors.add(next);
    after = next;
  }

  return pages
    .filter((item) => item.instagram_business_account?.id && item.access_token)
    .map<ManagedInstagramAccount>((item) => ({
      pageId: item.id,
      pageName: item.name,
      pageAccessToken: item.access_token,
      instagramUserId: item.instagram_business_account!.id,
      instagramUsername: item.instagram_business_account?.username,
      tasks: item.tasks ?? [],
    }));
}

export async function debugMetaToken(token: string) {
  const { appId, appSecret } = config();
  return graph<{ data: { is_valid: boolean; expires_at?: number; scopes?: string[] } }>("debug_token", {
    input_token: token,
    access_token: `${appId}|${appSecret}`,
  });
}

export type InstagramMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
};

export type InstagramProfileSnapshot = {
  id?: string;
  ig_id?: string;
  username: string;
  name?: string;
  biography?: string;
  website?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  media?: { data?: InstagramMedia[]; paging?: MetaCursorPaging };
};

const PROFILE_FIELDS = "id,ig_id,username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count";
const MEDIA_FIELDS = "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";

export async function fetchOwnInstagramProfile(igUserId: string, token: string) {
  const profile = await graph<InstagramProfileSnapshot>(igUserId, { fields: PROFILE_FIELDS }, token);
  const media: InstagramMedia[] = [];
  const seenCursors = new Set<string>();
  let after: string | undefined;

  for (let page = 0; page < META_COLLECTION_LIMITS.mediaPagesPerAccount; page += 1) {
    const response = await graph<MetaPage<InstagramMedia>>(`${igUserId}/media`, {
      fields: MEDIA_FIELDS,
      limit: String(META_COLLECTION_LIMITS.mediaPageSize),
      ...(after ? { after } : {}),
    }, token);
    media.push(...response.data);
    const next = response.paging?.cursors?.after;
    if (!next || seenCursors.has(next)) break;
    seenCursors.add(next);
    after = next;
  }
  return { ...profile, media: { data: media } };
}

export async function fetchObservedInstagramProfile(ownIgUserId: string, username: string, token: string) {
  const media: InstagramMedia[] = [];
  const seenCursors = new Set<string>();
  let after: string | undefined;
  let profile: InstagramProfileSnapshot | undefined;

  try {
    for (let page = 0; page < META_COLLECTION_LIMITS.mediaPagesPerAccount; page += 1) {
      const mediaEdge = `media.limit(${META_COLLECTION_LIMITS.mediaPageSize})${after ? `.after(${after})` : ""}{${MEDIA_FIELDS}}`;
      const response = await graph<Record<string, InstagramProfileSnapshot>>(ownIgUserId, {
        fields: `business_discovery.username(${username}){${PROFILE_FIELDS},${mediaEdge}}`,
      }, token);
      const current = response.business_discovery;
      if (!current) throw new MetaGraphError("La cuenta no está disponible para Business Discovery.", "unsupported", false);
      profile ??= current;
      media.push(...(current.media?.data ?? []));
      const next = current.media?.paging?.cursors?.after;
      if (!next || seenCursors.has(next)) break;
      seenCursors.add(next);
      after = next;
    }
  } catch (error) {
    if (error instanceof MetaGraphError && error.code !== "reconnect_required") {
      if (error.metadata.metaCode === 803 || error.metadata.metaSubcode === 33) {
        throw new MetaGraphError("La cuenta no existe o ya no está disponible.", "not_found", false, error.requestId, error.metadata);
      }
      if (error.metadata.metaCode === 100) {
        throw new MetaGraphError("La cuenta no es compatible con Business Discovery.", "unsupported", false, error.requestId, error.metadata);
      }
    }
    throw error;
  }

  if (!profile) throw new MetaGraphError("La cuenta no está disponible para Business Discovery.", "unsupported", false);
  return { ...profile, media: { data: media } };
}

type InstagramMediaDescriptor = Pick<InstagramMedia, "media_type" | "media_product_type">;

export function compatibleInstagramMediaInsightMetrics(media: InstagramMediaDescriptor) {
  const mediaType = media.media_type?.toUpperCase();
  const productType = media.media_product_type?.toUpperCase();
  if (productType === "REELS") return ["reach", "views", "saved", "shares", "total_interactions"] as const;
  if (productType === "STORY") return ["reach", "views", "shares"] as const;
  if (mediaType === "VIDEO") return ["reach", "views", "saved", "shares", "total_interactions"] as const;
  if (mediaType === "IMAGE" || mediaType === "CAROUSEL_ALBUM") {
    return ["reach", "saved", "shares", "total_interactions"] as const;
  }
  return ["reach"] as const;
}

type InstagramInsightResponse = {
  data: Array<{ name: string; values?: Array<{ value?: number }>; total_value?: { value?: number } }>;
};

export async function fetchInstagramMediaInsights(
  mediaId: string,
  token: string,
  knownMedia?: InstagramMediaDescriptor,
) {
  const media = knownMedia ?? await graph<InstagramMediaDescriptor>(mediaId, {
    fields: "media_type,media_product_type",
  }, token);
  const candidates = compatibleInstagramMediaInsightMetrics(media);
  const collected: Record<string, number | null> = Object.fromEntries(candidates.map((name) => [name, null]));

  // Meta varies compatible metrics by product/media type and Graph version. Querying
  // one metric at a time keeps one unsupported metric from discarding valid values.
  for (const metricName of candidates) {
    try {
      const response = await graph<InstagramInsightResponse>(`${mediaId}/insights`, {
        metric: metricName,
      }, token);
      const metric = response.data.find((item) => item.name === metricName) ?? response.data[0];
      collected[metricName] = metric?.total_value?.value ?? metric?.values?.[0]?.value ?? null;
    } catch (error) {
      if (error instanceof MetaGraphError && error.metadata.metaCode === 100) continue;
      throw error;
    }
  }
  return collected;
}
