"use client";
import { useEffect, useState } from "react";
import { usePreparationMonth } from "./preparation-month";
type Job = { id: string; status: string; progress: string; error: string | null; retryAt?: number | null };
const endpoint = "/api/assistant/grace-hope";
export function GraceHopeForm() {
  const month = usePreparationMonth();
  const [audience, setAudience] = useState("mixed"), [job, setJob] = useState<Job | null>(null);
  const [missing, setMissing] = useState<string[]>([]), [count, setCount] = useState(0), [message, setMessage] = useState("");
  const [planned, setPlanned] = useState(0);
  const [loading, setLoading] = useState(true), [starting, setStarting] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener("sermon-calendar-imported", refresh);
    return () => window.removeEventListener("sermon-calendar-imported", refresh);
  }, []);
  useEffect(() => {
    if (!month) return;
    const controller = new AbortController(); setJob(null); setCount(0); setPlanned(0); setMissing([]); setLoading(true); setMessage("");
    fetch(`${endpoint}?month=${month}&audience=${audience}`, { cache: "no-store", signal: controller.signal }).then(async r => {
      const result = await r.json(); if (!r.ok) throw new Error(result.error || "Could not load monthly sermons.");
      if (!controller.signal.aborted) { setJob(result.data.job); setMissing(result.data.missing); setCount(result.data.sources.length); setPlanned(result.data.sources.filter((s: {basis: string}) => s.basis === "calendar").length); }
    }).catch(e => { if (!controller.signal.aborted) setMessage(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [month, audience, revision]);
  // A saved guide keeps going on its own, including after a temporary service error.
  // This also resumes a guide if the page was reloaded while it was being prepared.
  const busy = job?.status === "queued" || job?.status === "running" || job?.status === "needs_attention";
  useEffect(() => {
    if (!busy || !job) return;
    let active = true, timer: ReturnType<typeof setTimeout>;
    async function step() {
      try {
        const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(job!.status === "needs_attention" ? { id: job!.id, retry: true } : { id: job!.id }) });
        const result = await r.json(); if (!r.ok) throw new Error(result.error || "Connection interrupted.");
        if (active) { setJob(result.data.job); setMessage(""); }
        if (active && result.data.job.status === "generated") {
          const key = `grace-hope-download-${job!.id}`;
          try { if (sessionStorage.getItem(key)) { sessionStorage.removeItem(key); window.location.assign(`${endpoint}/${job!.id}/download`); } } catch { /* The download link remains available if browser storage is disabled. */ }
        }
      } catch (e) { if (active) setMessage((e as Error).message); }
      const wait = Math.max(12000, (job!.retryAt || 0) - Date.now());
      if (active) timer = setTimeout(step, wait);
    }
    void step(); return () => { active = false; clearTimeout(timer); };
  }, [job?.id, busy]);
  async function prepare(regenerate = false) {
    setStarting(true); setMessage("");
    try {
      const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(job?.status === "needs_attention" ? { id: job.id, retry: true } : { month, audience, regenerate }) });
      const result = await r.json(); if (!r.ok) throw new Error(result.error || "Could not start the guide.");
      try { sessionStorage.setItem(`grace-hope-download-${result.data.job.id}`, "1"); } catch { /* Manual download remains available. */ }
      setJob(result.data.job);
      if (result.data.job.status === "generated") window.location.assign(`${endpoint}/${result.data.job.id}/download`);
    } catch (e) { setMessage((e as Error).message); } finally { setStarting(false); }
  }
  return <div className="stack">
    <p className="muted">A monthly conversation guide using your sermon calendar and completed sermons, with explained Scripture, reflection, practical questions and a fresh opening activity.</p>
    <label>Group<select className="select" value={audience} disabled={starting || !!busy} onChange={e => setAudience(e.target.value)}><option value="mixed">Mixed adults</option><option value="women">Women</option><option value="men">Men</option></select></label>
    <p className="muted">{loading ? "Checking this month’s sermons..." : `${count - planned} completed sermons and ${planned} calendar plans for ${month}.`}</p>
    {!loading && missing.length > 0 && <p className="muted">Complete sermon calendar information for: {missing.join(", ")}.</p>}
    {job?.status === "generated" && <a className="button" href={`${endpoint}/${job.id}/download`}>Download monthly guide (Word)</a>}
    <button className="button secondary" disabled={loading || starting || !!busy || !!missing.length || !month || !count} onClick={() => void prepare(job?.status === "generated")}>{busy || starting ? "Preparing monthly guide..." : job?.status === "generated" ? "Generate a new version" : "Prepare monthly guide (Word)"}</button>
    {job && <p className="muted" role="status">{job.progress}</p>}
    {(message || job?.error) && <p role="alert">{message || job?.error}</p>}
  </div>;
}
