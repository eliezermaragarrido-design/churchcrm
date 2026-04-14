import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Deletion | ChurchCRM",
  description: "Data deletion instructions for ChurchCRM.",
};

export default function DataDeletionPage() {
  return (
    <main className="marketing-shell">
      <section className="marketing-card stack">
        <p className="eyebrow">ChurchCRM</p>
        <h1>Data Deletion Instructions</h1>
        <p>
          If you want your connected data removed from ChurchCRM, contact the church or workspace
          administrator using this CRM and request account or integration removal.
        </p>
        <p>
          Workspace administrators can disconnect social accounts, remove scheduled posts, and
          delete related records inside the application.
        </p>
        <p>
          If a Meta-connected account must be removed, the administrator should disconnect the
          account from the Automation section and delete related scheduled posts.
        </p>
      </section>
    </main>
  );
}
