import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { sundaysInMonth } from "@/lib/current-sermon-month";
import { completedWorshipSource, retryWorship } from "./worship-jobs";
import { advanceGroup } from "./grace-hope-content";
import { createGroupDocx } from "@/lib/documents/grace-hope-docx";
import { GROUP_DISCUSSION_VERSION, type GroupAudience, type GroupSource, type GroupState } from "@/lib/documents/grace-hope-types";
import { missingSermonFields, sermonInput } from "./sermon-jobs";

export async function groupSources(churchId: string, month: string) {
  const plans = await prisma.sermonPlan.findMany({ where: { churchId, serviceDate: { gte: new Date(month + "-01T00:00:00Z"), lt: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 1)) } }, orderBy: { updatedAt: "desc" } });
  const sources: GroupSource[] = [], missing: string[] = [];
  for (const date of sundaysInMonth(month)) {
    const plan = plans.find(p => p.serviceDate.toISOString().slice(0, 10) === date);
    const source = plan && await completedWorshipSource(churchId, plan);
    if (source) sources.push({ date, title: source.sermonTitle, series: source.series, scripture: source.secondScriptureLesson, remarks: source.sermonRemarks, sermon: source.sermon, basis: "completed" });
    else if (plan && !missingSermonFields(sermonInput(plan)).length) {
      const input = sermonInput(plan);
      sources.push({ date, title: input.sermonTitle, series: input.series, scripture: input.secondScriptureLesson, remarks: input.sermonRemarks, sermon: null, basis: "calendar" });
    } else missing.push(date);
  }
  return { sources, missing };
}
const infoOf = (d: { inputJson: string | null }) => JSON.parse(d.inputJson || "{}");
export function groupSummary(d: { id: string; status: string; inputJson: string | null }) {
  const info = infoOf(d);
  return { id: d.id, status: d.status, progress: info.progress, error: info.error || null, retryAt: info.retryAt || null, month: info.month, audience: info.audience };
}
export async function latestGroup(churchId: string, month: string, audience: GroupAudience) {
  // Only lightweight metadata is needed to find the latest matching guide.
  return prisma.documentRequest.findFirst({ where: { churchId, id: { startsWith: "gracehope_" }, title: `Grace and Hope ${month} ${audience}` }, orderBy: { createdAt: "desc" }, select: { id: true, status: true, inputJson: true } });
}
export async function startGroup(churchId: string, month: string, audience: GroupAudience, regenerate = false) {
  const { sources, missing } = await groupSources(churchId, month);
  if (missing.length) throw new Error("Complete the sermon calendar information for " + missing.join(", ") + " before preparing this month’s guide.");
  const signature = createHash("sha256").update(JSON.stringify({ churchId, month, audience, sources, version: GROUP_DISCUSSION_VERSION })).digest("hex");
  const latest = await latestGroup(churchId, month, audience);
  if (latest && (latest.status === "running" || latest.status === "queued" || (!regenerate && infoOf(latest).signature === signature))) return latest;
  const records = await prisma.documentRequest.findMany({ where: { churchId, id: { startsWith: "gracehope_" } }, select: { inputJson: true }, orderBy: { createdAt: "desc" }, take: 120 });
  const history = records.flatMap(r => { const a = infoOf(r).activity; return a ? [a] : []; });
  const state: GroupState = { month, audience, annualTheme: month.startsWith("2026-") ? "Living a Life with Purpose" : "", sources, history, phase: "draft", reviews: [], repairs: 0 };
  const id = "gracehope_" + (regenerate ? randomUUID() : signature.slice(0, 40));
  return prisma.documentRequest.upsert({ where: { id }, update: {}, create: { id, churchId, title: `Grace and Hope ${month} ${audience}`, status: "queued", inputJson: JSON.stringify({ month, audience, signature, progress: "Preparing the monthly discussion guide." }), generatedBody: JSON.stringify(state) } });
}
export async function runGroupStep(id: string, churchId: string) {
  const initial = await prisma.documentRequest.findFirst({ where: { churchId, id: { equals: id, startsWith: "gracehope_" } } });
  if (!initial || initial.status === "generated") return;
  const info = infoOf(initial);
  if ((info.retryAt || 0) > Date.now()) return;
  const claim = await prisma.documentRequest.updateMany({ where: { id, churchId, updatedAt: initial.updatedAt, OR: [{ status: "queued" }, { status: "needs_attention" }, { status: "running", updatedAt: { lt: new Date(Date.now() - 300000) } }] }, data: { status: "running" } });
  if (!claim.count) return;
  const locked = await prisma.documentRequest.findUniqueOrThrow({ where: { id }, select: { updatedAt: true } });
  const state: GroupState = JSON.parse(initial.generatedBody!);
  try {
    info.steps = (info.steps || 0) + 1;
    await advanceGroup(state);
    if (state.phase === "complete") createGroupDocx(state);
    info.progress = state.phase === "complete" ? "Monthly Word guide ready." : state.phase === "scripture" ? "Verifying the Bible passages." : state.phase === "review" ? state.repairs ? "Refining wording after the two content reviews." : `Reviewing the guide. ${Math.min(state.reviews.length, 2)} of 2 checks complete.` : "Preparing the guide.";
    info.failures = 0; info.error = null; info.retryAt = null;
    if (state.content) info.activity = { title: state.content.activity.title, method: state.content.activity.method, instructions: state.content.activity.instructions };
    await prisma.documentRequest.updateMany({ where: { id, churchId, updatedAt: locked.updatedAt, status: "running" }, data: { status: state.phase === "complete" ? "generated" : "queued", inputJson: JSON.stringify(info), generatedBody: JSON.stringify(state) } });
  } catch (error) {
    const retry = retryWorship(error, (info.failures || 0) + 1);
    info.failures = (info.failures || 0) + 1;
    info.error = retry.message; info.retryAt = Date.now() + retry.delay;
    // Editorial revisions and temporary API failures retain their progress and retry automatically.
    // Only a configuration or billing problem is marked for attention, and the client keeps
    // checking it so the guide continues as soon as the issue is resolved.
    const blocked = retry.blocked;
    info.progress = blocked ? "Preparation needs attention. Saved progress is retained." : "Retrying the saved step.";
    await prisma.documentRequest.updateMany({ where: { id, churchId, updatedAt: locked.updatedAt, status: "running" }, data: { status: blocked ? "needs_attention" : "queued", inputJson: JSON.stringify(info), generatedBody: JSON.stringify(state) } });
  }
}
