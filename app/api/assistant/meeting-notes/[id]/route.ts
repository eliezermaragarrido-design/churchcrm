import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { handleRouteError } from "@/lib/api";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireAuthContext();
    const { id } = await params;
    const document = await prisma.documentRequest.findFirst({ where: { id, churchId, status: { in: ["uploading", "queued", "failed"] } } });
    if (!document) return NextResponse.json({ data: { removed: false } });
    const path = JSON.parse(document.inputJson || "{}").tempPath;
    if (path) await createSupabaseAdminClient().storage.from(env.SUPABASE_UPLOAD_BUCKET).remove([path]);
    await prisma.documentRequest.delete({ where: { id } });
    return NextResponse.json({ data: { removed: true } });
  } catch (error) {
    return handleRouteError(error);
  }
}
