import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

import { localDevelopmentAccess, publicRoute, staffIdentityAllowed } from "@/lib/access-policy";

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (publicRoute(path)) return NextResponse.next({ request });
  if (localDevelopmentAccess() && ["localhost", "127.0.0.1", "[::1]"].includes(request.nextUrl.hostname)) return NextResponse.next({ request });
  const denied = () => {
    if (/^\/api\/assistant\/(?:bulletin|worship-outline)\/[^/]+\/download$/.test(path)) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(login);
    }
    return path.startsWith("/api/")
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } })
      : NextResponse.redirect(new URL("/login", request.url));
  };
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return denied();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      get(name) {
        return request.cookies.get(name)?.value;
      },
      set(name, value, options) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request });
        response.cookies.set({ name, value, ...options });
      },
      remove(name, options) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({ request });
        response.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!staffIdentityAllowed(user, env.DEFAULT_CHURCH_ID)) {
    const rejection = denied();
    for (const cookie of response.cookies.getAll()) rejection.cookies.set(cookie);
    return rejection;
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
