import { createHash, randomUUID } from "node:crypto";
import type { SermonPlan } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { worshipComplete, firstSunday, type WorshipSource, type WorshipState } from "@/lib/documents/worship-types";
import { createWorshipDocx } from "@/lib/documents/worship-docx";
import { advanceWorship } from "./worship-content";
import { sermonInput } from "./sermon-jobs";
import { loadMusic } from "./music-store";
import { musicMissing } from "@/lib/worship-music";

export function worshipId(churchId: string, source: WorshipSource, communion: boolean) {
  return "worship_" + createHash("sha256").update(JSON.stringify({ churchId, source, communion, version: 7 })).digest("hex").slice(0, 40);
}
const sermonTextCache = new Map<string, unknown>();
export async function completedWorshipSource(churchId: string, plan: SermonPlan): Promise<WorshipSource | null> {
  const input = sermonInput(plan);
  const candidates = await prisma.documentRequest.findMany({ where: { churchId, status: "generated", id: { startsWith: "sermon_" }, title: { startsWith: input.serviceDate } }, select: { id: true, inputJson: true, updatedAt: true }, orderBy: { updatedAt: "desc" } });
  for (const document of candidates) {
    try {
      const info = JSON.parse(document.inputJson || "{}");
      // A completed sermon remains a valid source when calendar wording such as the
      // series or remarks changes later. The sermon title and main passage identify
      // the actual message. A different title or main passage requires a new deck.
      if (["serviceDate", "sermonTitle", "secondScriptureLesson"].some(key => info.input?.[key] !== input[key as keyof typeof input])) continue;
      const cacheKey = `${churchId}/${document.id}/${document.updatedAt.toISOString()}`;
      let sermon = sermonTextCache.get(cacheKey);
      if (!sermon) {
        const saved = await prisma.documentRequest.findFirst({ where: { id: document.id, churchId, status: "generated", updatedAt: document.updatedAt }, select: { generatedBody: true } });
        const deck = JSON.parse(saved?.generatedBody || "{}").deck;
        if (!deck?.points?.length || !deck?.scriptureReading?.length) continue;
        // Retain only approved text, never the large image payloads.
        sermon = Object.fromEntries(["sermonTitle", "seriesTitle", "introductions", "humor", "scriptureReading", "points", "finalPhrase"].map(key => [key, deck[key]]));
        if (sermonTextCache.size >= 32) sermonTextCache.delete(sermonTextCache.keys().next().value!);
        sermonTextCache.set(cacheKey, sermon);
      }
      return { ...input, planId: plan.id, sermonId: document.id, sermon, music: await loadMusic(churchId, input.serviceDate) };
    } catch { /* An old malformed record is not a completed source. */ }
  }
  return null;
}
type Info = { planId: string; communion: boolean; progress: string; retryAt?: number; failures?: number; error?: string; lease?: string; errorHistory?: { at: string; message: string }[] };
export function worshipSummary(document: { id: string; status: string; inputJson: string | null; updatedAt: Date }) {
  const info: Info = JSON.parse(document.inputJson || "{}");
  return { id: document.id, status: document.status, communion: info.communion, progress: info.progress, error: info.error || null };
}
export async function startWorship(churchId: string, plan: SermonPlan, communion = firstSunday(plan.serviceDate.toISOString().slice(0, 10)), regenerate = false) {
  const source = await completedWorshipSource(churchId, plan);
  if (!source) throw new Error("Finish this date’s sermon PowerPoint before preparing its worship service.");
  if (!source.firstScriptureLesson.trim()) throw new Error("Add the First Scripture Lesson to the sermon calendar before preparing the service.");
  if (musicMissing(source.music).length) throw new Error(`Upload the music workbook for ${source.serviceDate}. Missing: ${musicMissing(source.music).join(", ")}.`);
  const id = worshipId(churchId, source, communion);
  const existing = await prisma.documentRequest.findFirst({ where: { id, churchId } });
  if (existing && !regenerate) return existing;
  const recent = await prisma.documentRequest.findMany({ where: { churchId, id: { startsWith: "worship_" }, status: "generated" }, orderBy: { updatedAt: "desc" }, take: 48, select: { generatedBody: true } });
  const history: NonNullable<WorshipState["freshness"]>["history"] = [];
  for (const record of recent) {
    try {
      const prior: WorshipState = JSON.parse(record.generatedBody || "{}");
      if (!prior.source?.serviceDate || prior.source.serviceDate === source.serviceDate || !prior.sections || history.some(item => item.date === prior.source.serviceDate)) continue;
      history.push({ date: prior.source.serviceDate, psalm: prior.welcomePsalm?.[0]?.reference, sections: Object.fromEntries(Object.entries(prior.sections).map(([key, value]) => [key, value?.text])) });
      if (history.length === 16) break;
    } catch { /* Ignore malformed historical drafts. */ }
  }
  const state: WorshipState = { source, communion, sections: {}, freshness: { history } };
  if (existing) {
    return prisma.documentRequest.update({ where: { id }, data: {
      status: "queued",
      inputJson: JSON.stringify({ planId: plan.id, communion, progress: "Preparing a new worship service from the completed sermon." }),
      generatedBody: JSON.stringify(state),
    } });
  }
  return prisma.documentRequest.upsert({ where: { id }, update: {}, create: {
    id, churchId, title: `Worship ${source.serviceDate} ${source.sermonTitle}`, status: "queued",
    inputJson: JSON.stringify({ planId: plan.id, communion, progress: "Preparing the worship service from the completed sermon." }), generatedBody: JSON.stringify(state),
  } });
}
export function retryWorship(error: unknown, failures: number) {
  const message = error instanceof Error ? error.message : "Temporary service interruption.";
  const status = (error as { status?: number })?.status;
  const blocked = status === 401 || status === 403 || /insufficient_quota|no credits|billing|API key is missing|invalid_api_key/i.test(message);
  return { message, blocked, delay: Math.min(120000, 3000 * 2 ** Math.min(failures - 1, 6)) };
}
export async function runWorshipJob(id: string, churchId: string, budgetMs = process.env.VERCEL ? 150000 : 600000) {
  const initial = await prisma.documentRequest.findFirst({ where: { churchId, id: { equals: id, startsWith: "worship_" } } });
  if (!initial || initial.status === "generated" || initial.status === "needs_attention") return;
  const info: Info = JSON.parse(initial.inputJson!);
  if ((info.retryAt || 0) > Date.now()) return;
  const lease = randomUUID(); info.lease = lease;
  const claim = await prisma.documentRequest.updateMany({ where: { id, churchId, updatedAt: initial.updatedAt, OR: [{ status: "queued" }, { status: "running", updatedAt: { lt: new Date(Date.now() - 3 * 60_000) } }] }, data: { status: "running", inputJson: JSON.stringify(info) } });
  if (!claim.count) return;
  const state: WorshipState = JSON.parse(initial.generatedBody!);
  let revision = (await prisma.documentRequest.findUniqueOrThrow({ where: { id } })).updatedAt;
  const deadline = Date.now() + budgetMs;
  async function save(status = "running") {
    const result = await prisma.documentRequest.updateMany({ where: { id, churchId, status: "running", updatedAt: revision }, data: { status, inputJson: JSON.stringify(info), generatedBody: JSON.stringify(state) } });
    if (!result.count) return false;
    revision = (await prisma.documentRequest.findUniqueOrThrow({ where: { id } })).updatedAt;
    return true;
  }
  while (Date.now() < deadline) {
    try {
      if (worshipComplete(state)) {
        createWorshipDocx(state); // Validate export before exposing a download.
        info.progress = "Word document ready. Every generated section completed five reviews.";
        info.error = undefined; info.retryAt = undefined;
        await save("generated"); return;
      }
      info.progress = await advanceWorship(state);
      info.failures = 0; info.error = undefined; info.retryAt = undefined;
      if (!await save()) return;
    } catch (error) {
      info.failures = (info.failures || 0) + 1;
      const retry = retryWorship(error, info.failures);
      info.error = retry.message;
      info.errorHistory = [...(info.errorHistory || []), { at: new Date().toISOString(), message: retry.message }].slice(-10);
      info.progress = retry.blocked ? "Account access needs attention. Completed work is saved." : `Revising the document automatically. ${Object.values(state.sections).reduce((total, section) => total + (section?.reviews.length || 0), 0)} of 30 reviews saved.`;
      info.retryAt = Date.now() + retry.delay;
      if (!await save(retry.blocked ? "needs_attention" : "running")) return;
      if (retry.blocked) return;
      if (info.retryAt >= deadline) break;
      await new Promise(resolve => setTimeout(resolve, retry.delay));
    }
  }
  await save("queued");
}
