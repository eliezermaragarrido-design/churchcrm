import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { staffIdentityAllowed } from "@/lib/access-policy";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response("Forbidden", { status: 403 });
  try {
    const input = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) }).parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: input.email.trim().toLowerCase(), password: input.password });
    const member = !error && staffIdentityAllowed(data.user, env.DEFAULT_CHURCH_ID) ? await prisma.user.findFirst({ where: { churchId: env.DEFAULT_CHURCH_ID, email: { equals: data.user!.email!, mode: "insensitive" }, status: "ACTIVE" }, select: { id: true } }) : null;
    if (!member) { await supabase.auth.signOut(); return NextResponse.json({ error: "Unable to sign in." }, { status: 401 }); }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Unable to sign in." }, { status: 401 }); }
}
