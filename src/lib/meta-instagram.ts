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

export class MetaGraphError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    readonly requestId?: string,
  ) {
    super(message);
  }
}

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
      process.env.META_TOKEN_ENCRYPTION_KEY,
  );
}

function appSecretProof(token: string) {
  return createHmac("sha256", config().appSecret).update(token).digest("hex");
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
    const retryable = response.status === 429 || response.status >= 500 || code === 1 || code === 2 || code === 4 || code === 17;
    const retryAfter = response.headers.get("retry-after");
    throw new MetaGraphError(
      retryAfter
        ? `Meta pidió reintentar la consulta en ${retryAfter} segundos.`
        : "Meta no pudo completar la consulta oficial.",
      code ? `meta_${code}` : `http_${response.status}`,
      retryable,
      payload.error?.fbtrace_id,
    );
  }
  return payload;
}

export function buildMetaOAuthUrl({ state, redirectUri }: { state: string; redirectUri: string }) {
  const { appId, graphVersion } = config();
  const url = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", META_REQUIRED_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
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
  const response = await graph<{
    data: Array<{
      id: string;
      name: string;
      access_token: string;
      tasks?: string[];
      instagram_business_account?: { id: string; username?: string };
    }>;
  }>("me/accounts", {
    fields: "id,name,tasks,access_token,instagram_business_account{id,username}",
    limit: "100",
  }, userToken);

  return response.data
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
  media?: { data?: InstagramMedia[] };
};

const PROFILE_FIELDS = "id,ig_id,username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count";
const MEDIA_FIELDS = "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";

export async function fetchOwnInstagramProfile(igUserId: string, token: string) {
  return graph<InstagramProfileSnapshot>(igUserId, {
    fields: `${PROFILE_FIELDS},media.limit(100){${MEDIA_FIELDS}}`,
  }, token);
}

export async function fetchObservedInstagramProfile(ownIgUserId: string, username: string, token: string) {
  const response = await graph<Record<string, InstagramProfileSnapshot>>(ownIgUserId, {
    fields: `business_discovery.username(${username}){${PROFILE_FIELDS},media.limit(100){${MEDIA_FIELDS}}}`,
  }, token);
  const profile = response.business_discovery;
  if (!profile) throw new MetaGraphError("La cuenta no está disponible para Business Discovery.", "unsupported", false);
  return profile;
}

export async function fetchInstagramMediaInsights(mediaId: string, token: string) {
  const response = await graph<{
    data: Array<{ name: string; values?: Array<{ value?: number }>; total_value?: { value?: number } }>;
  }>(`${mediaId}/insights`, {
    metric: "reach,views,saved,shares,total_interactions",
  }, token);
  return Object.fromEntries(response.data.map((metric) => [
    metric.name,
    metric.total_value?.value ?? metric.values?.[0]?.value ?? null,
  ])) as Record<string, number | null>;
}
