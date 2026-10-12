import { PreparationMonth } from "./preparation-month";
import { AppShell } from "@/components/layout/app-shell";
import { SermonPlanForm } from "./sermon-plan-form";
import { QuickAiForm } from "./quick-ai-form";
import { SermonPreparationForm } from "./sermon-preparation-form";
import { WorshipOutlineForm } from "./worship-outline-form";
import { WorshipMusicForm } from "./worship-music-form";
import { BulletinForm } from "./bulletin-form";
import { GraceHopeForm } from "./grace-hope-form";

export default function AssistantPage() {
  return (
    <AppShell
      title="Assistant"
      subtitle="Church-office tools for documents, sermons, schedules, and messages."
      currentPath="/assistant"
      actions={<button className="button">Start new task</button>}
    >
      <section className="two-column">
        <article className="list-card"><div className="stack"><h2 className="card-title">Meeting minutes</h2><p className="muted">Upload a council meeting recording to prepare shareable minutes.</p><QuickAiForm kind="audio" accept="audio/*" label="Meeting audio" endpoint="/api/assistant/meeting-notes" /></div></article>
        <article className="list-card"><div className="stack"><h2 className="card-title">Sermon notes</h2><p className="muted">Upload the weekly PowerPoint to extract the title, points, and scripture used in each point.</p><QuickAiForm kind="sermon" accept=".ppt,.pptx" label="Sermon PowerPoint" endpoint="/api/assistant/sermon-notes" /></div></article>
      </section>
      <PreparationMonth>
      <section className="two-column">
        <article className="list-card"><div className="stack"><h2 className="card-title">Sermon preparation</h2><p className="muted">Your imported calendar supplies the title, scripture, series, and sermon remarks for each Sunday.</p><SermonPreparationForm /></div></article>
        <article className="list-card"><div className="stack"><h2 className="card-title">Import sermon calendar</h2><SermonPlanForm /></div></article>
        <article className="list-card"><div className="stack"><h2 className="card-title">Import weekly worship music</h2><WorshipMusicForm /></div></article>
        <article className="list-card"><div className="stack"><h2 className="card-title">Worship service outline</h2><WorshipOutlineForm /></div></article>
        <article className="list-card"><div className="stack"><h2 className="card-title">Weekly bulletin</h2><BulletinForm /></div></article>
        <article className="list-card"><div className="stack"><h2 className="card-title">Grace and Hope Groups</h2><GraceHopeForm /></div></article>
      </section>
      </PreparationMonth>

    </AppShell>
  );
}
