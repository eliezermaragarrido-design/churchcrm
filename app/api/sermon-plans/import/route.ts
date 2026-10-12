import { parseSermonCalendar, activeCalendarMonth } from "@/lib/sermon-calendar";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db/prisma";
import { requireAuthContext } from "@/lib/auth";
import { calendarSourceId, syncCurrentSundays } from "@/server/services/assistant/calendar-store";

export async function POST(request: Request) {
  try {
    const { churchId } = await requireAuthContext();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !/\.(xlsx|xls)$/i.test(file.name)) return NextResponse.json({ error: "Upload an .xlsx or .xls file." }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(bytes, { cellDates: true });
    const plans = parseSermonCalendar(workbook);
    if (!plans.length) return NextResponse.json({ error: "No dated sermon plans found in this workbook." }, { status: 422 });
    const source = { title: file.name, generatedBody: JSON.stringify({ plans, preferredMonth: activeCalendarMonth(bytes, workbook, plans) }), status: "calendar_source" };
    await prisma.documentRequest.upsert({ where: { id: calendarSourceId(churchId) }, create: { id: calendarSourceId(churchId), churchId, ...source }, update: source });
    const result = await syncCurrentSundays(churchId, plans);
    return NextResponse.json({ data: { ...result, totalSundays: result.sundays.length, sourcePlans: plans.length, sheets: workbook.SheetNames } }, { status: 201 });
  } catch (error) {
    console.error("Sermon calendar import failed", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "The calendar could not be saved. Please retry the import. Your existing sermon plans have been kept." }, { status: 503 });
  }
}
