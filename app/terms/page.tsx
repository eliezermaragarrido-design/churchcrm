import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | ChurchCRM",
  description: "Terms of service for ChurchCRM.",
};

export default function TermsPage() {
  return (
    <main className="marketing-shell">
      <section className="marketing-card stack">
        <p className="eyebrow">ChurchCRM</p>
        <h1>Terms of Service</h1>
        <p className="muted">
          ChurchCRM provides church offices and ministry teams with tools for member management,
          calendars, messaging, and automated social media publishing.
        </p>
        <p>
          By using ChurchCRM, you confirm that you are authorized to manage the connected accounts,
          publish the uploaded media, and schedule or send communications on behalf of your church or ministry organization.
        </p>
        <p>
          Users are responsible for the accuracy of their content, the legality of their communications,
          and compliance with the platform rules of TikTok, Meta, YouTube, Twilio, and any other connected services.
        </p>
        <p>
          ChurchCRM may store account connection details, media references, scheduling records, and publishing logs
          only as needed to provide the service and troubleshoot authorized workflows.
        </p>
        <p>
          Access to the service may be suspended or removed if the platform is used for spam, abuse, unauthorized posting,
          or any activity that violates applicable law or third-party platform policies.
        </p>
        <p>
          If you need support, policy clarification, or data removal help, contact the organization operating your ChurchCRM workspace.
        </p>
      </section>
    </main>
  );
}
