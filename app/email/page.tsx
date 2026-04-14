import { prisma } from "@/lib/db/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/layout/badge";
import { SectionCard } from "@/components/layout/section-card";

export default async function EmailPage() {
  const memberCount = await prisma.member.count({ where: { email: { not: null } } });

  return (
    <AppShell
      title="Email"
      subtitle="Prepare newsletters, sermon follow-ups, and church-wide email communication through Mailchimp."
      currentPath="/email"
      actions={<Badge>{memberCount} members with email</Badge>}
    >
      <section className="two-column">
        <SectionCard title="Mailchimp direction">
          <div className="list">
            <div className="list-item"><span>Connect your Mailchimp account and API key so the church can send newsletters, follow-up sequences, and targeted ministry emails.</span></div>
            <div className="list-item"><span>Start with simple church-wide or member-list communication before adding more advanced segmentation.</span></div>
            <div className="list-item"><span>Reuse sermon notes, announcements, and calendar highlights as polished weekly email content.</span></div>
          </div>
        </SectionCard>

        <SectionCard title="Audience base">
          <div className="stack">
            <div className="panel panel-soft"><strong>{memberCount}</strong><p className="muted">member records can already be synced to Mailchimp-ready audience lists</p></div>
            <div className="panel panel-soft"><strong>Simple first</strong><p className="muted">The focus is a clean church CRM first, then richer email segmentation later if needed.</p></div>
          </div>
        </SectionCard>
      </section>
    </AppShell>
  );
}
