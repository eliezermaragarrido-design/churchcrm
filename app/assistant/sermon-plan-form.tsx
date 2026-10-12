"use client";

import { useEffect, useState } from "react";

type CalendarEntry = { serviceDate: string; title: string; series: string; scripture: string };
const monthLabel = (serviceDate: string) => new Date(serviceDate + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const dateLabel = (serviceDate: string) => new Date(serviceDate + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export function SermonPlanForm() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  async function loadCalendar() {
    try {
      const response = await fetch("/api/sermon-plans/months", { cache: "no-store", signal: AbortSignal.timeout(30000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load calendar.");
      setEntries(result.data.entries || []);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load calendar."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadCalendar(); }, []);
  async function importWorkbook(formData: FormData) {
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/sermon-plans/import", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not import workbook.");
      setMessage("Calendar saved. " + result.data.matched + " of " + result.data.totalSundays + " Sundays matched for " + result.data.month + "." + (result.data.matched < result.data.totalSundays ? " Check the year and dates in Excel for the remaining Sundays." : " Sunday buttons are ready."));
      await loadCalendar();
      window.dispatchEvent(new Event("sermon-calendar-imported"));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not import workbook."); }
    finally { setPending(false); }
  }
  const grouped = entries.reduce<Record<string, CalendarEntry[]>>((all, entry) => { const month = monthLabel(entry.serviceDate); (all[month] ||= []).push(entry); return all; }, {});
  return <div className="stack"><form action={importWorkbook} className="stack"><label>Excel workbook<input className="input" type="file" name="file" accept=".xlsx,.xls" required /></label><button className="button" type="submit" disabled={pending}>{pending ? "Importing…" : "Import Excel workbook"}</button>{message && <p role="status">{message}</p>}</form><section className="panel stack" aria-live="polite"><strong>Calendar already imported</strong>{loading ? <p className="muted">Loading saved Sundays...</p> : entries.length === 0 ? <p className="muted">No Sunday sermon calendar has been imported yet.</p> : Object.entries(grouped).map(([month, plans]) => <div className="stack" key={month}><span className="muted">{month}</span>{plans.map(plan => <div key={plan.serviceDate}><strong>{dateLabel(plan.serviceDate)}</strong><br /><span>{plan.title}</span><br /><span className="muted">{plan.series}{plan.series && plan.scripture ? " · " : ""}{plan.scripture}</span></div>)}</div>)}</section></div>;
}
