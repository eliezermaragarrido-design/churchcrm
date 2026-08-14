import type { Church, ContentAsset, SocialAccount, SocialPost } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { refreshTikTokAccessToken, queryTikTokCreatorInfo } from "@/lib/social/tiktok";
import { refreshYouTubeAccessToken } from "@/lib/social/youtube";

const DEFAULT_AUTOMATION_CAPTION_TEXT = "\u{1F64F}\u{1F3FC}\u{1F64C}\u{1F3FD}";

const META_GRAPH_VERSION = "v23.0";

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

const TIKTOK_MIN_CHUNK_SIZE = 5 * 1024 * 1024;
const TIKTOK_MAX_CHUNK_SIZE = 64 * 1024 * 1024;
const TIKTOK_DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024;

function isInstagramNotReadyMessage(message: string) {
  const normalized = message.trim().toLowerCase();

  return (
    normalized.includes("media id is not available") ||
    normalized.includes("media is not ready") ||
    normalized.includes("please wait")
  );
}

async function readInstagramContainerStatus(containerId: string, accessToken: string) {
  const statusUrl = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${containerId}`);
  statusUrl.searchParams.set("fields", "status_code,status");
  statusUrl.searchParams.set("access_token", accessToken);

  const statusResponse = await fetch(statusUrl.toString(), { cache: "no-store" });
  const statusData = (await statusResponse.json()) as {
    status_code?: string;
    status?: string;
    error?: { message?: string };
  };

  if (!statusResponse.ok || statusData.error) {
    throw new Error(statusData.error?.message || "Instagram media status polling failed.");
  }

  return String(statusData.status_code || statusData.status || "").toUpperCase();
}
const DEFAULT_AUTOMATION_CAPTION = "🙏 ⛪";

void DEFAULT_AUTOMATION_CAPTION;

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

function isGeneratedAutomationLabel(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return (
    /^daily (image|reel)\s+\d{1,3}$/.test(normalized) ||
    /^day \d{1,3} (image|reel) post$/.test(normalized)
  );
}

function getPostCaption(post: SocialPostWithRelations, maxLength = 2200) {
  const explicitCaption = trimCaption(post.caption, maxLength);
  const bodyCaption = trimCaption(post.asset?.body, maxLength);
  const scriptureCaption = trimCaption(post.asset?.scriptureRef, maxLength);

  return (
    (!isGeneratedAutomationLabel(explicitCaption) ? explicitCaption : "") ||
    (!isGeneratedAutomationLabel(bodyCaption) ? bodyCaption : "") ||
    (!isGeneratedAutomationLabel(scriptureCaption) ? scriptureCaption : "") ||
    trimCaption(DEFAULT_AUTOMATION_CAPTION_TEXT, maxLength)
  );
}

function getTikTokTitle(post: SocialPostWithRelations, maxLength = 90) {
  const explicitTitle = trimCaption(post.title, maxLength);
  const assetTitle = trimCaption(post.asset?.title, maxLength);
  const caption = trimCaption(getPostCaption(post, maxLength), maxLength);

  return (
    (!isGeneratedAutomationLabel(explicitTitle) ? explicitTitle : "") ||
    (!isGeneratedAutomationLabel(assetTitle) ? assetTitle : "") ||
    caption ||
    trimCaption(DEFAULT_AUTOMATION_CAPTION_TEXT, maxLength)
  );
}

async function downloadMediaBuffer(url: string) {
  const mediaResponse = await fetch(url, { cache: "no-store" });

  if (!mediaResponse.ok) {
    throw new Error("Could not download the media file for TikTok upload.");
  }

  return Buffer.from(await mediaResponse.arrayBuffer());
}

function getTikTokChunkPlan(totalBytes: number) {
  if (totalBytes <= 0) {
    throw new Error("TikTok upload received an empty media file.");
  }

  if (totalBytes <= TIKTOK_MAX_CHUNK_SIZE) {
    return [totalBytes];
  }

  const chunkSizes: number[] = [];
  let remaining = totalBytes;

  while (remaining > 0) {
    if (remaining <= TIKTOK_MAX_CHUNK_SIZE) {
      if (remaining < TIKTOK_MIN_CHUNK_SIZE && chunkSizes.length > 0) {
        chunkSizes[chunkSizes.length - 1] += remaining;
      } else {
        chunkSizes.push(remaining);
      }
      break;
    }

    const nextChunkSize = Math.min(TIKTOK_DEFAULT_CHUNK_SIZE, remaining);
    chunkSizes.push(nextChunkSize);
    remaining -= nextChunkSize;
  }

  return chunkSizes;
}

async function uploadTikTokVideoChunks(uploadUrl: string, mediaBuffer: Buffer, mimeType: string) {
  const chunkSizes = getTikTokChunkPlan(mediaBuffer.byteLength);
  let offset = 0;

  for (const chunkSize of chunkSizes) {
    const end = offset + chunkSize;
    const chunk = mediaBuffer.subarray(offset, end);
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${offset}-${end - 1}/${mediaBuffer.byteLength}`,
      },
      body: chunk,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("TikTok media upload failed while sending the video binary.");
    }

    offset = end;
  }
}

