"use server";

import { revalidatePath } from "next/cache";
import { requireAuthContext } from "@/lib/auth";
import { memberInputSchema } from "@/lib/validators/members";
import { createMember, deleteMember } from "@/server/services/members/service";

export async function createMemberAction(formData: FormData) {
  const auth = await requireAuthContext();

  const payload = memberInputSchema.parse({
    firstName: String(formData.get("firstName") || "").trim(),
    lastName: String(formData.get("lastName") || "").trim(),
    preferredName: String(formData.get("preferredName") || "").trim() || undefined,
    phoneMobile: String(formData.get("phoneMobile") || "").trim() || undefined,
    email: String(formData.get("email") || "").trim() || undefined,
    birthdate: String(formData.get("birthdate") || "").trim() || undefined,
    householdId: String(formData.get("householdId") || "").trim() || undefined,
  });

  await createMember(auth.churchId, payload);
  revalidatePath("/members");
  revalidatePath("/dashboard");
  revalidatePath("/messages");
}

export async function deleteMemberAction(formData: FormData) {
  const auth = await requireAuthContext();
  const memberId = String(formData.get("memberId") || "").trim();

  if (!memberId) {
    return;
  }

  await deleteMember(auth.churchId, memberId);
  revalidatePath("/members");
  revalidatePath("/dashboard");
  revalidatePath("/messages");
}
