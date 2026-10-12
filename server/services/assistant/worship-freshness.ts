import type { WorshipState } from "@/lib/documents/worship-types";

export const welcomePsalms = ["Psalm 100:1", "Psalm 100:2", "Psalm 95:1", "Psalm 95:2", "Psalm 96:1", "Psalm 96:2", "Psalm 98:4", "Psalm 47:1", "Psalm 66:1", "Psalm 66:2", "Psalm 81:1", "Psalm 105:1", "Psalm 105:2", "Psalm 118:24", "Psalm 149:1", "Psalm 150:6"];
export function chooseWelcomePsalm(history: NonNullable<WorshipState["freshness"]>["history"]) {
  const used = history.map(item => item.psalm);
  return welcomePsalms.find(reference => !used.includes(reference)) || [...welcomePsalms].sort((a, b) => used.lastIndexOf(b) - used.lastIndexOf(a))[0];
}
// Shared five-word phrases catch recycled paragraphs while ignoring short liturgical phrases.
export function recycledWorshipText(current: string[], previous: string[]) {
  const grams = (paragraphs: string[]) => {
    const words = paragraphs.join(" ").toLowerCase().match(/[a-z]+/g) || [];
    return new Set(words.slice(4).map((_, index) => words.slice(index, index + 5).join(" ")));
  };
  const a = grams(current), b = grams(previous);
  return a.size >= 12 && [...a].filter(value => b.has(value)).length / a.size >= 0.32;
}
