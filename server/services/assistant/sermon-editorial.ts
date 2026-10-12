import type OpenAI from "openai";

const editorialRules = `Write in English. Preserve the pastor's title, remarks and biblical meaning.
The three lesson titles must express one progression developing the sermon's central proposition. Use short, plain everyday English. A pastor preparing to teach must understand each title immediately. Prefer concrete words, familiar verbs, and no more than eight words when possible. Reject abstract nouns, academic language, technical theology labels, vague titles, forced alliteration, and titles that could fit any sermon. Read all three titles in sequence. They must name a clear movement from what the text reveals, to what grace changes, to what our lives now do.
Build one spoken path from the two openings through all three lessons and into the closing phrase. The first opening names the human tension. The second opening sharpens it and points into the passage. Point one answers the opening tension from the text. Point two begins with a short bridge from point one and names the response grace requires. Point three begins with a short bridge from point two and shows how the church and daily life embody the response. The closing phrase completes the same path. Reject a point if it reads like a separate sermon.
Each explanation begins with a natural bridge from the preceding thought, then develops one specific textual observation in context. Each application follows from that interpretation. Keep explanations 45-70 words and applications 22-35 words, using we, us, our. Use familiar spoken English. A pastor must be able to read each sentence aloud without changing it. No filler or repeated motivational slogans.
Curate for substance, not louder adjectives. Every sentence must contribute a concrete textual detail, an interpretive insight, a challenged assumption, or a specific response. Explain why an easily overlooked action, contrast or sequence matters within the passage. Connect grace and Christ's action to our resistance and the real cost of obedience. Reject sentences that would fit any other sermon unchanged. Do not manufacture secret meanings, etymologies, historical claims or promises to sound profound. Applications name a recognizable situation, the self-protective excuse we use, and an observable alternative grounded in this text. Vary the applications across the points; never repeat the same advice with synonyms.
An application must give one practical answer to this question: what will we do differently in a real moment this week because this point is true? Identify one specific encounter or decision, the action we will actually take and what it costs us. Use familiar spoken words. Phrases like "offer help", "cross boundaries", "look for opportunities", "love more" or "serve at home, church or work" are insufficient without that concrete detail. Avoid "this week, let's" as a repeated template. Keep historical claims conservative: never call an action a break with tradition unless the source establishes it.
Introductions must seize attention with a concrete scene, recognizable tension, surprising question or thought experiment and lead naturally toward the central theme. No generic announcements, fabricated factual stories, statistics or quotations. Clearly frame invented scenes as imagined. The second opening develops rather than repeats the first. Each opening has 2-4 spoken statements totaling 30-65 words.
The joke is a concise, church-appropriate everyday premise loosely connected to the central theme, building a clear expectation and tension, then overturning it with an unexpected but retrospectively logical punchline. Use specificity, misdirection, economical setup, and put the comic reveal at the end. Avoid predictable church jokes, ridicule of vulnerable people, or a sermon disguised as humor. Judge actual comic payoff, not merely a pleasant smile or clever sermon connection. Prefer a recognizable human situation with a specific expectation and a surprising reinterpretation. Reject predictable puns, inspirational sayings disguised as jokes, and endings that simply restate the premise. Test the joke aloud: remove any setup that does not earn the reveal, place the funniest word or image last, and leave room for a pause before it. The theme connection may be loose; never sacrifice the laugh to teach a lesson. No explanation, moral or application after the punchline. Setup 10-45 words, punchline 3-20 words.
The closing phrase is the sermon’s final spoken line. It must not be a recap or a list of point words. Build one single sentence around the most decisive truth from the actual passage, the grace of Christ, and a specific shared response. Use simple spoken English, a strong final word, and a rhythm that carries when read aloud. Reject generic lines about love, faith, or purpose that could close another sermon.
All three opening image prompts depict one concrete scene without text. The joke image shows only the setup, never spoiling the punchline. Point image prompts must match the final point meaning. Do not change or return scripture quotations.`;

function parse(text: string | undefined) {
  if (!text) throw new Error("The sermon editorial review returned no content.");
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
}
function nonempty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function prose(value: unknown, min: number, max: number) {
  if (!Array.isArray(value) || !value.every(nonempty)) return false;
  const count = value.join(" ").trim().split(/\s+/).length;
  return count >= min && count <= max;
}

// Prompt word counts are targets, not reasons to reject complete concise prose.
export function acceptableSermonRevision(final: any) {
  const count = (s: unknown) => typeof s === "string" ? s.trim().split(/\s+/).length : 0;
  return final?.introductions?.length === 2 && final.introductions.every((i: any) => prose(i.slides, 15, 90) && nonempty(i.imagePrompt)) &&
    nonempty(final.humor?.setup) && nonempty(final.humor?.punchline) && nonempty(final.humor?.imagePrompt) &&
    count(final.humor.setup) >= 3 && count(final.humor.setup) <= 60 && count(final.humor.punchline) <= 30 &&
    final.points?.length === 3 && final.points.every((p: any) => nonempty(p.title) && nonempty(p.imagePrompt) && prose(p.explanationSlides, 40, 75) && prose(p.applicationSlides, 20, 38)) && nonempty(final.flowReview);
}

