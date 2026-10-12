import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        try { cookieStore.set({ name, value, ...options }); } catch { /* Middleware refreshes cookies for read-only Server Components. */ }
      },
      remove(name, options) {
        try { cookieStore.set({ name, value: "", ...options, maxAge: 0 }); } catch { /* See above. */ }
      },
    },
  });
}
