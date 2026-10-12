import { z } from "zod";
import type { MusicPlan } from "@/lib/worship-music";

export const worshipSections = ["welcome", "invocation", "children", "pastoral", "offertory", "benediction"] as const;
export type WorshipSection = typeof worshipSections[number];
export const worshipText = z.object({ paragraphs: z.array(z.string().trim().min(1).max(6000)).min(1).max(20) });
export type WorshipText = z.infer<typeof worshipText>;
export type WorshipSource = {
  sermonId: string; planId: string; serviceDate: string; sermonTitle: string; series: string;
  firstScriptureLesson: string; secondScriptureLesson: string; sermonRemarks: string;
  sermon: unknown;
  music?: MusicPlan;
};
export type WorshipState = {
  source: WorshipSource; communion: boolean;
  freshness?: { corrections?: Partial<Record<WorshipSection, string>>; history: { date: string; psalm?: string; sections: Partial<Record<WorshipSection, WorshipText>> }[] };
  welcomePsalm?: { reference: string; text: string; source: string }[];
  reading?: { reference: string; text: string; source: string }[];
  sections: Partial<Record<WorshipSection, { text: WorshipText; reviews: { focus: string; assessment: string; text: WorshipText }[] }>>;
};
export function firstSunday(date: string) {
  const day = new Date(date + "T12:00:00Z");
  return day.getUTCDay() === 0 && day.getUTCDate() <= 7;
}
export function worshipComplete(state: WorshipState) {
  return !!state.reading?.length && (!state.freshness || !!state.welcomePsalm?.length) && worshipSections.every(key => {
    const section = state.sections[key];
    return section?.reviews.length === 5 && worshipText.safeParse(section.text).success;
  });
}