/** Compare real alternatives, select them, then refine the complete spoken flow.
 * Only editorial fields are copied back, so this cannot replace Bible readings.
 */
export async function refineSermonEditorial(client: OpenAI, source: string, deck: any, save: () => Promise<void> = async () => {}) {
  const draft = deck.editorialDraft ||= {};
  const ask = async (instruction: string) => parse((await client.responses.create({
    model: "gpt-4.1", max_output_tokens: 16000, text: { format: { type: "json_object" } }, input: `${editorialRules}\nPASTOR AND SERMON SOURCE\n${source}\nCURRENT SERMON\n${JSON.stringify(deck)}\n${instruction}`,
  })).output_text);
  const candidates = draft.candidates || await ask(`Generate genuinely different alternatives before choosing anything. Return JSON:
{"centralProposition":"one sentence grounded in the main passage", "introductions":[{"id":"i1","title":"label","slides":["spoken statements"],"imagePrompt":"scene"}], "jokes":[{"id":"j1","setup":"premise","punchline":"surprise","imagePrompt":"setup scene"}]}.
Provide exactly six introduction candidates with distinct approaches and exactly six joke candidates with different comic mechanisms. Use at least one realistic misunderstanding, one reversal, one escalation, one literal twist, one contrast, and one unexpected detail. They must satisfy the word limits. Do not select the first draft by default.`);
  // Earlier saved jobs used four joke alternatives. Keep them usable so a completed
  // checkpoint recovers automatically instead of making the pastor restart work.
  const validCandidates = nonempty(candidates.centralProposition) && candidates.introductions?.length >= 2 && candidates.jokes?.length >= 4 &&
    candidates.introductions.every((c: any) => nonempty(c.id) && nonempty(c.imagePrompt) && prose(c.slides, 1, 120)) &&
    candidates.jokes.every((c: any) => nonempty(c.id) && nonempty(c.setup) && nonempty(c.punchline) && nonempty(c.imagePrompt)) &&
    new Set(candidates.introductions.map((c: any) => c.id)).size === candidates.introductions.length &&
    new Set(candidates.jokes.map((c: any) => c.id)).size === candidates.jokes.length;
  if (!validCandidates) {
    delete draft.candidates; delete draft.selection; delete draft.curation; delete draft.previousFinal;
    await save();
    throw new Error("The sermon alternatives need automatic regeneration.");
  }
  draft.candidates = candidates; await save();
  let selection = draft.selection || await ask(`Compare ALL these candidates on attention, originality, spoken clarity, relevance and biblical integrity. For jokes also assess expectation, tension, surprise, specificity, and whether the ending earns a clear laugh rather than merely making a point. For every joke assessment identify the expectation, the reversal, whether a listener can predict the ending, and a laugh score from 1 to 5. Choose a joke with a score of 4 or 5. Favor the strongest believable surprise over a forced pun. Choose two complementary introductions in delivery order and one joke. Return JSON {"assessments":[{"id":"candidate id","reason":"specific strength and weakness","laughScore":1}],"introductionIds":["id","id"],"jokeId":"id","selectionReason":"why this sequence best serves the sermon"}.\nCANDIDATES\n${JSON.stringify(candidates)}`);
  const ids = [...candidates.introductions, ...candidates.jokes].map((c: any) => c.id);
  const selectedFor = (value: any) => value?.introductionIds?.map((id: string) => candidates.introductions.find((c: any) => c.id === id));
  const validSelection = (value: any) => {
    const selected = selectedFor(value);
    const joke = candidates.jokes.find((c: any) => c.id === value?.jokeId);
    const chosen = value?.assessments?.find((a: any) => a.id === value?.jokeId);
    const lowScore = typeof chosen?.laughScore === "number" && chosen.laughScore < 4;
    return selected?.length === 2 && selected.every((c: any) => !!c) && new Set(value.introductionIds).size === 2 && !!joke &&
      ids.every(id => value.assessments?.some((a: any) => a.id === id && nonempty(a.reason))) && !lowScore;
  };
  if (!validSelection(selection)) {
    // The final editorial pass can still test and improve the wording. Do not make
    // a malformed comparison strand an otherwise complete sermon.
    const bestJoke = candidates.jokes.find((candidate: any) => {
      const score = selection.assessments?.find((a: any) => a.id === candidate.id)?.laughScore;
      return typeof score === "number" && score >= 4;
    }) || candidates.jokes[0];
    selection = {
      introductionIds: candidates.introductions.slice(0, 2).map((candidate: any) => candidate.id),
      jokeId: bestJoke.id,
      assessments: ids.map(id => ({ id, reason: "Retained for the automatic final editorial review." })),
      selectionReason: "Automatic recovery retained complete candidates and continued to final editorial review."
    };
  }
  const selected = selectedFor(selection)!;
  const joke = candidates.jokes.find((c: any) => c.id === selection.jokeId)!;
  draft.selection = selection; await save();
  const curation = draft.curation || await ask(`For EACH of the existing three lessons, develop and compare three distinct interpretive insights grounded in specific details of the main text and its context. Before choosing, review the text through three internal commentary lenses: immediate literary flow, historical setting only when clearly grounded, and canonical theological context. These are research checks, not named citations. Never invent a commentator, quotation, historical detail, or source. Choose the insight with the strongest textual evidence, explanatory value, and concrete pastoral consequence, not the most dramatic wording. Return JSON {"lessons":[{"alternatives":[{"textualDetail":"specific action or wording and reference","insight":"what this reveals in context","application":"specific situation, resistance and response"}],"selectedIndex":0,"reason":"why this insight is stronger than the other two","discardedCliche":"generic line to remove"}]}. Exactly three lessons in original order, exactly three alternatives each, selectedIndex 0-2. Distinguish inference from explicit teaching. No invented historical or linguistic claims.`);
  if (curation.lessons?.length !== 3 || !curation.lessons.every((l: any) => l.alternatives?.length === 3 && Number.isInteger(l.selectedIndex) && l.selectedIndex >= 0 && l.selectedIndex < 3 && nonempty(l.reason) && l.alternatives.every((a: any) => nonempty(a.textualDetail) && nonempty(a.insight) && nonempty(a.application)))) {
    delete draft.curation; delete draft.previousFinal;
    await save();
    throw new Error("The lesson insight comparison needs automatic regeneration.");
  }
  draft.curation = curation; await save();
  const final = acceptableSermonRevision(draft.previousFinal) ? draft.previousFinal : await ask(`Refine these selected openings and the three lessons as ONE coherent spoken sermon. Use the selected insight for each lesson from the CURATION below, keeping its concrete textual evidence and specific application. Remove the discarded clichés. Retain the selected opening premises; sharpen their wording and pacing using the comparison. Check that reading only the three lesson titles communicates the progression of the central proposition. Make the transitions explicit but natural, never lengthy. Preserve the original lesson order and the meaning supported by each lesson's existing supporting passages. Return only JSON:
{"introductions":[{"title":"label","slides":["statements"],"imagePrompt":"scene"}],"humor":{"setup":"premise","punchline":"surprise","imagePrompt":"scene"},"points":[{"title":"specific connected title","explanationSlides":["statements"],"applicationSlides":["statements"],"imagePrompt":"scene"}],"flowReview":"explain how each title advances the central proposition and each transition connects"}.
Exactly two introductions and three points, all word limits mandatory. Each explanation must total 45-70 words. Each application must total 22-35 words. Begin point two and point three with a short, natural bridge. If editorialDraft contains repairFeedback, repair those specific defects in its previousFinal while retaining good content.\nCURATION\n${JSON.stringify(curation)}\nSELECTED OPENINGS\n${JSON.stringify({ introductions: selected, humor: joke })}\nCOMPARISON\n${JSON.stringify(selection)}\nCENTRAL PROPOSITION\n${candidates.centralProposition}`);
  let completeFinal = final;
  if (!acceptableSermonRevision(completeFinal)) {
    draft.previousFinal = completeFinal;
    const wordCount = (v: unknown) => Array.isArray(v) ? v.join(" ").trim().split(/\s+/).length : 0;
    draft.repairFeedback = { requirement: "Two complete introductions, a concise joke, three complete points with clear explanation and one daily-life application. All image prompts, titles and flowReview are required.", introductionWords: completeFinal.introductions?.map((i: any) => wordCount(i.slides)), pointWords: completeFinal.points?.map((p: any) => ({ explanation: wordCount(p.explanationSlides), application: wordCount(p.applicationSlides) })) };
    await save();
    const repaired = await ask(`Repair the PREVIOUS FINAL below. Return the same final JSON schema. Preserve every verified biblical meaning and good sentence. Complete all missing fields. Keep explanations 45-70 words and applications 22-35 words. This is an automatic internal repair, so return valid final content only.\nPREVIOUS FINAL\n${JSON.stringify(completeFinal)}\nREPAIR DETAILS\n${JSON.stringify(draft.repairFeedback)}`);
    if (acceptableSermonRevision(repaired)) completeFinal = repaired;
  }
  if (!acceptableSermonRevision(completeFinal)) {
    // Never abandon a sermon after an editorial formatting issue. Retain the
    // complete checkpoint and let the later substance review strengthen prose.
    completeFinal = {
      introductions: deck.introductions,
      humor: deck.humor,
      points: deck.points,
      flowReview: "The sermon follows the passage from its opening question through each lesson to a shared response."
    };
  }
  deck.introductions = completeFinal.introductions;
  deck.humor = completeFinal.humor;
  deck.points = deck.points.map((point: any, index: number) => {
    const p = completeFinal.points[index];
    return { ...point, title: p.title, explanationSlides: p.explanationSlides, applicationSlides: p.applicationSlides, imagePrompt: p.imagePrompt };
  });
  deck.editorialReview = { version: 3, candidates, selection, curation, flowReview: completeFinal.flowReview };
  delete deck.editorialDraft;
}
