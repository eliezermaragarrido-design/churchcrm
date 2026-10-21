import { readFileSync } from "node:fs";
import path from "node:path";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { GROUP_DISCUSSION_VERSION, groupContent, groupIssues, type GroupState } from "./grace-hope-types";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
export function createGroupDocx(state: GroupState) {
  if (state.phase !== "complete" || state.reviews.length < 2 || !state.scriptures) throw new Error("The monthly guide is still being reviewed.");
  const c = groupContent.parse(state.content);
  // Existing completed guides remain downloadable. New guides must also pass
  // the simple-question checks; both get the same duplicate-free rendering.
  if (groupIssues(c, state.sources, state.history, state.discussionVersion === GROUP_DISCUSSION_VERSION).length) throw new Error("The monthly guide has unresolved editorial checks.");
  for (const ref of [...c.readingReferences, ...c.truths.flatMap(t => t.references)]) {
    if (!state.scriptures[ref]?.length) throw new Error("A verified passage is missing from the monthly guide.");
  }
  const zip = unzipSync(readFileSync(path.join(process.cwd(), "lib/documents/templates/grace-hope-template.docx")));
  const xml = strFromU8(zip["word/document.xml"]);
  const section = xml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0];
  if (!section) throw new Error("The group document template is missing page settings.");
  const p = (text: string, heading = false, title = false) => `<w:p><w:pPr>${title ? '<w:pStyle w:val="Title"/>' : ''}<w:widowControl/>${heading ? '<w:keepNext/>' : ''}</w:pPr><w:r><w:rPr>${heading ? '<w:b/>' : ''}<w:color w:val="000000"/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
  const month = new Date(state.month + "-01T12:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const body = [p(`Grace and Hope Groups ${month}`, true, true)];
  if (state.annualTheme) body.push(p(`${state.month.slice(0, 4)} Theme: ${state.annualTheme}`, true));
  body.push(p("Sermon Series: " + [...new Set(state.sources.map(s => s.series))].join(" / "), true),
    p("How the Meeting Works", true), p("The leader reads each question aloud. Each person takes a turn to share or pass. Keep personal stories within the group. After each round, the leader offers a short summary. Listen, reflect, encourage one another, and practice following Jesus in daily life."),
    p("Opening Prayer", true), p(c.openingPrayer), p("Opening Conversation", true), p(`${c.activity.title} (${c.activity.minutes} minutes)`, true));
  c.activity.instructions.forEach((step, i) => body.push(p(`${i + 1}. ${step}`)));
  body.push(p(c.activity.connection), p("Scripture Reading", true));
  for (const ref of c.readingReferences) {
    if (!state.scriptures[ref]?.length) throw new Error("A verified scripture reading is missing.");
    body.push(p(`${ref} (NIV)`, true), p(state.scriptures[ref].map(v => v.text).join(" ")));
  }
  body.push(p("Leader", true), p(c.introduction), p(`${c.truths.length} Truths for Daily Life`, true));
  const reflection = (questions: string[]) => {
    body.push(p("STOP THINK MEDITATE: 30 to 60 seconds", true), p("Then share", true));
    body.push(p(questions[0], true));
    body.push(p("________________________________________________________________________________"), p("________________________________________________________________________________"));
  };
  c.truths.forEach((truth, i) => {
    body.push(p(`${i + 1}. ${truth.title}`, true), p("Leader", true), p(truth.explanation), p("Scripture: " + truth.references.join(", ")), p("Application", true), p(truth.application));
    reflection(truth.questions);
  });
  body.push(p("Final Group Question", true)); reflection([c.finalQuestion]);
  body.push(p("Leader", true), p(c.closingLeader), p("Closing Prayer", true), p(c.closingPrayer));
  zip["word/document.xml"] = strToU8(xml.replace(/<w:body>[\s\S]*<\/w:body>/, `<w:body>${body.join("")}${section}</w:body>`));
  return Buffer.from(zipSync(zip, { level: 6 }));
}
