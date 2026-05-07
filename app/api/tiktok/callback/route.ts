import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { exchangeTikTokCodeForToken, fetchTikTokProfile, getTikTokStateChurchId } from "@/lib/social/tiktok";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/automation?tiktok=${encodeURIComponent(error)}`, url.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/automation?tiktok=missing-code", url.origin));
  }

  try {
    const token = await exchangeTikTokCodeForToken(code);
    const profile = await fetchTikTokProfile(token.access_token);
    const churchId = getTikTokStateChurchId(state, env.DEFAULT_CHURCH_ID);
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

    return NextResponse.redirect(new URL("/automation?tiktok=connected", url.origin));
  } catch (callbackError) {
    const message = callbackError instanceof Error ? callbackError.message : "tiktok-callback-failed";
    return NextResponse.redirect(new URL(`/automation?tiktok=${encodeURIComponent(message)}`, url.origin));
  }
}
