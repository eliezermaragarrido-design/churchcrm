import { prisma } from "@/lib/db/prisma";
import type { GroupInput } from "@/lib/validators/groups";

export async function listGroups(churchId: string) {
  return prisma.group.findMany({
    where: { churchId },
    include: {
      memberships: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function createGroup(churchId: string, input: GroupInput) {
  return prisma.group.create({
    data: {
      churchId,
      name: input.name,
      description: input.description || null,
      groupType: input.groupType,
      visibility: input.visibility,
      leaderUserId: input.leaderUserId || null,
    },
  });
}
