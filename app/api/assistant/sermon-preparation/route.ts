import { syncCurrentSundays } from "@/server/services/assistant/calendar-store";
import { after } from "next/server";
import { z } from "zod";
import { ok, fail, handleRouteError } from "@/lib/api";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { jobSummary, missingSermonFields, runSermonStep, sermonInput, sermonJobId } from "@/server/services/assistant/sermon-jobs";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { churchId } = await requireAuthContext();
    const { month, sundays } = await syncCurrentSundays(churchId, undefined, z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional().parse(new URL(request.url).searchParams.get("month") || undefined));
    const candidates = await prisma.sermonPlan.findMany({ where: { churchId, serviceDate: { gte: new Date(month + "-01T00:00:00Z"), lt: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 1)) } }, orderBy: { updatedAt: "desc" } });
    const plans = sundays.map(date => candidates.find(plan => plan.serviceDate.toISOString().slice(0, 10) === date)).filter((plan): plan is NonNullable<typeof plan> => !!plan);
    const jobs = await prisma.documentRequest.findMany({ where: { churchId, id: { in: plans.map(plan => sermonJobId(churchId, sermonInput(plan))) } }, select: { id: true, status: true, inputJson: true, updatedAt: true } });
    return ok(sundays.map(date => {
      const plan = plans.find(item => item.serviceDate.toISOString().slice(0, 10) === date);
      if (!plan) return { id: "missing-" + date, serviceDate: date, title: "Awaiting calendar information", series: "", scripture: "", missing: ["calendar entry for " + date], job: null };
      const input = sermonInput(plan);
      const job = jobs.find(item => item.id === sermonJobId(churchId, input));
      return { id: plan.id, serviceDate: input.serviceDate, title: input.sermonTitle, series: input.series,
        scripture: input.secondScriptureLesson, missing: missingSermonFields(input), job: job ? jobSummary(job) : null };
    }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const { churchId } = await requireAuthContext();
    const { planId, regenerate } = z.object({ planId: z.string().min(1), regenerate: z.boolean().optional().default(false) }).parse(await request.json());
    const plan = await prisma.sermonPlan.findFirst({ where: { id: planId, churchId } });
    if (!plan) return fail("Sermon plan not found.", 404);
    const input = sermonInput(plan);
    const missing = missingSermonFields(input);
    if (missing.length) return fail(`Complete ${missing.join(", ")} in the Excel calendar and import it again.`, 422);
    const id = sermonJobId(churchId, input);
    let current = await prisma.documentRequest.findUnique({ where: { id } });
    if (current?.status === "generated" && regenerate) {
      current = await prisma.documentRequest.update({ where: { id }, data: {
        status: "queued", generatedBody: null,
        inputJson: JSON.stringify({ planId, input, outputType: "pptx", progress: "Preparing a new sermon and verifying NIV readings.", hasDraft: false }),
      } });
    } else if (!current) current = await prisma.documentRequest.create({ data: {
      id, churchId, title: `${input.serviceDate} ${input.sermonTitle}`, status: "queued",
      inputJson: JSON.stringify({ planId, input, outputType: "pptx", progress: "Preparing sermon content and verifying NIV readings.", hasDraft: false }),
    } });
    if (JSON.parse(current.inputJson || "{}").retryAt > Date.now()) return ok(jobSummary(current), { status: 202 });
    const claim = await prisma.documentRequest.updateMany({ where: { id, churchId, OR: [
      { status: { in: ["queued", "needs_attention"] } },
      { status: "running", updatedAt: { lt: new Date(Date.now() - 6 * 60_000) } },
    ] }, data: { status: "running" } });
    if (claim.count) after(() => runSermonStep(id, churchId));
    const document = await prisma.documentRequest.findUniqueOrThrow({ where: { id }, select: { id: true, status: true, inputJson: true, updatedAt: true } });
    return ok(jobSummary(document), { status: document.status === "generated" ? 200 : 202 });
  } catch (error) { return handleRouteError(error); }
}
