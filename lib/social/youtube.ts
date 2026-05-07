import { env } from "@/lib/env";

const GOOGLE_OAUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_SCOPES = ["https://www.googleapis.com/auth/youtube.upload"].join(" ");

function requireYouTubeEnv() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw new Error("Google / YouTube environment variables are missing.");
  }
}

export function isYouTubeConfigured() {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI);
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

export function getYouTubeConnectUrl(churchId: string) {
  requireYouTubeEnv();

  const url = new URL(GOOGLE_OAUTH_BASE);
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", env.GOOGLE_REDIRECT_URI!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", YOUTUBE_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", encodeState({ churchId, platform: "youtube" }));

  return url.toString();
}

export function getYouTubeStateChurchId(state: string | null, fallbackChurchId: string) {
  const decoded = decodeState(state);
  return decoded?.churchId || fallbackChurchId;
}

async function readGoogleResponse<T>(response: Response) {
  const data = (await response.json()) as T & {
    error?: string;
    error_description?: string;
  };

  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Google request failed.");
  }

  return data;
}

export async function exchangeYouTubeCodeForToken(code: string) {
  requireYouTubeEnv();

  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    client_secret: env.GOOGLE_CLIENT_SECRET!,
    code,
    grant_type: "authorization_code",
    redirect_uri: env.GOOGLE_REDIRECT_URI!,
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  return readGoogleResponse<{
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope: string;
    token_type: string;
  }>(response);
}

export async function refreshYouTubeAccessToken(refreshToken: string) {
  requireYouTubeEnv();

  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    client_secret: env.GOOGLE_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  return readGoogleResponse<{
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
  }>(response);
}

export async function fetchYouTubeChannel(accessToken: string) {
  const url = new URL(`${YOUTUBE_API_BASE}/channels`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("mine", "true");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const data = await readGoogleResponse<{
    items?: Array<{
      id: string;
      snippet?: {
        title?: string;
      };
    }>;
  }>(response);

  return data.items?.[0] ?? null;
}
