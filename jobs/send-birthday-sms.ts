import { prisma } from "@/lib/db/prisma";
import { sendSms } from "@/lib/twilio/client";

export async function sendBirthdayTexts() {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  const members = await prisma.member.findMany({
    where: {
      isSmsOptedOut: false,
      phoneMobile: { not: null },
      birthdate: { not: null },
    },
  });

  let sent = 0;

  for (const member of members) {
    if (!member.birthdate || !member.phoneMobile) continue;
    if (member.birthdate.getUTCMonth() + 1 !== month || member.birthdate.getUTCDate() !== day) continue;

    await sendSms(member.phoneMobile, `Happy Birthday, ${member.preferredName || member.firstName}! Your church family is thankful for you.`);
    sent += 1;
  }

  return { sent };
}
