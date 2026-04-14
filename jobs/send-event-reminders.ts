import { prisma } from "@/lib/db/prisma";
import { sendSms } from "@/lib/twilio/client";

export async function sendUpcomingEventReminders() {
  const now = new Date();
  const oneDayAheadStart = new Date(now.getTime() + 24 * 60 * 60 * 1000 - 15 * 60 * 1000);
  const oneDayAheadEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 15 * 60 * 1000);
  const twoHoursAheadStart = new Date(now.getTime() + 2 * 60 * 60 * 1000 - 15 * 60 * 1000);
  const twoHoursAheadEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000 + 15 * 60 * 1000);

  const events = await prisma.calendarEvent.findMany({
    where: {
      isPublished: true,
      OR: [
        { startsAt: { gte: oneDayAheadStart, lte: oneDayAheadEnd } },
        { startsAt: { gte: twoHoursAheadStart, lte: twoHoursAheadEnd } },
      ],
    },
    include: { church: true },
  });

  for (const event of events) {
    const members = await prisma.member.findMany({
      where: {
        churchId: event.churchId,
        isSmsOptedOut: false,
        phoneMobile: { not: null },
      },
      select: { id: true, phoneMobile: true, firstName: true },
      take: 50,
    });

    for (const member of members) {
      if (!member.phoneMobile) continue;
      await sendSms(member.phoneMobile, `${event.title} is coming up at ${event.startsAt.toLocaleString()}. We hope to see you there.`);
    }
  }

  return { processed: events.length };
}
