import { env } from "@/lib/env";
import twilio from "twilio";
import { prisma } from "@/lib/db/prisma";
import { normalizeSmsPhone } from "@/lib/sms-consent";

export function getTwilioClient() {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    return null;
  }

  return twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
}

export async function sendSms(to: string, body: string, churchId = env.DEFAULT_CHURCH_ID) {
  const client = getTwilioClient();

  if (!client || !env.TWILIO_MESSAGING_SERVICE_SID || !env.TWILIO_INBOUND_URL) {
    throw new Error("SMS is not configured. Connect a Twilio Messaging Service and its inbound webhook before sending messages.");
  }

  const phoneNumber = normalizeSmsPhone(to);
  const consent = await prisma.smsSubscription.findFirst({
    where: { churchId, phoneNumber, revokedAt: null },
  });
  const optedOutMembers = await prisma.member.findMany({
    where: { churchId, isSmsOptedOut: true, phoneMobile: { not: null } },
    select: { phoneMobile: true },
  });
  const optedOut = optedOutMembers.some((member) => {
    try { return normalizeSmsPhone(member.phoneMobile || "") === phoneNumber; }
    catch { return false; }
  });
  if (!consent || optedOut) {
    throw new Error("SMS requires recorded consent and no active opt-out for this recipient.");
  }

  return client.messages.create({
    to: phoneNumber,
    body: `First Methodist Church of Dimmitt: ${body}\nReply STOP to unsubscribe or HELP for help.`,
    messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID,
  });
}
