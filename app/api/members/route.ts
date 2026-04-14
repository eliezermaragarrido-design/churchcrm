import { ok, handleRouteError } from "@/lib/api";
import { requireAuthContext } from "@/lib/auth";
import { memberInputSchema } from "@/lib/validators/members";
import { createMember, listMembers } from "@/server/services/members/service";

export async function GET() {
  try {
    const auth = await requireAuthContext();
    return ok(await listMembers(auth.churchId));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthContext();
    const payload = memberInputSchema.parse(await request.json());
    return ok(await createMember(auth.churchId, payload), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
