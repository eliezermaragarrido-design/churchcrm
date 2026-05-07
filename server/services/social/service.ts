import type { Church, ContentAsset, SocialAccount, SocialPost } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { refreshTikTokAccessToken, queryTikTokCreatorInfo } from "@/lib/social/tiktok";
import { refreshYouTubeAccessToken } from "@/lib/social/youtube";

const META_GRAPH_VERSION = "v23.0";

type SocialPostWithRelations = SocialPost & {
  asset: ContentAsset | null;
  church: Church;
  socialAccount: SocialAccount | null;
};

function getMimeTypeFromUrl(url: string) {
  const normalized = url.toLowerCase();

  if (normalized.endsWith(".mp4")) return "video/mp4";
  if (normalized.endsWith(".mov")) return "video/quicktime";
  if (normalized.endsWith(".m4v")) return "video/x-m4v";
  if (normalized.endsWith(".webm")) return "video/webm";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".webp")) return "image/webp";

  return "application/octet-stream";
}

function trimCaption(value: string | null | undefined, maxLength = 2200) {
  const caption = String(value || "").trim();

  if (!caption) {
    return "";
  }

  return caption.length > maxLength ? caption.slice(0, maxLength) : caption;
}

async function updatePostFailure(postId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown social publishing error";

  await prisma.socialPost.update({
    where: { id: postId },
    data: {
      status: "FAILED",
      lastAttemptAt: new Date(),
      lastErrorMessage: message,
      lastErrorCode: error instanceof Error ? error.name : "ERROR",
    },
  });
}

async function updatePostSuccess(postId: string, externalPostId?: string | null) {
  await prisma.socialPost.update({
    where: { id: postId },
    data: {
      status: "POSTED",
      publishedAt: new Date(),
      lastAttemptAt: new Date(),
      lastErrorCode: null,
      lastErrorMessage: null,
      externalPostId: externalPostId || null,
    },
  });
}

async function ensureTikTokAccessToken(account: SocialAccount) {
  if (!account.refreshTokenRef) {
    if (!account.accessTokenRef) {
      throw new Error("TikTok account is missing access token.");
    }

    return account.accessTokenRef;
  }

  const refreshed = await refreshTikTokAccessToken(account.refreshTokenRef);

  await prisma.socialAccount.update({
    where: { id: account.id },
    data: {
      accessTokenRef: refreshed.access_token,
      refreshTokenRef: refreshed.refresh_token || account.refreshTokenRef,
      externalAccountId: refreshed.open_id || account.externalAccountId,
    },
  });

  return refreshed.access_token;
}

async function ensureYouTubeAccessToken(account: SocialAccount) {
  if (!account.refreshTokenRef) {
    if (!account.accessTokenRef) {
      throw new Error("YouTube account is missing access token.");
    }

    return account.accessTokenRef;
  }

  const refreshed = await refreshYouTubeAccessToken(account.refreshTokenRef);

  await prisma.socialAccount.update({
    where: { id: account.id },
    data: {
      accessTokenRef: refreshed.access_token,
    },
  });

  return refreshed.access_token;
}

