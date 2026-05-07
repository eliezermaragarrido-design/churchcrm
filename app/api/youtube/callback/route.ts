import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { exchangeYouTubeCodeForToken, fetchYouTubeChannel, getYouTubeStateChurchId } from "@/lib/social/youtube";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/automation?youtube=${encodeURIComponent(error)}`, url.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/automation?youtube=missing-code", url.origin));
  }

  try {
    const token = await exchangeYouTubeCodeForToken(code);
    const channel = await fetchYouTubeChannel(token.access_token);
    const churchId = getYouTubeStateChurchId(state, env.DEFAULT_CHURCH_ID);

    if (!channel?.id) {
      throw new Error("No YouTube channel was returned for this Google account.");
    }

    const accountLabel = channel.snippet?.title || "YouTube channel";
    const existing = await prisma.socialAccount.findFirst({
      where: {
        churchId,
        platform: "YOUTUBE",
        externalAccountId: channel.id,
      },
    });

    if (existing) {
      await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          accountLabel,
          accessTokenRef: token.access_token,
          refreshTokenRef: token.refresh_token || existing.refreshTokenRef,
          isActive: true,
        },
      });
    } else {
      await prisma.socialAccount.create({
        data: {
          churchId,
          platform: "YOUTUBE",
          accountLabel,
          externalAccountId: channel.id,
          accessTokenRef: token.access_token,
          refreshTokenRef: token.refresh_token || null,
          isActive: true,
        },
      });
    }

    return NextResponse.redirect(new URL("/automation?youtube=connected", url.origin));
  } catch (callbackError) {
    const message = callbackError instanceof Error ? callbackError.message : "youtube-callback-failed";
    return NextResponse.redirect(new URL(`/automation?youtube=${encodeURIComponent(message)}`, url.origin));
  }
}
