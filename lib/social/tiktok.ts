import { env } from "@/lib/env";

const TIKTOK_OAUTH_BASE = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_API_BASE = "https://open.tiktokapis.com";
const TIKTOK_SCOPES = ["user.info.basic", "video.publish", "video.upload"].join(",");

function requireTikTokEnv() {
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET || !env.TIKTOK_REDIRECT_URI) {
    throw new Error("TikTok environment variables are missing.");
  }
}

export function isTikTokConfigured() {
  return Boolean(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET && env.TIKTOK_REDIRECT_URI);
}

function encodeState(payload: Record<string, string>) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeState(state: string | null) {
  if (!state) {
    return null;
  }

  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    return JSON.parse(decoded) as Record<string, string>;
  } catch {
    return null;
  }
}

export function getTikTokConnectUrl(churchId: string) {
  requireTikTokEnv();

  const url = new URL(TIKTOK_OAUTH_BASE);
  url.searchParams.set("client_key", env.TIKTOK_CLIENT_KEY!);
  url.searchParams.set("redirect_uri", env.TIKTOK_REDIRECT_URI!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", TIKTOK_SCOPES);
  url.searchParams.set("state", encodeState({ churchId, platform: "tiktok" }));

  return url.toString();
}

export function getTikTokStateChurchId(state: string | null, fallbackChurchId: string) {
  const decoded = decodeState(state);
  return decoded?.churchId || fallbackChurchId;
}

async function readTikTokResponse<T>(response: Response) {
  const data = (await response.json()) as T & { error?: { code?: string; message?: string } };

  if (!response.ok || (typeof data.error === "object" && data.error?.code && data.error.code !== "ok")) {
    const message =
      (typeof data.error === "object" && data.error?.message) ||
      (typeof data.error === "object" && data.error?.code) ||
      "TikTok request failed.";
    throw new Error(message);
  }

  return data;
}

export async function exchangeTikTokCodeForToken(code: string) {
  requireTikTokEnv();

  const body = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY!,
    client_secret: env.TIKTOK_CLIENT_SECRET!,
    code,
    grant_type: "authorization_code",
    redirect_uri: env.TIKTOK_REDIRECT_URI!,
  });

  const response = await fetch(`${TIKTOK_API_BASE}/v2/oauth/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  return readTikTokResponse<{
    access_token: string;
    expires_in: number;
    open_id: string;
    refresh_expires_in: number;
    refresh_token: string;
    scope: string;
    token_type: string;
  }>(response);
}

export async function refreshTikTokAccessToken(refreshToken: string) {
  requireTikTokEnv();

  const body = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY!,
    client_secret: env.TIKTOK_CLIENT_SECRET!,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(`${TIKTOK_API_BASE}/v2/oauth/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  return readTikTokResponse<{
    access_token: string;
    expires_in: number;
    open_id: string;
    refresh_expires_in: number;
    refresh_token: string;
    scope: string;
    token_type: string;
  }>(response);
}

export async function fetchTikTokProfile(accessToken: string) {
  const url = new URL(`${TIKTOK_API_BASE}/v2/user/info/`);
  url.searchParams.set("fields", "open_id,display_name,avatar_url");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const data = await readTikTokResponse<{
    data?: {
      user?: {
        open_id?: string;
        display_name?: string;
        avatar_url?: string;
      };
    };
  }>(response);

  return data.data?.user ?? null;
}

export async function queryTikTokCreatorInfo(accessToken: string) {
  const response = await fetch(`${TIKTOK_API_BASE}/v2/post/publish/creator_info/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({}),
    cache: "no-store",
  });

  return readTikTokResponse<{
    data?: {
      creator_avatar_url?: string;
      creator_username?: string;
      privacy_level_options?: string[];
    };
  }>(response);
}
