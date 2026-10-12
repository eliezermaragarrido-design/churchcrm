import { ok, handleRouteError } from "@/lib/api";
import { requireAuthContext } from "@/lib/auth";
import { assistantSummarySchema } from "@/lib/validators/assistant";
import { createSermonNotes, createSermonNotesFromText } from "@/server/services/assistant/service";

export async function POST(request: Request) {
  try {
    const auth = await requireAuthContext();
    const formData = await request.formData();
    const title = String(formData.get("title") || "Sermon Notes");
    const notesPrompt = String(formData.get("notesPrompt") || "Extract sermon points, verses, and outline notes from these slides.");
    const file = formData.get("file");
    const slidesText = String(formData.get("slidesText") || "").trim();
    const serviceDate = String(formData.get("serviceDate") || "").trim();

    if (!(file instanceof File) && !slidesText) {
      throw new Error("Presentation file is required.");
    }

    const payload = assistantSummarySchema.parse({ title, notesPrompt });
    return ok(slidesText ? await createSermonNotesFromText(auth.churchId, payload, slidesText, serviceDate) : await createSermonNotes(auth.churchId, payload, file as File, serviceDate), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
