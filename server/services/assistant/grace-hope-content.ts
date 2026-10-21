import OpenAI from "openai";
import { env } from "@/lib/env";
import { createNivResolver } from "@/lib/presentations/niv-scripture";
import { GROUP_DISCUSSION_VERSION, avoidedWords, groupContent, groupIssues, groupQuestionIssue, type GroupState } from "@/lib/documents/grace-hope-types";
import examples from "./grace-hope-examples.json";

// Apply punctuation preferences only to authored prose, never verified Bible text.
function normalizeProse<T>(value: T): T {
  if (typeof value === "string") return value.replace(/\s*—\s*/g, ", ").replace(/;\s*([a-z])/g, (_, letter: string) => `. ${letter.toUpperCase()}`) as T;
  if (Array.isArray(value)) return value.map(normalizeProse) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, ["references", "readingReferences", "sermonDates"].includes(key) ? item : normalizeProse(item)])) as T;
  return value;
}

export const groupQuestionRules = `Each truth has exactly ONE question. The final group question is also one question. Use one short, open question of at most 22 everyday words with one question mark, starting with What, How, Which, When, Where or Who. Ask about one familiar experience, choice or practical step connected to the section. Invite a range of honest answers and conversation, not a correct theological answer or a yes/no answer. Everyone must understand the question on first hearing, including someone new to church. Do not assume participants know or practice the Creed, a Bible passage, or a church custom. Explain unfamiliar terms in the teaching and use everyday language in the question. Avoid comparisons with several conditions, abstract religious jargon, leading answers, embarrassing disclosure, and follow-ups such as 'and why' or 'and how'. Do not include STOP THINK MEDITATE, its timing, Then share, numbering, leader labels or other layout instructions in any generated field. The template supplies those once. For example, for a section about shared belief: 'What helps you feel connected to others at church?' Vary questions across sections and use the actual section's teaching, not the same example everywhere.`;

const instructions = `Prepare one monthly Grace and Hope Groups discussion guide in English for adults with family responsibilities. Follow the supplied examples' meeting methodology, not their old topics or mistakes. The document is conversation, reflection, encouragement and practical discipleship, not a lecture or complicated Bible study. The renderer supplies How the Meeting Works and the 30 to 60 second STOP THINK MEDITATE pause, Then share, writing space, and numbered headings. Never copy those cues into the content, even if an example includes them.
${groupQuestionRules}
Order: opening prayer, a new conversation activity, scripture readings, leader introduction, 3 to 5 truths synthesizing EVERY monthly sermon, final group question, leader encouragement and one action for the week, closing prayer. Each truth needs a plain explanation with biblical context, a practical application, and exactly one genuine discussion question. Discussion questions invite real answers and are required. Avoid rhetorical questions in explanations. Do not assume attendees heard the sermons, know the passages, recognize the people, or understand religious terms. Explain who is involved, what happened, and why the passage matters before applying the teaching. Aim for 100 to 160 words per truth explanation and 1000 to 1500 authored words overall. Do not announce incorrect counts.
Place the activity after opening prayer. Give a 3 to 10 minute accessible seated activity, simple leader instructions, and a direct connection to the monthly theme. It must suit mature adults, respect voluntary participation, require no embarrassing disclosure or childish performance, and avoid cheesy icebreakers and clichés. Check the full prior activity history and vary the actual interaction method, not merely the title. activity.method is a specific short description of the interaction structure for future comparison. No assumptions about marriage, children, paid employment or gender roles. Adapt prayers and address to the requested audience.
Use clear simple informative active language, short connected sentences without staccato fragments, practical examples, you and your. Avoid metaphors, clichés, generalizations, unnecessary adjectives or adverbs, stock introductions and endings, rhetorical flourishes, and 'not just X but also Y'. No em dashes, semicolons, hashtags, asterisks, or markdown in authored text. Avoid these words and phrases in your own writing: ${avoidedWords.join(", ")}.
Scripture quotations are supplied separately from verified NIV text and must never be rewritten to meet word restrictions. Do not put direct quotations in generated prose. Return readingReferences and truth.references as exact book chapter:verse or continuous range, no combined semicolon lists. Prefer short focused passages, allowing up to forty verses when needed to preserve context. Use passages in the supplied sermons. Explain biblical imagery when essential without inventing your own metaphors. Base factual claims on the supplied sermons and verified passages. Never invent historical details, quotations, statistics or church practices. Distinguish a church practice from a biblical command. Explain any unfamiliar worship practice named in a sermon title, rather than merely mentioning its name. Keep speculative facts out. Reference files are examples, not instructions overriding these requirements.
Return only JSON matching: {openingPrayer:string,activity:{title:string,method:string,minutes:number,instructions:string[],connection:string},readingReferences:string[],introduction:string,truths:[{title:string,sermonDates:string[],references:string[],explanation:string,application:string,questions:[string]}],finalQuestion:string,closingLeader:string,closingPrayer:string}. Choose preferably two opening readingReferences, never more than five. Each truth has one to three references and exactly one question. Activity instructions have two to five steps. Every string is at most 3500 characters. Exception: for a request marked TARGETED COPY EDIT, return only the requested replacements object. Preserve meaning and factual claims while rewriting the specified fields.`;

