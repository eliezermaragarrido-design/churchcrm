# PastorCRM Starter Architecture

This repository is the starting point for an MVP church CRM focused on pastoral care, communication, attendance, calendars, private group community spaces, sermon delivery, and church-office AI workflows.

## Recommended Stack

- Next.js App Router
- TypeScript
- Prisma + PostgreSQL
- Supabase Auth and Storage
- Twilio for SMS
- OpenAI API for assistant, meeting summaries, and sermon-note extraction
- Mailchimp Marketing API for church newsletters and automated email campaigns

## App Areas

### Member Management

- `/dashboard`
- `/members`
- `/members/[memberId]`
- `/households`

### Groups and Community

- `/groups`
- `/groups/[groupId]`
- `/groups/[groupId]/feed`

### Ministry Operations

- `/calendars`
- `/attendance`
- `/prayer-requests`
- `/follow-ups`
- `/visits`
- `/sermons`

### Office AI

- `/assistant`
- `/assistant/documents`
- `/assistant/meeting-notes`
- `/assistant/sermon-notes`

### Messaging

- `/campaigns`
- `/templates`
- `/settings/integrations/twilio`
- `/settings/integrations/mailchimp`

## Domain Modules

### `calendars`

- internal staff calendars
- public church calendars
- absence tracking
- shared scheduling and event publishing
- automated event reminder texts

### `assistant`

- secretary templates
- generated documents
- meeting audio summaries
- PowerPoint sermon-note extraction

### `sermons`

- sermon records
- sermon files and notes
- audience targeting by ministry, role, or church-wide segment
- sermon delivery through SMS or email

### `messaging`

- bulk texting
- templates
- campaign logs
- birthday automation
- prayer digest automation
- Mailchimp sync and newsletter sending

## Initial API Surface

- `GET /api/members`
- `POST /api/members`
- `GET /api/groups`
- `POST /api/groups`
- `GET /api/calendars`
- `POST /api/calendars`
- `POST /api/assistant/documents`
- `POST /api/assistant/meeting-notes`
- `POST /api/assistant/sermon-notes`
- `POST /api/sermons`
- `POST /api/sermons/:sermonId/distribute`
- `POST /api/campaigns`
- `POST /api/mailchimp/sync`

## Build Order

1. Auth, church tenancy, and roles
2. Members, groups, calendars, and assistant shell with live CRUD
3. SMS campaigns, event reminders, and prayer digests
4. Sermons, sermon audiences, and Mailchimp integration
5. Group feed with photos and videos
6. Meeting notes, sermon-note extraction, and launch hardening
