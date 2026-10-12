import { after } from "next/server";
import { z } from "zod";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { ok, fail, handleRouteError } from "@/lib/api";
import { groupAudience, groupMonth } from "@/lib/documents/grace-hope-types";
import { groupSources, groupSummary, latestGroup, runGroupStep, startGroup } from "@/server/services/assistant/grace-hope-jobs";

export const maxDuration = 300;
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { churchId } = await requireAuthContext();
    const query = new URL(request.url).searchParams;
    if (query.has("id")) {
      const d = await prisma.documentRequest.findFirst({ where: { churchId, id: { equals: query.get("id")!, startsWith: "gracehope_" } }, select: { id: true, status: true, inputJson: true } });
      if (!d) return fail("Guide not found.", 404);
      return ok({ job: groupSummary(d) }, { headers: { "Cache-Control": "no-store" } });
    }
    const month = groupMonth.parse(query.get("month")), audience = groupAudience.parse(query.get("audience") || "mixed");
    const [{ sources, missing }, job] = await Promise.all([groupSources(churchId, month), latestGroup(churchId, month, audience)]);
    return ok({ sources: sources.map(s => ({ date: s.date, title: s.title, basis: s.basis })), missing, job: job ? groupSummary(job) : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleRouteError(error); }
}
export async function POST(request: Request) {
  try {
    const { churchId } = await requireAuthContext();
    const body = await request.json();
    let d;
    if (body.id) {
      const { id, retry } = z.object({ id: z.string().startsWith("gracehope_"), retry: z.boolean().optional() }).parse(body);
      d = await prisma.documentRequest.findFirst({ where: { id, churchId } });
      if (!d) return fail("Guide not found.", 404);
      if (retry && d.status === "needs_attention") {
        const info = JSON.parse(d.inputJson || "{}"); info.failures = 0; info.steps = 0; info.retryAt = null;
        const state = JSON.parse(d.generatedBody!); state.repairs = 0;
        d = await prisma.documentRequest.update({ where: { id }, data: { status: "queued", inputJson: JSON.stringify(info), generatedBody: JSON.stringify(state) } });
      }
    } else {
      const input = z.object({ month: groupMonth, audience: groupAudience, regenerate: z.boolean().optional() }).parse(body);
      d = await startGroup(churchId, input.month, input.audience, input.regenerate);
    }
    if (d.status !== "generated") after(() => runGroupStep(d!.id, churchId));
    return ok({ job: groupSummary(d) });
  } catch (error) { return handleRouteError(error); }
}
