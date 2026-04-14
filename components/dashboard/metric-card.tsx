export function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="metric-card">
      <p className="muted">{label}</p>
      <div className="metric-value">{value}</div>
      <p className="muted">{note}</p>
    </article>
  );
}
