export function Badge({ children, tone = "default" }: { children: string; tone?: "default" | "warn" | "danger" }) {
  const className = tone === "default" ? "pill" : `pill ${tone}`;
  return <span className={className}>{children}</span>;
}
