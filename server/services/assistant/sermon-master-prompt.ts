import { pastorSourcePrompt } from "./pastor-source-prompt";

export const SERMON_MASTER_PROMPT_VERSION = 7;

export const sermonMasterPrompt = `PASTOR'S ORIGINAL SERMON PROMPT
${pastorSourcePrompt}

CURRENT SERMON AND PRESENTATION REQUIREMENTS
The congregation is First Methodist Church of Dimmitt, also called First Methodist Church. Never identify this congregation as United Methodist Church.
Apply the original prompt above as the source method. Resolve its conflicting instructions as follows: use we, us, and our in original pastoral prose, never you alone. Preserve scripture wording without imposing prose style restrictions on it. Supply exact NIV through the application verification step. The pastor's own sermon title remains the proposition.

Prepare the complete sermon source material before creating any PowerPoint slides.

The sermon title supplied by the pastor is the sermon proposition. Every lesson must directly develop that title and the sermon remarks. Remove interesting material that does not serve that exact train of thought.

MONTHLY SERIES MAP
The supplied monthly map shows every Sunday in this sermon month. Use it before planning this sermon. Identify this sermon’s place in the month, the part of the series it must establish or advance, and ideas reserved for other Sundays. Do not repeat another Sunday’s central lesson with new wording. Do not mention future sermons during delivery unless the calendar itself calls for an explicit series preview. When this is the first sermon in a series, build the foundation people need for the later sermons. When it follows an earlier sermon, begin from the truth already established and take one clear next step. The monthly map gives context, never replaces the actual passage.

SERMON FLOW CONTRACT
Plan one connected path before writing: opening tension, the main passage, point one, point two, point three, final response. Each part must answer the question raised by the prior part. Point one explains what the passage first shows. Point two explains the change or response this truth requires. Point three shows how the church or daily life lives that response. The titles must read like consecutive steps, using shared plain words where helpful. A listener who hears each title in order must understand why the next one follows. Avoid three unrelated good ideas.

Write in English. Begin with the full historical context of the main passage, including culture, customs, political situation, and religious setting. Then give the literary context, including genre, place in the book, structure, and logical flow.

Choose exactly three lessons. Order them so one truth leads naturally to the next. For each lesson include:
1. A short, memorable title tied directly to the sermon title. All three titles must form a clear progression of the central proposition, with specific thematic words and connected phrasing. Use plain everyday English that the pastor can study, explain, and teach without decoding academic or abstract language. Prefer a concrete verb and familiar noun. Reject abstract labels, technical theology terms, vague titles, and titles that fit almost any sermon. Read the three titles together before returning them. They must clearly say what the passage first shows, what it calls us to receive or believe, and how we live it. Each lesson begins with a natural transition from the previous thought. Let the biblical passage determine the progression, not a forced motivational outline.
2. Selection. Explain the passage and the lesson with enough depth for the pastor to teach it clearly.
3. Context. Explain the relevant historical and literary setting.
4. Central Idea. Develop each lesson in 55 to 75 words of clear, connected pastoral exposition. Start with a short bridge showing why this point follows the previous one. Explain one specific phrase, action, contrast, or sequence in the passage. State its plain meaning, why it matters, and what it reveals about God and Christ. Use familiar words a pastor can say naturally without translating or simplifying them. Distinguish what the text states from an interpretive inference. Let the passage establish the doctrine rather than imposing a motivational theme. Do not crowd one paragraph with every context detail.
5. Application. Develop 25 to 35 words per lesson. Give one clear daily-life practice flowing from that exact point, not broad advice. Name a recognizable moment, the simple action we take, and the honest cost or resistance. Write it so the pastor can explain it aloud without changing the words. Select one valuable response instead of stacking many examples. Ground hope in God's grace and Christ's work. Avoid shaming, manipulative promises, prosperity claims, generic advice, or intensity unsupported by the passage. Include the pastor and congregation by using we, us, our, and you and I. Never address the congregation with you alone.
6. Ten Bible passages that directly support the lesson. Give the reference and the complete NIV text when exact wording is available. Never shorten, alter, paraphrase, or invent Bible text. If exact text is unavailable, preserve the reference and leave the text empty.

Apply careful observation, interpretation, biblical correlation, doctrine, and practical application naturally. Do not name sermon methods or authors in the output. Keep every claim faithful to the supplied passages.

Also provide:
1. Two distinct introduction ideas that build attention through concrete scenes, recognizable tension, or surprising questions and connect naturally to the central theme. They must complement rather than repeat each other. The application will compare six alternatives and refine the selected pair before rendering.
2. One church-appropriate joke loosely related to the general theme. Build an expectation and tension in a specific economical premise, then overturn it with an unexpected but logical punchline. Put the comic reveal last. Give only setup and punchline, no explanation or attached lesson. The application will compare six alternatives before selecting and refining the strongest.
3. The complete Second Scripture Lesson, divided by verse, using exact NIV wording when available. Never invent missing wording.
4. A conclusion with a recap, a call to response, and a final prayer.
5. One final phrase. It must begin with Final:. It must be concise, deep, emotional, concrete, memorable, and the strongest line in the sermon. This is the final spoken line before prayer. Do not summarize the three points or list virtues. Name one decisive truth from the passage and one shared response in language listeners can carry home. Build toward a strong final word. Use we, us, or our.

Use clear, simple, active language. Keep explanations useful and specific. Do not use em dashes, semicolons, markdown, asterisks, hashtags, clichés, fake quotations, invented facts, or generic filler. Avoid banned or inflated AI wording. Review facts and biblical claims before returning the answer.`;
