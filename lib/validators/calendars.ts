import { z } from "zod";

const optionalText = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}, z.string().optional());

export const calendarInputSchema = z.object({
  name: z.string().min(1),
  description: optionalText,
  colorHex: optionalText,
  visibility: z.enum(["INTERNAL", "PUBLIC"]),
  ownerUserId: optionalText,
  isAbsenceCalendar: z.boolean().optional().default(false),
});

export const calendarEventInputSchema = z
  .object({
    calendarId: z.string().min(1),
    title: z.string().min(1),
    description: optionalText,
    eventType: z.enum(["MEETING", "SERVICE", "REHEARSAL", "APPOINTMENT", "ABSENCE", "VACATION", "OFFICE", "MINISTRY_EVENT", "PUBLIC_EVENT", "OTHER"]).default("OTHER"),
    startsAt: z.string().min(1),
    endsAt: z.string().min(1),
    location: optionalText,
    isAllDay: z.boolean().optional().default(false),
    isAbsence: z.boolean().optional().default(false),
    isPublished: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    const startsAt = new Date(value.startsAt);
    const endsAt = new Date(value.endsAt);

    if (Number.isNaN(startsAt.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["startsAt"], message: "Start date/time is invalid." });
    }

    if (Number.isNaN(endsAt.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "End date/time is invalid." });
    }

    if (!Number.isNaN(startsAt.getTime()) && !Number.isNaN(endsAt.getTime()) && endsAt < startsAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "End date/time must be after the start." });
    }
  });

export type CalendarInput = z.infer<typeof calendarInputSchema>;
export type CalendarEventInput = z.infer<typeof calendarEventInputSchema>;