function normalizeTikTokPublishError(message: string) {
  const normalized = message.trim().toLowerCase();

  if (normalized.includes("content-sharing-guidelines")) {
    return "TikTok blocked this post under its content-sharing guidelines. While the app is still unaudited, the connected TikTok account must be private at posting time and posts can only publish as SELF_ONLY.";
  }

  return message;
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

  const caption = getPostCaption(post);

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

  const caption = getPostCaption(post);
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

  if (post.postType === "FEED_POST") {
    await sleep(8000);
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const statusCode = await readInstagramContainerStatus(createData.id, account.accessTokenRef);

    if (statusCode === "FINISHED" || statusCode === "PUBLISHED") {
      break;
    }

    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      throw new Error("Instagram media processing failed.");
    }

    await sleep(post.postType === "FEED_POST" ? 6000 : 4000);
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
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

    if (publishResponse.ok && !publishData.error) {
      return publishData.id || createData.id;
    }

    const message = publishData.error?.message || "Instagram publish failed.";

    if (attempt < 19 && isInstagramNotReadyMessage(message)) {
      await sleep(post.postType === "FEED_POST" ? 6000 : 4000);
      await readInstagramContainerStatus(createData.id, account.accessTokenRef);
      continue;
    }

    throw new Error(message);
  }

  throw new Error("Instagram publish timed out while waiting for media readiness.");
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
  const sandboxPreferredPrivacyLevel = privacyOptions.find((option) => option === "SELF_ONLY");
  const publicPreferredPrivacyLevel = privacyOptions.find((option) => option === "PUBLIC_TO_EVERYONE");
  const privacyLevel =
    (env.TIKTOK_USE_SANDBOX ? sandboxPreferredPrivacyLevel : publicPreferredPrivacyLevel) ||
    sandboxPreferredPrivacyLevel ||
    publicPreferredPrivacyLevel ||
    privacyOptions[0] ||
    "SELF_ONLY";

  const caption = getPostCaption(post);

  if (post.postType === "SHORT_VIDEO") {
    const mediaBuffer = await downloadMediaBuffer(post.asset.fileUrl);
    const mimeType = getMimeTypeFromUrl(post.asset.fileUrl);
    const chunkSizes = getTikTokChunkPlan(mediaBuffer.byteLength);
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
          source: "FILE_UPLOAD",
          video_size: mediaBuffer.byteLength,
          chunk_size: chunkSizes[0],
          total_chunk_count: chunkSizes.length,
        },
      }),
      cache: "no-store",
    });
    const data = (await response.json()) as {
      data?: { publish_id?: string; upload_url?: string };
      error?: { code?: string; message?: string };
    };

    if (!response.ok || data.error?.code !== "ok" || !data.data?.upload_url) {
      throw new Error(normalizeTikTokPublishError(data.error?.message || "TikTok video publishing failed."));
    }

    await uploadTikTokVideoChunks(data.data.upload_url, mediaBuffer, mimeType);

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
        title: getTikTokTitle(post),
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
    throw new Error(normalizeTikTokPublishError(data.error?.message || "TikTok photo publishing failed."));
  }

  return data.data?.publish_id || null;
}

async function publishTikTokVideoBuffer(input: {
  account: SocialAccount;
  mediaBuffer: Buffer;
  mimeType: string;
  caption: string;
}) {
  const accessToken = await ensureTikTokAccessToken(input.account);
  const creatorInfo = await queryTikTokCreatorInfo(accessToken);
  const privacyOptions = creatorInfo.data?.privacy_level_options || [];
  const sandboxPreferredPrivacyLevel = privacyOptions.find((option) => option === "SELF_ONLY");
  const publicPreferredPrivacyLevel = privacyOptions.find((option) => option === "PUBLIC_TO_EVERYONE");
  const privacyLevel =
    (env.TIKTOK_USE_SANDBOX ? sandboxPreferredPrivacyLevel : publicPreferredPrivacyLevel) ||
    sandboxPreferredPrivacyLevel ||
    publicPreferredPrivacyLevel ||
    privacyOptions[0] ||
    "SELF_ONLY";
  const chunkSizes = getTikTokChunkPlan(input.mediaBuffer.byteLength);
  const response = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: trimCaption(input.caption, 2200) || trimCaption(DEFAULT_AUTOMATION_CAPTION_TEXT, 2200),
        privacy_level: privacyLevel,
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false,
        brand_organic_toggle: true,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: input.mediaBuffer.byteLength,
        chunk_size: chunkSizes[0],
        total_chunk_count: chunkSizes.length,
      },
    }),
    cache: "no-store",
  });
  const data = (await response.json()) as {
    data?: { publish_id?: string; upload_url?: string };
    error?: { code?: string; message?: string };
  };

  if (!response.ok || data.error?.code !== "ok" || !data.data?.upload_url) {
    throw new Error(normalizeTikTokPublishError(data.error?.message || "TikTok video publishing failed."));
  }

  await uploadTikTokVideoChunks(data.data.upload_url, input.mediaBuffer, input.mimeType);

  return data.data?.publish_id || null;
}

