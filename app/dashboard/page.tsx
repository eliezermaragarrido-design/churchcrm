import { requireAuthContext } from "@/lib/auth";
﻿import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { SectionCard } from "@/components/layout/section-card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Badge } from "@/components/layout/badge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { churchId } = await requireAuthContext();
  const now = new Date();
  const upcomingWindow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [memberCount, calendarCount, upcomingEvents, latestMembers, latestPublishedPosts] = await Promise.all([
    prisma.member.count({ where: { churchId } }),
    prisma.calendar.count({ where: { churchId } }),
    prisma.calendarEvent.findMany({
      where: { churchId, startsAt: { gte: now, lte: upcomingWindow } },
      include: { calendar: true },
      orderBy: { startsAt: "asc" },
      take: 6,
    }),
    prisma.member.findMany({
      where: { churchId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.socialPost.findMany({
      where: { churchId, status: "POSTED" },
      include: {
        socialAccount: true,
        asset: true,
      },
      orderBy: { publishedAt: "desc" },
      take: 8,
    }),
  ]);

  const metrics = [
    { label: "Members", value: String(memberCount), note: "People in the church directory" },
    { label: "Calendars", value: String(calendarCount), note: "Staff and public calendars" },
    { label: "Published", value: String(latestPublishedPosts.length), note: "Latest published posts" },
    { label: "Upcoming", value: String(upcomingEvents.length), note: "Events in the next 7 days" },
  ];

  return (
    <AppShell
      title="Dashboard"
      subtitle="A simple overview of members, schedules, and church communication."
      currentPath="/dashboard"
      actions={<Link href="/members" className="button">Add member</Link>}
    >
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
      </section>

      <section>
        <SectionCard title="Latest published posts" action={<Link href="/automation" className="muted">Open automation</Link>}>
          <div className="published-post-grid">
            {latestPublishedPosts.length ? (
              latestPublishedPosts.map((post) => {
                const imageUrl = post.asset?.thumbnailUrl || (post.postType === "FEED_POST" ? post.asset?.fileUrl : null);
                const published = post.publishedAt ? new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                }).format(post.publishedAt) : "Today";
                return (
                  <article key={post.id} className="published-post-card">
                    <div className={`published-post-visual ${imageUrl ? "has-image" : ""}`}>
                      {imageUrl ? <img src={imageUrl} alt="" /> : <span aria-hidden="true">{post.postType === "SHORT_VIDEO" ? "▶" : "✦"}</span>}
                      {post.postType === "SHORT_VIDEO" ? <span className="published-post-play" aria-label="Video">▶</span> : null}
                    </div>
                    <div className="published-post-meta">
                      <strong>{post.socialAccount?.accountLabel || "Published post"}</strong>
                      <span>{published} · {post.postType === "SHORT_VIDEO" ? "Video" : "Image"}</span>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="list-item"><span>No published posts yet.</span></div>
            )}
          </div>
        </SectionCard>
      </section>
    </AppShell>
  );
}
