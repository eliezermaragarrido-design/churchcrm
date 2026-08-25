import Link from "next/link";

export const metadata = { title: "Contact | ChurchCRM" };

export default function ContactPage() {
  return (
    <main className="public-policy-page">
      <article className="public-policy-card">
        <p className="public-kicker">First Methodist Church of Dimmitt</p>
        <h1>Contact the Church Office</h1>
        <p>For questions about ChurchCRM, privacy, terms, SMS consent, or connected social accounts, contact the church office below.</p>
        <p><strong>Email:</strong> <a href="mailto:office@fumcdimmitt.org">office@fumcdimmitt.org</a></p>
        <p><strong>Address:</strong> 110 SW 3rd Street, Dimmitt, Texas</p>
        <nav className="public-policy-nav"><Link href={{ pathname: "/privacy" }}>Privacy</Link><Link href={{ pathname: "/terms" }}>Terms</Link><Link href={{ pathname: "/sms-consent" }}>SMS consent</Link><Link href={{ pathname: "/" }}>Home</Link></nav>
      </article>
    </main>
  );
}
