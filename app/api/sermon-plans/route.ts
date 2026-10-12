import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAuthContext } from "@/lib/auth";

const sermonPlanSchema = z.object({
  serviceDate: z.string().date(),
  title: z.string().trim().min(1).max(180),
  scriptureReference: z.string().trim().min(1).max(180),
  firstScriptureLesson: z.string().trim().max(180).optional(),
  secondScriptureLesson: z.string().trim().max(180).optional(),
  sermonRemarks: z.string().trim().max(5000).optional(),
  series: z.string().trim().max(180).optional(),
  theme: z.string().trim().max(500).optional(),
  mainIdea: z.string().trim().max(1000).optional(),
  serviceTime: z.string().trim().max(80).optional(),
  location: z.string().trim().max(180).optional(),
  language: z.enum(["English", "Spanish", "Bilingual"]).default("English"),
  pastorNotes: z.string().trim().max(10000).optional(),
});

export async function GET() {
  const auth = await requireAuthContext();
  const plans = await prisma.sermonPlan.findMany({ where: { churchId: auth.churchId }, orderBy: { serviceDate: "desc" }, take: 24 });
  return NextResponse.json({ data: plans });
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthContext();
    const input = sermonPlanSchema.parse(await request.json());
    const plan = await prisma.sermonPlan.create({
      data: {
        churchId: auth.churchId,
        serviceDate: new Date(`${input.serviceDate}T12:00:00.000Z`),
        title: input.title,
        scriptureReference: input.scriptureReference,
        firstScriptureLesson: input.firstScriptureLesson || null,
        secondScriptureLesson: input.secondScriptureLesson || null,
        sermonRemarks: input.sermonRemarks || null,
        series: input.series || null,
        theme: input.theme || null,
        mainIdea: input.mainIdea || null,
        serviceTime: input.serviceTime || null,
        location: input.location || null,
        language: input.language,
        pastorNotes: input.pastorNotes || null,
      },
    });
    return NextResponse.json({ data: plan }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? error.flatten() : "Could not save sermon plan." }, { status: 400 });
  }
}
