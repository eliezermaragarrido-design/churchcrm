import Link from "next/link";

export const metadata = { title: "SMS Consent | ChurchCRM" };

export default function SmsConsentPage() {
  return (
    <main className="public-policy-page">
      <article className="public-policy-card">
        <p className="public-kicker">First Methodist Church of Dimmitt</p>
        <h1>SMS Consent</h1>
        <p>Church members and ministry contacts may opt in through a church form, event registration, direct staff request, or by texting START after being invited by the church.</p>
        <h2>What messages contain</h2>
        <p>Messages may include worship and Bible study reminders, prayer-group updates, church events, schedule changes, volunteer coordination, and requested follow-up messages.</p>
        <h2>How consent is collected</h2>
        <p>Consent is collected only for ministry-related communication that the recipient requested or agreed to receive. Consent is separate from the Privacy Policy and Terms of Service. Consent is not a condition of attendance, giving, or purchase.</p>
        <h2>Opt out and help</h2>
        <p>Reply STOP at any time to stop messages. Reply HELP for help. Message frequency varies and message and data rates may apply. We do not sell, rent, or share mobile numbers for third-party marketing.</p>
        <h2>Example messages</h2>
        <p>Examples include: "First Methodist Church of Dimmitt: Worship service reminder for Sunday at 10:45 AM. Reply STOP to opt out or HELP for help."</p>
        <p>Read our <Link href={{ pathname: "/privacy" }}>Privacy Policy</Link> and <Link href={{ pathname: "/terms" }}>Terms of Service</Link>.</p>
        <nav className="public-policy-nav"><Link href={{ pathname: "/privacy" }}>Privacy</Link><Link href={{ pathname: "/terms" }}>Terms</Link><Link href={{ pathname: "/contact" }}>Contact</Link><Link href={{ pathname: "/" }}>Home</Link></nav>
      </article>
    </main>
  );
}
