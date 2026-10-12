export type EmphasizedScripture = { reference: string; text: string; highlights?: string[] };

export function scriptureWordEmphasis(verse: EmphasizedScripture) {
  const text = verse.text.replace(/\s+/g, " ").trim();
  const ranges: Array<[number, number]> = [];
  for (const phrase of verse.highlights || []) {
    const value = phrase.replace(/\s+/g, " ").trim();
    if (!value) continue;
    let offset = text.indexOf(value);
    while (offset >= 0) {
      const end = offset + value.length;
      if ((offset === 0 || !/\p{L}/u.test(text[offset - 1])) && (end === text.length || !/\p{L}/u.test(text[end]))) ranges.push([offset, end]);
      offset = text.indexOf(value, end);
    }
  }
  return [...text.matchAll(/\S+/g)].map(word => ranges.some(([start, end]) => word.index! < end && word.index! + word[0].length > start));
}

// Reverification may replace objects, but emphasis survives only unchanged text.
export function preserveScriptureEmphasis<T extends EmphasizedScripture>(verified: T[], previous: EmphasizedScripture[]) {
  return verified.map(verse => {
    const old = previous.find(item => item.reference === verse.reference && item.text === verse.text);
    return { ...verse, ...(old?.highlights ? { highlights: old.highlights.filter(phrase => verse.text.includes(phrase)) } : {}) };
  });
}
