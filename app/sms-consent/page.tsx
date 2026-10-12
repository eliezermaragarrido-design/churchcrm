import Link from "next/link";
import { SmsSignupForm } from "./signup-form";

export const metadata = { title: "SMS Consent | ChurchCRM" };

export default function SmsConsentPage() {
  return (
    <main className="public-policy-page">
      <article className="public-policy-card">
        <p className="public-kicker">First Methodist Church of Dimmitt</p>
        <h1>Church text updates</h1>
        <p>Stay connected with First Methodist Church of Dimmitt. Sign up for worship invitations, reminders, and church news.</p>
        <SmsSignupForm />
        <p>Questions? <a href="mailto:office@fumcdimmitt.org">Contact the church office</a>.</p>
        <nav className="public-policy-nav"><Link href={{ pathname: "/privacy" }}>Privacy</Link><Link href={{ pathname: "/terms" }}>Terms</Link><Link href={{ pathname: "/contact" }}>Contact</Link><Link href={{ pathname: "/" }}>Home</Link></nav>
      </article>
    </main>
  );
}
