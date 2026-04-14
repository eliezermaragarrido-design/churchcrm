import { z } from "zod";

export const memberInputSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  preferredName: z.string().optional(),
  phoneMobile: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  birthdate: z.string().optional(),
  householdId: z.string().optional(),
});

export type MemberInput = z.infer<typeof memberInputSchema>;
