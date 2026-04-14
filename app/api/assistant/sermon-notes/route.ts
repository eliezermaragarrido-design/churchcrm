import { ok, handleRouteError } from "@/lib/api";
import { requireAuthContext } from "@/lib/auth";
import { assistantSummarySchema } from "@/lib/validators/assistant";
import { createSermonNotes } from "@/server/services/assistant/service";

export async function POST(request: Request) {
  try {
    const auth = await requireAuthContext();
    const formData = await request.formData();
    const title = String(formData.get("title") || "Sermon Notes");
    const notesPrompt = String(formData.get("notesPrompt") || "Extract sermon points, verses, and outline notes from these slides.");
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new Error("Presentation file is required.");
    }

    const payload = assistantSummarySchema.parse({ title, notesPrompt });
    return ok(await createSermonNotes(auth.churchId, payload, file), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
