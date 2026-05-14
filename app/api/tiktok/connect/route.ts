import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireAuthContext } from "@/lib/auth";
import { getTikTokConnectUrl, isTikTokConfigured } from "@/lib/social/tiktok";

const TIKTOK_STATE_COOKIE = "tiktok_oauth_state";
const TIKTOK_CHURCH_COOKIE = "tiktok_oauth_church";

export async function GET(request: Request) {
  const auth = await requireAuthContext();
  const url = new URL(request.url);

  if (!isTikTokConfigured()) {
    return NextResponse.redirect(new URL("/automation?tiktok=missing-config", url.origin));
  }

  const state = randomBytes(24).toString("hex");
  const response = NextResponse.redirect(getTikTokConnectUrl(state));

  response.cookies.set(TIKTOK_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/",
    sameSite: "lax",
    secure: true,
  });
  response.cookies.set(TIKTOK_CHURCH_COOKIE, auth.churchId, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/",
    sameSite: "lax",
    secure: true,
  });

  return response;
}
