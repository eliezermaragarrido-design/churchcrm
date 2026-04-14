import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/layout/badge";
import { SectionCard } from "@/components/layout/section-card";
import { createGroupAction } from "./actions";

const groupTypes = ["SUNDAY_SCHOOL", "SMALL_GROUP", "MINISTRY", "VOLUNTEER_TEAM", "CARE_TEAM", "YOUTH_GROUP", "CLASS"] as const;

export default async function GroupsPage() {
  const groups = await prisma.group.findMany({
    include: {
      memberships: {
        include: { member: true },
      },
      posts: {
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell
      title="Groups"
      subtitle="Sunday school classes, ministry teams, small groups, and community feeds with their own conversations."
      currentPath="/groups"
      actions={<span className="pill">{groups.length} total groups</span>}
    >
      <section className="two-column">
        <SectionCard title="Create group">
          <form action={createGroupAction} className="form-grid">
            <input className="input" name="name" placeholder="Group name" required />
            <input className="input" name="description" placeholder="Description" />
            <select className="select" name="groupType" defaultValue="SUNDAY_SCHOOL">
              {groupTypes.map((type) => (
                <option key={type} value={type}>{type.replaceAll("_", " ")}</option>
              ))}
            </select>
            <select className="select" name="visibility" defaultValue="PRIVATE">
              <option value="PRIVATE">Private</option>
              <option value="CHURCH">Church visible</option>
            </select>
            <button className="button" type="submit">Save group</button>
          </form>
        </SectionCard>

        <SectionCard title="Group feed direction">
          <div className="list">
            <div className="list-item"><span>Each group opens into its own internal community page with posts, comments, prayer threads, pinned announcements, and media.</span></div>
            <div className="list-item"><span>Examples: youth pastor team, kids ministry team, worship team, Sunday school class, and staff-only care groups.</span></div>
            <div className="list-item"><span>Sermon distribution, reminders, attendance, and texting can stay tied to the same group audience.</span></div>
          </div>
        </SectionCard>
      </section>

      <section className="three-column">
        {groups.length ? (
          groups.map((group) => {
            const featuredPost = group.posts[0];
            return (
              <article key={group.id} className="list-card card-link-wrap">
                <div className="stack">
                  <div className="toolbar toolbar-start">
                    <div>
                      <h3 className="card-title">{group.name}</h3>
                      <p className="muted">{group.groupType.replaceAll("_", " ")}</p>
                    </div>
                    <Badge>{String(group.memberships.length)} members</Badge>
                  </div>

                  <p className="muted">{group.description || "No description yet. Open the community to start shaping this group space."}</p>

                  <div className="panel panel-soft">
                    <strong>Community feed</strong>
                    <p className="muted">
                      {featuredPost
                        ? `Latest post: ${featuredPost.title || (featuredPost.body ? featuredPost.body.slice(0, 70) : "Group update")}`
                        : "No posts yet. Start this group with a welcome message, sermon note, or announcement."}
                    </p>
                  </div>

                  <div className="toolbar toolbar-start">
                    <Badge>{group.visibility === "PRIVATE" ? "Private feed" : "Church visible"}</Badge>
                    <Link href={`/groups/${group.id}`} className="button secondary">Open community</Link>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <article className="list-card"><p className="muted">No groups yet. Create the first class or ministry team above.</p></article>
        )}
      </section>
    </AppShell>
  );
}