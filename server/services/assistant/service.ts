import OpenAI from "openai";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AssistantDocumentInput, AssistantSummaryInput } from "@/lib/validators/assistant";
import { SERMON_MASTER_PROMPT_VERSION, sermonMasterPrompt } from "./sermon-master-prompt";
import { createNivResolver, verifyDeckScriptures } from "@/lib/presentations/niv-scripture";
import { createSermonPowerPoint } from "@/lib/presentations/sermon-pptx";
import { refineFinalPhrase } from "./final-phrase";
import { refineSermonEditorial } from "./sermon-editorial";
import { selectScriptureEmphasis } from "./scripture-emphasis";
import { refineSermonSubstance } from "./sermon-substance";
import { meetingMinutes, minutesIssues, type MeetingMinutes } from "@/lib/documents/meeting-minutes-types";

function getOpenAIClient() {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OpenAI is not configured. Add an API key before generating documents.");
  }

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, ...(process.env.VERCEL ? { timeout: 180000, maxRetries: 0 } : {}) });
  if (process.env.VERCEL) {
    const deadline = Date.now() + 260000;
    for (const [resource, method] of [[client.responses, "create"], [client.images, "generate"]] as const) {
      const target = resource as any;
      const original = target[method].bind(target);
      target[method] = (...args: any[]) => {
        if (deadline - Date.now() < 185000) throw new Error("Continuing saved preparation in the next server request.");
        return original(...args);
      };
    }
  }
  return client;
}

const sermonBulletinPrompt = `Create a short sermon notes handout for people to place inside a church bulletin, keep, and take home.

Read the entire PowerPoint before writing so no numbered sermon point or conclusion is omitted. Preserve the pastor's actual point titles and meaning. Do not invent content or scripture.

Return only this compact structure:
- Sermon title
- Primary scripture
- Big idea in one short sentence
- Every numbered sermon point from the PowerPoint, in the original order. Under each point include only one concise takeaway, the most relevant scripture reference or references, and one brief practical application.
- Conclusion in one or two short sentences, preserving the pastor's final emphasis.

Keep the complete handout between 250 and 350 words and suitable for one printed Word page. Use plain, warm language and short paragraphs. Less is more. Do not include full verse quotations unless a short phrase is essential. Do not add transitions, a second outline, a preacher manuscript, exhaustive commentary, repeated ideas, or information that belongs only in preaching notes.`;

