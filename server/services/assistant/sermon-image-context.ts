export const sermonImageContextRules = `Choose the visual era from what the spoken text describes, not from the fact that this is a Christian sermon. Default to present-day life or a timeless still life. Prayer, the Lord's Prayer, worship, faith, forgiveness, and family do not by themselves imply an ancient setting.
For a present-day family praying or repeating the Lord's Prayer in a church, show ordinary modern clothes and a modern church. Never dress contemporary worshippers in biblical robes, tunics, ancient sandals, or head coverings merely to signal Christianity.
Use ancient clothing only when the spoken content explicitly depicts a historical biblical event or people in that era. Match the actual period and location of that event, not automatically first-century Judea for every Bible story. Keep clothing, architecture, furniture, objects, and activities consistent with the chosen era. Never mix ancient costumes with modern buildings or modern objects with an ancient event.
The supplied spoken context takes precedence over a conflicting proposed image concept. Correct the concept to fit the spoken meaning. A religious title alone is not evidence of a historical scene.`;

export function sermonVisualContext(concept: string, spokenText: string) {
  return `${sermonImageContextRules}\nSPOKEN CONTEXT (authority for meaning and era):\n${spokenText}\nPROPOSED VISUAL CONCEPT (adapt if inconsistent):\n${concept}`;
}
