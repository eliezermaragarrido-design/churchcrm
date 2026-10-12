import { strToU8, zipSync } from "fflate";
import type { MeetingMinutes } from "./meeting-minutes-types";

const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const run = (text: string, bold = false) => `<w:r><w:rPr>${bold ? "<w:b/>" : ""}<w:color w:val="000000"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
const p = (text: string, style = "Normal", bold = false) => `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${run(text, bold)}</w:p>`;
const heading = (text: string) => p(text, "Heading1", true);
const bullet = (text: string) => `<w:p><w:pPr><w:ind w:left="360" w:hanging="180"/></w:pPr>${run("• ", true)}${run(text)}</w:p>`;

export function createMeetingMinutesDocx(title: string, minutes: MeetingMinutes) {
  const body = [p(title, "Title", true)];
  if (minutes.meetingDate) body.push(p(minutes.meetingDate, "Subtitle"));
  if (minutes.attendees.length) body.push(heading("Attendees"), ...minutes.attendees.map(bullet));
  body.push(heading("Meeting Summary"), ...minutes.summary.map(bullet));
  if (minutes.keyPoints.length) body.push(heading("Key Points"), ...minutes.keyPoints.map(bullet));
  if (minutes.decisions.length) body.push(heading("Decisions"), ...minutes.decisions.map(bullet));
  if (minutes.actionItems.length) body.push(heading("Action Items"), ...minutes.actionItems.map(item => bullet(`${item.task}. Owner: ${item.owner || "Not stated"}. Due: ${item.dueDate || "Not stated"}.`)));
  if (minutes.followUps.length) body.push(heading("Follow Up"), ...minutes.followUps.map(bullet));
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="22"/><w:color w:val="000000"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="90" w:line="260" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="44"/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="180"/></w:pPr><w:rPr><w:sz w:val="22"/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="180" w:after="60"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="000000"/></w:rPr></w:style></w:styles>`;
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`),
    "word/_rels/document.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "word/styles.xml": strToU8(styles),
    "word/document.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join("")}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="900" w:right="1120" w:bottom="900" w:left="1120" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`),
  };
  return Buffer.from(zipSync(files, { level: 6 }));
}
