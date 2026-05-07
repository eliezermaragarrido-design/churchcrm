import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { getTikTokConnectUrl, isTikTokConfigured } from "@/lib/social/tiktok";

export async function GET(request: Request) {
  const auth = await requireAuthContext();
  const url = new URL(request.url);

  if (!isTikTokConfigured()) {
    return NextResponse.redirect(new URL("/automation?tiktok=missing-config", url.origin));
  }

  return NextResponse.redirect(getTikTokConnectUrl(auth.churchId));
}
