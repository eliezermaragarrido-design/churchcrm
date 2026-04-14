# AI Secretary and Content Automation Plan

## 1. Secretary Tab

The secretary area should feel like a church-office assistant, not a generic chatbot. It should combine guided forms, ready-made prompts, church data, and document generation.

### Core Secretary Jobs

- Transfer membership letter
- Baptism certificate
- New member certificate
- Letter of good standing
- Receiving member by transfer confirmation
- Baby dedication certificate
- Funeral program draft support
- Visitor follow-up letter
- Prayer or sympathy letter
- Board meeting notice draft
- Announcement rewrite for bulletin, SMS, and social media

## 2. Meeting Notes from Audio

The office should be able to upload one- to two-hour meeting audio and receive structured notes.

### Output Shape

- summary of the meeting
- major decisions
- action items
- names mentioned
- follow-up deadlines

## 3. Sermon Notes and Sermon Delivery

The pastor or secretary should be able to upload a PowerPoint presentation and extract sermon notes.

### Output Shape

- title and series
- scripture references
- major sermon points
- supporting subpoints
- altar-call or response notes
- clean congregation handout draft

### Distribution Rules

- send sermon notes to church-wide members when appropriate
- send youth sermons to youth audiences only
- send kids lessons to kids ministry families or leaders
- send worship-specific notes to the worship team
- support different staff roles such as youth pastor, kids pastor, worship pastor, and secretary

## 4. Purchased Daily Media Workflow

The church can buy commercial-use daily image bundles and reel bundles from Etsy or another supplier instead of generating them with AI.

### Content Source Rules

- The 365 daily images live in an imported folder
- The 365 daily reels live in a separate imported folder
- The app should map content by day number so image `1` and reel `1` belong to day `1`, and so on through `365`
- The system should mark each asset as approved and ready to publish after import

## 5. Social Publishing Automation

The app should support one approved post publishing to multiple channels from one screen.

### Platforms to Plan For

- Facebook Page feed
- Facebook Stories where supported through approved tooling
- Instagram feed
- Instagram Stories
- YouTube Shorts
- TikTok later

## 6. Event Reminder Texting

The formal church activities calendar should support automated SMS reminders tied to official public events.

### Default Reminder Sequence

- first reminder: one day before the event
- second reminder: two hours before the event start time

## 7. Prayer Request Automation

Prayer request updates should support recurring communication flows.

### Supported Schedules

- weekly prayer digest
- biweekly prayer digest
- staff-only prayer summary
- ministry-specific prayer updates

## 8. Mailchimp Email Automation

Mailchimp is a good fit for newsletters, announcement emails, and audience-based church email campaigns.

### What You Will Need

- a Mailchimp account
- a Mailchimp audience or audiences
- an API key from Mailchimp
- optional tags or segments that mirror church groups or ministries

### Recommended Use Cases

- church newsletter emails
- sermon follow-up emails
- event reminder emails
- newcomer welcome email sequence
- ministry-specific announcements

### Product Direction

- sync members who have email addresses into Mailchimp audiences or tags
- send one-off newsletters from the CRM
- later support automated campaigns for newcomers, sermon follow-up, and events

## 9. Recommended Build Order

### Phase A

- Secretary templates and document generation
- Calendar setup and permissions
- Members, groups, and messaging core

### Phase B

- Purchased image and reel import workflow
- Scheduled multi-platform posting
- Event reminder texting
- Prayer digest texting
- Mailchimp audience sync planning

### Phase C

- Meeting audio upload and summary pipeline
- PowerPoint sermon-note extraction pipeline
- Sermon distribution by audience/role
- Mailchimp newsletter sending

## 10. Product Principle

The assistant should not feel like a general chatbot. It should feel like a trained church-office worker with church-specific templates, safe defaults, saved history, direct access to church records, and awareness of sermon, ministry, and communication audiences.
