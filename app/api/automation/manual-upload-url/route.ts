import { NextResponse } from "next/server";
import type { ContentAssetType, SocialPostType } from "@prisma/client";
import { requireAuthContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function getAssetType(postType: SocialPostType): ContentAssetType {
  return postType === "SHORT_VIDEO" ? "DEVOTIONAL_VIDEO" : "DAILY_IMAGE";
}

function getBucketName(postType: SocialPostType) {
  return postType === "SHORT_VIDEO" ? "REELS" : "IMAGES";
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthContext();
    const body = (await request.json()) as {
      postType?: SocialPostType;
      fileName?: string;
      contentType?: string;
    };

    const postType = body.postType === "SHORT_VIDEO" || body.postType === "STORY" ? body.postType : "FEED_POST";
    const fileName = String(body.fileName || "manual-upload").trim() || "manual-upload";
    const extension = fileName.includes(".") ? fileName.split(".").pop() : undefined;
    const objectName = `${Date.now()}-${Math.random().toString(36).slice(2)}${extension ? `.${extension}` : ""}`;
    const objectPath = `manual/${objectName}`;
    const bucketName = getBucketName(postType);

    const supabase = createSupabaseAdminClient();
    const signed = await supabase.storage.from(bucketName).createSignedUploadUrl(objectPath);

    if (signed.error || !signed.data) {
      throw new Error(signed.error?.message || "Could not create a signed upload URL.");
    }

    const publicUrl = supabase.storage.from(bucketName).getPublicUrl(objectPath).data.publicUrl;

    return NextResponse.json({
      churchId: auth.churchId,
      bucketName,
      objectPath,
      token: signed.data.token,
      publicUrl,
      assetType: getAssetType(postType),
      contentType: String(body.contentType || "").trim() || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "manual-upload-url-failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
