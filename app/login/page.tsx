"use client";
import { useEffect, useState, type FormEvent } from "react";

export default function LoginPage() {
  const [returnTo, setReturnTo] = useState("/dashboard");
  const [error, setError] = useState("");
  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) setReturnTo(next);
  }, []);
  const [busy, setBusy] = useState(false);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: fields.get("email"), password: fields.get("password") }) });
      if (!response.ok) { setError("Unable to sign in. Check your email and password, or contact your administrator."); return; }
      window.location.assign(returnTo);
    } catch { setError("Connection interrupted. Please try again."); }
    finally { setBusy(false); }
  }
  return <main style={{ maxWidth: 460, margin: "10vh auto", padding: 24 }}><section className="list-card stack">
    <p className="kicker">First Methodist Church of Dimmitt</p><h1>Staff sign in</h1>
    <p>Use your email and password to open the shared church workspace.</p>
    <form onSubmit={login} className="stack">
      <label>Email<input name="email" type="email" autoComplete="username" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      <button className="button" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  </section></main>;
}
