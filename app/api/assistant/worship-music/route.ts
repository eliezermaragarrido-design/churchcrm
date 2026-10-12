import * as XLSX from "xlsx";
import { requireAuthContext } from "@/lib/auth";
import { ok, fail, handleRouteError } from "@/lib/api";
import { prisma } from "@/lib/db/prisma";
import { parseWorshipMusic, musicMissing } from "@/lib/worship-music";
import { saveMusic } from "@/server/services/assistant/music-store";
export async function GET() {
  try {
    const { churchId } = await requireAuthContext();
    const records = await prisma.documentRequest.findMany({ where: { churchId, status: "music_source", id: { startsWith: "worship_music_" } }, orderBy: { title: "desc" }, take: 52, select: { generatedBody: true } });
    return ok(records.map(record => JSON.parse(record.generatedBody!)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleRouteError(error); }
}
export async function POST(request: Request) {
  try {
    const { churchId } = await requireAuthContext();
    const form = await request.formData(), file = form.get("file");
    if (!(file instanceof File) || !/\.(xlsx|xls)$/i.test(file.name)) return fail("Upload an Excel music workbook.", 400);
    if (file.size > 5 * 1024 * 1024) return fail("The workbook must be smaller than 5 MB.", 413);
    let plan;
    try { plan = parseWorshipMusic(XLSX.read(Buffer.from(await file.arrayBuffer()), { cellDates: true }), file.name, String(form.get("serviceDate") || "") || undefined); }
    catch (error) { return fail(error instanceof Error ? error.message : "Unable to read this music workbook.", 422); }
    await saveMusic(churchId, plan);
    return ok({ plan, missing: musicMissing(plan) }, { status: 201 });
  } catch (error) { return handleRouteError(error); }
}
