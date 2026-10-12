import { unzipSync, strFromU8 } from "fflate";
import * as XLSX from "xlsx";

const scripturePattern = /\b(?:Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1\s*Samuel|2\s*Samuel|1\s*Kings|2\s*Kings|Psalms?|Proverbs|Isaiah|Jeremiah|Ezekiel|Daniel|Matthew|Mark|Luke|John|Acts|Romans|1\s*Corinthians|2\s*Corinthians|Galatians|Ephesians|Philippians|Colossians|1\s*Thessalonians|2\s*Thessalonians|1\s*Timothy|2\s*Timothy|Titus|Philemon|Hebrews|James|1\s*Peter|2\s*Peter|1\s*John|2\s*John|3\s*John|Jude|Revelation)\s+\d+[:.]\d+(?:[–-]\d+)?\b/i;

function asDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    const year = value.getUTCFullYear();
    return year >= 2020 && year <= 2100 ? value : null;
  }
  if (typeof value === "number") {
    if (value < 20000 || value > 80000) return null;
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    const year = date.getUTCFullYear();
    return year >= 2020 && year <= 2100 ? date : null;
  }
  if (typeof value !== "string" || !/(?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i.test(value)) return null;
  const match = value.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/i);
  const parsed = new Date(match?.[0] || value);
  const year = parsed.getUTCFullYear();
  return Number.isNaN(parsed.valueOf()) || year < 2020 || year > 2100 ? null : parsed;
}

function text(value: unknown) { return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value == null ? "" : String(value).trim(); }
function valueAfter(values: string[], pattern: RegExp) {
  const index = values.findIndex((value) => pattern.test(value.replace(/:$/, "").trim()));
  return index >= 0 ? values[index + 1] || "" : "";
}

export function parseSermonCalendar(workbook: XLSX.WorkBook) {
    const plans: Array<{ serviceDate: Date; title: string; series: string; scriptureReference: string; firstScriptureLesson: string; secondScriptureLesson: string; sermonRemarks: string; mainIdea: string; raw: string }> = [];
    for (const sheetName of workbook.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: true, defval: "" });
      for (let index = 0; index < rows.length; index += 1) {
        const date = rows[index].map(asDate).find(Boolean) as Date | undefined;
        if (!date || date.getUTCFullYear() < 2020) continue;
        const nextDate = rows.findIndex((row, next) => next > index && row.some(cell => asDate(cell)));
        const block = rows.slice(index, nextDate < 0 ? rows.length : nextDate);
        const window = block.flat().map(text).filter(Boolean);
        const scriptures = [...new Set(window.filter((value) => value.match(scripturePattern)?.[0] === value).map((value) => value.match(scripturePattern)?.[0] || value))];
        const titleRow = block.findIndex(row => row.some(cell => /^sermon title:?$/i.test(text(cell))));
        const titleColumn = titleRow < 0 ? -1 : block[titleRow].findIndex(cell => /^sermon title:?$/i.test(text(cell)));
        const rightTitle = titleRow < 0 ? "" : block[titleRow].slice(titleColumn + 1).map(text).find(value => value && !/^title$/i.test(value));
        const belowTitle = titleRow < 0 ? "" : block.slice(titleRow + 1).map(row => text(row[titleColumn])).find(value => value);
        const title = rightTitle || belowTitle || "Untitled sermon";
        if (title === "Untitled sermon" || /^Selected Scripture|^Sermon Title|^Title$/i.test(title)) continue;
        const ideas = window.filter((value) => value.length > 35 && !scripturePattern.test(value) && !/^sermon title$/i.test(value) && value !== title);
        const firstScriptureLesson = valueAfter(window, /^first scripture lesson$/i) || scriptures[0] || "";
        const secondScriptureLesson = valueAfter(window, /^second scripture lesson$/i) || scriptures[1] || scriptures[0] || "";
        const headerSeries = rows.slice(0, index).flat().filter(cell => typeof cell === "string").map(cell => String(cell).match(/Sermon Series(?: Title)?:\s*([^\r\n]+)/i)?.[1]?.trim()).filter(Boolean).at(-1);
        const series = valueAfter(window, /^(?:sermon )?series(?: title)?$/i) || headerSeries || "";
        const remarkCells = block.filter(row => scripturePattern.test(text(row[0]))).map(row => text(row[1])).filter(value => value.length > 25);
        const sermonRemarks = valueAfter(window, /^sermon remarks?$/i) || remarkCells.join(" ") || ideas.join(" ");
        plans.push({ serviceDate: new Date(date.toISOString().slice(0, 10) + "T12:00:00Z"), title, series, scriptureReference: secondScriptureLesson || firstScriptureLesson, firstScriptureLesson, secondScriptureLesson, sermonRemarks, mainIdea: ideas[0] || "", raw: `${sheetName}: ${window.join(" | ")}` });
      }
    }
    
    const unique = [...new Map(plans.map((plan) => [plan.serviceDate.toISOString().slice(0, 10), plan])).values()];
  return unique;
}

// Use the saved active worksheet only to choose the initial display month, never to rewrite dates.
export function activeCalendarMonth(bytes: Uint8Array, workbook: XLSX.WorkBook, plans: ReturnType<typeof parseSermonCalendar>) {
  try {
    const xml = unzipSync(bytes, { filter: file => file.name === "xl/workbook.xml" })["xl/workbook.xml"];
    const active = xml ? Number(strFromU8(xml).match(/<workbookView\b[^>]*\bactiveTab="(\d+)"/)?.[1] || 0) : 0;
    const name = workbook.SheetNames[active];
    const months = [...new Set(plans.filter(plan => plan.raw.startsWith(name + ":") && plan.serviceDate.getUTCDay() === 0).map(plan => plan.serviceDate.toISOString().slice(0, 7)))];
    return months.length === 1 ? months[0] : undefined;
  } catch { return undefined; }
}
