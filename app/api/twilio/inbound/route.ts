import twilio from "twilio";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { normalizeSmsPhone } from "@/lib/sms-consent";

export async function POST(request: Request) {
  if (!env.TWILIO_AUTH_TOKEN || !env.TWILIO_MESSAGING_SERVICE_SID || !env.TWILIO_INBOUND_URL) {
    return new Response("Messaging is not configured", { status: 503 });
  }
  const parameters = Object.fromEntries(new URLSearchParams(await request.text()));
  const signature = request.headers.get("x-twilio-signature") || "";
  if (!twilio.validateRequest(env.TWILIO_AUTH_TOKEN, signature, env.TWILIO_INBOUND_URL, parameters)
    || parameters.AccountSid !== env.TWILIO_ACCOUNT_SID
    || parameters.MessagingServiceSid !== env.TWILIO_MESSAGING_SERVICE_SID) {
    return new Response("Unauthorized", { status: 403 });
  }
  let phoneNumber: string;
  try { phoneNumber = normalizeSmsPhone(parameters.From || ""); }
  catch { return new Response("Invalid sender", { status: 400 }); }
  const keyword = (parameters.Body || "").trim().toUpperCase();
  const isStop = parameters.OptOutType === "STOP" || ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT"].includes(keyword);
  if (isStop) {
    await prisma.smsSubscription.updateMany({
      where: { churchId: env.DEFAULT_CHURCH_ID, phoneNumber, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  const response = new twilio.twiml.MessagingResponse();
  if (!parameters.OptOutType && ["HELP", "INFO"].includes(keyword)) {
    response.message("First Methodist Church of Dimmitt: Help: office@fumcdimmitt.org. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe.");
  }
  return new Response(response.toString(), { headers: { "Content-Type": "text/xml" } });
}
