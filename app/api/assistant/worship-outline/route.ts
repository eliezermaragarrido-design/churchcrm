import { after } from "next/server";
import { z } from "zod";
import { ok, fail, handleRouteError } from "@/lib/api";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { firstSunday } from "@/lib/documents/worship-types";
import { musicMissing } from "@/lib/worship-music";
import { syncCurrentSundays } from "@/server/services/assistant/calendar-store";
import { completedWorshipSource, runWorshipJob, startWorship, worshipId, worshipSummary } from "@/server/services/assistant/worship-jobs";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: Request) {
  try {
    const { churchId } = await requireAuthContext();
    const { month, sundays } = await syncCurrentSundays(churchId, undefined, z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional().parse(new URL(request.url).searchParams.get("month") || undefined));
    const plans = await prisma.sermonPlan.findMany({ where: { churchId, serviceDate: { gte: new Date(month + "-01T00:00:00Z"), lt: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 1)) } }, orderBy: { updatedAt: "desc" } });
    const rows = await Promise.all(sundays.map(async serviceDate => {
      const plan = plans.find(item => item.serviceDate.toISOString().slice(0, 10) === serviceDate);
      if (!plan) return { id: "missing-" + serviceDate, serviceDate, title: "Awaiting calendar information", ready: false, communion: firstSunday(serviceDate), job: null };
      const source = await completedWorshipSource(churchId, plan);
      const jobs = source ? await prisma.documentRequest.findMany({ where: { churchId, id: { in: [worshipId(churchId, source, true), worshipId(churchId, source, false)] } }, orderBy: { createdAt: "desc" } }) : [];
      const job = jobs[0];
      for (const saved of jobs) if (saved.status === "queued" || (saved.status === "running" && Date.now() - saved.updatedAt.getTime() > 180000)) after(() => runWorshipJob(saved.id, churchId));
      const missing = !source ? "Complete this Sunday’s sermon PowerPoint first." : !source.firstScriptureLesson ? "Add this Sunday’s First Scripture Lesson to the sermon calendar." : musicMissing(source.music).length ? `Upload music for ${serviceDate}. Missing: ${musicMissing(source.music).join(", ")}.` : "";
      return { id: plan.id, serviceDate, title: plan.title, firstScriptureLesson: plan.firstScriptureLesson, musicDate: source?.music?.serviceDate, ready: !missing, missing, communion: job ? JSON.parse(job.inputJson!).communion : firstSunday(serviceDate), job: job ? worshipSummary(job) : null, jobs: jobs.map(worshipSummary) };
    }));
    return ok(rows, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleRouteError(error); }
}
export async function POST(request: Request) {
  try {
    const { churchId } = await requireAuthContext();
    const input = z.object({ planId: z.string().min(1), communion: z.boolean(), regenerate: z.boolean().optional().default(false) }).parse(await request.json());
    const plan = await prisma.sermonPlan.findFirst({ where: { id: input.planId, churchId } });
    if (!plan) return fail("Sermon plan not found.", 404);
    const document = await startWorship(churchId, plan, input.communion, input.regenerate);
    // Explicit click after correcting account credentials can resume the same checkpoints.
    if (document.status === "needs_attention") await prisma.documentRequest.updateMany({ where: { id: document.id, churchId, status: "needs_attention" }, data: { status: "queued" } });
    after(() => runWorshipJob(document.id, churchId));
    return ok(worshipSummary(document), { status: document.status === "generated" ? 200 : 202 });
  } catch (error) { return handleRouteError(error); }
}
