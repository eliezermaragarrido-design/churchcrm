"use client";

import { useState } from "react";

const MAX_MANUAL_UPLOAD_BYTES = 4_000_000;

type ManualAccount = {
  id: string;
  accountLabel: string;
  platformLabel: string;
};

export function ManualPostClientForm(props: {
  accounts: ManualAccount[];
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      const selectedFile = formData.get("mediaFile");

      if (submitter?.value) {
        formData.set("submitMode", submitter.value);
      }

      if (selectedFile instanceof File && selectedFile.size > MAX_MANUAL_UPLOAD_BYTES) {
        throw new Error(
          "This upload is too large for the current Vercel function path. Keep manual uploads under about 4 MB, or use the scheduled Supabase asset flow for larger videos.",
        );
      }

      const response = await fetch("/api/automation/manual-post", {
        method: "POST",
        body: formData,
        redirect: "follow",
      });

      if (!response.ok) {
        throw new Error(`Manual post request failed with status ${response.status}.`);
      }

      window.location.href = response.url || "/automation";
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Manual post request failed.");
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form-grid simple-form" onSubmit={handleSubmit}>
      <div className="stack">
        <p className="muted">Pick one or more destinations for this post.</p>
        {props.accounts.length ? (
          props.accounts.map((account) => (
            <label key={`manual-${account.id}`} className="calendar-event">
              <input type="checkbox" name="accountIds" value={account.id} defaultChecked />
              {" "}
              <strong>{account.accountLabel}</strong>
              <div className="muted">{account.platformLabel}</div>
            </label>
          ))
        ) : (
          <div className="calendar-event">Add an account first.</div>
        )}
      </div>

      <div className="stack">
        <label>Type</label>
        <select className="input" name="postType" defaultValue="FEED_POST">
          <option value="FEED_POST">Feed post</option>
          <option value="STORY">Story</option>
          <option value="SHORT_VIDEO">Reel / short video</option>
        </select>
      </div>

      <div className="stack">
        <label>Caption</label>
        <textarea
          className="input"
          name="caption"
          rows={5}
          placeholder="Write the post copy. You can also upload media and leave this blank if needed."
        />
      </div>

      <div className="stack">
        <label>Media file</label>
        <input className="input" name="mediaFile" type="file" accept="image/*,video/*" />
        <div className="muted">Images are stored in the daily image bucket. Short videos are stored in the reels bucket.</div>
        <div className="muted">Manual uploads must stay under about 4 MB on Vercel. Larger videos need the Supabase asset flow instead of direct browser-to-function upload.</div>
      </div>

      <div className="stack">
        <label>Scheduled date and time</label>
        <input className="input" type="datetime-local" name="scheduledAt" />
        <div className="muted">Use this only when you want to create a scheduled post.</div>
      </div>

      {submitError ? <div className="calendar-event">{submitError}</div> : null}

      <div className="toolbar toolbar-start wrap-toolbar">
        <button className="button" type="submit" name="submitMode" value="NOW" disabled={isSubmitting}>
          {isSubmitting ? "Working..." : "Publish now"}
        </button>
        <button className="button secondary" type="submit" name="submitMode" value="SCHEDULE" disabled={isSubmitting}>
          {isSubmitting ? "Working..." : "Create scheduled post"}
        </button>
      </div>
    </form>
  );
}
