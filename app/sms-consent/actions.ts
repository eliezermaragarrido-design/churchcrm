"use server";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { normalizeSmsPhone, SMS_CONSENT_TEXT, SMS_CONSENT_VERSION } from "@/lib/sms-consent";

export async function subscribeToSms(previous: { success: boolean; message: string }, form: FormData) {
  const name = String(form.get("name") || "").trim();
  if (form.get("website")) return { success: false, message: "Unable to submit this form." };
  if (!name || name.length > 120 || form.get("consent") !== "yes") {
    return { success: false, message: "Enter your name and check the SMS consent box to subscribe." };
  }
  let phoneNumber: string;
  try {
    phoneNumber = normalizeSmsPhone(String(form.get("phone") || ""));
  } catch {
    return { success: false, message: "Enter a valid US mobile number, including its area code." };
  }
  try {
    await prisma.smsSubscription.create({
      data: {
        churchId: env.DEFAULT_CHURCH_ID,
        phoneNumber,
        name,
        consentText: SMS_CONSENT_TEXT,
        consentVersion: SMS_CONSENT_VERSION,
        source: "public-web-form:/sms-consent;bulletin-invitation",
      },
    });
    return { success: true, message: "Thank you! Your permission has been recorded. Church text updates will begin when our messaging service is ready." };
  } catch {
    return { success: false, message: "We could not save your subscription. Please try again later or contact the church office." };
  }
}
