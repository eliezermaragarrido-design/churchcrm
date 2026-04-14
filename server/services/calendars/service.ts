import { prisma } from "@/lib/db/prisma";
import type { CalendarEventInput, CalendarInput } from "@/lib/validators/calendars";

export async function listCalendars(churchId: string) {
  return prisma.calendar.findMany({
    where: { churchId },
    include: {
      entries: {
        orderBy: { startsAt: "asc" },
        take: 5,
      },
      members: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function createCalendar(churchId: string, input: CalendarInput) {
  return prisma.calendar.create({
    data: {
      churchId,
      ownerUserId: input.ownerUserId || null,
      name: input.name,
      description: input.description || null,
      colorHex: normalizeColor(input.colorHex),
      visibility: input.visibility,
      isAbsenceCalendar: input.isAbsenceCalendar,
    },
  });
}

export async function createCalendarEvent(churchId: string, userId: string | null | undefined, input: CalendarEventInput) {
  const createdByUserId = userId ? await resolveCalendarEventCreator(churchId, userId) : null;
  const calendar = await prisma.calendar.findFirst({
    where: { id: input.calendarId, churchId },
    select: { id: true, isAbsenceCalendar: true },
  });

  if (!calendar) {
    throw new Error("Calendar not found for this church.");
  }

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  const isAbsenceEvent = input.isAbsence || calendar.isAbsenceCalendar;
  const eventType = isAbsenceEvent ? "ABSENCE" : input.eventType;
  const isPublished = isAbsenceEvent ? false : input.isPublished;
  const normalizedLocation = isAbsenceEvent ? null : input.location || null;

  return prisma.calendarEvent.create({
    data: {
      churchId,
      calendarId: input.calendarId,
      createdByUserId,
      title: input.title,
      description: input.description || null,
      eventType,
      startsAt,
      endsAt,
      location: normalizedLocation,
      isAllDay: input.isAllDay,
      isAbsence: isAbsenceEvent,
      isPublished,
    },
  });
}

async function resolveCalendarEventCreator(churchId: string, userId: string) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      churchId,
    },
    select: { id: true },
  });

  return user?.id ?? null;
}

function normalizeColor(colorHex: string | undefined) {
  if (!colorHex) {
    return null;
  }

  const trimmed = colorHex.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#[0-9a-fA-F]{3,8}$/.test(normalized) ? normalized : null;
}