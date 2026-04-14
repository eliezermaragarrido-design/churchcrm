import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | ChurchCRM",
  description: "Privacy policy for ChurchCRM.",
};

export default function PrivacyPage() {
  return (
    <main className="marketing-shell">
      <section className="marketing-card stack">
        <p className="eyebrow">ChurchCRM</p>
        <h1>Privacy Policy</h1>
        <p className="muted">
          ChurchCRM is used by churches and ministry teams to manage member communication,
          scheduling, and publishing workflows.
        </p>
        <p>
          We collect only the information needed to operate the product, such as account details,
          connected social account information, communication records, and content scheduling data.
        </p>
        <p>
          We do not sell personal information. Data is used only to provide the CRM experience,
          automate approved workflows, and support church operations.
        </p>
        <p>
          Connected platform data, such as Facebook Page or Instagram account information, is used
          only for account connection, scheduling, and publishing actions authorized by the user.
        </p>
        <p>
          If you have questions about this policy or want data removed, contact the organization
          operating your ChurchCRM workspace.
        </p>
      </section>
    </main>
  );
}

