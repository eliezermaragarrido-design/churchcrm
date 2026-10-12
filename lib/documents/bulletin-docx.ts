import { readFileSync } from "node:fs";
import { join } from "node:path";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { WorshipSource } from "./worship-types";

type SermonPoint = { title?: string; explanationSlides?: string[]; supportingScriptures?: { reference?: string }[]; applicationSlides?: string[] };
type SermonDeck = { sermonTitle?: string; scriptureReading?: { reference?: string }[]; points?: SermonPoint[]; finalPhrase?: string };
const xmlEscape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const xmlText = (value: string) => value.replace(/<w:tab\/>/g, "\t").replace(/<w:br\/>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
const ordinal = (day: number) => day >= 11 && day <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[day % 10] || "th");

function westernEaster(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(Date.UTC(year, Math.floor((h + l - 7 * m + 114) / 31) - 1, (h + l - 7 * m + 114) % 31 + 1, 12));
}
function adventSunday(year: number) {
  const date = new Date(Date.UTC(year, 10, 27, 12));
  date.setUTCDate(date.getUTCDate() + (7 - date.getUTCDay()) % 7);
  return date;
}
export function methodistSundayName(serviceDate: string) {
  const date = new Date(serviceDate + "T12:00:00Z"), year = date.getUTCFullYear(), easter = westernEaster(year);
  const pentecost = new Date(easter); pentecost.setUTCDate(pentecost.getUTCDate() + 49);
  const advent = adventSunday(year);
  if (+date === +pentecost) return "Day of Pentecost";
  if (date > pentecost && date < advent) return `${Math.round((+date - +pentecost) / 604800000)}${ordinal(Math.round((+date - +pentecost) / 604800000))} Sunday after Pentecost`;
  if (date >= advent) return `${Math.round((+date - +advent) / 604800000) + 1}${ordinal(Math.round((+date - +advent) / 604800000) + 1)} Sunday of Advent`;
  if (+date === +easter) return "Easter Sunday";
  return "Sunday in the Christian Year";
}

function songNames(source: WorshipSource, slot: keyof NonNullable<WorshipSource["music"]>["songs"]) {
  const songs = source.music?.songs[slot] || [];
  return songs.map(song => song.title).join("”\n“") || "";
}
function paragraphs(xml: string) { return xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || []; }
function replaceExactParagraph(block: string, value: string, italic = false) {
  const properties = block.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] || "";
  let runProperties = block.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] || "";
  if (italic && !/<w:i\/?\>/.test(runProperties)) runProperties = runProperties ? runProperties.replace("</w:rPr>", "<w:i/><w:iCs/></w:rPr>") : "<w:rPr><w:i/><w:iCs/></w:rPr>";
  const pieces = value.split("\n").map((text, index) => `${index ? "<w:br/>" : ""}<w:t xml:space=\"preserve\">${xmlEscape(text)}</w:t>`).join("");
  return `<w:p>${properties}<w:r>${runProperties}${pieces}</w:r></w:p>`;
}
function replaceText(block: string, from: string, to: string) {
  const escaped = xmlEscape(from);
  return block.includes(escaped) ? block.replace(escaped, xmlEscape(to).replace(/\n/g, "</w:t><w:br/><w:t xml:space=\"preserve\">")) : block;
}
function referenceRange(deck: SermonDeck, fallback: string) {
  const references = deck.scriptureReading?.map(verse => verse.reference).filter(Boolean) as string[] || [];
  if (!references.length) return fallback;
  const first = references[0], last = references.at(-1)!;
  if (first === last) return first;
  const [book, start] = first.split(/\s+(?=\d)/), end = last.split(":").at(-1);
  return end ? `${book} ${start.split(":")[0]}:${start.split(":")[1]}–${end}` : fallback;
}

