import Link from "next/link";
import type { ReactNode } from "react";
import { navItems } from "@/lib/navigation";

export function AppShell({
  title,
  subtitle,
  currentPath,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  currentPath: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="app-shell shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-badge">CC</span>
          <div>
            <h1>ChurchCRM</h1>
            <p className="muted">A simpler church office workspace for members, schedules, sermons, and texting.</p>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navItems.map((item) => {
            const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href} className={`nav-link${active ? " active" : ""}`}>
                <strong>{item.label}</strong>
                <div className="muted">{item.description}</div>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="main">
        <div className="content-frame">
          <header className="topbar">
            <div>
              <p className="kicker">Church office workspace</p>
              <h2 className="page-title">{title}</h2>
              <p className="page-subtitle">{subtitle}</p>
            </div>
            {actions}
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
