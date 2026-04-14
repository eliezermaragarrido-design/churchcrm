import { z } from "zod";

export const assistantDocumentSchema = z.object({
  title: z.string().min(1),
  templateName: z.string().min(1),
  memberId: z.string().optional(),
  promptInput: z.record(z.string(), z.string()).default({}),
});

export const assistantSummarySchema = z.object({
  title: z.string().min(1),
  notesPrompt: z.string().min(1),
});

export type AssistantDocumentInput = z.infer<typeof assistantDocumentSchema>;
export type AssistantSummaryInput = z.infer<typeof assistantSummarySchema>;
