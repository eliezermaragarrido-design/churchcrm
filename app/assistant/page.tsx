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
      <section className="metrics-grid compact-metrics">
        <div className="metric-card">
          <p className="muted">Tasks</p>
          <div className="metric-value">{assistantTasks.length}</div>
        </div>
        <div className="metric-card">
          <p className="muted">Ready tools</p>
          <div className="metric-value">3</div>
        </div>
      </section>

      <section className="three-column">
        {assistantTasks.map((task) => (
          <article key={task.title} className="list-card">
            <div className="stack">
              <h3 className="card-title">{task.title}</h3>
              <div className="panel">
                <p className="muted">{task.output}</p>
              </div>
            </div>
          </article>
        ))}
      </section>

    </AppShell>
  );
}
