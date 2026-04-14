import Link from "next/link";

export default function HomePage() {
  return (
    <main className="marketing-shell">
      <section className="hero-card" style={{ maxWidth: 1280 }}>
        <div className="stack">
          <p className="kicker">Built for the whole church office and ministry team</p>
          <h1 className="page-title">One workspace for members, care, calendars, sermons, messages, and automation.</h1>
          <p className="page-subtitle">
            ChurchCRM combines member records, internal staff calendars, public church schedules,
            sermon delivery, bulk texting, newsletters, and automated social posting in one ministry-friendly dashboard.
          </p>
          <div className="toolbar">
            <Link href="/sign-in" className="button">Open staff login</Link>
            <Link href="/dashboard" className="button secondary">Preview dashboard</Link>
          </div>
        </div>
        <div className="panel">
          <h2 className="card-title">What's ready in this scaffold</h2>
          <div className="list">
            <div className="list-item"><span>Auth shell</span><strong>Ready</strong></div>
            <div className="list-item"><span>Members and calendars</span><strong>Live</strong></div>
            <div className="list-item"><span>Sermons, messages, email, and automation tabs</span><strong>Ready</strong></div>
            <div className="list-item"><span>Assistant and AI workflows</span><strong>Ready</strong></div>
            <div className="list-item"><span>Twilio and Mailchimp integration direction</span><strong>Planned</strong></div>
          </div>
        </div>
      </section>
    </main>
  );
}
