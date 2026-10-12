import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { createMeetingMinutesDocx } from "@/lib/documents/meeting-minutes-docx";
import { meetingMinutes } from "@/lib/documents/meeting-minutes-types";
import { handleRouteError } from "@/lib/api";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireAuthContext();
    const { id } = await params;
    const document = await prisma.documentRequest.findFirst({ where: { id, churchId, status: "generated" } });
    if (!document?.generatedBody) return NextResponse.json({ error: "Meeting minutes are not ready." }, { status: 404 });
    const file = createMeetingMinutesDocx(document.title, meetingMinutes.parse(JSON.parse(document.generatedBody)));
    return new NextResponse(file, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${document.title.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "") || "meeting-minutes"}.docx"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    return handleRouteError(error);
  }
}
