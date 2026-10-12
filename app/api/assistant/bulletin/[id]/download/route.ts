import { requireAuthContext } from "@/lib/auth";
import { fail, handleRouteError } from "@/lib/api";
import { prisma } from "@/lib/db/prisma";
import { createBulletinDocx } from "@/lib/documents/bulletin-docx";
import { completedWorshipSource } from "@/server/services/assistant/worship-jobs";

function notesForDate(serviceDate: string) {
  const date = new Date(serviceDate + "T12:00:00Z");
  const written = date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).replace(",", "");
  return { written, iso: serviceDate };
}

async function savedSermonNotes(churchId: string, serviceDate: string) {
  const target = notesForDate(serviceDate);
  const records = await prisma.documentRequest.findMany({ where: { churchId, status: "generated", title: { startsWith: "Sermon Notes" } }, orderBy: { updatedAt: "desc" }, take: 80, select: { title: true, inputJson: true, generatedBody: true } });
  const record = records.find(item => {
    try { if (JSON.parse(item.inputJson || "{}").serviceDate === serviceDate) return true; } catch { /* A prior note without metadata still matches by title. */ }
    return item.title.includes(target.written) || item.title.includes(target.iso);
  });
  return record?.generatedBody || undefined;
}

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireAuthContext(), { id } = await context.params;
    const plan = await prisma.sermonPlan.findFirst({ where: { id, churchId } });
    if (!plan) return fail("Sermon plan not found.", 404);
    const source = await completedWorshipSource(churchId, plan);
    if (!source) return fail("Finish this Sunday’s sermon PowerPoint before preparing the bulletin.", 409);
    const file = createBulletinDocx(source, await savedSermonNotes(churchId, source.serviceDate));
    return new Response(new Uint8Array(file), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="Bulletin Morning Worship ${source.serviceDate}.docx"`, "Cache-Control": "private, no-store" } });
  } catch (error) { return handleRouteError(error); }
}
