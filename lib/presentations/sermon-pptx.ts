import path from "node:path";
import PptxGenJS from "pptxgenjs";
import { deduplicatePresentationMedia } from "./presentation-media";
import { fitSlideText } from "./text-layout";
import { scriptureWordEmphasis } from "./scripture-emphasis";

type Scripture = { reference: string; text: string; translation?: string; source?: string; highlights?: string[] };
type SermonPoint = { title: string; explanationSlides: string[]; supportingScriptures: Scripture[]; applicationSlides: string[] };
type SermonDeck = {
  seriesTitle: string;
  sermonTitle: string;
  firstScriptureLesson: string;
  secondScriptureLesson: string;
  introductions: Array<{ title?: string; slides: string[] }>;
  humor: { setup: string; punchline: string };
  scriptureReading: Scripture[];
  points: SermonPoint[];
  finalPhrase: string;
  assets?: { seriesImage?: string | null; sermonImage?: string | null; pointImages?: Array<string | null>; introductionImages?: Array<string | null>; humorImage?: string | null };
};

const creed = [
  "Apostles Creed",
  "I believe in God, the Father Almighty, maker of heaven and earth;",
  "And in Jesus Christ his only Son, our Lord;",
  "who was conceived by the Holy Spirit, born of the Virgin Mary,",
  "suffered under Pontius Pilate, was crucified, dead, and buried;",
  "the third day he rose from the dead; he ascended into heaven,",
  "and sitteth at the right hand of God the Father Almighty;",
  "from thence he shall come to judge the quick and the dead.",
  "I believe in the Holy Spirit, the holy universal church,",
  "the communion of saints, the forgiveness of sins,",
  "the resurrection of the body, and the life everlasting. Amen.",
];

function imageData(value?: string | null) { return value ? `data:image/png;base64,${value}` : null; }

function words(value: string) { return value.trim().split(/\s+/).filter(Boolean); }