async function initializeTikTokVideoUpload(input: {
  account: SocialAccount;
  fileSize: number;
  caption: string;
}) {
  const accessToken = await ensureTikTokAccessToken(input.account);
  const creatorInfo = await queryTikTokCreatorInfo(accessToken);
  const privacyOptions = creatorInfo.data?.privacy_level_options || [];
  const sandboxPreferredPrivacyLevel = privacyOptions.find((option) => option === "SELF_ONLY");
  const publicPreferredPrivacyLevel = privacyOptions.find((option) => option === "PUBLIC_TO_EVERYONE");
  const privacyLevel =
    (env.TIKTOK_USE_SANDBOX ? sandboxPreferredPrivacyLevel : publicPreferredPrivacyLevel) ||
    sandboxPreferredPrivacyLevel ||
    publicPreferredPrivacyLevel ||
    privacyOptions[0] ||
    "SELF_ONLY";
  const chunkSizes = getTikTokChunkPlan(input.fileSize);
  const response = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: trimCaption(input.caption, 2200) || trimCaption(DEFAULT_AUTOMATION_CAPTION_TEXT, 2200),
        privacy_level: privacyLevel,
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false,
        brand_organic_toggle: true,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: input.fileSize,
        chunk_size: chunkSizes[0],
        total_chunk_count: chunkSizes.length,
      },
    }),
    cache: "no-store",
  });
  const data = (await response.json()) as {
    data?: { publish_id?: string; upload_url?: string };
    error?: { code?: string; message?: string };
  };

  if (!response.ok || data.error?.code !== "ok" || !data.data?.upload_url) {
    throw new Error(normalizeTikTokPublishError(data.error?.message || "TikTok video publishing failed."));
  }

  return {
    publishId: data.data.publish_id || null,
    uploadUrl: data.data.upload_url,
    chunkSizes,
  };
}

export async function publishTikTokLocalVideoNow(input: {
  socialAccountId: string;
  file: File;
  caption?: string | null;
}) {
  const account = await prisma.socialAccount.findUnique({
    where: { id: input.socialAccountId },
  });

  if (!account || account.platform !== "TIKTOK") {
    throw new Error("TikTok account is missing or no longer available.");
  }

  if (!input.file.size) {
    throw new Error("Choose a local TikTok video before publishing.");
  }

  const mediaBuffer = Buffer.from(await input.file.arrayBuffer());
  const mimeType = input.file.type || "video/mp4";

  return publishTikTokVideoBuffer({
    account,
    mediaBuffer,
    mimeType,
    caption: trimCaption(input.caption, 2200) || trimCaption(DEFAULT_AUTOMATION_CAPTION_TEXT, 2200),
  });
}

export async function createTikTokDirectUploadSessions(input: {
  churchId: string;
  socialAccountIds: string[];
  caption?: string | null;
  fileSize: number;
}) {
  const accounts = await prisma.socialAccount.findMany({
    where: {
      churchId: input.churchId,
      id: { in: input.socialAccountIds },
      isActive: true,
      platform: "TIKTOK",
    },
    orderBy: [{ accountLabel: "asc" }],
  });

  const sessions: Array<{
    socialPostId: string;
    socialAccountId: string;
    accountLabel: string;
    uploadUrl: string;
    externalPostId: string | null;
    chunkSizes: number[];
  }> = [];
  const caption = trimCaption(input.caption, 2200) || trimCaption(DEFAULT_AUTOMATION_CAPTION_TEXT, 2200);

  for (const account of accounts) {
    const post = await prisma.socialPost.create({
      data: {
        churchId: input.churchId,
        socialAccountId: account.id,
        title: null,
        caption,
        postType: "SHORT_VIDEO",
        status: "READY",
        scheduledFor: new Date(),
      },
    });

    try {
      const session = await initializeTikTokVideoUpload({
        account,
        fileSize: input.fileSize,
        caption,
      });

      sessions.push({
        socialPostId: post.id,
        socialAccountId: account.id,
        accountLabel: account.accountLabel,
        uploadUrl: session.uploadUrl,
        externalPostId: session.publishId,
        chunkSizes: session.chunkSizes,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "TikTok upload session failed.";
      await prisma.socialPost.update({
        where: { id: post.id },
        data: {
          status: "FAILED",
          lastAttemptAt: new Date(),
          lastErrorCode: error instanceof Error ? error.name : "ERROR",
          lastErrorMessage: message,
        },
      });
      throw error;
    }
  }

  return sessions;
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
      description: getPostCaption(post, 5000),
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
