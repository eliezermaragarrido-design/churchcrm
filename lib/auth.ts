import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthContext = {
  churchId: string;
  userId: string;
  email?: string;
  isDemoMode: boolean;
};

function getDemoAuthContext(): AuthContext {
  return {
    churchId: env.DEFAULT_CHURCH_ID,
    userId: "demo-user",
    email: "demo@churchcrm.local",
    isDemoMode: true,
  };
}

export async function requireAuthContext(): Promise<AuthContext> {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return getDemoAuthContext();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return getDemoAuthContext();
  }

  return {
    churchId: env.DEFAULT_CHURCH_ID,
    userId: user.id,
    email: user.email,
    isDemoMode: false,
  };
}