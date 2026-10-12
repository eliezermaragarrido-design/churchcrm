"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
const MonthContext = createContext("");
export const usePreparationMonth = () => useContext(MonthContext);
export function PreparationMonth({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(""), [months, setMonths] = useState<string[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/sermon-plans/months", { cache: "no-store", signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error("Could not load calendar months. Refresh this page.");
        const result = await response.json();
        if (active) { setMonths(result.data.months); setMonth(result.data.preferredMonth); setError(""); }
      } catch (e) { if (active) setError((e as Error).message); }
    }
    void load(); window.addEventListener("sermon-calendar-imported", load);
    return () => { active = false; window.removeEventListener("sermon-calendar-imported", load); };
  }, []);
  return <MonthContext.Provider value={month}>
    <div className="panel stack"><label>Preparation month<select className="input" value={month} onChange={event => setMonth(event.target.value)}>
      {!month && <option value="">Loading months...</option>}
      {months.map(value => <option key={value} value={value}>{new Date(value + "-01T12:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</option>)}
    </select></label><p className="muted">Choose any imported month to prepare its sermons and worship outlines in advance.</p>{error && <p role="alert">{error}</p>}</div>
    {children}
  </MonthContext.Provider>;
}
