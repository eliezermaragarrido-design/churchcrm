"use client";
import { usePreparationMonth } from "./preparation-month";

import { useEffect, useRef, useState } from "react";

type Job = { id: string; status: string; progress: string; error: string | null; retryAt?: number | null };
type Plan = { id: string; serviceDate: string; title: string; series: string; scripture: string; missing: string[]; job: Job | null };
const endpoint = "/api/assistant/sermon-preparation";
const dateLabel = (date: string) => new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });

export function SermonPreparationForm() {
  const selectedMonth = usePreparationMonth();
  const [plans, setPlans] = useState<Plan[]>([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [starting, setStarting] = useState<string[]>([]);
  const requests = useRef(new Set<string>());
  const downloads = useRef(new Set<string>());
  const regenerating = useRef(new Set<string>());
  const connectionRetries = useRef(new Map<string, { attempts: number; at: number }>());

  function download(id: string) {
    const link = document.createElement("a");
    link.href = `${endpoint}/${id}/download`; link.download = "";
    document.body.appendChild(link); link.click(); link.remove();
  }

  async function start(planId: string, downloadWhenReady = false, regenerate = false) {
    if (requests.current.has(planId)) return;
    requests.current.add(planId);
    if (downloadWhenReady) downloads.current.add(planId);
    if (regenerate) regenerating.current.add(planId);
    setStarting(current => [...current, planId]);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId, regenerate }) });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Could not start this sermon.");
      connectionRetries.current.delete(planId);
      setPlans(current => current.map(plan => plan.id === planId ? { ...plan, job: result.data } : plan));
    } catch (error) {
      const attempts = (connectionRetries.current.get(planId)?.attempts || 0) + 1;
      connectionRetries.current.set(planId, { attempts, at: Date.now() + Math.min(120000, 5000 * 2 ** (attempts - 1)) });
      setMessage(attempts <= 5 ? "Reconnecting automatically. Saved progress is retained." : (error instanceof Error ? error.message : "Connection unavailable. Saved progress is retained."));
    }
    finally {
      requests.current.delete(planId);
      setStarting(current => current.filter(id => id !== planId));
    }
  }

  useEffect(() => {
    let active = true;
    let fetching = false;
    async function refresh() {
      if (fetching) return;
      fetching = true;
      try {
        const response = await fetch(endpoint + (selectedMonth ? "?month=" + selectedMonth : ""), { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error("Could not load the imported calendar.");
        if (!active) return;
        const rows: Plan[] = result.data;
        setPlans(rows); setMessage("");
        for (const plan of rows) {
          const connection = connectionRetries.current.get(plan.id);
          const canConnect = !connection || (connection.attempts <= 5 && connection.at <= Date.now());
          if (canConnect && ((plan.job?.status === "queued" && (!plan.job.retryAt || plan.job.retryAt <= Date.now())) || (connection && !plan.job && downloads.current.has(plan.id)))) void start(plan.id);
          if (regenerating.current.has(plan.id) && plan.job?.status !== "generated") regenerating.current.delete(plan.id);
          if (plan.job?.status === "generated" && downloads.current.has(plan.id) && !regenerating.current.has(plan.id)) {
            downloads.current.delete(plan.id); download(plan.job.id);
          }
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Could not refresh progress. Saved work is retained.");
      } finally { fetching = false; if (active) setLoading(false); }
    }
    void refresh();
    const timer = setInterval(refresh, 4000);
    window.addEventListener("sermon-calendar-imported", refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("sermon-calendar-imported", refresh); };
  }, [selectedMonth]);

  const month = plans[0]?.serviceDate.slice(0, 7);
  return <div className="stack">
    <p className="muted">Every Sunday in the selected month appears below. Sermon information comes from the dates in your imported Excel calendar. The sermon prepares automatically and downloads when ready. Keep this page open to continue through all preparation steps.</p>
    {loading && <p role="status">Loading your sermon calendar…</p>}
    {message && <p role="alert">{message}</p>}
    {!loading && !plans.length && <p>Import your sermon calendar to see the Sunday buttons here.</p>}
    {month && <h3>{new Date(month + "-01T12:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</h3>}
    {plans.map(plan => {
      const job = plan.job;
      const busy = starting.includes(plan.id) || job?.status === "running" || job?.status === "queued" || job?.status === "needs_attention";
      const ready = job?.status === "generated";
      return <div className="panel stack" key={plan.id}>
        <strong>{dateLabel(plan.serviceDate)}</strong>
        <span>{plan.title}</span>
        {plan.scripture && <span className="muted">{plan.series} · {plan.scripture} (NIV)</span>}
        {plan.missing.length > 0 ? <><button className="button" disabled>Download sermon · {dateLabel(plan.serviceDate)}</button><p role="status">Missing in Excel: {plan.missing.join(", ")}. Import a calendar with this date to enable the button.</p></> :
          <button className="button" disabled={busy} onClick={() => { setMessage(""); void start(plan.id, true, ready); }}>
            {busy ? "Preparing complete sermon automatically…" : ready ? `Generate new sermon · ${dateLabel(plan.serviceDate)}` : `Prepare complete sermon · ${dateLabel(plan.serviceDate)}`}
          </button>}
        {ready && <button className="button secondary" onClick={() => download(job.id)}>Download current sermon</button>}
        {job && <p className="muted" role="status">{job.progress}</p>}
        {job?.status === "needs_attention" && job.error && <p role="alert">{job.error}</p>}
      </div>;
    })}
  </div>;
}
