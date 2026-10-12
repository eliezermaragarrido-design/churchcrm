import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { processMeetingUpload } from "@/server/services/assistant/service";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireAuthContext();
    const { id } = await params;
    await processMeetingUpload(churchId, id);
    return NextResponse.json({ data: { id, status: "generated", downloadUrl: `/api/assistant/meeting-notes/${id}/download` } });
  } catch (error) {
    return handleRouteError(error);
  }
}