export async function createSecretaryDocument(churchId: string, input: AssistantDocumentInput) {
  const client = getOpenAIClient();
  const prompt = `Create a ${input.templateName} for a church office. Use this input: ${JSON.stringify(input.promptInput)}`;

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
  });
  const generatedBody = response.output_text?.trim();

  if (response.status !== "completed" || !generatedBody) {
    throw new Error("OpenAI did not complete the document. Please try again.");
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

const MAX_TRANSCRIPTION_BYTES = 24 * 1024 * 1024;
const MAX_MEETING_AUDIO_BYTES = 180 * 1024 * 1024;

function safeAudioName(name: string) {
  const extension = name.toLowerCase().match(/\.(mp3|wav|m4a|mp4|mpeg|mpga|webm)$/)?.[1];
  if (!extension) throw new Error("Use an MP3, WAV, M4A, MP4, MPEG, MPGA or WebM audio file.");
  return `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
}

function meetingPath(churchId: string, documentId: string, fileName: string) {
  return `meeting-audio-temp/${churchId}/${documentId}/${safeAudioName(fileName)}`;
}

export async function startMeetingUpload(churchId: string, input: AssistantSummaryInput, file: { name: string; type: string; size: number }) {
  if (!file.size) throw new Error("Choose an audio recording before starting.");
  if (file.size > MAX_MEETING_AUDIO_BYTES) throw new Error("Meeting audio must be 180 MB or smaller.");
  const document = await prisma.documentRequest.create({ data: { churchId, title: input.title, inputJson: JSON.stringify({ notesPrompt: input.notesPrompt, fileName: file.name, fileType: file.type, fileSize: file.size, stage: "uploading" }), status: "uploading" } });
  const path = meetingPath(churchId, document.id, file.name);
  const storage = createSupabaseAdminClient().storage.from(env.SUPABASE_UPLOAD_BUCKET);
  const signed = await storage.createSignedUploadUrl(path);
  if (signed.error || !signed.data) {
    await prisma.documentRequest.delete({ where: { id: document.id } });
    throw new Error("Temporary audio upload is unavailable. Please try again.");
  }
  const signedUploadUrl = signed.data.signedUrl.startsWith("http") ? signed.data.signedUrl : new URL(signed.data.signedUrl, env.NEXT_PUBLIC_SUPABASE_URL).toString();
  await prisma.documentRequest.update({ where: { id: document.id }, data: { inputJson: JSON.stringify({ notesPrompt: input.notesPrompt, fileName: file.name, fileType: file.type, fileSize: file.size, tempPath: path, stage: "uploaded" }), status: "queued" } });
  const resumable = new URL(env.NEXT_PUBLIC_SUPABASE_URL!);
  resumable.hostname = resumable.hostname.replace(".supabase.co", ".storage.supabase.co");
  resumable.pathname = "/storage/v1/upload/resumable";
  return { id: document.id, signedUploadUrl, token: signed.data.token, path, bucketName: env.SUPABASE_UPLOAD_BUCKET, resumableUploadUrl: resumable.toString() };
}

function mp3Chunks(data: Uint8Array) {
  const chunks: Uint8Array[] = [];
  let start = 0;
  while (start < data.length) {
    let end = Math.min(data.length, start + MAX_TRANSCRIPTION_BYTES);
    if (end < data.length) {
      const floor = Math.max(start + 1024, end - 64 * 1024);
      while (end > floor && !(data[end] === 0xff && (data[end + 1] & 0xe0) === 0xe0)) end--;
      if (end <= floor) end = Math.min(data.length, start + MAX_TRANSCRIPTION_BYTES);
    }
    chunks.push(data.slice(start, end));
    start = end;
  }
  return chunks;
}

async function transcribeMeetingAudio(client: OpenAI, fileName: string, contentType: string, bytes: Uint8Array) {
  const extension = fileName.toLowerCase().split(".").pop() || "";
  const chunks = bytes.length <= MAX_TRANSCRIPTION_BYTES ? [bytes] : extension === "mp3" ? mp3Chunks(bytes) : [];
  if (!chunks.length) throw new Error("For recordings larger than 24 MB, export MP3 audio before uploading. The transcription service limits each audio part to 25 MB.");
  const transcript: string[] = [];
  for (let index = 0; index < chunks.length; index++) {
    const part = new File([chunks[index]], chunks.length === 1 ? fileName : `${fileName.replace(/\.mp3$/i, "")}-part-${index + 1}.mp3`, { type: contentType || "audio/mpeg" });
    const result = await client.audio.transcriptions.create({ model: "gpt-transcribe" as any, file: part, prompt: transcript.length ? `Continue this church meeting. The previous section ended: ${transcript.join(" ").slice(-1200)}` : "Church council meeting. Preserve names, dates, decisions, assignments, and deadlines exactly when spoken." });
    transcript.push(result.text);
  }
  return transcript.join("\n\n");
}

const minutesPrompt = `You are a precise church council secretary. Build factual meeting minutes from the transcript only. Never invent attendees, a date, a decision, an owner, a due date, or a follow-up. Use "Not stated" for an owner or due date when the transcript gives no answer. Ignore small talk, repetition and incomplete ideas.

Return only JSON matching {meetingDate?:string,attendees:string[],summary:string[],decisions:string[],actionItems:[{task:string,owner:string,dueDate:string}],keyPoints:string[],followUps:string[]}.

Writing rules apply to every JSON text field. Use clear, simple, short connected sentences. Use active voice. Focus on actions and facts. Do not use Markdown. Do not use em dashes, semicolons, asterisks, hashtags, metaphors, cliches, rhetorical questions, or unsupported claims. Do not use these words or phrases: can, may, just, that, very, really, literally, actually, certainly, probably, basically, could, maybe, delve, embark, enlightening, esteemed, shed light, craft, crafting, imagine, realm, game-changer, unlock, discover, skyrocket, abyss, not alone, in a world where, revolutionize, disruptive, utilize, utilizing, dive deep, tapestry, illuminate, unveil, pivotal, intricate, elucidate, hence, furthermore, however, harness, exciting, groundbreaking, cutting-edge, remarkable, it, remains to be seen, glimpse into, navigating, landscape, stark, testament, in summary, in conclusion, moreover, boost, skyrocketing, opened up, powerful, inquiries, ever-evolving.`;

async function summarizeMeetingTranscript(client: OpenAI, transcript: string) {
  let current: MeetingMinutes | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await client.responses.create({ model: "gpt-4.1", max_output_tokens: 7000, text: { format: { type: "json_object" } }, input: [{ role: "developer", content: minutesPrompt }, { role: "user", content: current ? `Revise this draft only where needed. Cross-check every item against the transcript. Remove unsupported details. Fix these editorial issues: ${minutesIssues(current).join(" ")}\nDRAFT:\n${JSON.stringify(current)}\nTRANSCRIPT:\n${transcript}` : `TRANSCRIPT:\n${transcript}` }] });
    if (!response.output_text) throw new Error("OpenAI did not return meeting minutes.");
    current = meetingMinutes.parse(JSON.parse(response.output_text));
    if (!minutesIssues(current).length) return current;
  }
  throw new Error("Meeting minutes need editorial attention. Please retry the saved recording.");
}

export async function processMeetingUpload(churchId: string, documentId: string) {
  const document = await prisma.documentRequest.findFirst({ where: { id: documentId, churchId, status: { in: ["queued", "processing"] } } });
  if (!document) throw new Error("Meeting recording not found or already completed.");
  const info = JSON.parse(document.inputJson || "{}");
  if (!info.tempPath) throw new Error("Meeting audio upload is missing.");
  await prisma.documentRequest.update({ where: { id: documentId }, data: { status: "processing", inputJson: JSON.stringify({ ...info, stage: "transcribing" }) } });
  const storage = createSupabaseAdminClient().storage.from(env.SUPABASE_UPLOAD_BUCKET);
  try {
    const downloaded = await storage.download(info.tempPath);
    if (downloaded.error || !downloaded.data) throw new Error("Temporary meeting audio was not found.");
    const transcript = await transcribeMeetingAudio(getOpenAIClient(), info.fileName, info.fileType, new Uint8Array(await downloaded.data.arrayBuffer()));
    const minutes = await summarizeMeetingTranscript(getOpenAIClient(), transcript);
    await prisma.documentRequest.update({ where: { id: documentId }, data: { status: "generated", generatedBody: JSON.stringify(minutes), inputJson: JSON.stringify({ fileName: info.fileName, fileSize: info.fileSize, stage: "complete" }) } });
    return minutes;
  } catch (error) {
    await prisma.documentRequest.update({ where: { id: documentId }, data: { status: "failed", inputJson: JSON.stringify({ fileName: info.fileName, fileSize: info.fileSize, stage: "failed", error: error instanceof Error ? error.message : "Meeting processing failed." }) } });
    throw error;
  } finally {
    await storage.remove([info.tempPath]);
  }
}

export async function createSermonNotes(churchId: string, input: AssistantSummaryInput, file: File, serviceDate = "") {
  const client = getOpenAIClient();
  const uploaded = await client.files.create({ file, purpose: "user_data" });
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [{ role: "user", content: [
      { type: "input_file", file_id: uploaded.id },
      { type: "input_text", text: `${sermonBulletinPrompt}\n\nAdditional request: ${input.notesPrompt}` },
    ] }],
  });
  const generatedBody = response.output_text?.trim();
  if (!generatedBody) throw new Error("OpenAI did not return sermon notes.");
  const fileUrl = env.SUPABASE_SERVICE_ROLE_KEY ? await uploadToSupabase("sermon-slides", file) : null;

  return prisma.documentRequest.create({
    data: {
      churchId,
      title: input.title,
      inputJson: JSON.stringify({ notesPrompt: input.notesPrompt, fileName: file.name, fileUrl, serviceDate }),
      generatedBody,
      outputFileUrl: fileUrl,
      status: "queued",
    },
  });
}

export async function createSermonNotesFromText(churchId: string, input: AssistantSummaryInput, slidesText: string, serviceDate = "") {
  const client = getOpenAIClient();
  const response = await client.responses.create({ model: "gpt-4.1-mini", input: `${sermonBulletinPrompt}\n\nAdditional request: ${input.notesPrompt}\n\nPowerPoint slide text:\n${slidesText}` });
  const generatedBody = response.output_text?.trim();
  if (!generatedBody) throw new Error("OpenAI did not return sermon notes.");
  return prisma.documentRequest.create({ data: { churchId, title: input.title, inputJson: JSON.stringify({ notesPrompt: input.notesPrompt, source: "PowerPoint text", serviceDate }), generatedBody, status: "generated" } });
}

export type SermonPreparationInput = {
  planId?: string;
  serviceDate: string;
  series: string;
  firstScriptureLesson: string;
  secondScriptureLesson: string;
  sermonTitle: string;
  sermonRemarks: string;
};

async function monthlySermonContext(churchId: string, input: SermonPreparationInput) {
  const serviceDate = new Date(input.serviceDate + "T12:00:00Z");
  const start = new Date(Date.UTC(serviceDate.getUTCFullYear(), serviceDate.getUTCMonth(), 1));
  const end = new Date(Date.UTC(serviceDate.getUTCFullYear(), serviceDate.getUTCMonth() + 1, 1));
  const plans = await prisma.sermonPlan.findMany({
    where: { churchId, serviceDate: { gte: start, lt: end } },
    orderBy: { serviceDate: "asc" },
    select: { serviceDate: true, title: true, series: true, firstScriptureLesson: true, secondScriptureLesson: true, sermonRemarks: true },
  });
  if (!plans.length) return "No monthly calendar entries were available.";
  const currentIndex = plans.findIndex(plan => plan.serviceDate.toISOString().slice(0, 10) === input.serviceDate);
  const lines = plans.map((plan, index) => {
    const position = index === currentIndex ? "CURRENT SERMON" : index < currentIndex ? "EARLIER SERMON" : "LATER SERMON";
    return `${position}. ${plan.serviceDate.toISOString().slice(0, 10)}. Title: ${plan.title}. Series: ${plan.series || input.series}. Main passage: ${plan.secondScriptureLesson || "not supplied"}. Remarks: ${plan.sermonRemarks || "not supplied"}.`;
  });
  return `This sermon is ${currentIndex + 1} of ${plans.length} Sundays in this month.\n${lines.join("\n")}`;
}

function parseJsonResponse(value: string) {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

type ImageReview = { pass: boolean; score: number; issues: string[]; improvementPrompt: string };

async function reviewSermonImage(client: OpenAI, image: string, exactTitle: string, visualGoal: string): Promise<ImageReview> {
  const response = await client.responses.create({
    model: "gpt-4.1",
    input: [{ role: "user", content: [
      { type: "input_text", text: `Act as a strict church presentation art director. Review this candidate image for a large 16:9 sanctuary screen. The image must contain no written words, letters, numbers, logos, watermark, or title. The title will be added later by PowerPoint. The visual must support: ${visualGoal}.

Reject the image if it contains any visible text, modern clothing or settings in a biblical scene, theatrical surprise, exaggerated facial emotion, or if it has creepy or malformed hands, fingers, feet, legs, faces, eyes, teeth, duplicated anatomy, merged people, waxy skin, unnatural poses, distorted architecture, logos, or watermarks. Reject generic art that does not communicate the lesson. Prefer natural photography or a refined cinematic painting, strong composition, respectful biblical imagery, and enough contrast for projection.

Reject collages, grids, split screens, multiple panels, muddy sepia grading, or images too dark to read on a sanctuary projector. Require one coherent scene, clear subjects, natural color and readable midtones.
Return JSON only: {"pass":true,"score":0,"issues":[],"improvementPrompt":""}. Pass requires a score of at least 90 and no anatomy, face, eye, text, relevance, composition, or lighting defect.` },
      { type: "input_image", image_url: `data:image/png;base64,${image}`, detail: "high" },
    ] }],
  });
  if (!response.output_text) return { pass: false, score: 0, issues: ["No visual review returned"], improvementPrompt: "Improve anatomy, typography, relevance, and realism." };
  try {
    const parsed = parseJsonResponse(response.output_text);
    const score = Number(parsed.score) || 0;
    const issues = Array.isArray(parsed.issues) ? parsed.issues.filter((issue: unknown) => typeof issue === "string" && issue.trim()) : ["Invalid review issues"];
    return { pass: parsed.pass === true && score >= 90 && score <= 100 && issues.length === 0, score, issues, improvementPrompt: String(parsed.improvementPrompt || "") };
  } catch {
    return { pass: false, score: 0, issues: ["Invalid visual review"], improvementPrompt: "Improve anatomy, typography, relevance, and realism." };
  }
}

type ImageCheckpoint = { attempt?: number; image?: string; firstReview?: ImageReview; secondReview?: ImageReview; best?: { image: string; review: ImageReview }; improvement?: string };
export async function generateReviewedSermonImage(client: OpenAI, prompt: string, exactTitle: string, progress: ImageCheckpoint = {}, save: () => Promise<void> = async () => {}) {
  let best: { image: string; review: ImageReview } | null = progress.best || null;
  let improvement = progress.improvement || "";
  for (let attempt = progress.attempt || 1; attempt <= 3; attempt += 1) {
    try {
      if (!progress.image) {
      const response = await client.images.generate({ model: process.env.OPENAI_SERMON_IMAGE_MODEL || "gpt-image-2.5-sunburst", size: "1536x864", quality: "xhigh", prompt: `${prompt}${attempt >= 3 ? "\nSimplify the composition to a single meaningful object or setting, with no people, faces, hands or feet. Preserve the central meaning. Use a naturally lit photographic still life, no montage." : ""}
Use ONE coherent full-frame scene with a single focal point. Never use a collage, split screen, panels, montage, or grid, even if the concept lists several activities. Use luminous natural color, readable midtones, clear subjects, and balanced daylight. Avoid muddy brown/sepia grading, underexposure, and heavy darkness. Keep essential subjects above the lower title area. Translate abstract applications into one specific moment, not a collection of scenes.
For contemporary introductions and contemporary applications, use a believable present-day setting when the concept calls for it. Never turn a modern illustration into a biblical scene. Prefer a well-composed still life or a restrained scene with one or two people over a crowd.
Create a polished, cinematic, reverent Christian visual for a widescreen 16:9 church slide. Do not put any text, letters, numbers, title, logo, or watermark in the image. PowerPoint will add the exact title separately. Use natural proportions and believable anatomy. For biblical scenes, use historically appropriate first-century Judea clothing, architecture, lighting, and objects. Do not show modern clothing, modern furniture, modern buildings, modern hairstyles, or contemporary people in a biblical setting. Keep faces calm and natural. Avoid theatrical surprise, exaggerated joy, fear, shock, direct eye contact with the viewer, close-up hands, feet, legs, faces, and eyes when they are not needed. Prefer a symbolic scene, landscape, still life, architecture, or a medium-wide scene with people shown from the side or at a distance. No extra fingers, distorted hands, malformed feet or legs, waxy faces, asymmetrical eyes, unnatural teeth, duplicated people, merged bodies, clutter, logos, watermarks, or stray text. Make the image look professionally photographed or painted, not obviously generated by AI.${improvement ? `\nThe prior candidate was rejected. Correct these defects: ${improvement}` : ""}` } as any);
      const image = response.data?.[0]?.b64_json;
      if (!image) continue;
      progress.image = image; progress.attempt = attempt; await save();
      }
      const image = progress.image;
      const firstReview = progress.firstReview || await reviewSermonImage(client, image, exactTitle, prompt);
      progress.firstReview = firstReview; await save();
      const review = firstReview.pass
        ? progress.secondReview || await reviewSermonImage(client, image, exactTitle, `${prompt}. This is the second independent final review. Be stricter about historical setting, facial expression, realism, and anatomy.`)
        : firstReview;
      progress.secondReview = review; await save();
      const rank = (item: ImageReview) => (item.issues.length === 0 ? 1000 : 0) + item.score;
      if (!best || rank(review) > rank(best.review)) best = { image, review };
      if (review.pass) return { image, review, attempts: attempt };
      improvement = [...review.issues, review.improvementPrompt].filter(Boolean).join(". ");
      progress.best = best || undefined; progress.improvement = improvement; progress.attempt = attempt + 1;
      delete progress.image; delete progress.firstReview; delete progress.secondReview;
      await save();
    } catch (error) {
      if (process.env.VERCEL) throw error;
      const failure = error as { status?: number; code?: string };
      if (["credit_balance_exhausted", "insufficient_quota"].includes(failure.code || "")) {
        if (best) return { ...best, attempts: attempt };
        // Preserve the provider's code so the route can explain a billing mismatch.
        throw error;
      }
      if ([400, 401, 403, 404].includes(failure.status || 0)) {
        throw new Error(`Image generation is unavailable for the configured model (${failure.status}). Check OPENAI_SERMON_IMAGE_MODEL and account access.`);
      }
      if (attempt === 3 && !best) throw new Error("OpenAI did not return an image after three attempts. Saved sermon progress is retained.");
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    }
  }
  // Aesthetic scores guide selection; they must not trap the pastor in a retry loop.
  // Preserve the real review result rather than relabeling it as an approval.
  if (best) return { ...best, attempts: 3 };
  throw new Error("OpenAI returned no image. Saved sermon progress is retained.");
}

const sermonDeckPrompt = `Prepare structured content for a church sermon PowerPoint. Return valid JSON only.
The scriptureReading array MUST cover EVERY verse of the pastor's complete Second Scripture Lesson, in order. Never substitute a selected verse or supporting scripture for this full main reading. All Bible quotations use NIV only. The application verifies and replaces Bible quotations with sourced NIV text after editorial review.

Use only the supplied COMPLETE SERMON SOURCE. Select its strongest explanation and most relevant application for each lesson. Keep one clear interpretive insight grounded in the passage and one concrete shared response. Remove repetition and secondary examples. Favor concise, substantive pastoral language over lengthy exposition. Do not invent a new outline, new theology, new Bible text, or a different train of thought. Use clear English, active voice, natural pastoral warmth, and "we," "us," and "our" in explanations and applications. Do not use em dashes, semicolons, markdown, asterisks, hashtags, clichés, fake quotations, or invented facts.

The complete sermon source includes a MONTHLY SERIES MAP and SERMON FLOW CONTRACT. Follow both. The introductions, three points, applications, and final phrase form one spoken path. Point one answers the opening tension from the text. Point two starts with a brief bridge from point one and explains the response grace requires. Point three starts with a brief bridge from point two and shows how we live the response together. Reject isolated points, abstract titles, and explanations that need the pastor to translate complex words before speaking.

Required JSON shape:
{
  "seriesTitle": "string",
  "sermonTitle": "string",
  "firstScriptureLesson": "reference",
  "secondScriptureLesson": "reference",
  "introductions": [
    {"title":"short optional label","imagePrompt":"one concrete visual scene illustrating this introduction, no text","slides":["2 to 4 concise attention-grabbing statements"]},
    {"title":"short optional label","imagePrompt":"one concrete visual scene illustrating this introduction, no text","slides":["2 to 4 current, relevant and memorable statements"]}
  ],
  "humor": {"imagePrompt":"one scene illustrating the joke setup without revealing its punchline, no text","setup":"short setup","punchline":"unexpected punchline only, no explanation, moral, lesson, or application"},
  "scriptureReading": [{"reference":"single verse reference, never a range","text":"complete NIV text for one verse only"}],
  "points": [
    {
      "title":"short memorable point title",
      "explanationSlides":["3 to 5 carefully selected connected statements totaling 45 to 70 words. Preserve one textual observation, its plain meaning, and why it matters. Point two and point three begin with a brief natural bridge. Each statement is a complete thought, not a slogan"],
      "supportingScriptures":[{"reference":"single verse reference, never a range","text":"complete NIV text for one verse only"}],
      "applicationSlides":["1 to 2 concise connected statements totaling 22 to 35 words using we, us, or our. Give one concrete daily-life practice that directly follows this point. Name the real moment, the action, and the cost or resistance. Use simple spoken English"],
      "imagePrompt":"specific cinematic visual concept connected to this point"
    }
  ],
  "finalPhrase":"the strongest truth of the sermon in one concrete, forceful, emotional and memorable sentence of 14 to 18 words, using we, us, or our, with a clear real-life response",
  "seriesImagePrompt":"monthly series visual concept",
  "sermonImagePrompt":"Sunday sermon visual concept"
}

Use exactly three sermon points. Preserve all ten directly relevant supporting passages per point from the sermon source. Every scripture object must contain exactly one verse, never a verse range. The two introduction ideas must feel distinct. The joke must aim only for laughter and stay loosely connected to the general subject. Point explanations must contain valuable content, not generic summaries. Applications must name real choices, habits, relationships, pressures, or acts of obedience. The final phrase must be the best line in the entire sermon, not a weak recap. Scripture text must be accurate and must never be paraphrased or fabricated. If exact wording is uncertain, omit the text and keep the reference so the pastor can review it.`;

export type SermonCheckpoint = { sermonFoundation: string; deck: any };
export type SermonWork = {
  checkpoint?: SermonCheckpoint;
  save: (checkpoint: SermonCheckpoint, progress: string) => Promise<void>;
};

// One resumable step per request: content, then one missing illustration.
export async function createSermonPreparation(churchId: string, input: SermonPreparationInput, work: SermonWork, client = getOpenAIClient()) {
  if (!work.checkpoint?.deck || ["draft", "source-review"].includes(work.checkpoint.deck.preparationPhase)) {
  const mainReading = await createNivResolver()(input.secondScriptureLesson);
  const monthContext = await monthlySermonContext(churchId, input);
  const source = `Service date: ${input.serviceDate}\nSeries title: ${input.series}\nFirst Scripture Lesson: ${input.firstScriptureLesson}\nSecond Scripture Lesson: ${input.secondScriptureLesson}\nSermon title: ${input.sermonTitle}\nSermon remarks: ${input.sermonRemarks}\n\nMONTHLY SERIES MAP\n${monthContext}`;
  if (!work.checkpoint?.sermonFoundation) {
  const foundationResponse = await client.responses.create({ model: "gpt-4.1", input: `${sermonMasterPrompt}\n\nPASTOR'S SERMON INFORMATION\n${source}\n\nVERIFIED COMPLETE SECOND SCRIPTURE LESSON (NIV)\n${JSON.stringify(mainReading)}` });
  const sermonFoundation = foundationResponse.output_text?.trim();
  if (!sermonFoundation) throw new Error("OpenAI did not complete the pastor's master sermon prompt.");

  await work.save({ sermonFoundation, deck: { preparationPhase: "draft" } }, "Sermon foundation saved. Preparing slides automatically.");
  return { complete: false };
  }
  const sermonFoundation = work.checkpoint.sermonFoundation;
  let deck = work.checkpoint.deck;
  if (deck.preparationPhase === "draft") {
  const first = await client.responses.create({ model: "gpt-4.1", max_output_tokens: 16000, text: { format: { type: "json_object" } }, input: `${sermonDeckPrompt}\n\nPASTOR'S SERMON INFORMATION\n${source}\n\nCOMPLETE SERMON SOURCE\n${sermonFoundation}` });
  if (!first.output_text) throw new Error("OpenAI did not convert the sermon source into slides.");
  deck = parseJsonResponse(first.output_text);
  deck.monthlySeriesMap = monthContext;
  deck.preparationPhase = "source-review";
  deck.sourceReviewCount = 0;
  await work.save({ sermonFoundation, deck }, "Slide draft saved. Reviewing automatically.");
  return { complete: false };
  }
  const reviews = [
    "Revision 3: Compare every slide with the COMPLETE SERMON SOURCE, MONTHLY SERIES MAP, and SERMON FLOW CONTRACT. Correct biblical faithfulness, alignment with the title and remarks, scripture accuracy, omissions, and logical progression. Make sure this sermon advances its own place in the month without repeating another Sunday’s main lesson. Read the openings, titles, explanations, applications, and final phrase in order. Each part must lead to the next. Preserve exactly three points. Keep every scripture object to one verse only, never a range. Return the complete corrected JSON only.",
    "Revision 4 final: Improve the introductions, humor, lesson titles, explanations, practical applications, and Final phrase. Remove repetition, complex words, and generic AI wording. Keep explanations to 45-70 words and applications to 22-35 words per point. Select the most relevant content; do not expand it. Point two and point three must begin with a short bridge showing why they follow the prior point. Every application must give one simple daily-life practice tied directly to its point, including a real moment, concrete action and honest cost or resistance. Reject generic motivation. Preserve all ten supporting passages per point and all three introduction image prompts. Ensure no slide text becomes a one-word or two-word fragment. Keep each scripture object to one verse only. Return the final complete JSON only.",
  ];
  const reviewIndex = deck.sourceReviewCount || 0;
  if (reviewIndex < reviews.length) {
    const instruction = reviews[reviewIndex];
    const response = await client.responses.create({ model: "gpt-4.1", max_output_tokens: 16000, text: { format: { type: "json_object" } }, input: `${sermonDeckPrompt}\n\n${instruction}\n\nPASTOR'S SERMON INFORMATION\n${source}\n\nCOMPLETE SERMON SOURCE\n${sermonFoundation}\n\nCURRENT JSON\n${JSON.stringify(deck)}` });
    if (!response.output_text) throw new Error("OpenAI did not complete all four sermon reviews.");
    deck = parseJsonResponse(response.output_text);
    deck.sourceReviewCount = reviewIndex + 1;
    deck.preparationPhase = "source-review";
    await work.save({ sermonFoundation, deck }, "Source review saved. Continuing automatically.");
    return { complete: false };
  }

  // Pastor-supplied metadata and verified scripture are authoritative, even if
  // an editorial model omits verses or replaces the main reading with a proof text.
  deck.seriesTitle = input.series;
  deck.sermonTitle = input.sermonTitle;
  deck.firstScriptureLesson = input.firstScriptureLesson;
  deck.secondScriptureLesson = input.secondScriptureLesson;
  if (!Array.isArray(deck.introductions) || deck.introductions.length !== 2 ||
      deck.introductions.some((item: any) => !Array.isArray(item.slides) || !item.slides.join(" ").trim()) ||
      !deck.humor?.setup || !deck.humor?.punchline ||
      !Array.isArray(deck.points) || deck.points.length !== 3) {
    throw new Error("The sermon must include two introductions, the humor opening, and three complete lessons. Please regenerate.");
  }
  deck.preparationPhase = "editorial";
  await work.save({ sermonFoundation, deck }, "Sermon source saved. Selecting and refining the strongest content.");
  return { complete: false };
  }

  const { sermonFoundation, deck } = work.checkpoint;
  if (deck.preparationPhase) {
    if (deck.preparationPhase === "editorial") {
      await refineSermonEditorial(client, `${JSON.stringify(input)}\n${sermonFoundation}`, deck,
        () => work.save({ sermonFoundation, deck }, "Saved editorial selection. Refining biblical insight and concrete application."));
      deck.preparationPhase = "substance";
    } else if (deck.preparationPhase === "substance") {
      // Use the verified main passage as the authority for the final content audit.
      await verifyDeckScriptures(deck);
      await refineSermonSubstance(client, deck, () => work.save({ sermonFoundation, deck }, "Automatically refining a content detail. Earlier work is saved."));
      deck.preparationPhase = "final";
    } else if (deck.preparationPhase === "final") {
      const result = await refineFinalPhrase(client, `${JSON.stringify(input)}\n${sermonFoundation}\nFINAL LESSONS\n${JSON.stringify(deck.points)}`, deck.finalPhrase, deck.finalPhraseReviewDraft ||= [], () => work.save({ sermonFoundation, deck }, "Final phrase review saved."));
      delete deck.finalPhraseReviewDraft;
      deck.finalPhrase = result.phrase;
      deck.finalPhraseReviews = result.history;
      deck.preparationPhase = "scripture";
    } else if (deck.preparationPhase === "scripture") {
      await verifyDeckScriptures(deck);
      deck.scriptureVerificationVersion = 1;
      deck.bibleTranslation = "NIV";
      deck.preparationPhase = "emphasis";
    } else if (deck.preparationPhase === "emphasis") {
      await selectScriptureEmphasis(client, deck, () => work.save({ sermonFoundation, deck }, "Saving orange emphasis. Completing every supporting verse automatically."));
      await createSermonPowerPoint({ ...deck, assets: undefined });
      delete deck.preparationPhase;
    } else throw new Error("Unknown sermon preparation phase.");
    await work.save({ sermonFoundation, deck }, deck.preparationPhase ? "Saved content review. Continuing automatically: " + deck.preparationPhase : "Sermon and NIV emphasis saved. Preparing illustrations.");
    return { complete: false };
  }
  deck.assets ||= {};
  deck.assets.pointImages ||= [];
  deck.assets.introductionImages ||= [];
  deck.imageReviews ||= {};
  const tasks = [
    { key: "series", title: input.series, prompt: deck.seriesImagePrompt || input.series, image: deck.assets.seriesImage, set: (image: string) => { deck.assets.seriesImage = image; } },
    { key: "sermon", title: input.sermonTitle, prompt: deck.sermonImagePrompt || input.sermonTitle, image: deck.assets.sermonImage, set: (image: string) => { deck.assets.sermonImage = image; } },
    ...deck.introductions.map((intro: any, index: number) => ({ key: "introduction-" + index, title: "Introduction " + (index + 1), prompt: intro.imagePrompt || intro.slides.join(" "), image: deck.assets.introductionImages[index], set: (image: string) => { deck.assets.introductionImages[index] = image; } })),
    { key: "humor", title: "Humor introduction", prompt: deck.humor.imagePrompt || "Illustrate the joke setup without revealing its punchline: " + deck.humor.setup, image: deck.assets.humorImage, set: (image: string) => { deck.assets.humorImage = image; } },
    ...deck.points.map((point: any, index: number) => ({ key: "point-" + index, title: point.title, prompt: point.imagePrompt || point.title, image: deck.assets.pointImages[index], set: (image: string) => { deck.assets.pointImages[index] = image; } })),
  ];
  const missing = tasks.find(task => !task.image);
  if (missing) {
    const completed = tasks.filter(task => task.image).length;
    await work.save({ sermonFoundation, deck }, "Reviewing illustration " + (completed + 1) + " of " + tasks.length + ": " + missing.title);
    let result: Awaited<ReturnType<typeof generateReviewedSermonImage>> | undefined;
    deck.imageCheckpoint ||= {};
    result ||= await generateReviewedSermonImage(client, missing.prompt, missing.title, deck.imageCheckpoint,
      () => work.save({ sermonFoundation, deck }, "Illustration progress saved. Continuing automatically."));
    delete deck.imageCheckpoint;
    missing.set(result.image);
    deck.imageReviews[missing.key] = { review: result.review, attempts: result.attempts };
    await work.save({ sermonFoundation, deck }, "Saved " + (completed + 1) + " of " + tasks.length + " illustrations.");
    return { complete: false };
  }
  await work.save({ sermonFoundation, deck }, "PowerPoint ready to download.");
  return { complete: true };
}
