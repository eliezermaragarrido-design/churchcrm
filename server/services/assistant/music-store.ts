import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import type { MusicPlan } from "@/lib/worship-music";
export const musicId = (churchId: string, date: string) => "worship_music_" + createHash("sha256").update(churchId + "/" + date).digest("hex").slice(0, 32);
export async function loadMusic(churchId: string, date: string): Promise<MusicPlan | undefined> {
  const saved = await prisma.documentRequest.findFirst({ where: { id: musicId(churchId, date), churchId }, select: { generatedBody: true } });
  return saved?.generatedBody ? JSON.parse(saved.generatedBody) : undefined;
}
export async function saveMusic(churchId: string, plan: MusicPlan) {
  const data = { title: `Music ${plan.serviceDate}`, generatedBody: JSON.stringify(plan), status: "music_source" };
  await prisma.documentRequest.upsert({ where: { id: musicId(churchId, plan.serviceDate) }, create: { id: musicId(churchId, plan.serviceDate), churchId, ...data }, update: data });
}
