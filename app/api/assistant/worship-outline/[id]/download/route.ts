import { requireAuthContext } from "@/lib/auth";
import { fail, handleRouteError } from "@/lib/api";
import { prisma } from "@/lib/db/prisma";
import { createWorshipDocx } from "@/lib/documents/worship-docx";
import { worshipComplete, type WorshipState } from "@/lib/documents/worship-types";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireAuthContext(), { id } = await context.params;
    const document = await prisma.documentRequest.findFirst({ where: { churchId, id: { equals: id, startsWith: "worship_" } } });
    if (!document) return fail("Worship service not found.", 404);
    if (document.status !== "generated") return fail("The service is still being prepared.", 409);
    const state: WorshipState = JSON.parse(document.generatedBody!);
    if (!worshipComplete(state)) return fail("The service is still being reviewed.", 409);
    const name = `Outline Morning Worship ${state.source.serviceDate}.docx`;
    return new Response(new Uint8Array(createWorshipDocx(state)), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" } });
  } catch (error) { return handleRouteError(error); }
}
