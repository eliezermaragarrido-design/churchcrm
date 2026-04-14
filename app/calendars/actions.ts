"use server";

import { revalidatePath } from "next/cache";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { calendarEventInputSchema, calendarInputSchema } from "@/lib/validators/calendars";
import { createCalendar, createCalendarEvent } from "@/server/services/calendars/service";

function normalizeCalendarEventRange(startsAtRaw: string, endsAtRaw: string, isAllDay: boolean) {
  const startsAt = new Date(startsAtRaw);
  const endsAt = new Date(endsAtRaw);

  if (Number.isNaN(startsAt.getTime())) {
    return {
      startsAt: startsAtRaw,
      endsAt: endsAtRaw,
    };
  }

  if (isAllDay) {
    const endOfDay = new Date(startsAt);
    endOfDay.setHours(23, 59, 0, 0);

    return {
      startsAt: startsAtRaw,
      endsAt: endOfDay.toISOString(),
    };
  }

  if (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    const suggestedEnd = new Date(startsAt.getTime() + 60 * 60 * 1000);

    return {
      startsAt: startsAtRaw,
      endsAt: suggestedEnd.toISOString(),
    };
  }

  return {
    startsAt: startsAtRaw,
    endsAt: endsAtRaw,
  };
}

export async function createCalendarAction(formData: FormData) {
  const auth = await requireAuthContext();

  const payload = calendarInputSchema.parse({
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || "").trim() || undefined,
    colorHex: String(formData.get("colorHex") || "").trim() || undefined,
    visibility: String(formData.get("visibility") || "INTERNAL"),
    ownerUserId: String(formData.get("ownerUserId") || "").trim() || undefined,
    isAbsenceCalendar: formData.get("isAbsenceCalendar") === "on",
  });

  await createCalendar(auth.churchId, payload);
  revalidatePath("/calendars");
  revalidatePath("/dashboard");
}

export async function createCalendarEventAction(formData: FormData) {
  const auth = await requireAuthContext();
  const isAllDay = formData.get("isAllDay") === "on";
  const normalizedRange = normalizeCalendarEventRange(
    String(formData.get("startsAt") || ""),
    String(formData.get("endsAt") || ""),
    isAllDay,
  );

  const payload = calendarEventInputSchema.parse({
    calendarId: String(formData.get("calendarId") || "").trim(),
    title: String(formData.get("title") || "").trim(),
    description: String(formData.get("description") || "").trim() || undefined,
    eventType: String(formData.get("eventType") || "OTHER"),
    startsAt: normalizedRange.startsAt,
    endsAt: normalizedRange.endsAt,
    location: String(formData.get("location") || "").trim() || undefined,
    isAllDay,
    isAbsence: formData.get("isAbsence") === "on",
    isPublished: formData.get("isPublished") === "on",
  });

  await createCalendarEvent(auth.churchId, auth.userId, payload);
  revalidatePath("/calendars");
  revalidatePath("/dashboard");
}

export async function deleteCalendarAction(formData: FormData) {
  const auth = await requireAuthContext();
  const calendarId = String(formData.get("calendarId") || "").trim();

  await prisma.calendar.deleteMany({
    where: {
      id: calendarId,
      churchId: auth.churchId,
    },
  });

  revalidatePath("/calendars");
  revalidatePath("/dashboard");
  revalidatePath("/messages");
}

export async function deleteCalendarEventAction(formData: FormData) {
  const auth = await requireAuthContext();
  const eventId = String(formData.get("eventId") || "").trim();

  await prisma.calendarEvent.deleteMany({
    where: {
      id: eventId,
      churchId: auth.churchId,
    },
  });

  revalidatePath("/calendars");
  revalidatePath("/dashboard");
  revalidatePath("/messages");
}
