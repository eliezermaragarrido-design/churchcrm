import { strToU8, zipSync } from "fflate";
import { communionLiturgy } from "./communion-liturgy";
import { worshipComplete, type WorshipState, type WorshipSection } from "./worship-types";
import { songDetail, type MusicSlot } from "@/lib/worship-music";

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
function run(text: string, properties = "") { return `<w:r><w:rPr>${properties}</w:rPr><w:t xml:space="preserve">${esc(text.replace(/\s*—\s*/g, ", "))}</w:t></w:r>`; }
const bold = "<w:b/>";
const yellow = '<w:highlight w:val="yellow"/>';
const red = '<w:color w:val="FF0000"/>';
function para(runs: string, properties = "") { return `<w:p><w:pPr><w:widowControl/>${properties}</w:pPr>${runs}</w:p>`; }
function heading(label: string, detail = "", highlight = false, redStars = 0) {
  const stars = redStars ? run("*".repeat(redStars), red + bold) : "";
  return para(stars + run(label, bold + "<w:smallCaps/>" + (highlight ? yellow : "")) + (detail ? '<w:r><w:tab/></w:r>' + run(detail, '<w:sz w:val="22"/>') : ""),
    '<w:keepNext/><w:spacing w:before="200" w:after="80" w:line="240" w:lineRule="auto"/><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="10800"/></w:tabs>');
}
export function createWorshipDocx(state: WorshipState) {
  if (!worshipComplete(state)) throw new Error("The worship service is not complete. All sections require five reviews and a verified reading.");
  const source = state.source;
  if (source.music && source.music.serviceDate !== source.serviceDate) throw new Error("The music and worship service dates do not match.");
  const date = new Date(source.serviceDate + "T12:00:00Z"), day = date.getUTCDate();
  const ordinal = day >= 11 && day <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[day % 10] || "th");
  const body: string[] = [para(run(date.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }) + " " + day, bold) + run(ordinal, bold + '<w:vertAlign w:val="superscript"/>') + run(", " + date.getUTCFullYear(), bold), '<w:jc w:val="center"/><w:spacing w:after="180"/>')];
  const section = (key: WorshipSection) => state.sections[key]!.text.paragraphs.forEach((text, index, all) => body.push(para(run(text, key === "welcome" ? bold + '<w:color w:val="0070C0"/>' : ""), key === "welcome" ? '<w:spacing w:line="240" w:lineRule="auto" w:after="100"/>' : key === "children" ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:keepLines/>' + (index === all.length - 2 ? '<w:keepNext/>' : '') + '<w:spacing w:line="280" w:lineRule="auto" w:after="100"/>' : "")));
  const music = (slot: MusicSlot, label: string, stars = 0) => {
    const songs = source.music?.songs[slot] || [];
    if (songs.length === 1 && songDetail(songs[0]).length <= 72) { body.push(heading(label, songDetail(songs[0]), false, stars)); return; }
    body.push(heading(label, "", false, stars));
    for (const song of songs) body.push(para(run(songDetail(song)), '<w:spacing w:line="240" w:lineRule="auto" w:after="100"/>'));
  };
  music("prelude", "Prelude"); body.push(heading("Welcome & Announcements", "Associate pastor Mara Garrido"));
  section("welcome");
  for (const verse of state.welcomePsalm || []) body.push(para(run("The Bible says: “" + verse.text + "” " + verse.reference + " (NIV). Amen.", bold + '<w:color w:val="0070C0"/>'), '<w:keepLines/><w:spacing w:line="240" w:lineRule="auto" w:after="100"/>'));
  body.push(heading("Announcements this week", "", true), para(run(" ")), heading("Now please join me in the prayer of invocation"));
  section("invocation");
  body.push(heading("Children’s Time", "", true));
  for (const song of source.music?.songs.children || []) body.push(para(run(songDetail(song))));
  section("children");
  music("call", "Call to Worship Music", 3); body.push(heading("First Scripture Lesson", source.firstScriptureLesson + " (NIV)"));
  // One editable reading paragraph with superscript verse numbers, verbatim NIV.
  body.push(para(state.reading!.map(verse => run(verse.reference.split(":").at(-1)! + " ", '<w:vertAlign w:val="superscript"/>') + run(verse.text + " ")).join("")));
  body.push(para(run("THE WORD OF GOD FOR US THE CHILDREN OF GOD, THANKS BE TO GOD.", bold + red)), para(run("Let us have the preparation for prayer.", bold + red)));
  music("preparation", "Preparation for Prayer"); body.push(heading("Pastoral Prayer", "Associate pastor Mara Garrido"));
  section("pastoral");
  body.push(para(run("Our Father, who art in heaven, hallowed be thy name. Thy kingdom come, thy will be done on earth as it is in heaven. Give us this day our daily bread. And forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation, but deliver us from evil. For thine is the kingdom, and the power, and the glory, forever. Amen.", bold)));
  music("special", "Special Music"); music("doxology", "*Doxology"); body.push(heading("Offertory Prayer", "ASSOCIATE PASTOR MARA GARRIDO", false, 1)); section("offertory");
  music("praise", "*Praise & Worship Music"); body.push(heading("Second Scripture Lesson", source.secondScriptureLesson + " (NIV)"), heading("Sermon", "“" + source.sermonTitle + "”"));
  if (state.communion) {
    body.push(heading("Communion"));
    for (const [speaker, text] of communionLiturgy) body.push(para((speaker ? run(speaker + " ", yellow) : "") + run(text)));
  }
  body.push(heading("Benediction", "SR. PASTOR ELIEZER GARRIDO")); section("benediction");
  music("response", "*Music Response");
  const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const relns = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"';
  const files: Record<string, string> = {
    "[Content_Types].xml": `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`,
    "_rels/.rels": `<Relationships ${relns}><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    "word/_rels/document.xml.rels": `<Relationships ${relns}><Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="numbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`,
    "word/numbering.xml": `<w:numbering ${ns}><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="360"/></w:tabs><w:ind w:left="360" w:hanging="240"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`,
    "word/document.xml": `<w:document ${ns}><w:body>${body.join("")}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="720" w:bottom="620" w:left="720" w:header="0" w:footer="0"/></w:sectPr></w:body></w:document>`,
    "word/styles.xml": `<w:styles ${ns}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Ebrima" w:hAnsi="Ebrima" w:cs="Ebrima"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:color w:val="000000"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="360" w:lineRule="auto"/><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`,
  };
  return Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([name, value]) => [name, strToU8(xml + value)])), { level: 6 }));
}
