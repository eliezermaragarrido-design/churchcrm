import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { processDueSocialPosts } from "@/server/services/social/service";

export async function GET(request: Request) {
  if (env.CRON_SECRET) {
    const authorization = request.headers.get("authorization");

    if (authorization !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await processDueSocialPosts();
  return NextResponse.json(result);
}
