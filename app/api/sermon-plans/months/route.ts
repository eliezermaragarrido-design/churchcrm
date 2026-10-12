import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { ok, handleRouteError } from "@/lib/api";
import { currentChurchMonth } from "@/lib/current-sermon-month";
import { calendarSourceId } from "@/server/services/assistant/calendar-store";
export async function GET() {
  try {
    const { churchId } = await requireAuthContext();
    const source = await prisma.documentRequest.findFirst({ where: { id: calendarSourceId(churchId), churchId }, select: { generatedBody: true, inputJson: true } });
    const saved = JSON.parse(source?.generatedBody || "{}");
    const mappings = JSON.parse(source?.inputJson || "{}").monthMappings || {};
    const current = currentChurchMonth();
    const months = [...new Set<string>([current, ...Object.keys(mappings), ...(saved.plans || []).filter((plan: {serviceDate:string}) => new Date(plan.serviceDate).getUTCDay() === 0).map((plan: {serviceDate:string}) => plan.serviceDate.slice(0, 7))])].sort();
    const plans = await prisma.sermonPlan.findMany({
      where: { churchId },
      orderBy: { serviceDate: "asc" },
      select: { serviceDate: true, title: true, series: true, secondScriptureLesson: true },
    });
    const entries = plans.filter(plan => plan.serviceDate.getUTCDay() === 0).map(plan => ({
      serviceDate: plan.serviceDate.toISOString().slice(0, 10), title: plan.title,
      series: plan.series || "", scripture: plan.secondScriptureLesson || "",
    }));
    return ok({ months, preferredMonth: months.includes(saved.preferredMonth) ? saved.preferredMonth : current, entries }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleRouteError(error); }
}
