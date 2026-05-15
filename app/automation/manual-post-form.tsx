"use client";

import { useState } from "react";

type ManualAccount = {
  id: string;
  accountLabel: string;
  platformLabel: string;
};

export function ManualPostForm(props: {
  accounts: ManualAccount[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [publishMode, setPublishMode] = useState<"NOW" | "SCHEDULE">("NOW");

  return (
    <form className="form-grid simple-form" action={props.action}>
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
      </div>

      <div className="stack">
        <label>Publish mode</label>
        <select
          className="input"
          name="publishMode"
          value={publishMode}
          onChange={(event) => setPublishMode(event.target.value === "SCHEDULE" ? "SCHEDULE" : "NOW")}
        >
          <option value="NOW">Publish now</option>
          <option value="SCHEDULE">Schedule for later</option>
        </select>
        <div className="muted">
          {publishMode === "NOW"
            ? "This will try to publish immediately to the selected connected accounts."
            : "This will only schedule the post for the selected date and time."}
        </div>
      </div>

      <div className="stack">
        <label>Scheduled date and time</label>
        <input className="input" type="datetime-local" name="scheduledAt" disabled={publishMode !== "SCHEDULE"} />
        <div className="muted">This is only used when publish mode is set to scheduled.</div>
      </div>

      <div className="toolbar toolbar-start">
        <button className="button" type="submit">
          {publishMode === "NOW" ? "Publish now" : "Create scheduled post"}
        </button>
      </div>
    </form>
  );
}
