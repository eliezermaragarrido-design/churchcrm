"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuthContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ContentAssetType, SocialPlatform, SocialPostStatus, SocialPostType } from "@prisma/client";

function getChicagoYearDayInfo(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  const current = Date.UTC(year, month - 1, day);
  const start = Date.UTC(year, 0, 1);

  return {
    year,
    dayOfYear: Math.floor((current - start) / 86400000) + 1,
  };
}

function getSelectedAccountIds(formData: FormData) {
  return formData
    .getAll("accountIds")
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function getTimeParts(formData: FormData, fieldName: string) {
  const raw = String(formData.get(fieldName) || "").trim();
  const [hoursRaw, minutesRaw] = raw.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (Number.isFinite(hours) && Number.isFinite(minutes)) {
    return {
      hours: Math.max(0, Math.min(23, hours)),
      minutes: Math.max(0, Math.min(59, minutes)),
    };
  }

  return { hours: 9, minutes: 0 };
}

function getAllowedPostTypes(platform: SocialPlatform) {
  const imagePlatforms: SocialPlatform[] = ["FACEBOOK_PAGE", "INSTAGRAM", "X"];
  const reelPlatforms: SocialPlatform[] = ["FACEBOOK_PAGE", "INSTAGRAM", "YOUTUBE", "TIKTOK"];

  return {
    image: imagePlatforms.includes(platform),
    reel: reelPlatforms.includes(platform),
  };
}

function getScheduledDateForSequence(year: number, sequenceNumber: number, hours: number, minutes: number) {
  return new Date(Date.UTC(year, 0, sequenceNumber, hours + 5, minutes, 0));
}

async function createQueuedPost(input: {
  churchId: string;
  socialAccountId: string;
  assetId: string;
  title: string;
  caption: string;
  postType: SocialPostType;
  scheduledFor: Date;
}) {
  const existing = await prisma.socialPost.findFirst({
    where: {
      churchId: input.churchId,
      socialAccountId: input.socialAccountId,
      assetId: input.assetId,
      postType: input.postType,
      status: { in: ["DRAFT", "READY", "SCHEDULED", "POSTED"] satisfies SocialPostStatus[] },
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.socialPost.create({
    data: {
      churchId: input.churchId,
      socialAccountId: input.socialAccountId,
      assetId: input.assetId,
      title: input.title,
      caption: input.caption,
      postType: input.postType,
      status: "SCHEDULED",
      scheduledFor: input.scheduledFor,
    },
  });
}

async function scheduleAnnualPlan(input: {
  assetType: ContentAssetType;
  postType: SocialPostType;
  churchId: string;
  year: number;
  startDay: number;
  selectedAccountIds: string[];
  hours: number;
  minutes: number;
}) {
  const assetsPromise = prisma.contentAsset.findMany({
    where: {
      churchId: input.churchId,
      assetType: input.assetType,
      sequenceNumber: { gte: input.startDay, lte: 365 },
    },
    orderBy: { sequenceNumber: "asc" },
  });

  let accounts = await prisma.socialAccount.findMany({
    where: {
      churchId: input.churchId,
      id: { in: input.selectedAccountIds },
      isActive: true,
    },
    orderBy: [{ platform: "asc" }, { accountLabel: "asc" }],
  });

  if (!accounts.length && input.selectedAccountIds.length) {
    accounts = await prisma.socialAccount.findMany({
      where: {
        id: { in: input.selectedAccountIds },
        isActive: true,
      },
      orderBy: [{ platform: "asc" }, { accountLabel: "asc" }],
    });
  }

  const assets = await assetsPromise;

  for (const account of accounts) {
    const allowed = getAllowedPostTypes(account.platform);
    const canUse =
      input.postType === "FEED_POST" ? allowed.image : allowed.reel;

    if (!canUse) {
      continue;
    }

    for (const asset of assets) {
      if (!asset.sequenceNumber) {
        continue;
      }

      await createQueuedPost({
        churchId: input.churchId,
        socialAccountId: account.id,
        assetId: asset.id,
        title:
          input.postType === "FEED_POST"
            ? `Day ${asset.sequenceNumber} image post`
            : `Day ${asset.sequenceNumber} reel post`,
        caption: asset.body || asset.scriptureRef || asset.title,
        postType: input.postType,
        scheduledFor: getScheduledDateForSequence(input.year, asset.sequenceNumber, input.hours, input.minutes),
      });
    }
  }
}

async function syncBucketAssets(input: {
  churchId: string;
  bucketName: "IMAGES" | "REELS";
  assetType: ContentAssetType;
  titlePrefix: string;
  pattern: RegExp;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(input.bucketName).list("", {
    limit: 500,
    sortBy: { column: "name", order: "asc" },
  });

  if (error || !data) {
    throw new Error(error?.message || `Could not read the ${input.bucketName} bucket.`);
  }

  const files = data.map((entry) => entry.name).filter((name) => input.pattern.test(name));

  for (const fileName of files) {
    const match = fileName.match(/^(\d{1,3})\./i);

    if (!match) {
      continue;
    }

    const sequenceNumber = Number(match[1]);

    if (!sequenceNumber || sequenceNumber > 366) {
      continue;
    }

    await prisma.contentAsset.upsert({
      where: {
        churchId_assetType_sequenceNumber: {
          churchId: input.churchId,
          assetType: input.assetType,
          sequenceNumber,
        },
      },
      update: {
        title: `${input.titlePrefix} ${String(sequenceNumber).padStart(3, "0")}`,
        fileUrl: supabase.storage.from(input.bucketName).getPublicUrl(fileName).data.publicUrl,
      },
      create: {
        churchId: input.churchId,
        assetType: input.assetType,
        sequenceNumber,
        title: `${input.titlePrefix} ${String(sequenceNumber).padStart(3, "0")}`,
        fileUrl: supabase.storage.from(input.bucketName).getPublicUrl(fileName).data.publicUrl,
      },
    });
  }
}

async function pauseAnnualPlan(input: {
  churchId: string;
  selectedAccountIds: string[];
  assetType: ContentAssetType;
  postType: SocialPostType;
}) {
  await prisma.socialPost.deleteMany({
    where: {
      churchId: input.churchId,
      socialAccountId: { in: input.selectedAccountIds },
      postType: input.postType,
      status: { in: ["READY", "SCHEDULED"] },
      asset: {
        is: {
          assetType: input.assetType,
        },
      },
    },
  });
}

export async function createSocialAccountAction(formData: FormData) {
  const auth = await requireAuthContext();

  const platform = String(formData.get("platform") || "").trim() as SocialPlatform;
  const accountLabel = String(formData.get("accountLabel") || "").trim();

  if (!platform || !accountLabel) {
    return;
  }

  await prisma.socialAccount.create({
    data: {
      churchId: auth.churchId,
      platform,
      accountLabel,
      externalAccountId: String(formData.get("externalAccountId") || "").trim() || null,
      isActive: true,
    },
  });

  revalidatePath("/automation");
}

export async function deleteSocialAccountAction(formData: FormData) {
  const socialAccountId = String(formData.get("socialAccountId") || "").trim();

  if (!socialAccountId) {
    return;
  }

  await prisma.socialPost.deleteMany({
    where: {
      socialAccountId,
    },
  });

  await prisma.socialAccount.deleteMany({
    where: {
      id: socialAccountId,
    },
  });

  revalidatePath("/automation");
}

export async function scheduleYearImagesAction(formData: FormData) {
  const auth = await requireAuthContext();
  const selectedAccountIds = getSelectedAccountIds(formData);
  const { hours, minutes } = getTimeParts(formData, "imageTime");

  if (!selectedAccountIds.length) {
    return;
  }

  const { year, dayOfYear } = getChicagoYearDayInfo();

  await syncBucketAssets({
    churchId: auth.churchId,
    bucketName: "IMAGES",
    assetType: "DAILY_IMAGE",
    titlePrefix: "Daily image",
    pattern: /^\d{1,3}\.(jpg|jpeg|png|webp)$/i,
  });

  await scheduleAnnualPlan({
    churchId: auth.churchId,
    selectedAccountIds,
    assetType: "DAILY_IMAGE",
    postType: "FEED_POST",
    year,
    startDay: dayOfYear,
    hours,
    minutes,
  });

  revalidatePath("/automation");
}

export async function scheduleYearReelsAction(formData: FormData) {
  const auth = await requireAuthContext();
  const selectedAccountIds = getSelectedAccountIds(formData);
  const { hours, minutes } = getTimeParts(formData, "reelTime");

  if (!selectedAccountIds.length) {
    return;
  }

  const { year, dayOfYear } = getChicagoYearDayInfo();

  await syncBucketAssets({
    churchId: auth.churchId,
    bucketName: "REELS",
    assetType: "DEVOTIONAL_VIDEO",
    titlePrefix: "Daily reel",
    pattern: /^\d{1,3}\.(mp4|mov|m4v|webm)$/i,
  });

  await scheduleAnnualPlan({
    churchId: auth.churchId,
    selectedAccountIds,
    assetType: "DEVOTIONAL_VIDEO",
    postType: "SHORT_VIDEO",
    year,
    startDay: dayOfYear,
    hours,
    minutes,
  });

  revalidatePath("/automation");
}

export async function pauseYearImagesAction(formData: FormData) {
  const auth = await requireAuthContext();
  const selectedAccountIds = getSelectedAccountIds(formData);

  if (!selectedAccountIds.length) {
    return;
  }

  await pauseAnnualPlan({
    churchId: auth.churchId,
    selectedAccountIds,
    assetType: "DAILY_IMAGE",
    postType: "FEED_POST",
  });

  revalidatePath("/automation");
}

export async function pauseYearReelsAction(formData: FormData) {
  const auth = await requireAuthContext();
  const selectedAccountIds = getSelectedAccountIds(formData);

  if (!selectedAccountIds.length) {
    return;
  }

  await pauseAnnualPlan({
    churchId: auth.churchId,
    selectedAccountIds,
    assetType: "DEVOTIONAL_VIDEO",
    postType: "SHORT_VIDEO",
  });

  revalidatePath("/automation");
}
