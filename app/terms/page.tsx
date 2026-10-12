import Link from "next/link";

export const metadata = { title: "Terms of Service | ChurchCRM" };

export default function TermsPage() {
  return (
    <main className="public-policy-page">
      <article className="public-policy-card">
        <p className="public-kicker">ChurchCRM</p>
        <h1>Terms of Service</h1>
        <p>ChurchCRM is a ministry operations platform for authorized First Methodist Church of Dimmitt staff and volunteers.</p>
        <h2>Acceptable use</h2>
        <p>Use the service only for lawful church operations. Do not use it for spam, deception, harassment, unlawful content, unauthorized access, or communications to people who have not requested them.</p>
        <h2>Messages and media</h2>
        <p>Users are responsible for recipient consent, accurate content, and rights to uploaded media. SMS recipients may reply STOP to opt out or HELP for help; message and data rates may apply. We may pause or remove access if someone uses the service for unauthorized messaging or policy violations.</p>
        <h2>First Methodist Church of Dimmitt SMS program</h2>
        <p>People who expressly opt in may receive worship invitations, Bible study reminders, church event notifications, schedule changes, prayer-group updates, and requested ministry follow-up messages from First Methodist Church of Dimmitt. Message frequency varies. Message and data rates may apply.</p>
        <p>SMS consent is optional and is not a condition of attendance, giving, purchase, or access to church services. Providing a phone number or becoming a church member does not by itself enroll someone in text messages.</p>
        <p>Reply STOP to unsubscribe from this SMS program. Reply HELP for help, or contact <a href="mailto:office@fumcdimmitt.org">office@fumcdimmitt.org</a>. Carriers are not liable for delayed or undelivered messages.</p>
        <p>See our <Link href={{ pathname: "/privacy" }}>Privacy Policy</Link> for how we handle mobile information and consent, and our <Link href={{ pathname: "/sms-consent" }}>SMS consent information</Link>.</p>
        <h2>Third-party services</h2>
        <p>Publishing and messaging depend on third-party permissions, availability, and policies. Connected accounts must remain authorized and in good standing. Users are responsible for complying with the rules of TikTok, Meta, YouTube, and Twilio when they use those integrations.</p>
        <h2>Contact</h2>
        <p>Questions can be sent to <a href="mailto:office@fumcdimmitt.org">office@fumcdimmitt.org</a>.</p>
        <nav className="public-policy-nav"><Link href={{ pathname: "/privacy" }}>Privacy</Link><Link href={{ pathname: "/sms-consent" }}>SMS consent</Link><Link href={{ pathname: "/contact" }}>Contact</Link><Link href={{ pathname: "/" }}>Home</Link></nav>
      </article>
    </main>
  );
}
