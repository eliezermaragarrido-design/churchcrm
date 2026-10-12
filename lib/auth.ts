import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { localDevelopmentAccess, staffIdentityAllowed } from "@/lib/access-policy";

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
  if (localDevelopmentAccess()) return getDemoAuthContext();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Unauthorized");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!staffIdentityAllowed(user, env.DEFAULT_CHURCH_ID)) throw new Error("Unauthorized");
  const member = await prisma.user.findFirst({ where: { email: { equals: user!.email!, mode: "insensitive" }, churchId: env.DEFAULT_CHURCH_ID, status: "ACTIVE" } });
  if (!member) throw new Error("Unauthorized");

  return {
    churchId: member.churchId,
    userId: member.id,
    email: member.email,
    isDemoMode: false,
  };
}
