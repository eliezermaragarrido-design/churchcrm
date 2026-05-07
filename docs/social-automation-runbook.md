# Social Automation Runbook

This project can already:

- connect Facebook Pages and Instagram through Meta
- connect TikTok through OAuth
- connect YouTube through Google OAuth
- sync daily assets from Supabase public buckets `IMAGES` and `REELS`
- queue daily posts for each connected social account
- publish due posts through `/api/automation/publish`
- run the publisher automatically every 15 minutes on Vercel cron

## Required environment variables

Add these values to `.env` and to the Vercel project environment settings:

- `META_APP_ID`
- `META_APP_SECRET`
- `META_REDIRECT_URI`
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `TIKTOK_REDIRECT_URI`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `CRON_SECRET`

## Required callback URLs

Use these callback URLs in the provider dashboards:

- Meta: `/api/meta/callback`
- TikTok: `/api/tiktok/callback`
- Google / YouTube: `/api/youtube/callback`

Replace the host with the real app domain, for example:

- `https://your-domain.com/api/meta/callback`
- `https://your-domain.com/api/tiktok/callback`
- `https://your-domain.com/api/youtube/callback`

## Daily asset rules

- `IMAGES` bucket: numbered files like `001.jpg`, `002.jpg`
- `REELS` bucket: numbered files like `001.mp4`, `002.mp4`
- day `1` uses asset `001`
- day `2` uses asset `002`

## Live test checklist

1. Connect Facebook and Instagram from the Automation page.
2. Connect TikTok from the Automation page.
3. Connect YouTube from the Automation page.
4. Click `Queue all year images`.
5. Click `Queue all year reels`.
6. Confirm the queue and status counts update.
7. Click `Run publisher now`.
8. Review `Recent publish failures`.
9. Verify the posts appeared in the connected platforms.

## Production note

If a provider is still in development mode, the connecting user may need to be a tester, developer, or admin in that provider dashboard before OAuth will succeed.
