import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuthContext } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const auth = await requireAuthContext();
    const body = (await request.json()) as {
      socialPostId?: string;
      success?: boolean;
      externalPostId?: string | null;
      errorMessage?: string | null;
    };

    const socialPostId = String(body.socialPostId || "").trim();

    if (!socialPostId) {
      return NextResponse.json({ error: "Missing TikTok post id." }, { status: 400 });
    }

    const post = await prisma.socialPost.findFirst({
      where: {
        id: socialPostId,
        churchId: auth.churchId,
      },
      select: { id: true },
    });

    if (!post) {
      return NextResponse.json({ error: "TikTok post record was not found." }, { status: 404 });
    }

    if (body.success) {
      await prisma.socialPost.update({
        where: { id: socialPostId },
        data: {
          status: "POSTED",
          publishedAt: new Date(),
          lastAttemptAt: new Date(),
          lastErrorCode: null,
          lastErrorMessage: null,
          externalPostId: body.externalPostId ? String(body.externalPostId) : null,
        },
      });
    } else {
      await prisma.socialPost.update({
        where: { id: socialPostId },
        data: {
          status: "FAILED",
          lastAttemptAt: new Date(),
          lastErrorCode: "DIRECT_UPLOAD_FAILED",
          lastErrorMessage: String(body.errorMessage || "TikTok direct upload failed."),
        },
      });
    }

    revalidatePath("/automation");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the TikTok upload result.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
