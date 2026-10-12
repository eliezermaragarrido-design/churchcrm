"use client";
import { usePreparationMonth } from "./preparation-month";
import { useEffect, useRef, useState } from "react";
type Job = { id: string; status: string; communion: boolean; progress: string; error: string | null };
type Row = { id: string; serviceDate: string; title: string; ready: boolean; missing?: string; firstScriptureLesson?: string; musicDate?: string; communion: boolean; job: Job | null; jobs?: Job[] };
const endpoint = "/api/assistant/worship-outline";
const pendingKey = "pastorcrm-worship-downloads-v1";
function download(id: string) {
  const link = document.createElement("a"); link.href = `${endpoint}/${id}/download`; link.download = "";
  document.body.appendChild(link); link.click(); link.remove();
}
export function WorshipOutlineForm() {
  const selectedMonth = usePreparationMonth();
  const [rows, setRows] = useState<Row[]>([]), [message, setMessage] = useState("Loading Sunday services...");
  const [choices, setChoices] = useState<Record<string, boolean>>({});
  const [starting, setStarting] = useState<string[]>([]);
  const pending = useRef(new Map<string, boolean>()), inFlight = useRef(new Set<string>());
  function rememberDownloads() {
    try { sessionStorage.setItem(pendingKey, JSON.stringify([...pending.current])); } catch { /* Downloads still work when browser storage is unavailable. */ }
  }
  async function start(id: string, communion: boolean, regenerate = false) {
    if (!regenerate) { pending.current.set(id, communion); rememberDownloads(); }
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id); setStarting(current => [...current, id]);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: id, communion, regenerate }), signal: AbortSignal.timeout(30000) });
      const result = await response.json();
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) { pending.current.delete(id); rememberDownloads(); }
        throw new Error(result.error || "Reconnecting automatically...");
      }
      setRows(current => current.map(row => row.id === id ? { ...row, job: result.data, jobs: [...(row.jobs || []).filter(job => job.communion !== communion), result.data] } : row)); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Reconnecting automatically..."); }
    finally { inFlight.current.delete(id); setStarting(current => current.filter(item => item !== id)); }
  }
  useEffect(() => {
    let active = true, fetching = false;
    try {
      const saved = JSON.parse(sessionStorage.getItem(pendingKey) || "[]");
      if (Array.isArray(saved)) for (const item of saved) if (Array.isArray(item) && typeof item[0] === "string" && typeof item[1] === "boolean") pending.current.set(item[0], item[1]);
      setChoices(Object.fromEntries(pending.current));
    } catch { /* A corrupt storage entry never blocks document generation. */ }
    async function refresh() {
      if (fetching) return; fetching = true;
      try {
        const response = await fetch(endpoint + (selectedMonth ? "?month=" + selectedMonth : ""), { cache: "no-store", signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error("Connection interrupted. Reconnecting automatically...");
        const result = await response.json(); if (!active) return;
        setRows(result.data); setMessage("");
        for (const row of result.data as Row[]) {
          const selection = pending.current.get(row.id);
          if (selection === undefined) continue;
          const selected = row.jobs?.find(job => job.communion === selection) || (row.job?.communion === selection ? row.job : null);
          if (!selected && row.ready) void start(row.id, selection);
          else if (selected?.status === "generated") { pending.current.delete(row.id); rememberDownloads(); download(selected.id); }
          else if (selected?.status === "needs_attention") { pending.current.delete(row.id); rememberDownloads(); }
        }
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : "Reconnecting automatically..."); }
      finally { fetching = false; }
    }
    void refresh(); const timer = setInterval(refresh, 6000);
    window.addEventListener("sermon-calendar-imported", refresh);
    window.addEventListener("worship-music-imported", refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("sermon-calendar-imported", refresh); window.removeEventListener("worship-music-imported", refresh); };
  }, [selectedMonth]);
  return <div className="stack">
    <p className="muted">The sermon calendar supplies the First Scripture Lesson. The completed sermon guides the prayers. Your music workbook supplies this Sunday’s songs. Every generated section receives five reviews. The document continues automatically. The download opens when ready.</p>
    {message && <p role="status">{message}</p>}
    {rows.map(row => {
      const communion = choices[row.id] ?? row.communion;
      const job = row.jobs?.find(saved => saved.communion === communion) || (row.job?.communion === communion ? row.job : null);
      const busy = starting.includes(row.id) || job?.status === "running" || job?.status === "queued";
      return <div className="panel stack" key={row.id}>
        <strong>{new Date(row.serviceDate + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}</strong>
        <span>{row.title}</span>
        {row.firstScriptureLesson && <span>First Scripture Lesson: {row.firstScriptureLesson} (NIV)</span>}
        {row.musicDate && <span>Music imported for {row.musicDate}</span>}
        <label><input type="checkbox" checked={communion} disabled={!!busy} onChange={event => setChoices(current => ({ ...current, [row.id]: event.target.checked }))} /> Include Holy Communion</label>
        <button className="button" disabled={!row.ready || starting.includes(row.id)} aria-busy={!!busy} onClick={() => void start(row.id, communion, job?.status === "generated")}>{busy ? "Preparing Word document automatically..." : job?.status === "generated" ? "Generate new worship service (Word)" : "Prepare worship service (Word)"}</button>
        {job?.status === "generated" && <button className="button secondary" onClick={() => download(job.id)}>Download current worship service (Word)</button>}
        {!row.ready && <p className="muted">{row.missing || "Import this Sunday’s sermon calendar information first."}</p>}
        {busy && <p className="muted">Preparation has started. It continues automatically. The download opens when ready.</p>}
        {job && <p role="status" className="muted">{job.progress}</p>}
        {job?.status === "needs_attention" && <p role="alert">{job.error}</p>}
      </div>;
    })}
  </div>;
}
