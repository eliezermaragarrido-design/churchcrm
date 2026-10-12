import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { createSermonPowerPoint } from "@/lib/presentations/sermon-pptx";
import { verifyDeckScriptures } from "@/lib/presentations/niv-scripture";
import { privateDocumentUrl, sermonPowerPointPath } from "@/lib/documents/private-download";

export const maxDuration = 300;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthContext();
    const { id } = await params;
    const document = await prisma.documentRequest.findFirst({ where: { id, churchId: auth.churchId } });
    if (!document?.generatedBody) return NextResponse.json({ error: "Sermon presentation not found." }, { status: 404 });
    const draft = new URL(_request.url).searchParams.get("draft") === "1";
    if (document.status !== "generated" && !draft) return NextResponse.json({ error: "This sermon is still being prepared. Its progress is saved." }, { status: 409 });
    const safeTitle = (document.title + (draft ? " - DRAFT images incomplete" : "")).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim() || "Sermon Presentation";
    if (process.env.VERCEL) {
      const url = await privateDocumentUrl(sermonPowerPointPath(auth.churchId, id), `${safeTitle}.pptx`, "application/vnd.openxmlformats-officedocument.presentationml.presentation", async () => {
        const saved = JSON.parse(document.generatedBody!);
        const deck = saved.deck || saved;
        if (!deck.scriptureVerificationVersion) await verifyDeckScriptures(deck);
        return createSermonPowerPoint(deck);
      });
      return NextResponse.redirect(url, { status: 303, headers: { "Cache-Control": "private, no-store" } });
    }
    const generated = JSON.parse(document.generatedBody);
    const deck = generated.deck || generated;
    // Repair older saved drafts on download as well as future generations.
    await verifyDeckScriptures(deck);
    const powerpoint = await createSermonPowerPoint(deck);
    return new NextResponse(powerpoint, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "Content-Disposition": `attachment; filename="${safeTitle}.pptx"`, "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not build the PowerPoint." }, { status: 500 });
  }
}
