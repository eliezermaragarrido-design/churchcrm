import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { getMetaConnectUrl, isMetaConfigured } from "@/lib/meta";

export async function GET(request: Request) {
  const auth = await requireAuthContext();
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") === "instagram" ? "instagram" : "facebook";

  if (!isMetaConfigured()) {
    return NextResponse.redirect(new URL("/automation?meta=missing-config", url.origin));
  }

  return NextResponse.redirect(
    getMetaConnectUrl(auth.churchId, {
      forceRelogin: true,
      provider,
    }),
  );
}
