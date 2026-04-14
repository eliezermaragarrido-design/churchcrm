import { env } from "@/lib/env";
import twilio from "twilio";

export function getTwilioClient() {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    return null;
  }

  return twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
}

export async function sendSms(to: string, body: string) {
  const client = getTwilioClient();

  if (!client || !env.TWILIO_MESSAGING_SERVICE_SID) {
    return { simulated: true, to, body };
  }

  return client.messages.create({
    to,
    body,
    messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID,
  });
}
