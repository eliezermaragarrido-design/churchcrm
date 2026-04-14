"use server";

import { revalidatePath } from "next/cache";
import { requireAuthContext } from "@/lib/auth";
import { groupInputSchema } from "@/lib/validators/groups";
import { createGroup } from "@/server/services/groups/service";

export async function createGroupAction(formData: FormData) {
  const auth = await requireAuthContext();

  const payload = groupInputSchema.parse({
    name: String(formData.get("name") || ""),
    description: String(formData.get("description") || "") || undefined,
    groupType: String(formData.get("groupType") || "SUNDAY_SCHOOL"),
    visibility: String(formData.get("visibility") || "PRIVATE"),
    leaderUserId: String(formData.get("leaderUserId") || "") || undefined,
  });

  await createGroup(auth.churchId, payload);
  revalidatePath("/groups");
  revalidatePath("/dashboard");
}
