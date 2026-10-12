import { load } from "cheerio";
import { preserveScriptureEmphasis } from "./scripture-emphasis";

export type VerifiedVerse = { reference: string; text: string; translation: "NIV"; source: string };

export function parseNivChapter(html: string, book: string, chapter: number, source: string): VerifiedVerse[] {
  const $ = load(html);
  const passage = $(".passage-text .version-NIV");
  if (!passage.length) throw new Error("The scripture source did not return the NIV translation.");
  passage.find("sup, h3, h4, .footnotes, .crossrefs, .chapternum").remove();
  const verses = new Map<number, string[]>();
  passage.find("span.text").each((_, element) => {
    const node = $(element);
    const match = (node.attr("class") || "").match(/\b[\w]+-(\d+)-(\d+)\b/);
    if (!match || Number(match[1]) !== chapter) return;
    const number = Number(match[2]);
    const text = node.text().replace(/\s+/g, " ").trim();
    if (text) verses.set(number, [...(verses.get(number) || []), text]);
  });
  return [...verses].sort(([a], [b]) => a - b).map(([number, parts]) => ({
    reference: `${book} ${chapter}:${number}`, text: parts.join(" "), translation: "NIV", source,
  }));
}

// A request-scoped resolver prevents duplicate downloads without serving stale
// or model-invented verse text. Fail visibly if a required verse cannot be read.
export function createNivResolver(fetcher: typeof fetch = fetch) {
  const chapters = new Map<string, Promise<VerifiedVerse[]>>();
  return async function resolve(reference: string): Promise<VerifiedVerse[]> {
    const normalized = reference.replace(/[–—]/g, "-").replace(/\s*\(?NIV\)?\s*$/i, "").trim();
    const match = normalized.match(/^((?:[1-3]\s*)?[A-Za-z][A-Za-z .]*?)\s+(\d+)(?::(\d+)(?:-(?:(\d+):)?(\d+))?)?$/);
    if (!match) throw new Error(`Cannot verify NIV reference: ${reference}. Use a book, chapter, and verse or continuous verse range.`);
    const [, book, chapterText, firstText, endChapterText, lastText] = match;
    const firstChapter = Number(chapterText), lastChapter = Number(endChapterText || chapterText);
    if (lastChapter < firstChapter || lastChapter - firstChapter > 150) throw new Error(`Invalid scripture range: ${reference}`);
    const result: VerifiedVerse[] = [];
    for (let chapter = firstChapter; chapter <= lastChapter; chapter++) {
      const key = `${book} ${chapter}`;
      if (!chapters.has(key)) chapters.set(key, (async () => {
        const source = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(key)}&version=NIV`;
        const response = await fetcher(source, { signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error(`NIV source unavailable (${response.status}). Please retry.`);
        const verses = parseNivChapter(await response.text(), book, chapter, source);
        if (!verses.length) throw new Error(`No verified NIV text was returned for ${key}.`);
        return verses;
      })());
      const verses = await chapters.get(key)!;
      const start = chapter === firstChapter ? Number(firstText || 1) : 1;
      const end = chapter === lastChapter && firstText ? Number(lastText || firstText) : Number(verses.at(-1)!.reference.split(":")[1]);
      if (end < start) throw new Error(`Invalid scripture range: ${reference}`);
      for (let number = start; number <= end; number++) {
        const verse = verses.find(item => item.reference === `${book} ${chapter}:${number}`);
        if (!verse) throw new Error(`Missing NIV verse: ${book} ${chapter}:${number}. Presentation not generated.`);
        result.push(verse);
      }
    }
    return result;
  };
}

export async function verifyDeckScriptures<T extends { secondScriptureLesson: string; scriptureReading: { reference: string; text: string }[]; points: { supportingScriptures: { reference: string; text: string }[] }[] }>(deck: T, resolve = createNivResolver()) {
  deck.scriptureReading = preserveScriptureEmphasis(await resolve(deck.secondScriptureLesson), deck.scriptureReading);
  for (const point of deck.points) {
    const passages = await Promise.all(point.supportingScriptures.map(verse => resolve(verse.reference)));
    point.supportingScriptures = preserveScriptureEmphasis(passages.flat().filter((verse, index, all) => all.findIndex(other => other.reference === verse.reference) === index), point.supportingScriptures);
  }
  return deck;
}
