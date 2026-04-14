import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/layout/badge";
import { SectionCard } from "@/components/layout/section-card";
import {
  clearOldCampaignsAction,
  createEventReminderCampaignAction,
  createManualCampaignAction,
  deleteCampaignAction,
  sendCampaignAction,
} from "./actions";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export default async function MessagesPage() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const twoHoursAhead = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const isTwilioReady = Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_MESSAGING_SERVICE_SID);

  const [reachableMembers, campaigns, publishedEvents] = await Promise.all([
    prisma.member.findMany({
      where: {
        isSmsOptedOut: false,
        phoneMobile: { not: null },
        status: "ACTIVE",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phoneMobile: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.messageCampaign.findMany({
      include: {
        recipients: {
          include: {
            member: true,
          },
          orderBy: { phoneNumber: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.calendarEvent.findMany({
      where: {
        startsAt: { gte: now },
        isPublished: true,
        isAbsence: false,
      },
      include: {
        calendar: true,
      },
      orderBy: { startsAt: "asc" },
      take: 20,
    }),
  ]);

  const tomorrowEvents = publishedEvents.filter((event) => isSameLocalDay(new Date(event.startsAt), tomorrow));
  const twoHourEvents = publishedEvents.filter((event) => {
    const startsAt = new Date(event.startsAt);
    return startsAt >= now && startsAt <= twoHoursAhead;
  });
  const sentCampaigns = campaigns.filter((campaign) => campaign.status === "SENT");

  return (
    <AppShell
      title="Messages"
      subtitle="Send church-wide texts, prayer updates, birthdays, and event reminders through Twilio from one messaging center."
      currentPath="/messages"
      actions={<Badge>{reachableMembers.length} reachable members</Badge>}
    >
      <section className="hero-card">
        <div className="stack">
          <p className="kicker">Twilio messaging center</p>
          <h3 className="card-title">Keep the texting workflow simple and clear.</h3>
          <p className="page-subtitle">
            Save church-wide message drafts, build reminder campaigns from published events, and see exactly why any Twilio delivery failed.
          </p>
        </div>
        <div className="metrics-grid">
          <div className="panel panel-soft">
            <strong className="metric-value">{reachableMembers.length}</strong>
            <p className="muted">reachable members</p>
          </div>
          <div className="panel panel-soft">
            <strong className="metric-value">{tomorrowEvents.length}</strong>
            <p className="muted">tomorrow reminders ready</p>
          </div>
          <div className="panel panel-soft">
            <strong className="metric-value">{sentCampaigns.length}</strong>
            <p className="muted">sent campaign records</p>
          </div>
        </div>
      </section>

      <section className="two-column">
        <SectionCard title="Compose church-wide text">
          <form action={createManualCampaignAction} className="form-grid">
            <input className="input" name="title" placeholder="Campaign title" required />
            <select className="select" name="campaignType" defaultValue="MANUAL_BULK">
              <option value="MANUAL_BULK">Manual bulk text</option>
              <option value="ANNOUNCEMENT">Announcement</option>
              <option value="PRAYER_UPDATE">Prayer update</option>
              <option value="BIRTHDAY">Birthday message</option>
            </select>
            <textarea className="textarea" name="body" rows={5} placeholder="Write the text that should go to church members" required />
            <div className="toolbar">
              <span className="muted">This version is church-wide only, using active members with valid mobile numbers who have not opted out.</span>
              <button className="button" type="submit">Save text campaign</button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Event reminder builder">
          <div className="stack">
            <div className="panel panel-soft stack">
              <div className="toolbar">
                <strong>Tomorrow reminder source</strong>
                <Badge>{tomorrowEvents.length} ready</Badge>
              </div>
              <div className="list compact-list">
                {tomorrowEvents.length ? tomorrowEvents.map((event) => (
                  <div key={`${event.id}-tomorrow`} className="list-item">
                    <div>
                      <strong>{event.title}</strong>
                      <div className="muted">{formatDateTime(event.startsAt)} - {event.calendar.name}</div>
                    </div>
                    <form action={createEventReminderCampaignAction} className="stack">
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="timing" value="tomorrow" />
                      <button className="button secondary" type="submit">Build tomorrow SMS</button>
                    </form>
                  </div>
                )) : <div className="list-item"><span>No published events are scheduled for tomorrow yet.</span></div>}
              </div>
            </div>

            <div className="panel panel-soft stack">
              <div className="toolbar">
                <strong>2-hour reminder source</strong>
                <Badge>{twoHourEvents.length} ready</Badge>
              </div>
              <div className="list compact-list">
                {twoHourEvents.length ? twoHourEvents.map((event) => (
                  <div key={`${event.id}-two-hours`} className="list-item">
                    <div>
                      <strong>{event.title}</strong>
                      <div className="muted">{formatDateTime(event.startsAt)} - {event.calendar.name}</div>
                    </div>
                    <form action={createEventReminderCampaignAction} className="stack">
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="timing" value="two-hours" />
                      <button className="button secondary" type="submit">Build 2-hour SMS</button>
                    </form>
                  </div>
                )) : <div className="list-item"><span>No published events are entering the 2-hour reminder window.</span></div>}
              </div>
            </div>
          </div>
        </SectionCard>
      </section>

      <section className="two-column">
        <SectionCard title="Campaign history" action={<Badge>{campaigns.length} campaigns</Badge>}>
          <div className="toolbar">
            <span className="muted">These campaign records stay visible even if the source event is later deleted. Delete old test campaigns when you no longer need them.</span>
            <form action={clearOldCampaignsAction}>
              <button className="button secondary" type="submit">Clear draft/failed tests</button>
            </form>
          </div>
          <div className="calendar-day-list">
            {campaigns.length ? campaigns.map((campaign) => (
              <div key={campaign.id} className="calendar-event">
                <div className="toolbar">
                  <strong>{campaign.title}</strong>
                  <Badge>{campaign.status}</Badge>
                </div>
                <div className="muted">{campaign.campaignType.replaceAll("_", " ")}</div>
                <div className="muted">{campaign.body}</div>
                <div className="muted">{campaign.recipients.length} recipients</div>
                <div className="toolbar">
                  <span className="muted">Created {formatDateTime(campaign.createdAt)}</span>
                  <div className="toolbar">
                    {campaign.status !== "SENT" ? (
                      <form action={sendCampaignAction}>
                        <input type="hidden" name="campaignId" value={campaign.id} />
                        <button className="button secondary" type="submit">{campaign.status === "FAILED" ? "Retry send" : "Send now"}</button>
                      </form>
                    ) : null}
                    <form action={deleteCampaignAction}>
                      <input type="hidden" name="campaignId" value={campaign.id} />
                      <button className="button secondary" type="submit">Delete</button>
                    </form>
                  </div>
                </div>
                {campaign.recipients.length ? (
                  <div className="list compact-list">
                    {campaign.recipients.map((recipient) => (
                      <div key={recipient.id} className="list-item">
                        <div>
                          <strong>{recipient.member ? `${recipient.member.firstName} ${recipient.member.lastName}` : recipient.phoneNumber}</strong>
                          <div className="muted">{recipient.phoneNumber}</div>
                          {recipient.errorMessage ? (
                            <div className="muted">Twilio error{recipient.errorCode ? ` ${recipient.errorCode}` : ""}: {recipient.errorMessage}</div>
                          ) : recipient.deliveryStatus === "SENT" ? (
                            <div className="muted">Sent {recipient.sentAt ? formatDateTime(recipient.sentAt) : "successfully"}</div>
                          ) : null}
                        </div>
                        <Badge>{recipient.deliveryStatus}</Badge>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )) : <div className="calendar-event">No text campaigns yet.</div>}
          </div>
        </SectionCard>

        <SectionCard title="Message health">
          <div className="list">
            <div className="list-item"><span>Reachable members right now</span><strong>{reachableMembers.length}</strong></div>
            <div className="list-item"><span>Published reminder-ready events</span><strong>{publishedEvents.length}</strong></div>
            <div className="list-item"><span>Campaigns already sent</span><strong>{sentCampaigns.length}</strong></div>
            <div className="list-item"><span>Twilio connection</span><strong>{isTwilioReady ? "Configured" : "Not fully configured"}</strong></div>
            <div className="list-item"><span>Opt-out protection</span><strong>Connected to member record</strong></div>
          </div>
        </SectionCard>
      </section>
    </AppShell>
  );
}
