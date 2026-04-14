import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { SectionCard } from "@/components/layout/section-card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Badge } from "@/components/layout/badge";

export default async function DashboardPage() {
  const now = new Date();
  const upcomingWindow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [memberCount, calendarCount, campaignCount, upcomingEvents, latestMembers, latestCampaigns] = await Promise.all([
    prisma.member.count(),
    prisma.calendar.count(),
    prisma.messageCampaign.count(),
    prisma.calendarEvent.findMany({
      where: { startsAt: { gte: now, lte: upcomingWindow } },
      include: { calendar: true },
      orderBy: { startsAt: "asc" },
      take: 6,
    }),
    prisma.member.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.messageCampaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const metrics = [
    { label: "Members", value: String(memberCount), note: "People in the church directory" },
    { label: "Calendars", value: String(calendarCount), note: "Staff and public calendars" },
    { label: "Messages", value: String(campaignCount), note: "Saved text campaigns" },
    { label: "Upcoming", value: String(upcomingEvents.length), note: "Events in the next 7 days" },
  ];

  return (
    <AppShell
      title="Dashboard"
      subtitle="A simple overview of members, schedules, and church communication."
      currentPath="/dashboard"
      actions={<Link href="/members" className="button">Add member</Link>}
    >
      <SectionCard title="Focus now">
        <div className="toolbar">
          <span className="muted">The core workflow is now centered on members, calendars, messages, and sermons.</span>
          <Badge>Keep it simple</Badge>
        </div>
      </SectionCard>

      <section className="metrics-grid compact-metrics">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="two-column">
        <SectionCard title="Upcoming schedule" action={<span className="muted">Next 7 days</span>}>
          <div className="list compact-list">
            {upcomingEvents.length ? (
              upcomingEvents.map((event) => (
                <div key={event.id} className="list-item">
                  <div>
                    <strong>{event.title}</strong>
                    <div className="muted">{new Date(event.startsAt).toLocaleString()} - {event.calendar.name}</div>
                  </div>
                  <Badge>{event.eventType.replaceAll("_", " ")}</Badge>
                </div>
              ))
            ) : (
              <div className="list-item"><span>No upcoming events yet. Add one from Calendars.</span></div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="What is already real">
          <div className="list compact-list">
            <div className="list-item"><span>Members can be added and deleted from the live directory.</span></div>
            <div className="list-item"><span>Calendars support real event creation, deletion, and reminder preparation.</span></div>
            <div className="list-item"><span>Messages can save campaigns and track Twilio send attempts.</span></div>
          </div>
        </SectionCard>
      </section>

      <section className="two-column">
        <SectionCard title="Latest members" action={<Link href="/members" className="muted">Open members</Link>}>
          <div className="list compact-list">
            {latestMembers.length ? (
              latestMembers.map((member) => (
                <div key={member.id} className="list-item">
                  <div>
                    <strong>{member.firstName} {member.lastName}</strong>
                    <div className="muted">{member.phoneMobile || "No phone"} - {member.email || "No email"}</div>
                  </div>
                  <Badge>{member.status}</Badge>
                </div>
              ))
            ) : (
              <div className="list-item"><span>No members yet. Use Members to add the first one.</span></div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Latest text campaigns" action={<Link href="/messages" className="muted">Open messages</Link>}>
          <div className="list compact-list">
            {latestCampaigns.length ? (
              latestCampaigns.map((campaign) => (
                <div key={campaign.id} className="list-item">
                  <div>
                    <strong>{campaign.title}</strong>
                    <div className="muted">{campaign.campaignType.replaceAll("_", " ")} - {campaign.body.slice(0, 72)}</div>
                  </div>
                  <Badge>{campaign.status}</Badge>
                </div>
              ))
            ) : (
              <div className="list-item"><span>No text campaigns yet.</span></div>
            )}
          </div>
        </SectionCard>
      </section>
    </AppShell>
  );
}
