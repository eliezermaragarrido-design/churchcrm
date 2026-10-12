# PastorCRM: production readiness and weekly ministry workflow

Updated: 2026-09-17. This is an implementation backlog, not a claim of approval or completion.

## Product requirements

- Enter a monthly sermon plan once: Sunday date, title, scripture, series, theme, main idea, service time, location, language, and pastoral notes.
- Use that weekly record to prepare Saturday invitations: social caption and image, plus an SMS invitation for members with recorded consent.
- Generate the sermon using the pastor's supplied prompt and selected past presentations as style references.
- Draft, critique, and revise two or three times before exporting the final sermon PowerPoint. Preserve versions and the pastor's corrections.
- Generate the weekly service outline with invocation, offering prayer, pastoral prayer, benediction, and a short practical children's object lesson tied to the sermon.
- Use supplied service outlines and children's lessons as examples; evaluate against the pastor's approved work before claiming that the output matches his style.
- Keep screens concise: week, content preview, status, edit, generate, schedule, and retry. Put operational detail in logs and documentation.
- Support durable jobs, duplicate prevention, provider status reconciliation, timezone-aware schedules, retry limits, and actionable failure reporting.

## Findings from the current repository

### TikTok: approval blocker

Direct Post guidelines exclude applications restricted to internal/private use, including utilities uploading to accounts owned by the developer or their team. Determine the genuine intended audience before choosing direct integration or an existing approved publishing service. Do not misrepresent the product in an application.

The current creator-info response type does not include duration or interaction restrictions. Publishing needs fresh creator information, an editable preview, explicit privacy selection without a default, disabled interactions by default, commercial disclosures, and express upload consent. All entry points, including scheduled posts and direct local uploads, need consistent validation.

The direct-upload completion endpoint currently trusts a browser success flag and records POSTED before confirming TikTok's processing result. Implement provider-side status reconciliation and a distinct processing state before reporting publication. Review existing queued posts before enabling unattended delivery.

Source: https://developers.tiktok.com/docs/en/content-sharing-guidelines

### YouTube

OAuth and upload code exist; connection, token renewal, upload processing, quota handling, and actual channel visibility need live verification. Unverified API projects created after July 28, 2020 have uploads restricted to private until the required audit. OAuth verification and the YouTube API audit must be tracked separately.

Source: https://developers.google.com/youtube/v3/docs/videos/insert

### Twilio

The current schema records opt-out but not affirmative consent evidence. Existing members must not be assumed to have consented merely because they have a phone number. Add consent source, timestamp, wording/version, purpose, and revocation history. Recheck consent at send time, implement signed inbound/status webhooks, and synchronize STOP/START/HELP handling with the Messaging Service.

Campaign sending currently loops over every recipient on each invocation: add an atomic claim and reconciliation before retries to prevent duplicate sends. A Twilio message acceptance is not delivery confirmation. The reminder jobs are not wired into the current Vercel cron and lack durable deduplication.

Confirm whether the sending number is US local 10DLC or toll-free before preparing the corresponding registration. Public terms and SMS consent text alone do not establish provider approval or prove recipient consent.

Sources:
- https://www.twilio.com/en-us/legal/messaging-policy
- https://www.twilio.com/docs/messaging/compliance/a2p-10dlc

### OpenAI and ministry content

The secretary endpoint calls OpenAI, but the assistant page displays sample tasks. Sermons redirects to that page. Audio and slides endpoints save queued records; they do not implement the promised processing workers.

Implement persisted sermon records, a private reference library, prompt versions, structured generation, revision history, and durable workers. Retrieve relevant examples for each task; uploading examples alone does not train a model. Validate dates, scripture references, service details, theological constraints supplied by the pastor, and children's lesson practicality. Render and inspect exports before treating them as final.

Source: https://developers.openai.com/api/docs/guides/tools-file-search

### Access and scheduling

Authentication currently falls back to a demo user and a default church, including when no authenticated user is present. Production writes need authenticated, authorized church membership and explicit separation from demo mode before broadening access to other churches.

The Vercel schedule is daily at 14:00 UTC, not every 15 minutes. Choose a supported execution schedule and persist local timezone intent; Saturday invitations must remain correct across daylight-saving changes. Do not change production cadence until duplicate prevention is in place.

## Implementation sequence and acceptance

1. Resolve TikTok eligibility and the actual review feedback; fix access control and provider-confirmed status handling. Prepare an honest review demonstration with all required posting controls.
2. Verify YouTube OAuth and a consented test upload; document audit state and visibility limits.
3. Implement consent evidence and reliable SMS lifecycle; complete the applicable Twilio registration and test opt-out handling.
4. Add monthly sermon planning and private reference uploads; ingest the pastor's prompt and examples.
5. Generate and revise the weekly sermon, service outline, prayers, and children's lesson; compare against approved examples and inspect Word/PowerPoint output.
6. Generate invitations from the same weekly record; schedule authorized content and consented SMS, with duplicate prevention and failure recovery.
7. Validate the full weekly flow in production, including expired tokens, timeouts, retries, provider rejection, timezone changes, backups, and recovery. No external approval or uninterrupted availability is guaranteed by code changes.

## Inputs still needed

- Current public CRM URL and TikTok review status/rejection text.
- Whether the CRM is exclusively for this church or genuinely available to other churches.
- Pastor's prompt, representative finished PowerPoints, service outlines, and children's lessons, preferably with before/after revisions.
- Monthly sermon plan, output language, approved Bible translation, service details, and preferred generation/publication times.
- Provider dashboard states and sending number type. Configure secrets through environment settings rather than placing them in documentation.

## Changes completed in this first pass

- Missing Twilio configuration now fails instead of simulating a successful send.
- Missing OpenAI configuration or an incomplete/empty response no longer produces a record marked generated.
- The cron publisher now refuses execution when its secret is absent.
- Corrected the documented scheduler frequency to match the repository.

All other items above remain pending until implemented and verified.