async function publishFacebookPagePost(post: SocialPostWithRelations) {
  const account = post.socialAccount;

  if (!account?.externalAccountId || !account.accessTokenRef) {
    throw new Error("Facebook Page account is missing page id or token.");
  }

  const caption = trimCaption(post.caption || post.title || post.asset?.title);

  if (post.postType === "SHORT_VIDEO") {
    if (!post.asset?.fileUrl) {
      throw new Error("Facebook reel/video post is missing a public media URL.");
    }

    const response = await fetch(`https://graph-video.facebook.com/${META_GRAPH_VERSION}/${account.externalAccountId}/videos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        access_token: account.accessTokenRef,
        file_url: post.asset.fileUrl,
        description: caption,
      }),
      cache: "no-store",
    });
    const data = (await response.json()) as { id?: string; error?: { message?: string } };

    if (!response.ok || data.error) {
      throw new Error(data.error?.message || "Facebook video publishing failed.");
    }

    return data.id || null;
  }

  if (post.asset?.fileUrl) {
    const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${account.externalAccountId}/photos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        access_token: account.accessTokenRef,
        url: post.asset.fileUrl,
        published: "true",
        caption,
      }),
      cache: "no-store",
    });
    const data = (await response.json()) as { post_id?: string; id?: string; error?: { message?: string } };

    if (!response.ok || data.error) {
      throw new Error(data.error?.message || "Facebook photo publishing failed.");
    }

    return data.post_id || data.id || null;
  }

  const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${account.externalAccountId}/feed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      access_token: account.accessTokenRef,
      message: caption,
    }),
    cache: "no-store",
  });
  const data = (await response.json()) as { id?: string; error?: { message?: string } };

  if (!response.ok || data.error) {
    throw new Error(data.error?.message || "Facebook feed publishing failed.");
  }

  return data.id || null;
}

async function publishInstagramPost(post: SocialPostWithRelations) {
  const account = post.socialAccount;

  if (!account?.externalAccountId || !account.accessTokenRef) {
    throw new Error("Instagram account is missing creator id or token.");
  }

  if (!post.asset?.fileUrl) {
    throw new Error("Instagram publishing requires a public media URL.");
  }

  const caption = trimCaption(post.caption || post.title || post.asset.title);
  const createContainerUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${account.externalAccountId}/media`;
  const publishUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${account.externalAccountId}/media_publish`;
  const params = new URLSearchParams({
    access_token: account.accessTokenRef,
    caption,
  });

  if (post.postType === "SHORT_VIDEO") {
    params.set("media_type", "REELS");
    params.set("video_url", post.asset.fileUrl);
  } else if (post.postType === "STORY") {
    params.set("media_type", "STORIES");
    params.set(post.asset.fileUrl.includes(".mp4") ? "video_url" : "image_url", post.asset.fileUrl);
  } else {
    params.set("image_url", post.asset.fileUrl);
  }

  const createResponse = await fetch(createContainerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
    cache: "no-store",
  });
  const createData = (await createResponse.json()) as { id?: string; error?: { message?: string } };

  if (!createResponse.ok || createData.error || !createData.id) {
    throw new Error(createData.error?.message || "Instagram media container creation failed.");
  }

  if (post.postType === "SHORT_VIDEO") {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const statusUrl = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${createData.id}`);
      statusUrl.searchParams.set("fields", "status_code,status");
      statusUrl.searchParams.set("access_token", account.accessTokenRef);

      const statusResponse = await fetch(statusUrl.toString(), { cache: "no-store" });
      const statusData = (await statusResponse.json()) as { status_code?: string; status?: string; error?: { message?: string } };

      if (!statusResponse.ok || statusData.error) {
        throw new Error(statusData.error?.message || "Instagram media status polling failed.");
      }

      if (statusData.status_code === "FINISHED") {
        break;
      }

      if (statusData.status_code === "ERROR") {
        throw new Error("Instagram media processing failed.");
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  const publishResponse = await fetch(publishUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      access_token: account.accessTokenRef,
      creation_id: createData.id,
    }),
    cache: "no-store",
  });
  const publishData = (await publishResponse.json()) as { id?: string; error?: { message?: string } };

  if (!publishResponse.ok || publishData.error) {
    throw new Error(publishData.error?.message || "Instagram publish failed.");
  }

  return publishData.id || createData.id;
}

async function publishTikTokPost(post: SocialPostWithRelations) {
  const account = post.socialAccount;

  if (!account) {
    throw new Error("TikTok account is missing.");
  }

  if (!post.asset?.fileUrl) {
    throw new Error("TikTok publishing requires a public media URL.");
  }

  const accessToken = await ensureTikTokAccessToken(account);
  const creatorInfo = await queryTikTokCreatorInfo(accessToken);
  const privacyOptions = creatorInfo.data?.privacy_level_options || [];
  const privacyLevel =
    privacyOptions.find((option) => option === "PUBLIC_TO_EVERYONE") ||
    privacyOptions[0] ||
    "SELF_ONLY";

  const caption = trimCaption(post.caption || post.title || post.asset.title);

  if (post.postType === "SHORT_VIDEO") {
    const response = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title: caption,
          privacy_level: privacyLevel,
          disable_comment: false,
          disable_duet: false,
          disable_stitch: false,
          brand_organic_toggle: true,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: post.asset.fileUrl,
        },
      }),
      cache: "no-store",
    });
    const data = (await response.json()) as {
      data?: { publish_id?: string };
      error?: { code?: string; message?: string };
    };

    if (!response.ok || data.error?.code !== "ok") {
      throw new Error(data.error?.message || "TikTok video publishing failed.");
    }

    return data.data?.publish_id || null;
  }

  const response = await fetch("https://open.tiktokapis.com/v2/post/publish/content/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: post.asset.title,
        description: caption,
        privacy_level: privacyLevel,
        disable_comment: false,
        auto_add_music: false,
      },
      source_info: {
        source: "PULL_FROM_URL",
        photo_cover_index: 1,
        photo_images: [post.asset.fileUrl],
      },
      post_mode: "DIRECT_POST",
      media_type: "PHOTO",
    }),
    cache: "no-store",
  });
  const data = (await response.json()) as {
    data?: { publish_id?: string };
    error?: { code?: string; message?: string };
  };

  if (!response.ok || data.error?.code !== "ok") {
    throw new Error(data.error?.message || "TikTok photo publishing failed.");
  }

  return data.data?.publish_id || null;
}

