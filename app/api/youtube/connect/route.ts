import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { getYouTubeConnectUrl, isYouTubeConfigured } from "@/lib/social/youtube";

export async function GET(request: Request) {
  const auth = await requireAuthContext();
  const url = new URL(request.url);

  if (!isYouTubeConfigured()) {
    return NextResponse.redirect(new URL("/automation?youtube=missing-config", url.origin));
  }

  return NextResponse.redirect(getYouTubeConnectUrl(auth.churchId));
}
