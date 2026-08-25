import Link from "next/link";
import { signInAction } from "./actions";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;

  return (
    <main className="marketing-shell">
      <section className="auth-card">
        <p className="kicker">Church staff access</p>
        <h1 className="page-title" style={{ fontSize: "2.5rem" }}>Staff access</h1>
        <p className="page-subtitle">Use this page only if staff login is enabled for the workspace.</p>
        <form action={signInAction} className="stack" style={{ marginTop: 20 }}>
          <label>
            <span className="muted">Email</span>
            <input className="input" name="email" type="email" placeholder="office@yourchurch.org" required />
          </label>
          <label>
            <span className="muted">Password</span>
            <input className="input" name="password" type="password" placeholder="••••••••" required />
          </label>
          {params.error ? <p className="pill danger">{params.error}</p> : null}
          <button className="button" type="submit">Sign in</button>
          <Link href="/" className="button secondary">Back to home</Link>
        </form>
      </section>
    </main>
  );
}
