import Link from "next/link";

export const metadata = { title: "Privacy Policy | ChurchCRM" };

export default function PrivacyPage() {
  return (
    <main className="public-policy-page">
      <article className="public-policy-card">
        <p className="public-kicker">ChurchCRM</p>
        <h1>Privacy Policy</h1>
        <p>First Methodist Church of Dimmitt operates ChurchCRM for authorized church staff and volunteers.</p>
        <h2>Information we use</h2>
        <p>We use account, member, contact, calendar, communication, media, and connected social-account information to operate church services, send requested notifications, schedule approved content, and protect the workspace.</p>
        <h2>How we share information</h2>
        <p>We do not sell personal information or phone numbers. We use service providers such as Supabase, Vercel, Twilio, and connected social platforms only to provide the requested CRM features and protect the service.</p>
        <p>Mobile information will not be shared with third parties or affiliates for marketing or promotional purposes. Text messaging opt-in data and consent will not be sold, rented, or shared with third parties or affiliates for their own use. Providers that deliver and operate our messaging service may process this information only on our behalf to provide that service.</p>
        <h2>SMS communications</h2>
        <p>Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. SMS messages require the recipient's express consent for the applicable church messaging program. Church membership, providing a phone number, or staff authorization alone does not establish SMS consent.</p>
        <h2>Contact</h2>
        <p>Questions about privacy can be sent to <a href="mailto:office@fumcdimmitt.org">office@fumcdimmitt.org</a>.</p>
        <nav className="public-policy-nav"><Link href={{ pathname: "/terms" }}>Terms</Link><Link href={{ pathname: "/sms-consent" }}>SMS consent</Link><Link href={{ pathname: "/contact" }}>Contact</Link><Link href={{ pathname: "/" }}>Home</Link></nav>
      </article>
    </main>
  );
}
