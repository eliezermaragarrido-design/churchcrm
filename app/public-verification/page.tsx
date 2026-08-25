import Link from "next/link";

export const metadata = {
  title: "ChurchCRM | Ministry communication workspace",
  description:
    "ChurchCRM is the private ministry workspace used by First Methodist Church of Dimmitt for staff, contacts, schedules, SMS, and approved social publishing.",
};

export default function PublicVerificationPage() {
  return (
    <main className="public-policy-page">
      <section className="public-policy-card" aria-labelledby="page-title">
        <p className="public-kicker">FIRST METHODIST CHURCH OF DIMMITT</p>
        <h1 id="page-title">ChurchCRM ministry platform</h1>
        <p className="public-policy-lead">
          ChurchCRM is an organizational platform for authorized church staff
          and volunteers. It keeps ministry contacts, schedules, reminders,
          and approved social media content organized in one place.
        </p>

        <div className="public-policy-grid">
          <article>
            <h2>What the service does</h2>
            <p>
              Authorized users can manage ministry information, prepare event
              and prayer-group reminders, send requested SMS messages, connect
              approved social accounts, and schedule church-owned images or
              short videos for publication.
            </p>
          </article>
          <article>
            <h2>Who can use it</h2>
            <p>
              Access is limited to church staff and volunteers who have been
              invited by the church. Social and messaging connections are made
              only after the account owner authorizes them. The church does not
              sell access or open the platform to the public.
            </p>
          </article>
          <article>
            <h2>Responsible communication</h2>
            <p>
              ChurchCRM is intended for permission-based ministry updates,
              service information, Bible studies, prayer groups, and events. It
              is not intended for spam, deceptive content, or unauthorized
              messaging. SMS recipients may reply STOP to opt out or HELP for
              help.
            </p>
          </article>
          <article>
            <h2>Need help?</h2>
            <p>
              Contact the church office at{" "}
              <a href="mailto:office@fumcdimmitt.org">office@fumcdimmitt.org</a>.
            </p>
          </article>
        </div>

        <nav className="public-policy-nav" aria-label="Legal and service pages">
          <Link href={{ pathname: "/privacy" }}>Privacy policy</Link>
          <Link href={{ pathname: "/terms" }}>Terms of service</Link>
          <Link href={{ pathname: "/sms-consent" }}>SMS consent and messaging</Link>
          <Link href={{ pathname: "/contact" }}>Contact</Link>
        </nav>
      </section>
    </main>
  );
}
