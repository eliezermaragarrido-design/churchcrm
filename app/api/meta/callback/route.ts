import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { importMetaAccountsFromCode } from "@/lib/meta";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/automation?meta=${encodeURIComponent(error)}`, url.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/automation?meta=missing-code", url.origin));
  }

  try {
    const result = await importMetaAccountsFromCode(code, state, env.DEFAULT_CHURCH_ID);
    return NextResponse.redirect(
      new URL(
        `/automation?meta=${encodeURIComponent(`connected:${result.importedCount}:${result.pageCount}`)}`,
        url.origin,
      ),
    );
  } catch (callbackError) {
    const message = callbackError instanceof Error ? callbackError.message : "meta-callback-failed";
    return NextResponse.redirect(new URL(`/automation?meta=${encodeURIComponent(message)}`, url.origin));
  }
}
