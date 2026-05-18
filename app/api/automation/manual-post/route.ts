import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { ContentAssetType, SocialPlatform, SocialPostType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAuthContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { processDueSocialPosts } from "@/server/services/social/service";

function getSelectedAccountIds(formData: FormData) {
  return formData
    .getAll("accountIds")
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function getSelectedPostType(formData: FormData) {
  const raw = String(formData.get("postType") || "").trim() as SocialPostType;

  if (raw === "STORY" || raw === "SHORT_VIDEO") {
    return raw;
  }

  return "FEED_POST" satisfies SocialPostType;
}

async function createManualQueuedPosts(input: {
  churchId: string;
  selectedAccountIds: string[];
  caption: string;
  postType: SocialPostType;
  scheduledFor: Date;
  assetId?: string;
}) {
  const accounts = await prisma.socialAccount.findMany({
    where: {
      churchId: input.churchId,
      id: { in: input.selectedAccountIds },
      isActive: true,
    },
    orderBy: [{ platform: "asc" }, { accountLabel: "asc" }],
  });

  for (const account of accounts) {
    await prisma.socialPost.create({
      data: {
        churchId: input.churchId,
        socialAccountId: account.id,
        title: null,
        caption: input.caption || null,
        postType: input.postType,
        status: input.scheduledFor <= new Date() ? "READY" : "SCHEDULED",
        scheduledFor: input.scheduledFor,
        assetId: input.assetId || null,
      },
    });
  }
}

async function uploadManualAsset(input: {
  churchId: string;
  file: File;
  postType: SocialPostType;
}) {
  if (!input.file.size) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const extension = input.file.name.includes(".") ? input.file.name.split(".").pop() : undefined;
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${extension ? `.${extension}` : ""}`;
  const bucketName = input.postType === "SHORT_VIDEO" ? "REELS" : "IMAGES";
  const objectPath = `manual/${fileName}`;

  const { error } = await supabase.storage.from(bucketName).upload(objectPath, input.file, {
    contentType: input.file.type || undefined,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message || "Could not upload media.");
  }

  const publicUrl = supabase.storage.from(bucketName).getPublicUrl(objectPath).data.publicUrl;
  const assetType: ContentAssetType = input.postType === "SHORT_VIDEO" ? "DEVOTIONAL_VIDEO" : "DAILY_IMAGE";

  return prisma.contentAsset.create({
    data: {
      churchId: input.churchId,
      assetType,
      title: input.file.name || "Manual upload",
      fileUrl: publicUrl,
    },
  });
}

function getRedirectUrl(origin: string, params: Record<string, string>) {
  const url = new URL("/automation", origin);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url;
}

function seeOther(url: URL) {
  return NextResponse.redirect(url, 303);
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return seeOther(getRedirectUrl(origin, {}));
}

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;

  try {
    const auth = await requireAuthContext();
    const formData = await request.formData();
    const selectedAccountIds = getSelectedAccountIds(formData);
    const postType = getSelectedPostType(formData);
    const caption = String(formData.get("caption") || "").trim();
    const publishMode = String(formData.get("publishMode") || formData.get("submitMode") || "NOW").trim();
    const scheduledAtRaw = String(formData.get("scheduledAt") || "").trim();
    const mediaFile = formData.get("mediaFile");

    if (!selectedAccountIds.length) {
      return seeOther(getRedirectUrl(origin, { manual: "missing-accounts" }));
    }

    if (!caption && !(mediaFile instanceof File && mediaFile.size)) {
      return seeOther(getRedirectUrl(origin, { manual: "missing-content" }));
    }

    const scheduledFor =
      publishMode === "SCHEDULE" && scheduledAtRaw
        ? new Date(scheduledAtRaw)
        : new Date();

    const manualAsset =
      mediaFile instanceof File && mediaFile.size
        ? await uploadManualAsset({
            churchId: auth.churchId,
            file: mediaFile,
            postType,
          })
        : null;

    await createManualQueuedPosts({
      churchId: auth.churchId,
      selectedAccountIds,
      caption,
      postType,
      scheduledFor,
      assetId: manualAsset?.id,
    });

    if (publishMode === "NOW") {
      const result = await processDueSocialPosts();
      revalidatePath("/automation");
      return seeOther(
        getRedirectUrl(origin, {
          manual: "published",
          posted: String(result.posted),
          failed: String(result.failed),
        }),
      );
    }

    revalidatePath("/automation");
    return seeOther(getRedirectUrl(origin, { manual: "scheduled" }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "manual-post-failed";
    return seeOther(getRedirectUrl(origin, { manual: message }));
  }
}
