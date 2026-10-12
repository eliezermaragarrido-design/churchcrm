# Worship service outline

Assistant creates an editable Word service from the saved text that produced a completed sermon PowerPoint. Calendar metadata must match the completed sermon. Source snapshots include its points, explanations, applications, readings and closing phrase. Source changes or a different Communion selection create separate jobs.

## Reference format

Based on the four user-supplied Morning Worship PDFs dated August 23, August 30, September 6 and September 13, 2026. Letter paper, half-inch side/top margins, Ebrima 14 pt, bold small-cap headings, dotted right tabs, blue bold welcome, yellow announcements/Children's Time/speaker cues, red reading response and superscript verse numbers. No decorative cover, table or footer.

Order: date, prelude, welcome and announcements, invocation, Children's Time, call-to-worship music, full First Scripture Lesson NIV, congregational response, preparation hymn, pastoral prayer, Lord's Prayer, special music, doxology, offertory prayer, praise music, Second Scripture Lesson reference, sermon title, optional Communion, benediction, response music.

Copied sermon metadata and expired announcements in the PDFs are not reused. First Scripture Lesson comes from that Sunday's imported sermon calendar, including corrections made after the PowerPoint. It is verified as complete NIV before insertion. Music comes from the weekly worship leader workbook, never another week's file. Announcements remain blank. Only the Lord's Prayer and supplied Communion liturgy remain fixed. Communion defaults to the first Sunday, with a checkbox override. Both versions have independent jobs.

## Weekly music and prose revisions

Import weekly worship music accepts the leader's Placement, Song Name, Verses, Book, Page and Notes columns. Filename dates such as 08.30.2026.xlsx prefill the service date. A conflicting selected date is rejected. A file with no dated name needs an explicit service date. Reimports replace only that church/date, never other weeks.

Prelude, Children's Time, Call to Worship, Prep for Prayer, Special, Doxology, Praise&Worship and Music Response map to the corresponding outline sections. CCLI is not a verse designation and is omitted. Numeric verse selections, including v.1,2,4, are retained. Book, page and performance notes remain alongside the song. Sending Forth personnel, sermon rows and rehearsal extras are not songs. Seven main placements must exist before a new complete outline starts; children's music is optional. Source identity includes music, so updating songs invalidates the previous outline without changing the PowerPoint.

The church is First Methodist Church of Dimmitt, never United Methodist. Welcome targets 30-45 words with a 50-word cap. Invocation explicitly invites worship and asks God to speak during the service. Children's Time uses 5-7 editable Word bullets for toddlers, simple actions, actual participation and pauses, rather than a long reading script. Pastoral prayer includes people in need, requests from those present and the church prayer list without inventing names or medical details. No cue to pause or collect prayer requests is printed. Children retain their participation pauses. Generated prose removes long dashes, semicolons and markdown. A final vocabulary check enforces the supplied writing preferences without rewriting scripture or fixed liturgy words. Word rendering replaces em-dash punctuation with commas, including in readings, while preserving their words.

## Generation and recovery

Six generated sections: welcome, invocation, Children's Time, pastoral prayer, offertory prayer and benediction. Each gets a draft and five independent reviews. All drafts are created first, then five rounds review biblical fidelity, sermon connection, pastoral care, spoken delivery and final coherence. Review findings, text and final paragraphs are checkpointed in DocumentRequest after every successful call. Invalid output and failed calls never count as reviews. The full First Scripture Lesson comes from the verified NIV resolver, not model memory.

A database compare-and-swap claim prevents duplicate workers. Expired three-minute leases recover on the next status poll. API calls time out at 100 seconds. Transient errors retry with exponential backoff capped at two minutes, with no arbitrary retry-count cutoff. A server worker processes up to ten minutes, then queues remaining work. The open Assistant page polls and activates queued or interrupted jobs automatically. Closing the browser normally does not interrupt an active server worker, but a server restart or worker time-window expiry needs another status request to wake saved work. This is not an external durable queue.

Invalid credentials, no credit and denied account access stop retries and show the account error. After account access is corrected, the same job resumes. Downloads require generated status, a verified reading and five reviews for every section. No incomplete draft download is offered.

The model follows the existing sermon model gpt-4.1, overridable with OPENAI_WORSHIP_MODEL. Deterministic OOXML export needs no desktop Word installation on the server.

## Verification

Run `node node_modules/tsx/dist/cli.mjs scripts/test-worship-outline.ts` and `node node_modules/typescript/bin/tsc --noEmit`.