function sermonNotesSlots(notes: string, source: WorshipSource) {
  const lines = notes.replace(/\r/g, "").replace(/\*+/g, "").replace(/^\s*[-•]\s*/gm, "").split(/\n+/).map(line => line.trim()).filter(line => line && line !== "--");
  const valueAfter = (label: string) => {
    const index = lines.findIndex(line => line.toLowerCase() === label.toLowerCase());
    return index >= 0 ? lines[index + 1] || "" : "";
  };
  const firstPoint = lines.findIndex(line => /^1\.\s*/.test(line));
  const conclusion = lines.findIndex(line => /^conclusion:?$/i.test(line));
  if (firstPoint < 0) return [source.sermonTitle, ...lines.filter(line => line.toLowerCase() !== source.sermonTitle.toLowerCase()).slice(0, 11)].slice(0, 12);
  const pointEnd = conclusion >= 0 ? conclusion : lines.length;
  const pointStarts = lines.map((line, index) => /^\d+\.\s*/.test(line) ? index : -1).filter(index => index >= firstPoint && index < pointEnd).slice(0, 3);
  const points = pointStarts.map((start, index) => {
    const part = lines.slice(start, pointStarts[index + 1] || pointEnd);
    const field = (label: string) => part.find(line => line.toLowerCase().startsWith(label.toLowerCase())) || "";
    return { title: part[0], takeaway: field("Takeaway:"), scripture: field("Scripture:"), application: field("Application:") };
  });
  if (points.length !== 3) return [source.sermonTitle, ...lines.filter(line => line.toLowerCase() !== source.sermonTitle.toLowerCase()).slice(0, 11)].slice(0, 12);
  const title = valueAfter("Sermon Title:") || source.sermonTitle;
  const primary = valueAfter("Primary Scripture:");
  const bigIdea = valueAfter("Big Idea:");
  const final = conclusion >= 0 ? lines.slice(conclusion + 1).join(" ") : "";
  return [title, [primary && `Main Scripture: ${primary}`, bigIdea && `Big Idea: ${bigIdea}`].filter(Boolean).join("\n"), ...points.flatMap(point => [point.title, [point.takeaway, point.application].filter(Boolean).join("\n"), point.scripture]), final].slice(0, 12);
}

