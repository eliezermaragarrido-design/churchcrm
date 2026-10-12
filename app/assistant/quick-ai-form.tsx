"use client";

import { useState } from "react";
import { strFromU8, unzipSync } from "fflate";

function sermonNotesServiceDate(fileName: string) {
  const baseName = fileName.replace(/\.(ppt|pptx)$/i, "");
  const written = baseName.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{4})\b/i);
  if (written) {
    const date = new Date(Date.UTC(Number(written[3]), new Date(`${written[1]} 1, 2000`).getMonth(), Number(written[2])));
    return date.toISOString().slice(0, 10);
  }
  const iso = baseName.match(/\b(\d{4})[ .\/-](\d{1,2})[ .\/-](\d{1,2})\b/);
  return iso ? `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}` : "";
}

function sermonNotesTitle(fileName: string) {
  const baseName = fileName.replace(/\.(ppt|pptx)$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const monthDate = baseName.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{4})\b/i);
  if (monthDate) {
    const month = monthDate[1][0].toUpperCase() + monthDate[1].slice(1).toLowerCase();
    return `Sermon Notes ${month} ${Number(monthDate[2])} ${monthDate[3]}`;
  }

  const isoDate = baseName.match(/\b(\d{4})[ .\/-](\d{1,2})[ .\/-](\d{1,2})\b/);
  if (isoDate) {
    const date = new Date(Date.UTC(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3])));
    if (!Number.isNaN(date.getTime())) return `Sermon Notes ${date.toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" }).replace(",", "")}`;
  }

  return "Sermon Notes";
}

export function QuickAiForm({ kind, accept, label, endpoint }: { kind: "audio" | "sermon"; accept: string; label: string; endpoint: string }) {
  const [message, setMessage] = useState("");
  const [download, setDownload] = useState("");
  const [pending, setPending] = useState(false);
  const [generatedOnce, setGeneratedOnce] = useState(false);
  async function submit(formData: FormData) {
    setPending(true); setMessage(""); setDownload("");
    try {
      if (kind === "sermon") {
        const file = formData.get("file");
        if (file instanceof File) {
          formData.set("title", sermonNotesTitle(file.name));
          const serviceDate = sermonNotesServiceDate(file.name);
          if (serviceDate) formData.set("serviceDate", serviceDate);
          const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
          const slideNumber = (name: string) => Number(name.match(/slide(\d+)\.xml$/i)?.[1] || 0);
          const text = Object.entries(archive)
            .filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
            .sort(([a], [b]) => slideNumber(a) - slideNumber(b))
            .map(([name, bytes]) => `\n${name}\n${strFromU8(bytes).replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ")}`)
            .join("\n");
          if (!text.trim()) throw new Error("No slide text found in this PowerPoint.");
          formData.delete("file"); formData.append("slidesText", text.slice(0, 180000));
        }
      }
      const response = await fetch(endpoint, { method: "POST", body: formData });
      const result = await response.json().catch(() => ({}));
      setMessage(response.ok ? "Document ready." : result.error || result.message || response.statusText || "The file could not be processed.");
      if (response.ok && result.data?.id) { setDownload(`/api/assistant/documents/${result.data.id}/download`); setGeneratedOnce(true); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "The file could not be processed."); }
    finally { setPending(false); }
  }
  return <form onSubmit={(event) => { event.preventDefault(); void submit(new FormData(event.currentTarget)); }} className="stack">
    <input type="hidden" name="title" value={kind === "audio" ? "Council meeting minutes" : "Sermon notes"} />
    <input type="hidden" name="notesPrompt" value={kind === "audio" ? "Return polished minutes ready to share with the council." : "Make this a concise one-page bulletin insert for people to keep and take home. Include every numbered point and the conclusion."} />
    <label>{label}<input className="input" type="file" name="file" accept={accept} required /></label>
    <button className="button" type="submit" disabled={pending}>{pending ? "Generating…" : generatedOnce ? kind === "sermon" ? "Generate new sermon notes" : "Generate new document" : "Generate"}</button>
    {message && <p role="status">{message}</p>}
    {download && <a className="button secondary" href={download}>Download document</a>}
  </form>;
}