`scripts/test-worship-music.ts` checks all eight songs against the supplied August 30 workbook, date mismatch rejection, CCLI omission, verse/book/page retention, OOXML placement, bullets and cache invalidation. `scripts/verify-worship-style-live.ts` runs all 30 live content reviews against the actual September 27 sermon in an isolated QA checkpoint. It does not assign the August music to September or publish an incomplete weekly service.

Tests cover dates, 30 review transitions, serialized restart, failed/invalid response preservation, no API calls after completion, source/tenant/Communion identity, complete-only export, section order, colors, fixed liturgy and retry classification. A live September 20 service is generated through the actual app endpoint and downloaded as Word. Word PDF export supplies local visual inspection because LibreOffice is absent. A QA-only Communion variant verifies the longer layout without another paid content generation.


### Fresh weekly composition

Version 4 snapshots up to sixteen recent, distinct completed service dates for the same church. Each generation selects an unused short call-to-worship Psalm from a sixteen-reference rotation, then the least recently used after exhaustion. The actual NIV text is resolved before export and appears in the blue welcome area. Retries and downloads retain the selection.

Every section is composed for the completed sermon and reviewed five times with recent section texts as exclusions, including underlying approach, not just wording. Children use a common safe object and practical toddler interaction, without lamps, flashlights or candles. A five-word phrase overlap check rejects substantial recycled final prose and requests fresh composition. This is a repetition safeguard, not a guarantee of semantic uniqueness. Fixed liturgy remains fixed.

Run `scripts/test-worship-freshness.ts` for live NIV verification, verse rotation, retry persistence, completeness, duplicate detection and document placement checks.

### Version 5 spoken English

New jobs request familiar conversational English, short sentences and easy pronunciation. The spoken-delivery review and final language validation reject elaborate vocabulary and sentences longer than thirty words. Welcome remains capped at fifty generated words. The renderer adds `The Bible says:` before the verified Psalm and `Amen.` after its reference, independently of model prose.

The isolated September 27 live QA completed all five reviews for each of six sections. Its four-page Word export was rendered through Word to PDF and visually checked. Hosted verification on September 25 passed login for all three staff accounts, anonymous denial, logout, and actual Word and PowerPoint downloads. Cloud outline workers checkpoint after a 150-second work budget, while local workers retain the ten-minute budget described above.

### Version 6 online welcome and semantic comparison

Welcome now targets 45-70 words, capped at 75, to include online worshippers, a blessing or prayer for them, and an invitation to the sanctuary without a fixed repeated sentence. Before a section completes its fifth review, an independent comparison evaluates its ideas, development and application against up to sixteen saved services. A rejected approach saves specific feedback with the fourth-review checkpoint and retries automatically. Required beliefs and recurring prayer coverage are exempt from rejection by themselves. This model-based comparison improves detection of paraphrased repetition but does not guarantee every subjective judgment.

scripts/test-worship-semantic.ts verifies semantic rejection, saved feedback across restart, completion after correction, and required online acknowledgment. Version 6 changes job identity so earlier completed files do not mask the new generation rules.

### Version 7 toddler teaching

Children's Time derives one child-sized truth from the completed sermon's central claim. All cues must teach that truth through a purposeful demonstration, brief Bible connection, participation, home response and prayer. Presenter directions and words to say are explicit. Target 90-140 words, maximum 160 including directions, 5-7 cues. A targeted shortening pass handles oversized final candidates.

An independent teaching audit after the fifth revision checks fidelity, action-to-lesson alignment, toddler clarity and presenter readiness. Rejection retains four completed reviews and saves corrective feedback for automatic recovery. Self-care activities do not satisfy a sermon about serving others. Instructions prohibit invented biblical reactions and unprovided props. These are model judgments, not guarantees of perfect lessons.

Type checking and test-children-teaching/test-worship-outline pass. Isolated live QA exercised length rejection, style repair and teaching rejection before completing five reviews. Manual inspection identified additional weaknesses concerning invented reactions and audience props, which were added to both generation and review instructions. No QA document was published as a real weekly service.

### Recovery and advance month planning

Exclude revisions of the same service date from historical freshness comparisons, including already-running checkpoints. This fixes a September 27 pastoral prayer loop caused by comparison to its own older version. Recovery retained 27 reviews and completed all 30. Busy outline buttons allow checking the existing idempotent job; network requests time out after 30 seconds instead of trapping the interface indefinitely.

Assistant now has a shared preparation-month selector. Both APIs accept a validated month query. Imports keep all parsed dates, and saved active XLSX worksheet metadata chooses the initial month when its dated Sunday entries belong to one month. The filename does not choose dates or prevent reimport. Existing October 2026 entries were synchronized for October 4, 11, 18 and 25 without changing source dates. Outlines still require the completed sermon and correct weekly music.
