import assert from "node:assert/strict";
import { generateReviewedSermonImage } from "../server/services/assistant/service";
import { sermonVisualContext } from "../server/services/assistant/sermon-image-context";

async function main() {
  const prompt = sermonVisualContext("Worshippers in robes", "Families worship together in their church today.");
  let generated = 0;
  let reviewed = 0;
  const client = {
    images: { generate: async () => ({ data: [{ b64_json: `candidate-${++generated}` }] }) },
    responses: { create: async () => {
      reviewed++;
      return { output_text: JSON.stringify({
        pass: true, score: 99, issues: [], improvementPrompt: "",
        eraConsistent: generated > 1,
      }) };
    } },
  };
  const result = await generateReviewedSermonImage(client as any, prompt, "Worship");
  assert.equal(result.image, "candidate-2", "Even a 99-score image must be rejected for mixed eras");
  assert.equal(reviewed, 3, "Replacement must pass both reviews");

  generated = 0;
  client.responses.create = async () => ({ output_text: JSON.stringify({
    pass: true, score: 100, issues: [], improvementPrompt: "", eraConsistent: false,
  }) });
  await assert.rejects(generateReviewedSermonImage(client as any, prompt, "Worship"), /another simplified composition/);
  assert.equal(generated, 3, "Rejected images must never escape through the best-candidate fallback");
  console.log("PASS: mixed eras rejected despite high scores; two reviews required; rejected fallback blocked.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
