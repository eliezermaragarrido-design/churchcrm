import { prisma } from "@/lib/db/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/layout/badge";
import { SectionCard } from "@/components/layout/section-card";
import { createMemberAction, deleteMemberAction } from "./actions";

export default async function MembersPage() {
  const members = await prisma.member.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const smsReadyCount = members.filter((member) => member.phoneMobile && !member.isSmsOptedOut).length;

  return (
    <AppShell
      title="Members"
      subtitle="A simple church directory with the contact details needed for care, reminders, and communication."
      currentPath="/members"
      actions={<span className="pill">{members.length} members</span>}
    >
      <section className="metrics-grid compact-metrics">
        <article className="metric-card">
          <p className="muted">Total members</p>
          <div className="metric-value">{members.length}</div>
        </article>
        <article className="metric-card">
          <p className="muted">SMS ready</p>
          <div className="metric-value">{smsReadyCount}</div>
        </article>
      </section>

      <section className="two-column narrow-right">
        <SectionCard title="Add member">
          <form action={createMemberAction} className="form-grid simple-form">
            <div className="two-up-inputs">
              <input className="input" name="firstName" placeholder="First name" required />
              <input className="input" name="lastName" placeholder="Last name" required />
            </div>
            <input className="input" name="preferredName" placeholder="Preferred name" />
            <div className="two-up-inputs">
              <input className="input" name="phoneMobile" placeholder="Mobile phone" />
              <input className="input" name="email" type="email" placeholder="Email" />
            </div>
            <input className="input" name="birthdate" type="date" />
            <div className="toolbar toolbar-start">
              <button className="button" type="submit">Save member</button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="What matters here">
          <div className="list compact-list">
            <div className="list-item"><span>Keep names, phone numbers, and email current.</span></div>
            <div className="list-item"><span>Use this directory as the source for church-wide texts.</span></div>
            <div className="list-item"><span>Delete test records or mistakes directly from the table below.</span></div>
          </div>
        </SectionCard>
      </section>

      <SectionCard title="Member directory" action={<Badge>{smsReadyCount} SMS ready</Badge>}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Birthday</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.length ? (
              members.map((member) => (
                <tr key={member.id}>
                  <td>
                    <strong>{member.firstName} {member.lastName}</strong>
                    <div className="muted">{member.preferredName || "No preferred name"}</div>
                  </td>
                  <td>{member.phoneMobile || "-"}</td>
                  <td>{member.email || "-"}</td>
                  <td>{member.birthdate ? new Date(member.birthdate).toLocaleDateString() : "-"}</td>
                  <td><Badge>{member.status}</Badge></td>
                  <td>
                    <form action={deleteMemberAction}>
                      <input type="hidden" name="memberId" value={member.id} />
                      <button className="button secondary danger-button" type="submit">Delete</button>
                    </form>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>No members yet. Add the first one above.</td>
              </tr>
            )}
          </tbody>
        </table>
      </SectionCard>
    </AppShell>
  );
}
