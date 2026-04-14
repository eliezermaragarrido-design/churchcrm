"use server";

import { randomUUID } from "crypto";
import { FeedReactionType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuthContext } from "@/lib/auth";
import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const allowedPostTypes = new Set(["TEXT", "PHOTO", "VIDEO", "ANNOUNCEMENT", "PRAYER_REQUEST"]);
const allowedReactionTypes = new Set<FeedReactionType>(["LIKE", "AMEN", "PRAY", "LOVE"]);

export async function createGroupPostAction(formData: FormData) {
  const auth = await requireAuthContext();

  const groupId = String(formData.get("groupId") || "");
  const authorMemberId = String(formData.get("authorMemberId") || "");
  const title = String(formData.get("title") || "").trim() || undefined;
  const body = String(formData.get("body") || "").trim();
  const requestedType = String(formData.get("postType") || "TEXT");
  const postType = allowedPostTypes.has(requestedType) ? requestedType : "TEXT";
  const mediaFile = formData.get("mediaFile");

  if (!groupId || !authorMemberId || (!body && !hasUploadedFile(mediaFile))) {
    throw new Error("A post needs text or media, plus a valid author and group.");
  }

  await assertGroupAndMember(auth.churchId, groupId, authorMemberId);

  const createdPost = await prisma.groupPost.create({
    data: {
      churchId: auth.churchId,
      groupId,
      authorMemberId,
      postType,
      title,
      body: body || undefined,
    },
  });

  if (hasUploadedFile(mediaFile)) {
    const uploadedMedia = await uploadGroupMedia(groupId, createdPost.id, mediaFile);
    await prisma.groupMedia.create({
      data: {
        postId: createdPost.id,
        mediaType: uploadedMedia.mediaType,
        url: uploadedMedia.url,
      },
    });
  }

  revalidateGroupViews(groupId);
}

export async function createGroupCommentAction(formData: FormData) {
  const auth = await requireAuthContext();

  const groupId = String(formData.get("groupId") || "");
  const postId = String(formData.get("postId") || "");
  const authorMemberId = String(formData.get("authorMemberId") || "");
  const body = String(formData.get("body") || "").trim();

  if (!groupId || !postId || !authorMemberId || !body) {
    throw new Error("Group, post, author, and comment body are required.");
  }

  await assertGroupAndMember(auth.churchId, groupId, authorMemberId);

  const post = await prisma.groupPost.findFirst({
    where: {
      id: postId,
      groupId,
      churchId: auth.churchId,
    },
    select: { id: true },
  });

  if (!post) {
    throw new Error("The selected post could not be found.");
  }

  await prisma.groupComment.create({
    data: {
      postId,
      authorMemberId,
      body,
    },
  });

  revalidateGroupViews(groupId);
}

export async function toggleGroupReactionAction(formData: FormData) {
  const auth = await requireAuthContext();

  const groupId = String(formData.get("groupId") || "");
  const postId = String(formData.get("postId") || "");
  const memberId = String(formData.get("memberId") || "");
  const requestedType = String(formData.get("reactionType") || "LIKE") as FeedReactionType;

  if (!groupId || !postId || !memberId || !allowedReactionTypes.has(requestedType)) {
    throw new Error("Reaction details are incomplete.");
  }

  await assertGroupAndMember(auth.churchId, groupId, memberId);

  const post = await prisma.groupPost.findFirst({
    where: {
      id: postId,
      groupId,
      churchId: auth.churchId,
    },
    select: { id: true },
  });

  if (!post) {
    throw new Error("The selected post could not be found.");
  }

  const existingReaction = await prisma.groupReaction.findUnique({
    where: {
      postId_memberId_reactionType: {
        postId,
        memberId,
        reactionType: requestedType,
      },
    },
    select: { id: true },
  });

  if (existingReaction) {
    await prisma.groupReaction.delete({ where: { id: existingReaction.id } });
  } else {
    await prisma.groupReaction.create({
      data: {
        postId,
        memberId,
        reactionType: requestedType,
      },
    });
  }

  revalidateGroupViews(groupId);
}

export async function addGroupMemberAction(formData: FormData) {
  const auth = await requireAuthContext();

  const groupId = String(formData.get("groupId") || "");
  const memberId = String(formData.get("memberId") || "");
  const requestedRole = String(formData.get("role") || "MEMBER");
  const role = requestedRole === "LEADER" || requestedRole === "ASSISTANT" ? requestedRole : "MEMBER";

  if (!groupId || !memberId) {
    throw new Error("Group and member are required.");
  }

  await assertGroupAndMember(auth.churchId, groupId, memberId);

  await prisma.groupMember.upsert({
    where: {
      groupId_memberId: {
        groupId,
        memberId,
      },
    },
    update: {
      role,
    },
    create: {
      groupId,
      memberId,
      role,
    },
  });

  revalidateGroupViews(groupId);
  revalidatePath("/messages");
}

export async function removeGroupMemberAction(formData: FormData) {
  const auth = await requireAuthContext();

  const groupId = String(formData.get("groupId") || "");
  const membershipId = String(formData.get("membershipId") || "");

  if (!groupId || !membershipId) {
    throw new Error("Group and membership are required.");
  }

  const membership = await prisma.groupMember.findFirst({
    where: {
      id: membershipId,
      groupId,
      group: {
        churchId: auth.churchId,
      },
    },
    select: { id: true },
  });

  if (!membership) {
    throw new Error("The selected group membership could not be found.");
  }

  await prisma.groupMember.delete({
    where: { id: membership.id },
  });

  revalidateGroupViews(groupId);
  revalidatePath("/messages");
}

async function assertGroupAndMember(churchId: string, groupId: string, memberId: string) {
  const [group, member] = await Promise.all([
    prisma.group.findFirst({
      where: { id: groupId, churchId },
      select: { id: true },
    }),
    prisma.member.findFirst({
      where: { id: memberId, churchId },
      select: { id: true },
    }),
  ]);

  if (!group || !member) {
    throw new Error("The group or selected member could not be found.");
  }
}

function hasUploadedFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File && value.size > 0;
}

async function uploadGroupMedia(groupId: string, postId: string, file: File) {
  const admin = createSupabaseAdminClient();
  const fileExtension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const filePath = `groups/${groupId}/${postId}-${randomUUID()}.${fileExtension}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const uploadResult = await admin.storage
    .from(env.SUPABASE_UPLOAD_BUCKET)
    .upload(filePath, bytes, {
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadResult.error) {
    throw new Error(`Media upload failed: ${uploadResult.error.message}`);
  }

  const publicUrl = admin.storage.from(env.SUPABASE_UPLOAD_BUCKET).getPublicUrl(filePath).data.publicUrl;

  return {
    url: publicUrl,
    mediaType: file.type || "application/octet-stream",
  };
}

function revalidateGroupViews(groupId: string) {
  revalidatePath("/groups");
  revalidatePath("/dashboard");
  revalidatePath(`/groups/${groupId}`);
}
