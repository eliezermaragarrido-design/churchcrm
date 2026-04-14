import { ok, handleRouteError } from "@/lib/api";
import { requireAuthContext } from "@/lib/auth";
import { assistantDocumentSchema } from "@/lib/validators/assistant";
import { createSecretaryDocument } from "@/server/services/assistant/service";

export async function POST(request: Request) {
  try {
    const auth = await requireAuthContext();
    const payload = assistantDocumentSchema.parse(await request.json());
    return ok(await createSecretaryDocument(auth.churchId, payload), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
