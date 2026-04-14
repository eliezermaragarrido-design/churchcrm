import OpenAI from "openai";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AssistantDocumentInput, AssistantSummaryInput } from "@/lib/validators/assistant";

function getOpenAIClient() {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

export async function createSecretaryDocument(churchId: string, input: AssistantDocumentInput) {
  const client = getOpenAIClient();
  const prompt = `Create a ${input.templateName} for a church office. Use this input: ${JSON.stringify(input.promptInput)}`;

  let generatedBody = `Draft for ${input.templateName}\n\n${JSON.stringify(input.promptInput, null, 2)}`;

  if (client) {
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });

    generatedBody = response.output_text || generatedBody;
  }

  return prisma.documentRequest.create({
    data: {
      churchId,
      memberId: input.memberId || null,
      title: input.title,
      inputJson: JSON.stringify(input.promptInput),
      generatedBody,
      status: "generated",
    },
  });
}

async function uploadToSupabase(folder: string, file: File) {
  const supabase = createSupabaseAdminClient();
  const path = `${folder}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage
    .from(env.SUPABASE_UPLOAD_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || undefined });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(env.SUPABASE_UPLOAD_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function createMeetingSummary(churchId: string, input: AssistantSummaryInput, file: File) {
  const fileUrl = env.SUPABASE_SERVICE_ROLE_KEY ? await uploadToSupabase("meeting-audio", file) : null;

  return prisma.documentRequest.create({
    data: {
      churchId,
      title: input.title,
      inputJson: JSON.stringify({ notesPrompt: input.notesPrompt, fileName: file.name, fileUrl }),
      generatedBody: "Audio uploaded. Transcription and summarization job can now process this file.",
      outputFileUrl: fileUrl,
      status: "queued",
    },
  });
}

export async function createSermonNotes(churchId: string, input: AssistantSummaryInput, file: File) {
  const fileUrl = env.SUPABASE_SERVICE_ROLE_KEY ? await uploadToSupabase("sermon-slides", file) : null;

  return prisma.documentRequest.create({
    data: {
      churchId,
      title: input.title,
      inputJson: JSON.stringify({ notesPrompt: input.notesPrompt, fileName: file.name, fileUrl }),
      generatedBody: "Slides uploaded. Extraction and note-generation job can now process this presentation.",
      outputFileUrl: fileUrl,
      status: "queued",
    },
  });
}
