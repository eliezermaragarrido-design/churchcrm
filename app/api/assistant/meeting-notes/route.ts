import { ok, handleRouteError } from "@/lib/api";
import { requireAuthContext } from "@/lib/auth";
import { assistantSummarySchema } from "@/lib/validators/assistant";
import { createMeetingSummary } from "@/server/services/assistant/service";

export async function POST(request: Request) {
  try {
    const auth = await requireAuthContext();
    const formData = await request.formData();
    const title = String(formData.get("title") || "Meeting Notes");
    const notesPrompt = String(formData.get("notesPrompt") || "Summarize this meeting and extract action items.");
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new Error("Meeting audio file is required.");
    }

    const payload = assistantSummarySchema.parse({ title, notesPrompt });
    return ok(await createMeetingSummary(auth.churchId, payload, file), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
