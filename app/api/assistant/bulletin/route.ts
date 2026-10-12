import { z } from "zod";
import { requireAuthContext } from "@/lib/auth";
import { ok, handleRouteError } from "@/lib/api";
import { prisma } from "@/lib/db/prisma";
import { musicMissing } from "@/lib/worship-music";
import { syncCurrentSundays } from "@/server/services/assistant/calendar-store";
import { completedWorshipSource } from "@/server/services/assistant/worship-jobs";

export async function GET(request: Request) {
  try {
    const { churchId } = await requireAuthContext();
    const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional().parse(new URL(request.url).searchParams.get("month") || undefined);
    const current = await syncCurrentSundays(churchId, undefined, month);
    const plans = await prisma.sermonPlan.findMany({ where: { churchId, serviceDate: { gte: new Date(current.month + "-01T00:00:00Z"), lt: new Date(Date.UTC(Number(current.month.slice(0, 4)), Number(current.month.slice(5)), 1)) } } });
    const rows = await Promise.all(current.sundays.map(async serviceDate => {
      const plan = plans.find(item => item.serviceDate.toISOString().slice(0, 10) === serviceDate);
      if (!plan) return { id: "missing-" + serviceDate, serviceDate, title: "Awaiting calendar information", ready: false, missing: "Import this Sunday’s sermon calendar information first." };
      const source = await completedWorshipSource(churchId, plan);
      const missing = !source ? "Complete this Sunday’s sermon PowerPoint first." : musicMissing(source.music).length ? `Upload music for ${serviceDate}. Missing: ${musicMissing(source.music).join(", ")}.` : "";
      return { id: plan.id, serviceDate, title: plan.title, ready: !missing, missing };
    }));
    return ok(rows, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleRouteError(error); }
}
