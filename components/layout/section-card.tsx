import type { ReactNode } from "react";

export function SectionCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="list-card">
      <div className="toolbar">
        <h3 className="card-title">{title}</h3>
        {action}
      </div>
      <div className="stack">{children}</div>
    </section>
  );
}
