import Link from "next/link";

export const metadata = {
  title: "ChurchCRM | Public information",
  description:
    "Public information for ChurchCRM, operated by First Methodist Church of Dimmitt.",
};

export default function VerificationPage() {
  return (
    <main className="public-policy-page">
      <article className="public-policy-card">
        <p className="public-kicker">FIRST METHODIST CHURCH OF DIMMITT</p>
        <h1>ChurchCRM</h1>
        <p>
          ChurchCRM is an organizational ministry platform for authorized staff
          and volunteers at First Methodist Church of Dimmitt. It helps the
          church manage members, schedules, messages, SMS consent, and approved
          social-media publishing.
        </p>

        <h2>Public information</h2>
        <nav aria-label="Public information links" className="public-policy-nav">
          <Link href={{ pathname: "/privacy" }}>Privacy Policy</Link>
          <Link href={{ pathname: "/terms" }}>Terms of Service</Link>
          <Link href={{ pathname: "/sms-consent" }}>SMS Consent and Messaging</Link>
          <Link href={{ pathname: "/contact" }}>Contact</Link>
        </nav>

        <h2>How the service works</h2>
        <p>
          Authorized users sign in to manage church content and connect only the
          social accounts they control. Connected services receive content only
          when the user schedules or publishes it through ChurchCRM. Visitors
          can review the public policies without creating an account.
        </p>

        <p>
          For questions, contact the church office at{" "}
          <a href="mailto:office@fumcdimmitt.org">office@fumcdimmitt.org</a>.
        </p>
      </article>
    </main>
  );
}
