"use client";
import { useEffect, useState } from "react";
import * as tus from "tus-js-client";

const MAX_MANUAL_UPLOAD_BYTES = 4_000_000;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

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

type ManualUploadInfo = {
  signedUploadUrl?: string;
  resumableUploadUrl?: string;
  publicUrl?: string;
  token?: string;
  bucketName?: string;
  objectPath?: string;
};

type TikTokDirectUploadSession = {
  socialPostId: string;
  socialAccountId: string;
  accountLabel: string;
  uploadUrl: string;
  externalPostId: string | null;
  chunkSizes: number[];
};

function supportsPostType(platform: string, postType: ManualPostType) {
  if (postType === "SHORT_VIDEO") {
    return ["FACEBOOK_PAGE", "INSTAGRAM", "TIKTOK", "YOUTUBE"].includes(platform);
  }

  if (postType === "STORY") {
    return ["FACEBOOK_PAGE", "INSTAGRAM"].includes(platform);
  }

  return ["FACEBOOK_PAGE", "INSTAGRAM"].includes(platform);
}

function shouldUseDirectTikTokLocalUpload(input: {
  postType: ManualPostType;
  selectedAccountIds: string[];
  accounts: ManualAccount[];
}) {
  if (input.postType !== "SHORT_VIDEO" || !input.selectedAccountIds.length) {
    return false;
  }

  const selectedPlatforms = input.accounts
    .filter((account) => input.selectedAccountIds.includes(account.id))
    .map((account) => account.platform);

  return selectedPlatforms.length > 0 && selectedPlatforms.every((platform) => platform === "TIKTOK");
}

function getSelectedPlatformAccountIds(input: {
  selectedAccountIds: string[];
  accounts: ManualAccount[];
  platform: string;
}) {
  return input.accounts
    .filter((account) => input.selectedAccountIds.includes(account.id) && account.platform === input.platform)
    .map((account) => account.id);
}

async function uploadFileToSupabaseResumable(input: {
  file: File;
  uploadInfo: ManualUploadInfo;
}) {
  if (!input.uploadInfo.resumableUploadUrl || !input.uploadInfo.token || !input.uploadInfo.bucketName || !input.uploadInfo.objectPath) {
    throw new Error("Supabase resumable upload preparation returned incomplete data.");
  }

  const { resumableUploadUrl, token, bucketName, objectPath } = input.uploadInfo;

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(input.file, {
      endpoint: resumableUploadUrl,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        "x-upsert": "false",
        "x-signature": token,
      },
      uploadDataDuringCreation: false,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName,
        objectName: objectPath,
        contentType: input.file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      onError(error) {
        reject(error);
      },
      onSuccess() {
        resolve();
      },
    });

    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }

      upload.start();
    }).catch(reject);
  });
}

function buildTikTokChunkPlan(totalBytes: number) {
  const minChunkSize = 5 * 1024 * 1024;
  const maxChunkSize = 64 * 1024 * 1024;
  const defaultChunkSize = 10 * 1024 * 1024;

  if (totalBytes <= 0) {
    throw new Error("TikTok upload received an empty media file.");
  }

  if (totalBytes <= maxChunkSize) {
    return [totalBytes];
  }

  const chunkSizes: number[] = [];
  let remaining = totalBytes;

  while (remaining > 0) {
    if (remaining <= maxChunkSize) {
      if (remaining < minChunkSize && chunkSizes.length > 0) {
        chunkSizes[chunkSizes.length - 1] += remaining;
      } else {
        chunkSizes.push(remaining);
      }
      break;
    }

    const nextChunkSize = Math.min(defaultChunkSize, remaining);
    chunkSizes.push(nextChunkSize);
    remaining -= nextChunkSize;
  }

  return chunkSizes;
}

async function uploadFileDirectlyToTikTok(input: {
  file: File;
  uploadUrl: string;
  chunkSizes?: number[];
}) {
  const chunkSizes = input.chunkSizes?.length ? input.chunkSizes : buildTikTokChunkPlan(input.file.size);
  let offset = 0;

  for (const chunkSize of chunkSizes) {
    const end = offset + chunkSize;
    const chunk = input.file.slice(offset, end);
    const response = await fetch(input.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": input.file.type || "video/mp4",
        "Content-Range": `bytes ${offset}-${end - 1}/${input.file.size}`,
      },
      body: chunk,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(errorText || `TikTok direct upload failed with status ${response.status}.`);
    }

    offset = end;
  }
}

