import widths from "./calibri-bold-widths.json";

// Calibri Bold advances measured at 100px, stored in ems so exports are portable.
// Explicit line breaks and point sizes work before PowerPoint ever edits the file.
const glyphs: Record<string, number> = widths;
export function fitSlideText(text: string, width: number, height: number, maximum = 132) {
  const paragraphs = text.split(/\r?\n/).map(part => part.replace(/\s+/g, " ").trim()).filter(Boolean);
  for (let size = maximum; size >= 18; size -= 2) {
    const available = (width * 72 - 16) * 0.92;
    const measure = (value: string) => Array.from(value).reduce((sum, char) => sum + (glyphs[char] ?? 1), 0) * size;
    const lines: string[] = [];
    let line = "";
    let tooWide = false;
    for (const paragraph of paragraphs) {
      for (const word of paragraph.split(" ")) {
        if (measure(word) > available) { tooWide = true; break; }
        const candidate = line ? `${line} ${word}` : word;
        if (line && measure(candidate) > available) { lines.push(line); line = word; }
        else line = candidate;
      }
      if (line) lines.push(line);
      line = "";
    }
    // Reserve extra height for PowerPoint's actual Calibri line metrics and
    // paragraph rendering, instead of fitting against the edge of the box.
    if (!tooWide && lines.length * size * 1.4 <= height * 72 - 32) {
      return { text: lines.join("\n"), fontSize: size, lineSpacingMultiple: 1.0 };
    }
  }
  throw new Error("Slide text exceeds the safe layout. Split the content before exporting.");
}