async function publishYouTubePost(post: SocialPostWithRelations) {
  const account = post.socialAccount;

  if (!account) {
    throw new Error("YouTube account is missing.");
  }

  if (post.postType !== "SHORT_VIDEO") {
    throw new Error("YouTube automation currently supports short videos only.");
  }

  if (!post.asset?.fileUrl) {
    throw new Error("YouTube publishing requires a public media URL.");
  }

  const accessToken = await ensureYouTubeAccessToken(account);
  const mediaResponse = await fetch(post.asset.fileUrl, { cache: "no-store" });

  if (!mediaResponse.ok) {
    throw new Error("Could not download the Supabase video for YouTube upload.");
  }

  const mediaBuffer = Buffer.from(await mediaResponse.arrayBuffer());
  const mimeType = getMimeTypeFromUrl(post.asset.fileUrl);
  const metadata = {
    snippet: {
      title: trimCaption(post.title || post.asset.title || "Daily reel", 100),
      description: trimCaption(post.caption || "", 5000),
      categoryId: "22",
    },
    status: {
      privacyStatus: "public",
    },
  };

  const sessionResponse = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(mediaBuffer.byteLength),
      "X-Upload-Content-Type": mimeType,
    },
    body: JSON.stringify(metadata),
    cache: "no-store",
  });

  if (!sessionResponse.ok) {
    const errorText = await sessionResponse.text();
    throw new Error(errorText || "YouTube resumable upload session failed.");
  }

  const uploadUrl = sessionResponse.headers.get("Location");

  if (!uploadUrl) {
    throw new Error("YouTube upload session did not return a resumable URL.");
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Length": String(mediaBuffer.byteLength),
      "Content-Type": mimeType,
    },
    body: mediaBuffer,
    cache: "no-store",
  });

  const uploadData = (await uploadResponse.json()) as { id?: string; error?: { message?: string } };

  if (!uploadResponse.ok || uploadData.error) {
    throw new Error(uploadData.error?.message || "YouTube video upload failed.");
  }

  return uploadData.id || null;
}

async function publishSocialPost(post: SocialPostWithRelations) {
  const platform = post.socialAccount?.platform;

  if (!platform) {
    throw new Error("Post is no longer linked to a social account.");
  }

  if (platform === "FACEBOOK_PAGE") {
    return publishFacebookPagePost(post);
  }

  if (platform === "INSTAGRAM") {
    return publishInstagramPost(post);
  }

  if (platform === "TIKTOK") {
    return publishTikTokPost(post);
  }

  if (platform === "YOUTUBE") {
    return publishYouTubePost(post);
  }

  throw new Error(`Platform ${platform} is not supported yet.`);
}

export async function processDueSocialPosts(limit = 25) {
  const now = new Date();
  const posts = await prisma.socialPost.findMany({
    where: {
      status: { in: ["READY", "SCHEDULED"] },
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
    },
    include: {
      asset: true,
      church: true,
      socialAccount: true,
    },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
    take: limit,
  });

  const results: Array<{ id: string; status: "POSTED" | "FAILED"; platform: string; message: string }> = [];

  for (const post of posts) {
    try {
      const externalPostId = await publishSocialPost(post);
      await updatePostSuccess(post.id, externalPostId);
      results.push({
        id: post.id,
        status: "POSTED",
        platform: post.socialAccount?.platform || "UNKNOWN",
        message: externalPostId || "published",
      });
    } catch (error) {
      await updatePostFailure(post.id, error);
      results.push({
        id: post.id,
        status: "FAILED",
        platform: post.socialAccount?.platform || "UNKNOWN",
        message: error instanceof Error ? error.message : "publish failed",
      });
    }
  }

  return {
    processed: posts.length,
    posted: results.filter((result) => result.status === "POSTED").length,
    failed: results.filter((result) => result.status === "FAILED").length,
    results,
  };
}
