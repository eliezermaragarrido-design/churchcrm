"use server";

import { revalidatePath } from "next/cache";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { sendSms } from "@/lib/twilio/client";

function formatReminderBody(title: string, startsAt: Date, location: string | null, timingLabel: string) {
  const startsText = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(startsAt);

  const locationText = location ? ` at ${location}` : "";
  return `Church reminder: ${title} is ${timingLabel} on ${startsText}${locationText}. Reply STOP to opt out.`;
}

function getErrorDetails(error: unknown) {
  if (error && typeof error === "object") {
    const maybeCode = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
    const maybeMessage = "message" in error ? String((error as { message?: unknown }).message ?? "") : "Unknown Twilio error";

    return {
      errorCode: maybeCode || null,
      errorMessage: maybeMessage || "Unknown Twilio error",
    };
  }

  return {
    errorCode: null,
    errorMessage: "Unknown Twilio error",
  };
}

async function listReachableMembers(churchId: string, groupId?: string) {
  return prisma.member.findMany({
    where: {
      churchId,
      isSmsOptedOut: false,
      phoneMobile: { not: null },
      status: "ACTIVE",
      ...(groupId
        ? {
            groupLinks: {
              some: {
                groupId,
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phoneMobile: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

async function resolveAudienceGroup(churchId: string, audienceGroupId: string | undefined) {
  if (!audienceGroupId) {
    return null;
  }

  return prisma.group.findFirst({
    where: {
      id: audienceGroupId,
      churchId,
    },
    select: {
      id: true,
      name: true,
    },
  });
}

export async function createManualCampaignAction(formData: FormData) {
  const auth = await requireAuthContext();
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const campaignType = String(formData.get("campaignType") || "MANUAL_BULK").trim();
  const audienceGroupId = String(formData.get("audienceGroupId") || "").trim() || undefined;

  if (!title || !body) {
    throw new Error("Title and message body are required.");
  }

  const audienceGroup = await resolveAudienceGroup(auth.churchId, audienceGroupId);
  const recipients = await listReachableMembers(auth.churchId, audienceGroup?.id);

  await prisma.messageCampaign.create({
    data: {
      churchId: auth.churchId,
      title: audienceGroup ? `${title} - ${audienceGroup.name}` : title,
      body,
      campaignType: campaignType as "ANNOUNCEMENT" | "PRAYER_UPDATE" | "BIRTHDAY" | "MANUAL_BULK",
      status: "DRAFT",
      recipients: {
        create: recipients
          .filter((member) => member.phoneMobile)
          .map((member) => ({
            memberId: member.id,
            phoneNumber: member.phoneMobile!,
          })),
      },
    },
  });

  revalidatePath("/messages");
  revalidatePath("/dashboard");
}

export async function createEventReminderCampaignAction(formData: FormData) {
  const auth = await requireAuthContext();
  const eventId = String(formData.get("eventId") || "").trim();
  const timing = String(formData.get("timing") || "tomorrow").trim();
  const audienceGroupId = String(formData.get("audienceGroupId") || "").trim() || undefined;

  const event = await prisma.calendarEvent.findFirst({
    where: {
      id: eventId,
      churchId: auth.churchId,
      isPublished: true,
      isAbsence: false,
    },
    include: {
      calendar: true,
    },
  });

  if (!event) {
    throw new Error("Published event not found.");
  }

  const audienceGroup = await resolveAudienceGroup(auth.churchId, audienceGroupId);
  const recipients = await listReachableMembers(auth.churchId, audienceGroup?.id);
  const timingLabel = timing === "two-hours" ? "in about two hours" : "tomorrow";
  const titleBase = `${event.title} ${timing === "two-hours" ? "2-hour SMS" : "Tomorrow SMS"}`;
  const title = audienceGroup ? `${titleBase} - ${audienceGroup.name}` : titleBase;
  const body = formatReminderBody(event.title, event.startsAt, event.location, timingLabel);

  await prisma.messageCampaign.create({
    data: {
      churchId: auth.churchId,
      title,
      body,
      campaignType: "ANNOUNCEMENT",
      status: "DRAFT",
      recipients: {
        create: recipients
          .filter((member) => member.phoneMobile)
          .map((member) => ({
            memberId: member.id,
            phoneNumber: member.phoneMobile!,
          })),
      },
    },
  });

  revalidatePath("/messages");
  revalidatePath("/dashboard");
}

export async function sendCampaignAction(formData: FormData) {
  const auth = await requireAuthContext();
  const campaignId = String(formData.get("campaignId") || "").trim();

  const campaign = await prisma.messageCampaign.findFirst({
    where: {
      id: campaignId,
      churchId: auth.churchId,
    },
    include: {
      recipients: true,
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  const sentAt = new Date();
  let hasFailure = false;
  let sentCount = 0;

  for (const recipient of campaign.recipients) {
    try {
      const result = await sendSms(recipient.phoneNumber, campaign.body);
      await prisma.messageRecipient.update({
        where: { id: recipient.id },
        data: {
          deliveryStatus: "SENT",
          twilioMessageSid: "sid" in result ? result.sid : recipient.twilioMessageSid,
          sentAt,
          errorCode: null,
          errorMessage: null,
        },
      });
      sentCount += 1;
    } catch (error) {
      hasFailure = true;
      const details = getErrorDetails(error);
      await prisma.messageRecipient.update({
        where: { id: recipient.id },
        data: {
          deliveryStatus: "FAILED",
          errorCode: details.errorCode,
          errorMessage: details.errorMessage,
        },
      });
    }
  }

  await prisma.messageCampaign.update({
    where: { id: campaign.id },
    data: {
      status: hasFailure ? "FAILED" : sentCount > 0 ? "SENT" : "DRAFT",
      sentAt: sentCount > 0 ? sentAt : campaign.sentAt,
    },
  });

  revalidatePath("/messages");
  revalidatePath("/dashboard");
}

export async function deleteCampaignAction(formData: FormData) {
  const auth = await requireAuthContext();
  const campaignId = String(formData.get("campaignId") || "").trim();

  await prisma.messageCampaign.deleteMany({
    where: {
      id: campaignId,
      churchId: auth.churchId,
    },
  });

  revalidatePath("/messages");
  revalidatePath("/dashboard");
}

export async function clearOldCampaignsAction() {
  const auth = await requireAuthContext();

  await prisma.messageCampaign.deleteMany({
    where: {
      churchId: auth.churchId,
      status: {
        in: ["DRAFT", "FAILED"],
      },
    },
  });

  revalidatePath("/messages");
  revalidatePath("/dashboard");
}
