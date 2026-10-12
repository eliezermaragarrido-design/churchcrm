"use client";
import { useEffect, useState } from "react";
import { filenameDate, musicLabels, songDetail, type MusicPlan, type MusicSlot } from "@/lib/worship-music";
export function WorshipMusicForm() {
  const [date, setDate] = useState(""), [file, setFile] = useState<File | null>(null), [plans, setPlans] = useState<MusicPlan[]>([]);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function refresh() { const response = await fetch("/api/assistant/worship-music", { cache: "no-store" }); if (response.ok) setPlans((await response.json()).data); }
  useEffect(() => { void refresh().catch(() => setMessage("Unable to load imported music. Refresh the page to reconnect.")); }, []);
  async function upload(event: React.FormEvent) {
    event.preventDefault(); if (!file) return; setBusy(true); setMessage("");
    try {
      const form = new FormData(); form.set("file", file); form.set("serviceDate", date);
      const response = await fetch("/api/assistant/worship-music", { method: "POST", body: form }), result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage(`Music saved for ${result.data.plan.serviceDate}.${result.data.missing.length ? " Missing placements: " + result.data.missing.join(", ") : " All service placements are ready."}`);
      await refresh(); window.dispatchEvent(new Event("worship-music-imported"));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to import music."); }
    finally { setBusy(false); }
  }
  return <div className="stack"><p className="muted">Upload the worship leader’s Excel for each service. Placement determines the order. CCLI is omitted. Song titles, selected verses, book, page and notes come from the workbook.</p>
    <form className="stack" onSubmit={upload}>
      <label>Music Excel workbook<input className="input" type="file" accept=".xlsx,.xls" required onChange={event => { const selected = event.target.files?.[0] || null; setFile(selected); setDate(selected ? filenameDate(selected.name) : ""); }} /></label>
      <label>Music service date<input className="input" type="date" required value={date} onChange={event => setDate(event.target.value)} /></label>
      <button className="button" disabled={busy}>{busy ? "Importing music..." : "Import weekly music"}</button>
    </form>
    {message && <p role="status">{message}</p>}
    {plans.map(plan => <details key={plan.serviceDate}><summary>{plan.serviceDate} · {plan.filename}</summary><dl>{(Object.keys(musicLabels) as MusicSlot[]).map(slot => <div key={slot}><dt><strong>{musicLabels[slot]}</strong></dt><dd>{plan.songs[slot]?.map(songDetail).join(" / ") || "Not supplied"}</dd></div>)}</dl></details>)}
  </div>;
}
