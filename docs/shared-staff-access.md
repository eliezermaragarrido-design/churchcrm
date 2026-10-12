# Shared staff CRM

Production entry point: https://churchcrm-three.vercel.app/login

The Vercel application and Supabase database run independently of the office computer. Staff use individual email/password accounts. Supabase verifies credentials; server-managed `crm_staff` and `crm_church_id` metadata plus an ACTIVE local User record authorize access. Passwords are kept by Supabase Auth, never in the repository or Prisma User.passwordHash. All three requested users have access to the shared church workspace.

Production always rejects demo access. Local development on loopback retains the existing workflow unless ALLOW_LOCAL_DEMO=false. Private pages and APIs require authentication. Public legal/verification pages and authenticated provider webhook endpoints remain available. Prisma queries on directory, dashboard, groups, calendars and messages now select the authorized church.

Prisma uses Supabase transaction pooling on port 6543, pgbouncer=true, connection_limit=1, pool_timeout=30 in production. DIRECT_URL uses session pooling for separately managed migrations. Church tables use RLS without browser policies, so browser clients cannot query them directly. The server connects using its existing privileged Prisma credential.

Large PowerPoint files download through the private crm-documents bucket using a five-minute signed URL issued after staff authorization. Generated objects are versioned by saved document timestamp. Word exports remain small authenticated responses. Hosting has a 300-second function limit, so generation stores intermediate source drafts, source reviews, image candidates, image reviews and final phrase reviews. The browser continues queued work automatically while the preparation page is open. Closing all preparation pages can pause queued work until the page is opened again.

## Release

1. Apply reviewed schema migrations with `npm run db:deploy` before deployment. Build runs only `prisma generate && next build`; it does not compete with live session-pool connections for migration locks.
2. Deploy the project linked in .vercel/project.json with `vercel deploy --prod`.
3. Verify anonymous denial, all staff accounts, shared records, Word and private PowerPoint downloads. The deployment is not accepted until these checks pass.
4. Keep secrets in Vercel environment settings. Do not upload .env, output, qa, .tmp files or credentials.

Checks: scripts/test-staff-access.ts, scripts/test-hosted-checkpoints.ts, scripts/verify-hosted-staff.ts. The hosted script reads its temporary test password from CRM_TEST_PASSWORD and never logs cookies, passwords or signed download URLs.

September 25 hosted acceptance passed for all three accounts, including corrected mara_1410@hotmail.com. Anonymous requests were denied, logout succeeded, and actual finished Word and PowerPoint downloads returned valid ZIP documents. The tested PowerPoint was 17,126,429 bytes after exact-byte duplicate media removal, with original image bytes preserved.

References: [Supabase Prisma connection guidance](https://supabase.com/docs/guides/database/prisma/prisma-troubleshooting), [Vercel function limits](https://vercel.com/docs/functions/limitations).
