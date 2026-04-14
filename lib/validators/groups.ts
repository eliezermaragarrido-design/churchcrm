import { z } from "zod";

export const groupInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  groupType: z.enum(["SUNDAY_SCHOOL", "SMALL_GROUP", "MINISTRY", "VOLUNTEER_TEAM", "CARE_TEAM", "YOUTH_GROUP", "CLASS"]),
  visibility: z.enum(["PRIVATE", "CHURCH"]).default("PRIVATE"),
  leaderUserId: z.string().optional(),
});

export type GroupInput = z.infer<typeof groupInputSchema>;
