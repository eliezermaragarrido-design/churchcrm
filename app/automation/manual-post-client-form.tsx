"use client";
import { useEffect, useState } from "react";

const MAX_MANUAL_UPLOAD_BYTES = 4_000_000;

type ManualAccount = {
  id: string;
  accountLabel: string;
  platformLabel: string;
  platform: string;
};

type ReelLibraryOption = {
  title: string;
  url: string;
};

type ManualPostType = "FEED_POST" | "STORY" | "SHORT_VIDEO";

function supportsPostType(platform: string, postType: ManualPostType) {
  if (postType === "SHORT_VIDEO") {
    return ["FACEBOOK_PAGE", "INSTAGRAM", "TIKTOK", "YOUTUBE"].includes(platform);
  }

  if (postType === "STORY") {
    return ["FACEBOOK_PAGE", "INSTAGRAM"].includes(platform);
  }

  return ["FACEBOOK_PAGE", "INSTAGRAM"].includes(platform);
}

export function ManualPostClientForm(props: {
  accounts: ManualAccount[];
  reelLibraryOptions: ReelLibraryOption[];
}) {
  const [postType, setPostType] = useState<ManualPostType>("FEED_POST");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(() => props.accounts.map((account) => account.id));
  const [selectedReelUrl, setSelectedReelUrl] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const allowedAccountIds = props.accounts
      .filter((account) => supportsPostType(account.platform, postType))
      .map((account) => account.id);

    setSelectedAccountIds((current) => current.filter((accountId) => allowedAccountIds.includes(accountId)));
  }, [postType, props.accounts]);

  useEffect(() => {
    setSubmitError(null);

    if (postType !== "SHORT_VIDEO" && selectedReelUrl) {
      setSelectedReelUrl("");
    }
  }, [postType, selectedReelUrl]);

  function toggleAccount(accountId: string, checked: boolean) {
    setSelectedAccountIds((current) => {
      if (checked) {
        return current.includes(accountId) ? current : [...current, accountId];
      }

      return current.filter((id) => id !== accountId);
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      const selectedFile = formData.get("mediaFile");
      const postType = String(formData.get("postType") || "FEED_POST").trim();

      if (submitter?.value) {
        formData.set("submitMode", submitter.value);
      }

      if (postType === "SHORT_VIDEO" && selectedReelUrl) {
        formData.delete("mediaFile");
        const selectedReel = props.reelLibraryOptions.find((option) => option.url === selectedReelUrl);

        if (selectedReel) {
          formData.set("uploadedAssetUrl", selectedReel.url);
          formData.set("uploadedAssetTitle", selectedReel.title);
        }
      }

      if (selectedFile instanceof File && selectedFile.size) {
        const shouldUseSupabaseUpload =
          postType === "SHORT_VIDEO" || selectedFile.type.startsWith("video/") || selectedFile.size > MAX_MANUAL_UPLOAD_BYTES;

        if (shouldUseSupabaseUpload) {
          const uploadInfoResponse = await fetch("/api/automation/manual-upload-url", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              postType,
              fileName: selectedFile.name,
              contentType: selectedFile.type,
            }),
          });

          if (!uploadInfoResponse.ok) {
            throw new Error("Could not prepare a direct Supabase upload for this media file.");
          }

          const uploadInfo = (await uploadInfoResponse.json()) as {
            signedUploadUrl?: string;
            publicUrl?: string;
          };

          if (!uploadInfo.signedUploadUrl || !uploadInfo.publicUrl) {
            throw new Error("Supabase upload preparation returned incomplete data.");
          }

          const uploadResult = await fetch(uploadInfo.signedUploadUrl, {
            method: "PUT",
            headers: selectedFile.type
              ? {
                  "Content-Type": selectedFile.type,
                }
              : undefined,
            body: selectedFile,
          });

          if (!uploadResult.ok) {
            const errorText = await uploadResult.text();
            throw new Error(errorText || `Supabase direct upload failed with status ${uploadResult.status}.`);
          }

          formData.delete("mediaFile");
          formData.set("uploadedAssetUrl", uploadInfo.publicUrl);
          formData.set("uploadedAssetTitle", selectedFile.name || "Manual upload");
        } else {
          formData.set("uploadedAssetTitle", selectedFile.name || "Manual upload");
        }
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
              <input
                type="checkbox"
                name="accountIds"
                value={account.id}
                checked={selectedAccountIds.includes(account.id)}
                disabled={!supportsPostType(account.platform, postType)}
                onChange={(event) => toggleAccount(account.id, event.target.checked)}
              />
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
        <select
          className="input"
          name="postType"
          value={postType}
          onChange={(event) => setPostType(event.target.value as ManualPostType)}
        >
          <option value="FEED_POST">Feed post</option>
          <option value="STORY">Story</option>
          <option value="SHORT_VIDEO">Reel / short video</option>
        </select>
        <div className="muted">
          Feed posts and stories stay on Facebook/Instagram. TikTok and YouTube are reserved for short-video publishing in this CRM.
        </div>
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
        <input
          key={fileInputKey}
          className="input"
          name="mediaFile"
          type="file"
          accept="image/*,video/*"
          disabled={postType === "SHORT_VIDEO"}
          onChange={() => setSubmitError(null)}
        />
        <div className="muted">Images are stored in the daily image bucket. Short videos are stored in the reels bucket.</div>
        {postType === "SHORT_VIDEO" ? (
          <div className="muted">
            Local video uploads are turned off in this form. For reels and TikTok/YouTube tests, first upload the video into the
            Supabase <strong>REELS</strong> bucket, then choose it below. This keeps manual posting aligned with the daily automation
            flow and avoids request-size failures.
          </div>
        ) : (
          <>
            <div className="muted">Images can still post directly when they stay under about 4 MB on Vercel.</div>
            <div className="muted">Short videos use the REELS bucket workflow instead of direct browser upload.</div>
          </>
        )}
      </div>

      {postType === "SHORT_VIDEO" ? (
        <div className="stack">
          <label>Or use a reel already in Supabase</label>
          <select
            className="input"
            value={selectedReelUrl}
            onChange={(event) => {
              setSelectedReelUrl(event.target.value);
              setSubmitError(null);

              if (event.target.value) {
                setFileInputKey((current) => current + 1);
              }
            }}
          >
            <option value="">Choose an existing reel from the REELS bucket</option>
            {props.reelLibraryOptions.map((option) => (
              <option key={option.url} value={option.url}>
                {option.title}
              </option>
            ))}
          </select>
          <div className="muted">Use this when you want to test TikTok or YouTube with a reel that is already stored in Supabase.</div>
          {selectedReelUrl ? (
            <div className="muted">Using a Supabase reel now. This is the same storage path the daily autopost plan uses.</div>
          ) : null}
        </div>
      ) : null}

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
