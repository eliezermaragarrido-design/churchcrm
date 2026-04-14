import { prisma } from "@/lib/db/prisma";
import type { MemberInput } from "@/lib/validators/members";

export async function listMembers(churchId: string) {
  return prisma.member.findMany({
    where: { churchId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export async function createMember(churchId: string, input: MemberInput) {
  return prisma.member.create({
    data: {
      churchId,
      firstName: input.firstName,
      lastName: input.lastName,
      preferredName: input.preferredName || null,
      phoneMobile: input.phoneMobile || null,
      email: input.email || null,
      birthdate: input.birthdate ? new Date(input.birthdate) : null,
      householdId: input.householdId || null,
    },
  });
}

export async function deleteMember(churchId: string, memberId: string) {
  return prisma.member.deleteMany({
    where: {
      id: memberId,
      churchId,
    },
  });
}
