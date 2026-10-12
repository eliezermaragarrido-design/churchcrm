import type OpenAI from "openai";
import type { EmphasizedScripture } from "@/lib/presentations/scripture-emphasis";
import { scriptureWordEmphasis } from "@/lib/presentations/scripture-emphasis";

export async function selectScriptureEmphasis(client: OpenAI, deck: any, save: () => Promise<void> = async () => {}) {
  const entries: Array<{ id: string; verse: EmphasizedScripture; context: string }> = [];
  deck.scriptureReading.forEach((verse: EmphasizedScripture, i: number) => entries.push({ id: `main-${i}`, verse, context: "Main reading, overall sermon theme: " + deck.sermonTitle + ". " + (deck.editorialReview?.candidates?.centralProposition || "") }));
  deck.points.forEach((p: any, i: number) => p.supportingScriptures.forEach((verse: EmphasizedScripture, j: number) => entries.push({ id: `point-${i}-${j}`, verse, context: p.title + ": " + p.explanationSlides.join(" ") })));
  type Selection = { id: string; phrases: string[]; reason: string; text: string; context: string };
  const selected = new Map<string, Selection>();
  const rejected: Record<string, unknown> = deck.scriptureEmphasisFeedback || {};
  const budget = (entry: typeof entries[number]) => Math.max(1, Math.min(16, Math.floor(entry.verse.text.trim().split(/\s+/).length * 0.6)));
  const valid = (item: any, entry: typeof entries[number]) => {
    if (!Array.isArray(item.phrases) || item.phrases.length < 1 || item.phrases.length > 2 || typeof item.reason !== "string" || !item.reason.trim() ||
        !item.phrases.every((phrase: unknown) => typeof phrase === "string" && phrase.trim() && entry.verse.text.includes(phrase) && phrase.split(/\s+/).length <= 12)) return false;
    const mask = scriptureWordEmphasis({ ...entry.verse, highlights: item.phrases });
    return mask.some(Boolean) && mask.some(value => !value) && mask.filter(Boolean).length <= budget(entry);
  };
  for (const item of deck.scriptureEmphasisDraft || []) {
    const entry = entries.find(e => e.id === item.id && e.verse.text === item.text && e.context === item.context);
    if (entry && valid(item, entry)) selected.set(item.id, item);
  }
  const missing = () => entries.filter(e => e.id.startsWith("point-") ? !selected.has(e.id) : ![...selected.keys()].some(id => id.startsWith("main-")));
  for (let attempt = 0; attempt < 3 && missing().length; attempt++) {
    const pending = missing();
    const response = await client.responses.create({ model: "gpt-4.1", max_output_tokens: 16000, text: { format: { type: "json_object" } }, input: `Select orange emphasis within verified NIV verses. Return JSON {"selections":[{"id":"entry id","phrases":["exact continuous substring copied from the verse"],"reason":"specific connection to the overall theme or this lesson"}]}.
TWO DIFFERENT COVERAGE RULES:
MAIN READING (main-*): choose only the MOST relevant words or short clauses directly expressing the overall sermon theme. Be selective across the passage. Prefer just the one to three strongest thematic statements in a typical passage. Exclude occupations, locations, crowd reactions and narrative setup that merely explain the background unless they themselves directly state this sermon’s central claim. Do not highlight a phrase merely because it sets the stage for the theme. Leave incidental narrative and verses that do not directly express that theme white. Do not try to cover every main-reading verse or every lesson. Select at least one central phrase in this collection when main entries are supplied.
SUPPORTING VERSES (point-*): EVERY supplied verse must receive at least one important word or short phrase explaining how that verse supports its PARTICULAR lesson. Do not skip a verse or select only one per lesson. Use the meaning in context, not superficial keyword matching. Different occurrences of the same verse may support different points and need different emphasis.
For both: preserve negation and contrast, select at most two phrases per verse, usually 1-8 words each, and keep the rest white. Never color an entire verse or change any NIV wording. Respect EACH entry's maxHighlightedWords across both phrases together. For a short verse choose just its most meaningful word or two rather than the entire meaningful sentence. If previousInvalidSelection is supplied, it failed exact-word matching or colored too many words: choose a SHORTER exact phrase within the budget, not the same selection again. Explain the actual connection in reason, without inventing a claim. Repair only supplied entries; already valid selections are saved.
${JSON.stringify(pending.map(e => ({ ...e, verse: { reference: e.verse.reference, text: e.verse.text }, maxHighlightedWords: budget(e), previousInvalidSelection: rejected[e.id] })))}` });
    const result = JSON.parse((response.output_text || "{}").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    for (const item of Array.isArray(result.selections) ? result.selections : []) {
      const entry = pending.find(e => e.id === item.id);
      if (entry && !selected.has(item.id)) {
        if (valid(item, entry)) { selected.set(item.id, { ...item, text: entry.verse.text, context: entry.context }); delete rejected[item.id]; }
        else rejected[item.id] = item;
      }
    }
    deck.scriptureEmphasisDraft = [...selected.values()];
    deck.scriptureEmphasisFeedback = rejected;
    await save();
  }
  if (missing().length) throw new Error("Scripture emphasis omitted required verses or exact short phrases. Saved selections retained; remaining entries: " + missing().map(e => e.id).join(", "));
  for (const entry of entries) entry.verse.highlights = selected.get(entry.id)?.phrases || [];
  deck.scriptureEmphasisReview = [...selected.values()].map(({ id, phrases, reason }) => ({ id, phrases, reason }));
  deck.scriptureEmphasisVersion = 2;
  delete deck.scriptureEmphasisDraft;
  delete deck.scriptureEmphasisFeedback;
}
