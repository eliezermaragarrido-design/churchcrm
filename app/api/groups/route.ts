import { ok, handleRouteError } from "@/lib/api";
import { requireAuthContext } from "@/lib/auth";
import { groupInputSchema } from "@/lib/validators/groups";
import { createGroup, listGroups } from "@/server/services/groups/service";

export async function GET() {
  try {
    const auth = await requireAuthContext();
    return ok(await listGroups(auth.churchId));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthContext();
    const payload = groupInputSchema.parse(await request.json());
    return ok(await createGroup(auth.churchId, payload), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
