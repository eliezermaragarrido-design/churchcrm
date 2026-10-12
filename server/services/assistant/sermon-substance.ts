import type OpenAI from "openai";

export async function refineSermonSubstance(client: OpenAI, deck: any, save: () => Promise<void> = async () => {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
  const result = await client.responses.create({ model: "gpt-4.1", max_output_tokens: 16000, text: { format: { type: "json_object" } }, input: `Act as a rigorous biblical and pastoral editor. Audit and revise these three lessons for specific value, not emotional adjectives. Before revising each point, run three internal commentary checks: follow the immediate literary flow, test historical context only where the passage supports it, and compare the point with the Bible’s wider witness about Christ and the church. Use those checks to remove weak claims. Do not name, quote, or invent a commentary source. Return JSON {"points":[{"explanationSlides":["complete statements totaling 45-70 words"],"applicationSlides":["complete statements totaling 22-35 words"],"audit":"specific weak or unsupported claim removed and how the revision adds value"}]} in the same order, exactly three.
Keep the point titles, logical progression, and interpretation grounded in the supplied verified main passage. Each explanation must show a particular textual detail and WHY it changes our understanding of the central theme. Remove invented historical claims, speculative psychology stated as fact, etymologies, unsupported promises and clichés. Do not call an action a violation of tradition without evidence. Distinguish inference from what the passage says. Do not quote long stretches of Scripture again. The goal is insight we could not obtain by replacing the passage with any other text.
Each explanation must start with a clear bridge from the prior point. Point one answers the opening tension. Point two shows the next response this truth requires. Point three shows the life we now live together. Each application must give ONE concise daily-life practice for its exact lesson: who or what situation we face, what we do differently, and the resistance or cost. Use simple spoken English and select one useful response rather than a list. Do not just say offer help, cross boundaries, serve others, accept love, or look for opportunities. No vague settings or interchangeable virtues. Give the three lessons distinct applications. Use we, us, our. No em dashes, semicolons or inflated language. Never pad for length. Maintain the word limits. Return the revised prose, not instructions to the preacher.
${JSON.stringify({ title: deck.sermonTitle, mainReading: deck.scriptureReading, points: deck.points.map((p: any) => ({ title: p.title, explanationSlides: p.explanationSlides, applicationSlides: p.applicationSlides })), previousCorrection: deck.substanceCorrection })}` });
  const revised = JSON.parse((result.output_text || "{}").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  const valid = (items: unknown, min: number, max: number) => Array.isArray(items) && items.every(item => typeof item === "string") && items.join(" ").trim().split(/\s+/).length >= min && items.join(" ").trim().split(/\s+/).length <= max;
  if (revised.points?.length !== 3 || !revised.points.every((p: any) => valid(p.explanationSlides, 40, 75) && valid(p.applicationSlides, 20, 38) && typeof p.audit === "string" && p.audit.trim())) {
    const count = (value: unknown) => Array.isArray(value) ? value.join(" ").trim().split(/\s+/).length : 0;
    deck.substanceCorrection = { previous: revised, instruction: "Repair only invalid fields. Explanation must be 40-75 words and application 20-38 words. Aim at 58 and 30. Retain good specific content; no padding. Three points and audits required.", counts: revised.points?.map((p: any) => ({ explanation: count(p.explanationSlides), application: count(p.applicationSlides) })) };
    await save();
    continue;
  }
  deck.points = deck.points.map((p: any, i: number) => ({ ...p, explanationSlides: revised.points[i].explanationSlides, applicationSlides: revised.points[i].applicationSlides }));
  deck.substanceReview = revised.points.map((p: any) => p.audit);
  delete deck.substanceCorrection;
  return;
  }
  throw new Error("The substance review needs a correction to meet the concise lesson requirements. Correction details are saved.");
}
