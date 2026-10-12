import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { meetingJobSummary, processMeetingUpload } from "@/server/services/assistant/service";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireAuthContext();
    const { id } = await params;
    const job = await processMeetingUpload(churchId, id);
    return NextResponse.json({ data: { job, downloadUrl: job.status === "generated" ? `/api/assistant/meeting-notes/${id}/download` : null } });
  } catch (error) {
    try {
      const { churchId } = await requireAuthContext();
      const { id } = await params;
      return NextResponse.json({ data: { job: await meetingJobSummary(churchId, id), downloadUrl: null } }, { status: 202 });
    } catch { return handleRouteError(error); }
  }
}
