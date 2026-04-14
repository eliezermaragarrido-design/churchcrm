import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/layout/badge";
import { SectionCard } from "@/components/layout/section-card";
import { assistantTasks } from "@/lib/mock-data";

export default function AssistantPage() {
  return (
    <AppShell
      title="Assistant"
      subtitle="Church-office AI tools for documents, sermon notes, summaries, and communication workflows."
      currentPath="/assistant"
      actions={<button className="button">Start new task</button>}
    >
      <section className="hero-card">
        <div className="stack">
          <p className="kicker">Secretary, sermon, and pastor support</p>
          <h3 className="card-title">One assistant can handle office letters, sermon notes, meeting summaries, and prayer-text preparation.</h3>
          <p className="page-subtitle">
            This page combines the AI assistant and sermon support so staff do not need separate tabs for office work and sermon preparation.
          </p>
        </div>
        <div className="stack">
          <Badge>Document templates ready</Badge>
          <Badge>Sermon notes workspace ready</Badge>
          <Badge tone="warn">Audio summary workflow planned</Badge>
        </div>
      </section>

      <section className="three-column">
        {assistantTasks.map((task) => (
          <article key={task.title} className="list-card">
            <div className="stack">
              <h3 className="card-title">{task.title}</h3>
              <p className="muted">{task.description}</p>
              <div className="panel">
                <strong>Output</strong>
                <p className="muted">{task.output}</p>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="two-column">
        <SectionCard title="Sermon tools in this same tab">
          <div className="list">
            <div className="list-item"><span>Upload sermon slides and turn them into clean sermon notes.</span></div>
            <div className="list-item"><span>Prepare different sermon summaries for staff, volunteers, or the church.</span></div>
            <div className="list-item"><span>Use the same AI workspace for sermon prep and church-office communication.</span></div>
          </div>
        </SectionCard>

        <SectionCard title="Ready-made church tasks">
          <div className="list">
            <div className="list-item"><span>Transfer membership letters and receiving-member confirmations</span></div>
            <div className="list-item"><span>Baptism certificates, new member certificates, and bulletin drafts</span></div>
            <div className="list-item"><span>Visitor follow-up, sympathy letters, and ministry announcements</span></div>
          </div>
        </SectionCard>
      </section>

      <section className="two-column">
        <SectionCard title="AI intake flows to build next">
          <div className="list">
            <div className="list-item"><span>Upload board meeting audio and produce concise notes, decisions, and action items</span></div>
            <div className="list-item"><span>Upload sermon PowerPoint files and extract verses, points, and congregation notes</span></div>
            <div className="list-item"><span>Turn approved prayer lists into weekly or biweekly text campaigns</span></div>
          </div>
        </SectionCard>

        <SectionCard title="Where this goes next">
          <div className="list">
            <div className="list-item"><span>Secretary prompts tied to church templates and office documents.</span></div>
            <div className="list-item"><span>Sermon note extraction from slides and media uploads.</span></div>
            <div className="list-item"><span>Automatic handoff into messages, calendars, and church communication.</span></div>
          </div>
        </SectionCard>
      </section>
    </AppShell>
  );
}
