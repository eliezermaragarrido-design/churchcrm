import { prisma } from "@/lib/db/prisma";
import { sendSms } from "@/lib/twilio/client";

export async function sendPrayerDigest() {
  const requests = await prisma.prayerRequest.findMany({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS"] },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (!requests.length) {
    return { sent: 0 };
  }

  const body = `Prayer update: ${requests.map((request) => request.title).join("; ")}`;
  const recipients = await prisma.member.findMany({
    where: {
      isSmsOptedOut: false,
      phoneMobile: { not: null },
    },
    select: { phoneMobile: true },
    take: 50,
  });

  let sent = 0;

  for (const recipient of recipients) {
    if (!recipient.phoneMobile) continue;
    await sendSms(recipient.phoneMobile, body);
    sent += 1;
  }

  return { sent };
}