export function createBulletinDocx(source: WorshipSource, sermonNotes?: string) {
  if (!source.music || source.music.serviceDate !== source.serviceDate) throw new Error("Upload the matching weekly music before preparing the bulletin.");
  const deck = source.sermon as SermonDeck;
  if (!deck?.points?.length || !deck.finalPhrase) throw new Error("Finish the sermon PowerPoint before preparing the bulletin.");
  const template = unzipSync(readFileSync(join(process.cwd(), "lib", "documents", "templates", "bulletin-template.docx")));
  const document = strFromU8(template["word/document.xml"]);
  const body = document.match(/<w:body>[\s\S]*<\/w:body>/)?.[0];
  if (!body) throw new Error("Bulletin template is missing its document body.");
  let blocks = paragraphs(body);
  const get = (index: number) => xmlText(blocks[index]);
  const normalize = (value: string) => value.replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
  const find = (value: string, after = 0) => blocks.findIndex((block, index) => index >= after && normalize(get(index)) === normalize(value));
  const date = new Date(source.serviceDate + "T12:00:00Z");
  const header = `${date.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })} ${date.getUTCDate()}${ordinal(date.getUTCDate())} - ${methodistSundayName(source.serviceDate)}`;
  const replace = (oldText: string, newText: string) => { const index = find(oldText); if (index < 0) throw new Error(`Bulletin template slot is missing: ${oldText}`); blocks[index] = replaceExactParagraph(blocks[index], newText); };
  const replaceValue = (paragraph: string, oldValue: string, newValue: string, fallback: string) => {
    const index = find(paragraph);
    if (index < 0) throw new Error(`Bulletin template slot is missing: ${paragraph}`);
    const replaced = replaceText(blocks[index], oldValue, newValue);
    blocks[index] = replaced === blocks[index] ? replaceExactParagraph(blocks[index], fallback) : replaced;
  };
  replace("September 27th - 18th Sunday after Pentecost", header);
  replaceValue("“I Will Stand”\tScreen", "I Will Stand", songNames(source, "prelude"), `“${songNames(source, "prelude")}”\tScreen`);
  replaceValue("“I Choose to Praise You”\tScreen", "I Choose to Praise You", songNames(source, "call"), `“${songNames(source, "call")}”\tScreen`);
  replaceValue("Philippians 2:1-11\tAssociate Pastor Mara Garrido", "Philippians 2:1-11", source.firstScriptureLesson, `${source.firstScriptureLesson}\tAssociate Pastor Mara Garrido`);
  replace("Special \t“In the Beauty of Holiness”", `Special\t“${songNames(source, "special")}”`);
  replaceValue("*Doxology\t“Praise God, from Whom All Blessings”", "Praise God, from Whom All Blessings", songNames(source, "doxology"), `*Doxology\t“${songNames(source, "doxology")}”`);
  replaceValue("“In Jesus Name”\tScreen", "In Jesus Name", songNames(source, "praise"), `“${songNames(source, "praise")}”\tScreen`);
  const praiseStart = find("*Praise and Worship");
  if (praiseStart < 0) throw new Error("Bulletin template Praise and Worship section is missing.");
  blocks[praiseStart] = blocks[praiseStart].replace(/(<w:pPr>[\s\S]*?<\/w:pPr>)/, "$1<w:r><w:br w:type=\"column\"/></w:r>");
  replaceValue("John 13:3-15\tPastor Eliezer Garrido", "John 13:3-15", source.secondScriptureLesson, `${source.secondScriptureLesson}\tPastor Eliezer Garrido`);
  replace("“The Last Supper Lesson\"\tPastor Eliezer Garrido", `“${source.sermonTitle}”\tPastor Eliezer Garrido`);
  replaceValue("“I Give You My Heart”\tScreen", "I Give You My Heart", songNames(source, "response"), `“${songNames(source, "response")}”\tScreen`);
  replace("September 27, 2026", date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }));
  // Prayer requests are prepared manually. Keep this page exactly as it appears in
  // the print-ready template so its page break and the two Sermon Notes columns stay intact.
  const prayersStart = blocks.findIndex((block, index) => index > 0 && get(index).startsWith("Continued Prayers"));
  const notesStart = find("The Last Supper Lesson", prayersStart);
  if (prayersStart < 0 || notesStart < 0) throw new Error("Bulletin template prayer or sermon-note section is missing.");
  const main = referenceRange(deck, source.secondScriptureLesson);
  const noteStarts = blocks.map((block, index) => ({ index, text: xmlText(block) })).filter(item => item.text === "The Last Supper Lesson").map(item => item.index);
  if (noteStarts.length !== 2) throw new Error("Bulletin template needs two Sermon Notes copies.");
  const savedNotes = sermonNotes?.trim() ? sermonNotesSlots(sermonNotes, source) : null;
  for (const start of [...noteStarts].reverse()) {
    if (savedNotes) {
      for (let offset = 0; offset < 12; offset++) blocks[start + offset] = replaceExactParagraph(blocks[start + offset], savedNotes[offset] || "", offset === 11);
      continue;
    }
    blocks[start] = replaceExactParagraph(blocks[start], source.sermonTitle);
    blocks[start + 1] = replaceExactParagraph(blocks[start + 1], `Main Scripture:\n${main}`);
    deck.points.slice(0, 3).forEach((point, index) => {
      const row = start + 2 + index * 3;
      blocks[row] = replaceExactParagraph(blocks[row], `${index + 1}. ${point.title || ""}`);
      blocks[row + 1] = replaceExactParagraph(blocks[row + 1], [...(point.explanationSlides || []), ...(point.applicationSlides || [])].join(" "));
      blocks[row + 2] = replaceExactParagraph(blocks[row + 2], `Verses: ${(point.supportingScriptures || []).map(item => item.reference).filter(Boolean).join("; ")}`);
    });
    blocks[start + 11] = replaceExactParagraph(blocks[start + 11], deck.finalPhrase.replace(/^Final:\s*/i, ""));
  }
  // The second copy belongs at the top of the right Sermon Notes column. Without
  // this explicit column break, Word may leave the title at the foot of the left
  // column and begin the right column with the next paragraph.
  const rightNotesStart = noteStarts[1];
  blocks[rightNotesStart] = blocks[rightNotesStart].replace(
    /(<w:pPr>[\s\S]*?<\/w:pPr>)/,
    "$1<w:r><w:br w:type=\"column\"/></w:r>",
  );
  const sectionProperties = body.match(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/)?.[0];
  if (!sectionProperties) throw new Error("Bulletin template is missing its page layout.");
  const replacementBody = `<w:body>${blocks.join("")}${sectionProperties}</w:body>`;
  template["word/document.xml"] = strToU8(document.replace(body, replacementBody));
  return Buffer.from(zipSync(template, { level: 6 }));
}