async function markTikTokDirectUploadResult(input: {
  socialPostId: string;
  success: boolean;
  externalPostId?: string | null;
  errorMessage?: string;
}) {
  await fetch("/api/automation/manual-post/tiktok-direct-complete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
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
      const submitMode = submitter?.value || String(formData.get("submitMode") || "NOW").trim();
      const selectedTikTokAccountIds = getSelectedPlatformAccountIds({
        selectedAccountIds,
        accounts: props.accounts,
        platform: "TIKTOK",
      });
      const selectedNonTikTokAccountIds = selectedAccountIds.filter((accountId) => !selectedTikTokAccountIds.includes(accountId));

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
        const shouldBypassSupabaseForTikTokLocal =
          shouldUseDirectTikTokLocalUpload({
            postType: postType as ManualPostType,
            selectedAccountIds,
            accounts: props.accounts,
          }) &&
          selectedFile.type.startsWith("video/");

        const shouldUseSupabaseUpload =
          !shouldBypassSupabaseForTikTokLocal &&
          (postType === "SHORT_VIDEO" || selectedFile.type.startsWith("video/") || selectedFile.size > MAX_MANUAL_UPLOAD_BYTES);

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

          const uploadInfo = (await uploadInfoResponse.json()) as ManualUploadInfo;

          if (!uploadInfo.publicUrl) {
            throw new Error("Supabase upload preparation returned incomplete data.");
          }

          const shouldUseResumableUpload =
            postType === "SHORT_VIDEO" || selectedFile.type.startsWith("video/") || selectedFile.size > 6 * 1024 * 1024;

          if (shouldUseResumableUpload) {
            await uploadFileToSupabaseResumable({
              file: selectedFile,
              uploadInfo,
            });
          } else {
            if (!uploadInfo.signedUploadUrl) {
              throw new Error("Supabase direct upload preparation returned incomplete data.");
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
          }

          formData.delete("mediaFile");
          formData.set("uploadedAssetUrl", uploadInfo.publicUrl);
          formData.set("uploadedAssetTitle", selectedFile.name || "Manual upload");
        } else {
          formData.set("uploadedAssetTitle", selectedFile.name || "Manual upload");
        }
      }

      if (
        selectedFile instanceof File &&
        selectedFile.size &&
        postType === "SHORT_VIDEO" &&
        submitMode === "NOW" &&
        selectedFile.type.startsWith("video/") &&
        selectedTikTokAccountIds.length
      ) {
        const initResponse = await fetch("/api/automation/manual-post/tiktok-direct-init", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accountIds: selectedTikTokAccountIds,
            caption: String(formData.get("caption") || "").trim(),
            fileSize: selectedFile.size,
            fileType: selectedFile.type,
          }),
        });

        const initData = (await initResponse.json().catch(() => ({}))) as {
          error?: string;
          sessions?: TikTokDirectUploadSession[];
        };

        if (!initResponse.ok || !initData.sessions?.length) {
          throw new Error(initData.error || `TikTok direct upload setup failed with status ${initResponse.status}.`);
        }

        let posted = 0;
        let failed = 0;
        let firstError = "";

        for (const session of initData.sessions) {
          try {
            await uploadFileDirectlyToTikTok({
              file: selectedFile,
              uploadUrl: session.uploadUrl,
              chunkSizes: session.chunkSizes,
            });

            await markTikTokDirectUploadResult({
              socialPostId: session.socialPostId,
              success: true,
              externalPostId: session.externalPostId,
            });
            posted += 1;
          } catch (error) {
            const message = error instanceof Error ? error.message : "TikTok direct upload failed.";
            await markTikTokDirectUploadResult({
              socialPostId: session.socialPostId,
              success: false,
              errorMessage: message,
            });
            failed += 1;

            if (!firstError) {
              firstError = message;
            }
          }
        }

        if (selectedNonTikTokAccountIds.length) {
          const queuedFormData = new FormData();

          for (const [key, value] of formData.entries()) {
            if (key === "accountIds" || key === "mediaFile") {
              continue;
            }

            queuedFormData.append(key, value);
          }

          for (const accountId of selectedNonTikTokAccountIds) {
            queuedFormData.append("accountIds", accountId);
          }

          const queuedResponse = await fetch("/api/automation/manual-post", {
            method: "POST",
            body: queuedFormData,
            redirect: "follow",
          });

          if (!queuedResponse.ok) {
            throw new Error(`Manual post request failed with status ${queuedResponse.status}.`);
          }

          const queuedUrl = new URL(queuedResponse.url || "/automation", window.location.origin);
          posted += Number(queuedUrl.searchParams.get("posted") || 0);
          failed += Number(queuedUrl.searchParams.get("failed") || 0);
        }

        const redirectUrl = new URL("/automation", window.location.origin);
        redirectUrl.searchParams.set("manual", "published");
        redirectUrl.searchParams.set("posted", String(posted));
        redirectUrl.searchParams.set("failed", String(failed));
        if (firstError) {
          redirectUrl.searchParams.set("tiktok", firstError);
        }
        window.location.href = redirectUrl.toString();
        return;
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
          disabled={postType === "SHORT_VIDEO" && Boolean(selectedReelUrl)}
          onChange={(event) => {
            setSubmitError(null);

            if (postType === "SHORT_VIDEO" && event.currentTarget.files?.length) {
              setSelectedReelUrl("");
            }
          }}
        />
        <div className="muted">Images are stored in the daily image bucket. Short videos are stored in the reels bucket.</div>
        {postType === "SHORT_VIDEO" ? (
          getSelectedPlatformAccountIds({
            selectedAccountIds,
            accounts: props.accounts,
            platform: "TIKTOK",
          }).length ? (
            <div className="muted">
              TikTok short videos publish straight to TikTok from your browser. If Facebook, Instagram, or YouTube are also selected, the CRM still prepares their own publishing path separately.
            </div>
          ) : (
            <div className="muted">
              If you choose a video from your PC, the CRM will upload it into the Supabase <strong>REELS</strong> bucket first and then
              publish from there. That keeps TikTok, YouTube, and the daily automation flow using the same storage path.
            </div>
          )
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
            <div className="muted">Using a Supabase reel now. The local file input is turned off so the form does not try to use both sources at the same time.</div>
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
