import * as XLSX from "xlsx";

export const musicLabels = { prelude: "Prelude", children: "Children’s Time", call: "Call to Worship", preparation: "Preparation for Prayer", special: "Special Music", doxology: "Doxology", praise: "Praise & Worship Music", response: "Music Response" } as const;
export type MusicSlot = keyof typeof musicLabels;
export type WorshipSong = { title: string; verses: string; book: string; page: string; notes: string };
export type MusicPlan = { serviceDate: string; filename: string; songs: Partial<Record<MusicSlot, WorshipSong[]>> };
const normalized = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
export function filenameDate(filename: string) {
  const match = filename.match(/(?:^|\D)(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})(?:\D|$)/);
  if (!match) return "";
  const date = `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  return validServiceDate(date) ? date : "";
}
export function validServiceDate(date: string) { return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date + "T12:00:00Z").toISOString().slice(0, 10) === date; }
export function songVerses(value: unknown) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(?:v(?:erse)?s?\.?\s*)?(\d+(?:\s*(?:,|&|and|[-–])\s*\d+)*)$/i);
  return match ? "v. " + match[1].replace(/\s*,\s*/g, ", ") : "";
}
export function musicMissing(plan?: MusicPlan) {
  return (Object.keys(musicLabels) as MusicSlot[]).filter(key => key !== "children" && !plan?.songs[key]?.length).map(key => musicLabels[key]);
}
export function parseWorshipMusic(workbook: XLSX.WorkBook, filename: string, selectedDate?: string): MusicPlan {
  const detected = filenameDate(filename), serviceDate = selectedDate || detected;
  if (!validServiceDate(serviceDate)) throw new Error("Choose the service date for this music workbook.");
  if (detected && selectedDate && detected !== selectedDate) throw new Error(`The filename is dated ${detected}. Select that service date to avoid mixing weeks.`);
  const songs: MusicPlan["songs"] = {};
  const aliases: Record<string, MusicSlot> = { prelude: "prelude", childrenstime: "children", childrensmusic: "children", calltoworship: "call", calltoworshipmusic: "call", prepforprayer: "preparation", preparationforprayer: "preparation", special: "special", specialmusic: "special", doxology: "doxology", praiseworship: "praise", praiseandworship: "praise", praiseandworshipmusic: "praise", praiseworshipmusic: "praise", musicresponse: "response", musicofresponse: "response", musicofrespond: "response" };
  for (const name of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: "" });
    const head = rows.findIndex(row => row.some(cell => normalized(cell) === "placement") && row.some(cell => normalized(cell) === "songname"));
    if (head < 0) continue;
    const headers = rows[head].map(normalized), column = (row: unknown[], key: string) => String(row[headers.indexOf(key)] ?? "").trim();
    for (const row of rows.slice(head + 1)) {
      const placement = normalized(column(row, "placement"));
      if (placement === "notes" || /rehearsal/.test(placement)) break;
      const slot = aliases[placement]; if (!slot) continue;
      const title = column(row, "songname");
      if (!title || /^(sermon|\(eliezer\))$/i.test(title)) continue;
      const song = { title, verses: songVerses(column(row, "verses")), book: column(row, "book").replace(/\bCCLI\b.*$/i, "").trim(), page: column(row, "page"), notes: column(row, "notes").replace(/\bCCLI\b(?:\s*#?\d+)?/gi, "").trim() };
      if (!songs[slot]?.some(saved => JSON.stringify(saved) === JSON.stringify(song))) (songs[slot] ||= []).push(song);
    }
  }
  if (!Object.keys(songs).length) throw new Error("No music found. Use Placement and Song Name columns.");
  return { serviceDate, filename, songs };
}
export function songDetail(song: WorshipSong) { return [song.title, song.verses, [song.book, song.page].filter(Boolean).join(" "), song.notes].filter(Boolean).join(" · "); }
