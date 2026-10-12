import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { createGroupDocx } from "@/lib/documents/grace-hope-docx";
import { fail, handleRouteError } from "@/lib/api";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireAuthContext();
    const { id } = await params;
    const d = await prisma.documentRequest.findFirst({ where: { churchId, id: { equals: id, startsWith: "gracehope_" } } });
    if (!d) return fail("Guide not found.", 404);
    if (d.status !== "generated") return fail("The guide is still being reviewed.", 409);
    const state = JSON.parse(d.generatedBody!);
    return new NextResponse(createGroupDocx(state), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="Grace and Hope ${state.month} ${state.audience}.docx"`, "Cache-Control": "private, no-store" } });
  } catch (error) { return handleRouteError(error); }
}
