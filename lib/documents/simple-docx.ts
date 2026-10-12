import { strToU8, zipSync } from "fflate";

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function cleanLine(value: string) {
  return value.replace(/^#{1,6}\s*/, "").replace(/\*\*/g, "").replace(/\\([.#*_\-])/g, "$1").replace(/^[-*]\s+/, "• ").trim();
}

function run(text: string, options: { bold?: boolean; italic?: boolean; color?: string; size?: number } = {}) {
  const properties = [options.bold ? "<w:b/>" : "", options.italic ? "<w:i/>" : "", options.color ? `<w:color w:val="${options.color}"/>` : "", options.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : ""].join("");
  return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ""}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function paragraphRuns(runs: string, style?: string) {
  return `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}</w:pPr>${runs}</w:p>`;
}

function paragraph(text: string, style?: string) {
  return paragraphRuns(run(text), style);
}

function labeledParagraph(label: string, value: string, italicValue = false) {
  return paragraphRuns(run(`${label.toUpperCase()}  `, { bold: true, color: "B07F16", size: 20 }) + run(value, { italic: italicValue }), "Detail");
}

function sermonParagraphs(body: string) {
  const lines = body.split(/\r?\n/).map(cleanLine).filter((line) => line && !/^-{3,}$/.test(line));
  const output: string[] = [];
  let sermonTitleUsed = false;

  for (const line of lines) {
    const titleMatch = line.match(/^(?:sermon title|title)\s*:\s*(.+)$/i);
    if (titleMatch) {
      output.push(paragraph(titleMatch[1], "Title"));
      sermonTitleUsed = true;
      continue;
    }
    if (!sermonTitleUsed && !/^(?:primary scripture|scripture|big idea|takeaway|application|conclusion)\s*:/i.test(line) && !/^\d+[.)]\s+/.test(line)) {
      output.push(paragraph(line, "Title"));
      sermonTitleUsed = true;
      continue;
    }
    const point = line.match(/^(\d+)[.)]\s*(.+)$/);
    if (point) {
      output.push(paragraphRuns(run(point[1].padStart(2, "0"), { bold: true, color: "B07F16", size: 22 }) + run(`   ${point[2]}`, { bold: true }), "Heading1"));
      continue;
    }
    const field = line.match(/^(primary scripture|scripture|big idea|takeaway|application|conclusion)\s*:\s*(.*)$/i);
    if (field) {
      const label = field[1].toLowerCase();
      const value = field[2];
      if (label === "conclusion") {
        output.push(paragraph("Conclusion", "Heading1"));
        if (value) output.push(paragraph(value));
      } else if (label === "primary scripture" || label === "big idea") {
        output.push(paragraph(label === "primary scripture" ? "PRIMARY SCRIPTURE" : "BIG IDEA", "SectionLabel"));
        output.push(paragraph(value, label === "primary scripture" ? "MetadataValue" : undefined));
      } else {
        output.push(labeledParagraph(label, value, label === "scripture"));
      }
      continue;
    }
    output.push(paragraph(line));
  }
  return output.join("");
}

function genericParagraphs(body: string) {
  const lines = body.split(/\r?\n/).map(cleanLine).filter((line) => line && !/^-{3,}$/.test(line));
  return lines.map((line, index) => {
    if (index === 0 || /^(sermon title|title)\s*:/i.test(line)) return paragraph(line.replace(/^(sermon title|title)\s*:\s*/i, ""), "Title");
    if (/^\d+[.)]\s+/.test(line)) return paragraph(line, "Heading1");
    if (/^(primary scripture|scripture|big idea|conclusion|application)\s*:/i.test(line)) return paragraph(line, "Heading2");
    return paragraph(line);
  }).join("");
}

export function createSimpleDocx(title: string, body: string) {
  const isSermonNotes = /^sermon notes\b/i.test(title) || /(?:^|\n)\s*(?:primary scripture|big idea|takeaway)\s*:/i.test(body);
  const paragraphs = isSermonNotes ? sermonParagraphs(body) : genericParagraphs(body);
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="21"/><w:color w:val="20262E"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="80"/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:sz w:val="48"/><w:color w:val="17324D"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="180"/></w:pPr><w:rPr><w:i/><w:sz w:val="20"/><w:color w:val="5E6873"/><w:spacing w:val="20"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="180" w:after="65"/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:sz w:val="28"/><w:color w:val="17324D"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="120" w:after="50"/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="17324D"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="SectionLabel"><w:name w:val="Section Label"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="40" w:after="15"/></w:pPr><w:rPr><w:b/><w:sz w:val="16"/><w:color w:val="B07F16"/><w:spacing w:val="14"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="MetadataValue"><w:name w:val="Metadata Value"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="100"/></w:pPr><w:rPr><w:b/><w:sz w:val="23"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Detail"><w:name w:val="Detail"/><w:basedOn w:val="Normal"/><w:pPr><w:left w:left="260" w:hanging="260"/><w:spacing w:after="55"/></w:pPr></w:style></w:styles>`;

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`),
    "word/_rels/document.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "word/document.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraph(isSermonNotes ? title.toUpperCase() : title, "Subtitle")}${paragraphs}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="900" w:right="1120" w:bottom="900" w:left="1120" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`),
    "word/styles.xml": strToU8(styles),
    "docProps/core.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeXml(title)}</dc:title><dc:creator>PastorCRM</dc:creator></cp:coreProperties>`),
    "docProps/app.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>PastorCRM</Application></Properties>`),
  };
  return Buffer.from(zipSync(files, { level: 6 }));
}
