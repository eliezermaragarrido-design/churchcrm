import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import { groupIssues, type GroupState, type GroupContent } from "../lib/documents/grace-hope-types";
import { advanceGroup } from "../server/services/assistant/grace-hope-content";
import { createGroupDocx } from "../lib/documents/grace-hope-docx";

async function main() {
  const content: GroupContent = {
    openingPrayer: "Father, thank You for bringing us together. Help us listen with patience and speak honestly. Teach us to serve our families and neighbors with care. In Jesus’ name, Amen.",
    activity: { title: "A shared decision", method: "paired choice between two concrete responses", minutes: 5, instructions: ["Work with a partner. Read these two choices: spend ten minutes listening to a tired neighbor, or finish a household task before visiting.", "Each person chooses a response and explains the reason. Describe how urgency affects your choice. Passing is welcome.", "Share one consideration with the group. Listen for different responsibilities and needs."], connection: "Daily decisions reveal our priorities. Today you will discuss how following Jesus shapes those decisions." },
    readingReferences: ["John 13:14-15"], introduction: "Jesus served His disciples during their final meal together. His example helps you consider your own responsibilities. The monthly messages connect faith with daily choices, relationships and service.",
    truths: [1, 2, 3].map((n) => ({ title: ["Receive care with humility", "Make time for others", "Practice service this week"][n-1], sermonDates: [`2026-11-${String(n*7+1).padStart(2, "0")}`], references: ["John 13:14-15"], explanation: "Jesus washed His disciples’ feet during their final meal together. He performed a task associated with service, then instructed His followers to follow His example. His actions explain the meaning of humble care. A position of responsibility gives you opportunities to serve others. Paying attention to someone’s needs helps you choose useful actions. At home, a tired relative might need your patient attention before another task. In a group, a quieter person needs room to speak without interruption. These examples concern ordinary responsibilities. Begin by listening, then choose a response suited to the person and situation. Service grows through deliberate choices and steady practice.", application: "Choose one person and one helpful action for this week. Set aside time and follow through.", questions: ["Which responsibility needs more patience from you this week?"] })),
    finalQuestion: "Which action will you practice this week, and who will receive your care?",
    closingLeader: "Thank you for sharing. Choose one response from today’s conversation. Practice your response during the week and encourage someone from the group.",
    closingPrayer: "Father, thank You for our time together. Give us patience, humility and courage to serve. Help us follow Jesus in our homes and daily responsibilities. In Jesus’ name, Amen.",
  };
  const state: GroupState = { month: "2026-11", audience: "mixed", annualTheme: "Living a Life with Purpose", sources: content.truths.map(t => ({ date: t.sermonDates[0], title: t.title, series: "Service", scripture: "John 13:14-15", remarks: "Daily service", sermon: {} })), history: [], reviews: [], phase: "draft", repairs: 0 };
  assert.throws(() => createGroupDocx(state), /reviewed/);
  let calls = 0;
  const ask = async () => { calls++; return JSON.stringify(content); };
  const resolve = async () => [{ reference: "John 13:14", text: "Fixture verse with it and that; unchanged by prose rules.", source: "test", translation: "NIV" as const }];
  await advanceGroup(state, ask, resolve);
  assert.equal(state.phase, "scripture");
  await advanceGroup(state, ask, resolve);
  await advanceGroup(state, ask, resolve);
  assert.equal(state.reviews.length, 1);
  await advanceGroup(state, ask, resolve);
  assert.equal(state.phase, "complete"); assert.equal(calls, 3);
  assert.deepEqual(groupIssues(content, state.sources, []), []);
  assert.ok(groupIssues(content, state.sources, [content.activity]).some(s => /activity/.test(s)));
  assert.ok(groupIssues({ ...content, closingLeader: "It may just work; really." }, state.sources, []).length >= 2);
  assert.ok(groupIssues(content, [...state.sources, { ...state.sources[0], date: "2026-11-29" }], []).some(s => /omitted/.test(s)));
  const repair = structuredClone(state);
  repair.phase = "review";
  repair.content!.closingLeader = "It may help; try that.";
  await advanceGroup(repair, async prompt => {
    assert.ok(prompt.startsWith("TARGETED COPY EDIT"));
    return JSON.stringify({ replacements: { closingLeader: content.closingLeader, openingPrayer: "Unrequested changes are ignored." } });
  }, resolve);
  assert.equal(repair.phase, "complete");
  assert.equal(repair.content!.openingPrayer, content.openingPrayer);
  assert.deepEqual(repair.scriptures, state.scriptures);
  const buffer = createGroupDocx(state);
  const xml = strFromU8(unzipSync(buffer)["word/document.xml"]);
  assert.ok(xml.indexOf("Opening Prayer") < xml.indexOf("Opening Conversation"));
  assert.ok(xml.indexOf("Opening Conversation") < xml.indexOf("Scripture Reading"));
  assert.ok(xml.includes("Fixture verse with it and that; unchanged by prose rules."));
  assert.ok(xml.includes('w:top="720"'));
  mkdirSync("output/grace-hope", { recursive: true });
  writeFileSync("output/grace-hope/layout-test.docx", buffer);
  console.log("PASS: two reviews, complete-only download, sermon coverage, activity repetition, prose restrictions, unchanged verse text, template margins and section order.");
}
main().catch(e => { console.error(e); process.exitCode = 1; });
