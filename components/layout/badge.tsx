import type { ReactNode } from "react";

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "warn" | "danger" }) {
  const className = tone === "default" ? "pill" : `pill ${tone}`;
  return <span className={className}>{children}</span>;
}
