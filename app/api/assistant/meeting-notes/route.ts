import { ok, handleRouteError } from "@/lib/api";
import { requireAuthContext } from "@/lib/auth";
import { assistantSummarySchema } from "@/lib/validators/assistant";
import { startMeetingUpload } from "@/server/services/assistant/service";

export async function POST(request: Request) {
  try {
    const auth = await requireAuthContext();
    const body = await request.json();
    const payload = assistantSummarySchema.parse({ title: body.title || "Council Meeting Minutes", notesPrompt: body.notesPrompt || "Prepare factual meeting minutes." });
    const file = { name: String(body.fileName || ""), type: String(body.contentType || ""), size: Number(body.fileSize || 0) };
    return ok(await startMeetingUpload(auth.churchId, payload, file), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
