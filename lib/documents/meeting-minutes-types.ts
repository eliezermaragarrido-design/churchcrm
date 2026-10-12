import { z } from "zod";
import { avoidedWords } from "./grace-hope-types";

const text = z.string().trim().min(1).max(4000);
export const meetingMinutes = z.object({
  meetingDate: z.string().trim().max(120).optional(),
  attendees: z.array(text).max(100),
  summary: z.array(text).min(1).max(20),
  decisions: z.array(text).max(40),
  actionItems: z.array(z.object({ task: text, owner: z.string().trim().max(200), dueDate: z.string().trim().max(120) })).max(60),
  keyPoints: z.array(text).max(50),
  followUps: z.array(text).max(40),
});
export type MeetingMinutes = z.infer<typeof meetingMinutes>;

export function minutesIssues(value: MeetingMinutes) {
  const prose = [value.meetingDate || "", ...value.attendees, ...value.summary, ...value.decisions, ...value.keyPoints, ...value.followUps, ...value.actionItems.flatMap(item => [item.task, item.owner, item.dueDate])].join("\n");
  const issues: string[] = [];
  if (/[—;*#]/.test(prose)) issues.push("Remove em dashes, semicolons, asterisks and hashtags.");
  const found = avoidedWords.filter(word => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "i").test(prose));
  if (found.length) issues.push("Rewrite without: " + found.join(", "));
  return issues;
}
