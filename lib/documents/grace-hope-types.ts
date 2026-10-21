import { z } from "zod";

export const groupAudience = z.enum(["mixed", "women", "men"]);
export type GroupAudience = z.infer<typeof groupAudience>;
export const groupMonth = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
const text = z.string().trim().min(1).max(3500);
export const GROUP_DISCUSSION_VERSION = 2;

// The Word renderer owns these cues. Strip copies produced from old examples,
// including inline labels and typographical dash variants, from authored prose only.
export function stripGroupReflectionCues(value: string) {
  return value
    .replace(/\bSTOP[\s,\-–—]*THINK[\s,\-–—]*MEDITATE\b\s*:?\s*(?:\(?\s*30\s*(?:to|[-–—])\s*60\s*seconds?\s*\)?\s*\.?)?/gi, "")
    .replace(/\bThen\s+share\s*:\s*/gi, "")
    .replace(/(^|\n)\s*Then\s+share\s*[.!]?\s*(?=\n|$)/gi, "$1")
    .replace(/\n{3,}/g, "\n\n").trim();
}
const authoredText = text.transform(stripGroupReflectionCues).pipe(text);
const questionText = text.transform(stripGroupReflectionCues);
const questions = z.array(questionText).min(1).max(2).transform(items => items.filter(Boolean)).pipe(z.array(text).min(1).max(2));

export function groupQuestionIssue(question: string) {
  if ((question.match(/\?/g) || []).length !== 1 || !question.trim().endsWith("?")) return "Ask one complete question with one question mark.";
  if (question.trim().split(/\s+/).length > 22) return "Shorten the question to at most 22 everyday words.";
  if (!/^(what|how|which|when|where|who)\b/i.test(question)) return "Ask an open question inviting a personal response, not yes or no.";
  if (/\b(?:and|or)\s+(?:what|how|why|which|when|where|who)\b/i.test(question)) return "Ask about one thing, without a second question or follow-up.";
  return null;
}
export const groupContent = z.object({
  openingPrayer: authoredText,
  activity: z.object({ title: text, method: text, minutes: z.number().int().min(3).max(10), instructions: z.array(text).min(2).max(5), connection: text }),
  readingReferences: z.array(text).min(1).max(5),
  introduction: authoredText,
  truths: z.array(z.object({ title: authoredText, sermonDates: z.array(z.string()).min(1), references: z.array(text).min(1).max(3), explanation: authoredText, application: authoredText, questions })).min(3).max(5),
  finalQuestion: authoredText,
  closingLeader: authoredText,
  closingPrayer: authoredText,
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
  discussionVersion?: number;
};

export const avoidedWords = ["can", "may", "just", "that", "very", "really", "literally", "actually", "certainly", "probably", "basically", "could", "maybe", "delve", "embark", "enlightening", "esteemed", "shed light", "craft", "crafting", "imagine", "realm", "game-changer", "unlock", "discover", "skyrocket", "abyss", "not alone", "in a world where", "revolutionize", "disruptive", "utilize", "utilizing", "dive deep", "tapestry", "illuminate", "unveil", "pivotal", "intricate", "elucidate", "hence", "furthermore", "however", "harness", "exciting", "groundbreaking", "cutting-edge", "remarkable", "it", "remains to be seen", "glimpse into", "navigating", "landscape", "stark", "testament", "in summary", "in conclusion", "moreover", "boost", "skyrocketing", "opened up", "powerful", "inquiries", "ever-evolving"];

export function groupIssues(content: GroupContent, sources: GroupSource[], history: GroupState["history"], checkDiscussion = true) {
  const prose = [content.openingPrayer, content.activity.title, ...content.activity.instructions, content.activity.connection, content.introduction,
    ...content.truths.flatMap(t => [t.title, t.explanation, t.application, ...t.questions]), content.finalQuestion, content.closingLeader, content.closingPrayer].join("\n");
  const issues: string[] = [];
  if (checkDiscussion) {
    content.truths.forEach((truth, i) => {
      if (truth.questions.length !== 1) issues.push(`Section ${i + 1}: include exactly one discussion question.`);
      truth.questions.forEach(q => { const issue = groupQuestionIssue(q); if (issue) issues.push(`Section ${i + 1}: ${issue}`); });
    });
    const finalIssue = groupQuestionIssue(content.finalQuestion);
    if (finalIssue) issues.push(`Final group question: ${finalIssue}`);
  }
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
