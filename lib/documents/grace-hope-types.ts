import { z } from "zod";

export const groupAudience = z.enum(["mixed", "women", "men"]);
export type GroupAudience = z.infer<typeof groupAudience>;
export const groupMonth = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
const text = z.string().trim().min(1).max(3500);
export const groupContent = z.object({
  openingPrayer: text,
  activity: z.object({ title: text, method: text, minutes: z.number().int().min(3).max(10), instructions: z.array(text).min(2).max(5), connection: text }),
  readingReferences: z.array(text).min(1).max(5),
  introduction: text,
  truths: z.array(z.object({ title: text, sermonDates: z.array(z.string()).min(1), references: z.array(text).min(1).max(3), explanation: text, application: text, questions: z.array(text).min(1).max(2) })).min(3).max(5),
  finalQuestion: text,
  closingLeader: text,
  closingPrayer: text,
});
export type GroupContent = z.infer<typeof groupContent>;
export type GroupSource = { date: string; title: string; series: string; scripture: string; remarks: string; sermon: unknown; basis?: "completed" | "calendar" };
export type GroupState = {
  month: string; audience: GroupAudience; annualTheme: string; sources: GroupSource[];
  history: { title: string; method: string; instructions: string[] }[];
  content?: GroupContent;
  scriptures?: Record<string, { reference: string; text: string; source: string }[]>;
  reviews: string[]; phase: "draft" | "scripture" | "review" | "complete";
  repairs: number;
};

export const avoidedWords = ["can", "may", "just", "that", "very", "really", "literally", "actually", "certainly", "probably", "basically", "could", "maybe", "delve", "embark", "enlightening", "esteemed", "shed light", "craft", "crafting", "imagine", "realm", "game-changer", "unlock", "discover", "skyrocket", "abyss", "not alone", "in a world where", "revolutionize", "disruptive", "utilize", "utilizing", "dive deep", "tapestry", "illuminate", "unveil", "pivotal", "intricate", "elucidate", "hence", "furthermore", "however", "harness", "exciting", "groundbreaking", "cutting-edge", "remarkable", "it", "remains to be seen", "glimpse into", "navigating", "landscape", "stark", "testament", "in summary", "in conclusion", "moreover", "boost", "skyrocketing", "opened up", "powerful", "inquiries", "ever-evolving"];

export function groupIssues(content: GroupContent, sources: GroupSource[], history: GroupState["history"]) {
  const prose = [content.openingPrayer, content.activity.title, ...content.activity.instructions, content.activity.connection, content.introduction,
    ...content.truths.flatMap(t => [t.title, t.explanation, t.application, ...t.questions]), content.finalQuestion, content.closingLeader, content.closingPrayer].join("\n");
  const issues: string[] = [];
  if (/[—;*#]/.test(prose)) issues.push("Remove em dashes, semicolons, asterisks and hashtags from authored prose.");
  const found = avoidedWords.filter(word => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(prose));
  if (found.length) issues.push("Rewrite authored prose without: " + found.join(", "));
  const offendingSentences = prose.split(/(?<=[.!?])\s+|\n/).filter(sentence => /[—;*#]/.test(sentence) || found.some(word => new RegExp(`\\b${word}\\b`, "i").test(sentence)));
  if (offendingSentences.length) issues.push("Rewrite these specific sentences completely while preserving meaning: " + JSON.stringify(offendingSentences));
  const covered = new Set(content.truths.flatMap(t => t.sermonDates));
  const missing = sources.filter(s => !covered.has(s.date));
  if (missing.length) issues.push("Add substantial teaching for the omitted sermon(s): " + missing.map(s => `${s.date} ${s.title}, ${s.scripture}, ${s.remarks}`).join(" | "));
  if ([...covered].some(date => !sources.some(s => s.date === date))) issues.push("Use only the supplied sermon dates.");
  const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  if (history.some(h => normalized(h.title) === normalized(content.activity.title) || normalized(h.method) === normalized(content.activity.method))) issues.push("Replace the opening activity with a different method, not a renamed previous activity.");
  return issues;
}
