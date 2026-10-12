import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { createMeetingMinutesDocx } from "../lib/documents/meeting-minutes-docx";
import { meetingMinutes, minutesIssues } from "../lib/documents/meeting-minutes-types";

const minutes = meetingMinutes.parse({
  meetingDate: "October 12, 2026",
  attendees: ["Eliezer Garrido", "Maria Lopez"],
  summary: ["Council reviewed the fall outreach plan.", "The group assigned preparation tasks for Trunk and Treat."],
  keyPoints: ["Food orders need confirmation before Friday."],
  decisions: ["Council approved the outreach supply budget."],
  actionItems: [{ task: "Confirm food order", owner: "Maria Lopez", dueDate: "October 16, 2026" }, { task: "Share volunteer schedule", owner: "Not stated", dueDate: "Not stated" }],
  followUps: ["Review volunteer responses during the next council meeting."],
});

assert.deepEqual(minutesIssues(minutes), []);
assert.ok(minutesIssues({ ...minutes, summary: ["It may work; truly."] }).length > 0);
const file = createMeetingMinutesDocx("Council Meeting Minutes", minutes);
const xml = strFromU8(unzipSync(file)["word/document.xml"]);
for (const expected of ["Council Meeting Minutes", "Attendees", "Meeting Summary", "Key Points", "Decisions", "Action Items", "Follow Up", "Confirm food order", "Maria Lopez"]) assert.ok(xml.includes(expected), expected);
mkdirSync("output/meeting-minutes", { recursive: true });
writeFileSync("output/meeting-minutes/meeting-minutes-fixture.docx", file);
console.log("PASS: structured minutes validate, reject prohibited copy and create a Word download.");
