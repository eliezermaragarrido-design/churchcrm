import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { currentChurchMonth, sundaysInMonth } from "@/lib/current-sermon-month";
import { parseSermonCalendar } from "@/lib/sermon-calendar";

type CalendarPlan = ReturnType<typeof parseSermonCalendar>[number];
export const calendarSourceId = (churchId: string) => "calendar_" + createHash("sha256").update(churchId).digest("hex").slice(0, 32);

export function applyCalendarMappings(plans: CalendarPlan[], mappings: Record<string, string>) {
  const result = [...plans];
  for (const [targetMonth, sourceMonth] of Object.entries(mappings)) {
    const targets = sundaysInMonth(targetMonth);
    const sources = sundaysInMonth(sourceMonth).map(date => plans.find(plan => new Date(plan.serviceDate).toISOString().slice(0, 10) === date));
    targets.forEach((date, index) => {
      const source = sources[index];
      if (!source || result.some(plan => new Date(plan.serviceDate).toISOString().slice(0, 10) === date)) return;
      result.push({ ...source, serviceDate: new Date(date + "T12:00:00Z"), raw: `User-approved reassignment from ${new Date(source.serviceDate).toISOString().slice(0, 10)} to ${date}. ${source.raw}` });
    });
  }
  return result;
}

export async function syncCurrentSundays(churchId: string, sourcePlans?: CalendarPlan[], requestedMonth?: string) {
  const source = await prisma.documentRequest.findFirst({ where: { id: calendarSourceId(churchId), churchId }, select: { generatedBody: true, inputJson: true } });
  sourcePlans ||= source?.generatedBody ? JSON.parse(source.generatedBody).plans : [];
  const mappings = source?.inputJson ? JSON.parse(source.inputJson).monthMappings || {} : {};
  const savedPreference = source?.generatedBody ? JSON.parse(source.generatedBody).preferredMonth : undefined;
  const month = requestedMonth || savedPreference || currentChurchMonth();
  const sundays = sundaysInMonth(month);
  const matching = applyCalendarMappings(sourcePlans!, mappings).filter(plan => sundays.includes(new Date(plan.serviceDate).toISOString().slice(0, 10)));
  const existing = await prisma.sermonPlan.findMany({ where: { churchId, serviceDate: { gte: new Date(month + "-01T00:00:00Z"), lt: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 1)) } }, orderBy: { updatedAt: "desc" } });
  const operations = [];
  let imported = 0, updated = 0;
  for (const plan of matching) {
    const date = new Date(plan.serviceDate).toISOString().slice(0, 10);
    const old = existing.find(item => item.serviceDate.toISOString().slice(0, 10) === date);
    const data = { title: plan.title, series: plan.series || null, scriptureReference: plan.scriptureReference,
      firstScriptureLesson: plan.firstScriptureLesson || null, secondScriptureLesson: plan.secondScriptureLesson || null,
      sermonRemarks: plan.sermonRemarks || null, mainIdea: plan.mainIdea || null, pastorNotes: plan.raw };
    if (old && Object.entries(data).every(([key, value]) => (old as any)[key] === value)) continue;
    const id = old?.id || "sunday_" + createHash("sha256").update(churchId + date).digest("hex").slice(0, 32);
    operations.push(prisma.sermonPlan.upsert({ where: { id }, create: { id, churchId, serviceDate: new Date(date + "T12:00:00Z"), ...data, status: "imported" }, update: data }));
    if (old) updated++; else imported++;
  }
  // At most five Sunday writes. No long interactive transaction over historical sheets.
  if (operations.length) await prisma.$transaction(operations);
  return { month, sundays, imported, updated, matched: matching.length };
}
