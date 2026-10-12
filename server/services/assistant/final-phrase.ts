import type OpenAI from "openai";

export async function refineFinalPhrase(client: OpenAI, source: string, initial: string, history: string[] = [], save: () => Promise<void> = async () => {}) {
  let phrase = (history.at(-1) || initial).replace(/^final:\s*/i, "").trim();
  const usable = (value: string) => {
    const count = value.trim().split(/\s+/).length;
    return count >= 6 && count <= 30 && /\b(we|us|our)\b/i.test(value) && !/\byou(r)?\b/i.test(value);
  };
  const reviews = [
    "Biblical faithfulness: identify the central truth linking the title, passage and all three lessons. Remove unsupported promises and generic religious slogans.",
    "Pastoral impact: give that truth emotional weight and a concrete shared response. Awaken hope and conviction without shaming, exaggerating or manipulating. Do not summarize the points.",
    "Memorability: refine rhythm and spoken clarity. Use familiar, precise words and one coherent thought a listener could remember tomorrow. Avoid lists of virtues, ornamental language, and a generic ending that could fit another sermon.",
    "Final editorial review: choose the strongest faithful wording. It must capture the sermon’s decisive biblical truth, sound natural aloud, and end with a strong final word. Retain the current line if a change weakens it.",
  ];
  for (const review of reviews.slice(history.length)) {
    const result = await client.responses.create({
      model: "gpt-4.1",
      max_output_tokens: 1200,
      text: { format: { type: "json_object" } },
      input: `Refine ONLY the final takeaway of this sermon. ${review}\nReturn JSON only: {"phrase":"one English sentence of 10 to 20 words"}. Use we, us or our, never you. This is the final line before prayer, not a recap of three lessons. Name one central truth and one faithful response. Use plain spoken English. No label, quotation marks inside the sentence, em dash or semicolon.\nSERMON SOURCE\n${source}\nCURRENT PHRASE\n${phrase}`,
    });
    if (!result.output_text) throw new Error("The final phrase review did not complete.");
    const candidate = JSON.parse(result.output_text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")).phrase;
    if (typeof candidate !== "string") throw new Error("The final phrase review returned invalid text.");
    const revised = candidate.replace(/^final:\s*/i, "").replace(/\s*[—;]\s*/g, ", ").trim();
    // Retain a usable line when a review fails to improve it. A writing target
    // must not discard four completed reviews and block the entire presentation.
    if (usable(revised)) phrase = revised;
    history.push(phrase);
    await save();
  }
  if (!usable(phrase)) throw new Error("The final phrase review returned no usable takeaway.");
  return { phrase, history };
}