export function splitForSlides(value: string, maximumWords = 12) {
  const tokens = words(value.replace(/\s+/g, " "));
  if (!tokens.length) return [];
  // Balance the whole passage, including its opening and final fragments.
  // Prefer sentence/clause boundaries only when both sides remain readable.
  const result: string[] = [];
  let offset = 0;
  while (tokens.length - offset > maximumWords) {
    const remaining = tokens.length - offset;
    const ideal = Math.ceil(remaining / Math.ceil(remaining / maximumWords));
    let count = ideal;
    let bestScore = Infinity;
    for (let candidate = Math.max(3, ideal - 2); candidate <= Math.min(maximumWords, remaining - 3); candidate++) {
      const previous = tokens[offset + candidate - 1];
      const next = tokens[offset + candidate];
      const boundary = /[.!?;,:][”"']?$/.test(previous) || /^(but|and|because|when|while|yet|then)$/i.test(next);
      const score = Math.abs(candidate - ideal) - (boundary ? 1.5 : 0);
      if (score < bestScore) { bestScore = score; count = candidate; }
    }
    result.push(tokens.slice(offset, offset + count).join(" "));
    offset += count;
  }
  result.push(tokens.slice(offset).join(" "));
  return result;
}

function fontSizeFor(text: string) {
  const length = text.trim().length;
  const count = words(text).length;
  if (count <= 2 && length <= 20) return 188;
  if (count <= 5 && length <= 34) return 156;
  if (count <= 8 && length <= 48) return 132;
  if (count <= 12 && length <= 64) return 100;
  if (count <= 16 && length <= 82) return 92;
  return 84;
}

export async function createSermonPowerPoint(deck: SermonDeck) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "PastorCRM";
  pptx.subject = deck.sermonTitle;
  pptx.title = deck.sermonTitle;
  pptx.company = "First Methodist Church of Dimmitt";
  pptx.theme = { headFontFace: "Calibri", bodyFontFace: "Calibri" };
  const background = path.join(process.cwd(), "public", "sermon-assets", "classic-background.jpg");

  function addBackground(slide: any) { slide.background = { path: background }; }
  function addTextSlide(text: string, color = "FFFF00", size?: number, italic = false, emphasis?: boolean[]) {
    const slide = pptx.addSlide(); addBackground(slide);
    const layout = fitSlideText(text, 12.13, 6.3, Math.min(size || fontSizeFor(text), 156));
    let token = 0;
    const rich = emphasis ? layout.text.split(/(\s+)/).filter(Boolean).map(part => ({ text: part, options: { color: /\S/.test(part) ? (emphasis[token++] ? "FF9900" : color) : color } })) : layout.text;
    slide.addText(rich, { x: 0.6, y: 0.6, w: 12.13, h: 6.3, fontFace: "Calibri", fontSize: layout.fontSize, bold: true, italic, color, align: "center", valign: "middle", margin: 8, paraSpaceAfter: 0, lineSpacingMultiple: 1, breakLine: false, shadow: { type: "outer", color: "000000", blur: 2, angle: 45, opacity: 0.45 } });
    return slide;
  }

  function addImageTitleSlide(title: string, base64?: string | null) {
    const slide = pptx.addSlide();
    const data = imageData(base64);
    if (data) {
      slide.addImage({ data, x: 0, y: 0, w: 13.333, h: 7.5, sizing: { type: "cover", w: 13.333, h: 7.5 } });
    } else {
      addBackground(slide);
    }
    // Keep all title lettering editable and exact. Generated images contain no text.
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 5.45, w: 13.333, h: 2.05,
      fill: { color: "000000", transparency: 32 },
      line: { color: "000000", transparency: 100 },
    });
    const titleLayout = fitSlideText(title, 12.23, 1.55, 44);
    slide.addText(titleLayout.text, {
      x: 0.55, y: 5.67, w: 12.23, h: 1.55,
      fontFace: "Calibri", fontSize: titleLayout.fontSize, bold: true, color: "FFFFFF",
      align: "center", valign: "middle", margin: 8, paraSpaceAfter: 0,
      breakLine: false,
      shadow: { type: "outer", color: "000000", blur: 2, angle: 45, opacity: 0.55 },
    });
    return slide;
  }

  function addIntroductionImage(base64?: string | null) {
    if (!base64) return; // Older saved decks do not have introduction artwork.
    const slide = pptx.addSlide();
    slide.addImage({ data: imageData(base64)!, x: 0, y: 0, w: 13.333, h: 7.5 });
  }


  creed.forEach((text, index) => {
    const slide = addTextSlide(text, "FFFFFF", index === 0 ? 166 : fontSizeFor(text));
    if (index === 8) slide.addText("**Catholic", { x: 9.7, y: 6.55, w: 2.8, h: 0.35, fontFace: "Calibri", fontSize: 11, color: "FFFFFF", align: "right" });
  });

  addImageTitleSlide(deck.seriesTitle, deck.assets?.seriesImage);
  addImageTitleSlide(deck.sermonTitle, deck.assets?.sermonImage);
  for (const [index, introduction] of deck.introductions.slice(0, 2).entries()) {
    addIntroductionImage(deck.assets?.introductionImages?.[index]);
    splitForSlides(introduction.slides.join(" ")).forEach((part) => addTextSlide(part));
  }
  addIntroductionImage(deck.assets?.humorImage);
  if (words(deck.humor.setup).length < 3 || words(deck.humor.punchline).length < 3) {
    splitForSlides([deck.humor.setup, deck.humor.punchline].join(" ")).forEach((part) => addTextSlide(part));
  } else {
    splitForSlides(deck.humor.setup).forEach((part) => addTextSlide(part));
    splitForSlides(deck.humor.punchline).forEach((part) => addTextSlide(part));
  }
  addTextSlide(`Second Scripture Lesson\n${deck.secondScriptureLesson} (NIV)`, "FFFFFF", 88);
  function addScriptures(verses: Scripture[]) {
    const emphasis = verses.flatMap(scriptureWordEmphasis);
    let offset = 0;
    // Paginate continuous scripture text so even a short verse stays with its
    // neighboring text. Preserve every word, with references in speaker notes.
    splitForSlides(verses.map(verse => verse.text).join(" "), 10).forEach(part => {
      const count = words(part).length;
      const slide = addTextSlide(part, "FFFFFF", undefined, false, emphasis.slice(offset, offset + count));
      offset += count;
      slide.addNotes(verses.map(verse => verse.reference + " (NIV). Source: " + (verse.source || "Verified NIV passage")).join("\n"));
    });
  }
  addScriptures(deck.scriptureReading);

  deck.points.slice(0, 3).forEach((point, index) => {
    addImageTitleSlide(`${index + 1}. ${point.title}`, deck.assets?.pointImages?.[index]);
    splitForSlides(point.explanationSlides.join(" ")).forEach((part) => addTextSlide(part));
    // References are visible for supporting passages, unlike the continuous
    // main reading. Keep adjacent verses together, never join different texts.
    const groups: Scripture[][] = [];
    for (const verse of point.supportingScriptures) {
      const group = groups[groups.length - 1];
      const previous = group?.[group.length - 1].reference.match(/^(.*\d+):(\d+)$/);
      const current = verse.reference.match(/^(.*\d+):(\d+)$/);
      if (group && previous && current && previous[1] === current[1] && Number(current[2]) === Number(previous[2]) + 1) group.push(verse);
      else groups.push([verse]);
    }
    for (const group of groups) {
      const reference = group[0].reference + (group.length > 1 ? "–" + group[group.length - 1].reference.split(":").pop() : "");
      addTextSlide(reference + "\n(NIV)", "FFFFFF", 132);
      addScriptures(group);
    }
    splitForSlides(point.applicationSlides.join(" ")).forEach((part, index) =>
      addTextSlide(index === 0 ? "Application: " + part : part, "FFFF00"));
  });

  addTextSlide(`Final: ${deck.finalPhrase.replace(/^final:\s*/i, "")}`, "FFFF00");
  addImageTitleSlide(deck.seriesTitle, deck.assets?.seriesImage);
  addImageTitleSlide(deck.sermonTitle, deck.assets?.sermonImage);
  return deduplicatePresentationMedia(Buffer.from(await pptx.write({ outputType: "nodebuffer" }) as Buffer));
}

