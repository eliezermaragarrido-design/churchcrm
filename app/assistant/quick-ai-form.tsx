"use client";

import { useEffect, useState } from "react";
import { strFromU8, unzipSync } from "fflate";
import * as tus from "tus-js-client";

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
  const [meetingId, setMeetingId] = useState("");
  useEffect(() => {
    if (kind !== "audio") return;
    try { setMeetingId(sessionStorage.getItem("meeting-minutes-pending") || ""); } catch { /* A browser without storage still finishes while this page stays open. */ }
  }, [kind]);
  useEffect(() => {
    if (kind !== "audio" || !meetingId) return;
    let active = true, timer: ReturnType<typeof setTimeout>;
    const schedule = (delay: number) => { if (active) timer = setTimeout(() => void continueMeeting(), delay); };
    const continueMeeting = async () => {
      try {
        const response = await fetch(`${endpoint}/${meetingId}/process`, { method: "POST" });
        const result = await response.json().catch(() => ({}));
        const job = result.data?.job;
        if (!active) return;
        if (job?.status === "generated") {
          setDownload(result.data.downloadUrl || `${endpoint}/${meetingId}/download`); setMessage("Meeting minutes ready."); setGeneratedOnce(true); setMeetingId("");
          try { sessionStorage.removeItem("meeting-minutes-pending"); } catch { /* Nothing else is needed. */ }
          return;
        }
        setMessage(job?.progress || "Continuing meeting preparation automatically.");
        schedule(Math.max(6000, Number(job?.retryAt || 0) - Date.now()));
      } catch {
        if (active) { setMessage("Continuing meeting preparation automatically."); schedule(12000); }
      }
    };
    void continueMeeting();
    return () => { active = false; clearTimeout(timer); };
  }, [endpoint, kind, meetingId]);
  async function uploadMeeting(file: File, formData: FormData) {
    const start = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: formData.get("title"), notesPrompt: formData.get("notesPrompt"), fileName: file.name, contentType: file.type, fileSize: file.size }) });
    const started = await start.json();
    if (!start.ok) throw new Error(started.error || "Could not prepare the audio upload.");
    const info = started.data as { id: string; token: string; bucketName: string; path: string; resumableUploadUrl: string };
    setMessage("Uploading meeting audio...");
    try { await new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(file, { endpoint: info.resumableUploadUrl, retryDelays: [0, 3000, 5000, 10000], headers: { authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", "x-upsert": "false", "x-signature": info.token }, uploadDataDuringCreation: false, removeFingerprintOnSuccess: true, chunkSize: 6 * 1024 * 1024, metadata: { bucketName: info.bucketName, objectName: info.path, contentType: file.type || "audio/mpeg", cacheControl: "3600" }, onProgress(uploaded, total) { setMessage(`Uploading meeting audio... ${Math.round(uploaded / total * 100)}%`); }, onError: reject, onSuccess() { resolve(); } });
      upload.findPreviousUploads().then(previous => { if (previous.length) upload.resumeFromPreviousUpload(previous[0]); upload.start(); }).catch(reject);
    }); } catch (error) { await fetch(`${endpoint}/${info.id}`, { method: "DELETE" }).catch(() => undefined); throw error; }
    setMessage("Transcribing audio and preparing minutes...");
    return info.id;
  }
  async function submit(formData: FormData) {
    setPending(true); setMessage(""); setDownload("");
    try {
      if (kind === "audio") {
        const file = formData.get("file");
        if (!(file instanceof File)) throw new Error("Choose a meeting audio file.");
        const id = await uploadMeeting(file, formData);
        try { sessionStorage.setItem("meeting-minutes-pending", id); } catch { /* The automatic loop on this page remains active. */ }
        setMeetingId(id); setMessage("Transcribing audio and preparing minutes..."); return;
      }
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
    <input type="hidden" name="notesPrompt" value={kind === "audio" ? "Prepare factual meeting minutes with a summary, key points, decisions, action items, owners, due dates and follow-up items." : "Make this a concise one-page bulletin insert for people to keep and take home. Include every numbered point and the conclusion."} />
    <label>{label}<input className="input" type="file" name="file" accept={accept} required /></label>
    <button className="button" type="submit" disabled={pending || !!meetingId}>{pending || meetingId ? "Preparing meeting minutes…" : generatedOnce ? kind === "sermon" ? "Generate new sermon notes" : "Generate new document" : "Generate"}</button>
    {message && <p role="status">{message}</p>}
    {download && <a className="button secondary" href={download}>Download document</a>}
  </form>;
}
