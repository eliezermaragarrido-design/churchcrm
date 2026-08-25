import Link from "next/link";

export default function HomePage() {
  return (
    <main className="marketing-shell">
      <section className="hero-card" style={{ maxWidth: 1280 }}>
        <div className="stack">
          <p className="kicker">First Methodist Church of Dimmitt</p>
          <h1 className="page-title">A church operations platform for members, messages, calendars, and publishing.</h1>
          <p className="page-subtitle">
            ChurchCRM helps the church manage ministry information, send requested texts, organize schedules, and publish approved content in one place.
          </p>
          <div className="toolbar">
            <Link href="/dashboard" className="button">Start</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
