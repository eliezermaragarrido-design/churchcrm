import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { fetchMetaPagesFromCode } from "@/lib/meta";

const META_PENDING_COOKIE = "meta_pending_pages";

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
    const result = await fetchMetaPagesFromCode(code, state, env.DEFAULT_CHURCH_ID);
    const response = NextResponse.redirect(new URL("/automation?meta=select-pages", url.origin));
    response.cookies.set(
      META_PENDING_COOKIE,
      JSON.stringify({
        churchId: result.churchId,
        selections: result.selections,
      }),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: 60 * 15,
      },
    );
    return response;
  } catch (callbackError) {
    const message = callbackError instanceof Error ? callbackError.message : "meta-callback-failed";
    return NextResponse.redirect(new URL(`/automation?meta=${encodeURIComponent(message)}`, url.origin));
  }
}
