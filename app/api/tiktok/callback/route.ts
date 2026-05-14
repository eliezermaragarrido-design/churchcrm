import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { exchangeTikTokCodeForToken, fetchTikTokProfile } from "@/lib/social/tiktok";

const TIKTOK_STATE_COOKIE = "tiktok_oauth_state";
const TIKTOK_CHURCH_COOKIE = "tiktok_oauth_church";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(TIKTOK_STATE_COOKIE)?.value || null;
  const churchId = cookieStore.get(TIKTOK_CHURCH_COOKIE)?.value || env.DEFAULT_CHURCH_ID;

  if (error) {
    const response = NextResponse.redirect(new URL(`/automation?tiktok=${encodeURIComponent(error)}`, url.origin));
    response.cookies.delete(TIKTOK_STATE_COOKIE);
    response.cookies.delete(TIKTOK_CHURCH_COOKIE);
    return response;
  }

  if (!code) {
    const response = NextResponse.redirect(new URL("/automation?tiktok=missing-code", url.origin));
    response.cookies.delete(TIKTOK_STATE_COOKIE);
    response.cookies.delete(TIKTOK_CHURCH_COOKIE);
    return response;
  }

  if (!state || !expectedState || state !== expectedState) {
    const response = NextResponse.redirect(new URL("/automation?tiktok=invalid-state", url.origin));
    response.cookies.delete(TIKTOK_STATE_COOKIE);
    response.cookies.delete(TIKTOK_CHURCH_COOKIE);
    return response;
  }

  try {
    const token = await exchangeTikTokCodeForToken(code);
    const profile = await fetchTikTokProfile(token.access_token);
    const externalAccountId = profile?.open_id || token.open_id;
    const accountLabel = profile?.display_name || `TikTok ${externalAccountId.slice(0, 8)}`;
    const existing = await prisma.socialAccount.findFirst({
      where: {
        churchId,
        platform: "TIKTOK",
        externalAccountId,
      },
    });

    if (existing) {
      await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          accountLabel,
          accessTokenRef: token.access_token,
          refreshTokenRef: token.refresh_token,
          isActive: true,
        },
      });
    } else {
      await prisma.socialAccount.create({
        data: {
          churchId,
          platform: "TIKTOK",
          accountLabel,
          externalAccountId,
          accessTokenRef: token.access_token,
          refreshTokenRef: token.refresh_token,
          isActive: true,
        },
      });
    }

    const response = NextResponse.redirect(new URL("/automation?tiktok=connected", url.origin));
    response.cookies.delete(TIKTOK_STATE_COOKIE);
    response.cookies.delete(TIKTOK_CHURCH_COOKIE);
    return response;
  } catch (callbackError) {
    const message = callbackError instanceof Error ? callbackError.message : "tiktok-callback-failed";
    const response = NextResponse.redirect(new URL(`/automation?tiktok=${encodeURIComponent(message)}`, url.origin));
    response.cookies.delete(TIKTOK_STATE_COOKIE);
    response.cookies.delete(TIKTOK_CHURCH_COOKIE);
    return response;
  }
}
