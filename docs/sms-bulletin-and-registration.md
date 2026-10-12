# Bulletin subscription and Twilio resubmission

Status (2026-09-17): deployed to https://churchcrm-three.vercel.app. The subscription migration is applied, row-level security is enabled, and the public form, privacy policy, and SMS terms return 200 with updated content. The production database write/read test was rolled back without retaining synthetic consent. Anonymous publisher calls return 401; unsigned inbound webhook calls return 403.

Twilio configuration is still blocked: the saved Account SID is not in the expected format and a read-only authentication check failed with 401/20003. Do not resubmit the campaign or claim end-to-end messaging is ready until the correct account credentials, Messaging Service, and Advanced Opt-Out webhook are verified. No SMS has been sent and no campaign has been resubmitted.

Production deployment: `dpl_DjYtC9kzHCo1UH6MDLuj9cCN1rF7`. Local source changes have not been committed or pushed to GitHub; this release was deployed directly with Vercel CLI.

## Bulletin copy

### Stay connected with our church

Receive worship invitations, reminders, and church news from First Methodist Church of Dimmitt by text.

Sign up at https://churchcrm-three.vercel.app/sms-consent

Subscription is voluntary. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help. Consent is not a condition of attendance, giving, or purchase.

Privacy: https://churchcrm-three.vercel.app/privacy

SMS terms: https://churchcrm-three.vercel.app/terms

A QR code must point to the subscription URL above. Reading the bulletin or scanning a QR code is not consent; completing the form with its unchecked consent box is the opt-in action.

## Registration text (use once Twilio configuration is verified)

Campaign description:

First Methodist Church of Dimmitt sends recurring worship invitations, Bible study reminders, church event notifications, schedule changes, prayer updates, and requested ministry follow-up to people who expressly subscribe to its SMS program. Message frequency varies. Messages identify the church and include opt-out instructions. Contact lists are not purchased, and church membership alone does not enroll a person.

Message flow / call to action:

The church bulletin invites people to visit https://churchcrm-three.vercel.app/sms-consent. On the public page, users enter their name and mobile number and must actively check an initially unchecked SMS consent box before selecting Subscribe to church texts. The disclosure identifies First Methodist Church of Dimmitt, recurring automated message types, variable frequency, message and data rates, STOP and HELP instructions, and that consent is not a condition of attendance, giving, or purchase. Privacy and SMS terms links appear next to the form. The CRM records the submitted number, consent timestamp, exact consent wording, version, and form source. Scanning the bulletin QR code does not subscribe a person. No messages are sent to existing members solely because their phone number is on file.

Sample 1:

First Methodist Church of Dimmitt: Join us for worship this Sunday. We look forward to welcoming you! Reply STOP to unsubscribe or HELP for help.

Sample 2:

First Methodist Church of Dimmitt: This week's Bible study schedule has changed. Please contact the church office for the updated time. Reply STOP to unsubscribe or HELP for help.

## Deployment and verification

1. Apply the additive migration `20260917150000_add_sms_subscriptions` and generate Prisma Client. It enables row-level security without public policies, so browser Supabase roles cannot read subscription records. The server database connection must use the table owner or an appropriate service role. The normal build script runs migration deployment; deploy only against the intended database.
2. Deploy the code and confirm the three public links above are accessible without signing in. Completed for the deployment listed above.
3. Set `TWILIO_INBOUND_URL=https://churchcrm-three.vercel.app/api/twilio/inbound` alongside the existing Twilio credentials and Messaging Service SID. The exact URL is used to verify Twilio signatures.
4. In that Messaging Service, enable Advanced Opt-Out and configure incoming messages to POST to that URL. Customize HELP with the church identity and office@fumcdimmitt.org; Twilio handles keyword acknowledgements. The CRM records STOP revocation. START does not automatically restore CRM consent in this version; a returning subscriber must also complete the website form again. Document this in the service's START response.
5. Test a voluntary subscription with an authorized test number, verify the database evidence, then verify a signed STOP webhook revokes permission. Invalid signatures must fail without changing records. Do not send production messages while the campaign remains rejected.
6. Confirm that an unsubscribed or never-subscribed number cannot be sent a campaign, and that repeated clicks cannot start the same campaign twice. New bulletin subscribers appear in new church-wide campaigns without creating member records; group campaigns require group membership. Existing campaign audiences are snapshots and must be recreated to include new subscribers.
7. Submit the verified URLs and actual consent flow to Twilio. Approval remains external; these changes do not establish carrier approval or confirm delivery.

Current limitations: no phone-ownership verification, no production delivery-status reconciliation, and no automatic recovery of a campaign interrupted while SENDING. Database consent records contain personal information and are not exposed by a public listing endpoint. Migration and deployment are verified as described above; Twilio account configuration and real SMS delivery are not verified.
