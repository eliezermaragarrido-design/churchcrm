import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAuthContext } from "@/lib/auth";
import { createTikTokDirectUploadSessions } from "@/server/services/social/service";

export async function POST(request: Request) {
  try {
    const auth = await requireAuthContext();
    const body = (await request.json()) as {
      accountIds?: string[];
      caption?: string;
      fileSize?: number;
      fileType?: string;
    };

    const accountIds = Array.isArray(body.accountIds)
      ? body.accountIds.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    const fileSize = Number(body.fileSize || 0);
    const fileType = String(body.fileType || "").trim().toLowerCase();
    const caption = String(body.caption || "").trim();

    if (!accountIds.length) {
      return NextResponse.json({ error: "Choose at least one TikTok account." }, { status: 400 });
    }

    if (!fileSize) {
      return NextResponse.json({ error: "Choose a TikTok video before publishing." }, { status: 400 });
    }

    if (!fileType.startsWith("video/")) {
      return NextResponse.json({ error: "TikTok direct publishing requires a local video file." }, { status: 400 });
    }

    const sessions = await createTikTokDirectUploadSessions({
      churchId: auth.churchId,
      socialAccountIds: accountIds,
      caption,
      fileSize,
    });

    revalidatePath("/automation");
    return NextResponse.json({ sessions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not prepare the TikTok direct upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