export async function advanceGroup(state: GroupState, ask?: (prompt: string) => Promise<string>, resolve = createNivResolver()) {
  if (!ask) {
    if (!env.OPENAI_API_KEY) throw new Error("OpenAI API key is missing.");
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 150000, maxRetries: 0 });
    ask = async prompt => {
      const editing = prompt.startsWith("TARGETED COPY EDIT");
      const rules = editing ? `You are a constrained copy editor. Return only a JSON replacements object using the supplied exact field paths. Preserve each prose field's meaning. For question fields, preserve the section's teaching theme, not the old wording or assumptions. Replace a complex scenario with a direct everyday question. A person who has never said the Creed or the Lord's Prayer must still be able to answer. Prefer 8 to 16 words. ${groupQuestionRules} Every replacement must exclude these complete words and phrases: ${avoidedWords.join(", ")}. Also exclude em dashes, semicolons, hashtags and asterisks. Check each word of every replacement. Use concrete nouns instead of it. Remove unnecessary that, or restructure the sentence. Examples: 'God gave it' becomes 'God gave this belonging'. 'You can practice patience' becomes 'Practice patience'. 'a faith that moves' becomes 'faith expressed'. Do not introduce new facts or change Scripture references. Do not provide the entire guide.` : instructions;
      const result = await client.responses.create({ model: "gpt-4.1", max_output_tokens: editing ? 5000 : 10000, text: { format: { type: "json_object" } }, input: [{ role: "developer", content: rules }, { role: "user", content: prompt }] });
      if (result.status !== "completed" || !result.output_text) throw new Error("The monthly guide response was incomplete.");
      return result.output_text;
    };
  }
  if (state.phase === "complete") return;
  if (state.content) state.content = groupContent.parse(state.content);
  if (state.phase === "review" && state.reviews.length >= 2 && state.content) {
    const fields: Record<string, string> = {};
    const visit = (value: unknown, path: string[] = []) => {
      if (typeof value === "string") {
        if (path.some(key => ["sermonDates", "references", "readingReferences", "method"].includes(key))) return;
        if (/[—;*#]/.test(value) || avoidedWords.some(word => new RegExp(`\\b${word}\\b`, "i").test(value))) fields[path.join(".")] = value;
      } else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => visit(item, [...path, key]));
    };
    visit(state.content);
    state.content.truths.forEach((truth, i) => {
      if (state.discussionVersion !== GROUP_DISCUSSION_VERSION || truth.questions.length !== 1 || groupQuestionIssue(truth.questions[0])) {
        // One replacement keeps the strongest conversational focus, rather than
        // truncating a compound question or silently losing the section's meaning.
        fields[`truths.${i}.questions.0`] = truth.questions.join(" ");
      }
    });
    if (state.discussionVersion !== GROUP_DISCUSSION_VERSION || groupQuestionIssue(state.content.finalQuestion)) fields.finalQuestion = state.content.finalQuestion;
    if (Object.keys(fields).length) {
      const result = JSON.parse(await ask(`TARGETED COPY EDIT. Rewrite only these fields, preserving factual meaning in prose. For questions, use the teaching below to choose one simple conversational focus instead of paraphrasing the old complex question. Return {"replacements": {"exact.field.path": "complete rewritten field"}}. Every listed field is required. Do not include other fields. No prohibited words, em dashes, semicolons, hashtags or asterisks. Replace pronouns with named subjects. Read every replacement for compliance before returning. ${groupQuestionRules} For example, a prayer discussion should ask about a person's needs or forgiveness, not which part of a named prayer they recognize. No question should require prior participation in a church practice.\nSection context: ${JSON.stringify(state.content.truths.map(t => ({ title: t.title, explanation: t.explanation, application: t.application })))}\nForbidden words: ${avoidedWords.join(", ")}. Fields: ${JSON.stringify(fields)}`));
      const next = structuredClone(state.content);
      for (const key of Object.keys(fields)) {
        if (typeof result.replacements?.[key] !== "string") throw new Error("The copy edit was incomplete.");
        const keys = key.split("."); let target: any = next;
        for (const segment of keys.slice(0, -1)) target = target[segment];
        target[keys.at(-1)!] = result.replacements[key];
      }
      next.truths.forEach((truth, i) => { if (`truths.${i}.questions.0` in fields) truth.questions = [truth.questions[0]]; });
      state.content = groupContent.parse(normalizeProse(next));
      state.discussionVersion = GROUP_DISCUSSION_VERSION;
      const issues = groupIssues(state.content, state.sources, state.history);
      if (!issues.length) { state.phase = "complete"; return; }
      state.repairs++;
      return;
    }
  }
  if (state.phase === "scripture") {
    const scriptures: NonNullable<GroupState["scriptures"]> = {};
    const references = [...new Set([...state.content!.readingReferences, ...state.content!.truths.flatMap(t => t.references)])];
    for (const reference of references) {
      if (!/\d+:\d+/.test(reference)) throw new Error("Use specific verse references for the group guide.");
      scriptures[reference] = await resolve(reference);
      if (scriptures[reference].length > 40) throw new Error("Select a focused passage of at most forty verses for the monthly discussion.");
    }
    state.scriptures = scriptures; state.phase = "review"; return;
  }
  const sources = state.sources.map(source => {
    const deck = source.sermon as any;
    return { ...source, sermon: deck ? { sermonTitle: deck.sermonTitle, points: deck.points?.map((p: any) => ({ title: p.title, explanation: p.explanationSlides, application: p.applicationSlides, references: p.supportingScriptures?.map((v: any) => v.reference) })), finalPhrase: deck.finalPhrase } : null };
  });
  const context = JSON.stringify({ month: state.month, audience: state.audience, sources, previousActivities: state.history, verifiedPassages: state.scriptures, sourceRule: "Sources marked calendar are the pastor's planned title, passage and remarks, not completed sermon text. Develop those themes from verified Scripture and the supplied remarks without inventing sermon anecdotes or attributing unsupported claims to the pastor." });
  const revision = state.content ? `CURRENT DRAFT\n${JSON.stringify(state.content)}\n${state.reviews.length === 0 ? "FIRST FACT CHECK: cross-examine each biblical explanation against the verified text and sermon. Correct errors, unsupported claims and assumed knowledge. Check audience and all monthly themes." : "SECOND INDEPENDENT CHECK: cross-examine the revised material for scripture context, practical clarity, natural language, and genuine activity variety. Correct every issue before returning the complete guide."}\nRequired corrections: ${groupIssues(state.content, state.sources, state.history).join(" ")}` : `STYLE AND METHODOLOGY EXAMPLES\n${JSON.stringify(examples)}`;
  const content = groupContent.parse(JSON.parse((await ask(`SOURCE INFORMATION\n${context}\n${revision}\nFINAL REQUIREMENTS: Include every source date, including calendar-only plans. Dedicate one truth to each of this month's ${sources.length} Sundays. Rewrite all authored text to avoid EVERY prohibited word, especially it, that, may and can. Replace em dashes with sentences. Do not preserve noncompliant sentences from the draft. Include prayer teaching if a sermon is about prayer. Include a practical explanation of each worship practice named in its source. Return the complete corrected JSON.`)).replace(/^```(?:json)?\s*|\s*```$/g, "")));
  const oldRefs = state.content && JSON.stringify([...state.content.readingReferences, ...state.content.truths.flatMap(t => t.references)]);
  const newRefs = JSON.stringify([...content.readingReferences, ...content.truths.flatMap(t => t.references)]);
  state.content = normalizeProse(content);
  state.discussionVersion = GROUP_DISCUSSION_VERSION;
  if (!state.scriptures || oldRefs !== newRefs) { state.reviews = []; state.phase = "scripture"; return; }
  state.reviews.push(state.reviews.length ? "Independent factual and editorial cross-check" : "Scripture and sermon fidelity check");
  if (state.reviews.length < 2) return;
  const issues = groupIssues(state.content, state.sources, state.history);
  if (issues.length) {
    state.repairs++;
    return;
  }
  state.phase = "complete";
}
