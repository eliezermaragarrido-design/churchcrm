import { createHash } from "node:crypto";
import type { SermonPlan } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { openAIBillingMessage } from "@/lib/openai-errors";
import { sermonRetry } from "./sermon-retry";
import { createSermonPreparation, type SermonPreparationInput } from "./service";
import { createSermonPowerPoint } from "@/lib/presentations/sermon-pptx";
import { sermonPowerPointPath, storePrivateDocument } from "@/lib/documents/private-download";

const POWERPOINT_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function removeCompletedIllustrations(checkpoint: any) {
  const deck = checkpoint?.deck || checkpoint;
  if (!deck || typeof deck !== "object") return checkpoint;
  // The final PPTX already contains these images. Keeping their base64 payloads
  // in Postgres makes every later status read unnecessarily expensive.
  delete deck.assets;
  delete deck.imageReviews;
  delete deck.imageCheckpoint;
  return checkpoint;
}

export function sermonInput(plan: SermonPlan): SermonPreparationInput {
  return {
    planId: plan.id, serviceDate: plan.serviceDate.toISOString().slice(0, 10),
    series: plan.series || plan.theme || "",
    firstScriptureLesson: plan.firstScriptureLesson || "",
    secondScriptureLesson: plan.secondScriptureLesson || plan.scriptureReference,
    sermonTitle: plan.title, sermonRemarks: plan.sermonRemarks || plan.mainIdea || "",
  };
}

export function missingSermonFields(input: SermonPreparationInput) {
  return ([['series', 'series title'], ['secondScriptureLesson', 'Second Scripture Lesson'], ['sermonTitle', 'sermon title'], ['sermonRemarks', 'sermon remarks']] as const)
    .filter(([key]) => !input[key].trim() || input[key] === "To be reviewed" || input[key] === "Untitled sermon")
    .map(([, label]) => label);
}

export function sermonJobId(churchId: string, input: SermonPreparationInput) {
  return "sermon_" + createHash("sha256").update(JSON.stringify({ churchId, input, version: 10 })).digest("hex").slice(0, 40);
}

export function jobSummary(document: { id: string; status: string; inputJson: string | null; updatedAt: Date }) {
  const info = JSON.parse(document.inputJson || "{}");
  const interrupted = document.status === "running" && Date.now() - document.updatedAt.getTime() > 6 * 60_000;
  const error = String(info.error || "");
  const permanent = /billing quota|no credits|credit_balance_exhausted|not configured|model is unavailable|unauthorized/i.test(error);
  const automaticRecovery = document.status === "needs_attention" && !permanent;
  return { id: document.id, status: interrupted || automaticRecovery ? "queued" : document.status,
    progress: interrupted || automaticRecovery ? "Recovering the complete sermon automatically…" : info.progress,
    retryAt: automaticRecovery ? null : info.retryAt || null, error: permanent ? error : null };
}

export async function runSermonStep(documentId: string, churchId: string) {
  const document = await prisma.documentRequest.findFirstOrThrow({ where: { id: documentId, churchId } });
  const info = JSON.parse(document.inputJson!);
  try {
    const result = await createSermonPreparation(churchId, info.input, {
      checkpoint: document.generatedBody ? JSON.parse(document.generatedBody) : undefined,
      save: async (checkpoint, progress) => {
        info.progress = progress; info.hasDraft = true; info.error = null;
        await prisma.documentRequest.update({ where: { id: documentId }, data: {
          generatedBody: JSON.stringify(checkpoint), inputJson: JSON.stringify(info),
        } });
      },
    });
    info.failures = 0; info.retryAt = null; info.error = null;
    if (result.complete && process.env.VERCEL) {
      const finished = await prisma.documentRequest.findUniqueOrThrow({ where: { id: documentId }, select: { generatedBody: true } });
      const checkpoint = JSON.parse(finished.generatedBody || "{}");
      const deck = checkpoint.deck || checkpoint;
      const powerpoint = await createSermonPowerPoint(deck);
      await storePrivateDocument(sermonPowerPointPath(churchId, documentId), POWERPOINT_CONTENT_TYPE, powerpoint);
      await prisma.documentRequest.update({ where: { id: documentId }, data: {
        status: "generated", inputJson: JSON.stringify(info), generatedBody: JSON.stringify(removeCompletedIllustrations(checkpoint)),
      } });
    } else {
      await prisma.documentRequest.update({ where: { id: documentId }, data: { status: result.complete ? "generated" : "queued", inputJson: JSON.stringify(info) } });
    }
  } catch (error) {
    info.error = openAIBillingMessage(error) || (error instanceof Error ? error.message : "Preparation was interrupted.");
    info.failures = (info.failures || 0) + 1;
    const recovery = sermonRetry(error, info.failures);
    info.retryAt = recovery.retryAt;
    info.errorHistory = [...(info.errorHistory || []), { at: new Date().toISOString(), message: info.error }].slice(-12);
    info.progress = recovery.retry ? "Recovering the complete sermon automatically. Saved work will be reused."
      : "Preparation needs service attention: " + info.error;
    await prisma.documentRequest.update({ where: { id: documentId }, data: { status: recovery.retry ? "queued" : "needs_attention", inputJson: JSON.stringify(info) } });
  }
}
