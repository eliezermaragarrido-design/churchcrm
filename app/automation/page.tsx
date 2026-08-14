import Link from "next/link";
import { cookies } from "next/headers";
import { listMatchingBucketFiles } from "@/lib/automation/buckets";
import { prisma } from "@/lib/db/prisma";
import { requireAuthContext } from "@/lib/auth";
import { env } from "@/lib/env";
import { getTikTokScopeString, isTikTokConfigured } from "@/lib/social/tiktok";
import { isYouTubeConfigured } from "@/lib/social/youtube";
import { AppShell } from "@/components/layout/app-shell";
import { SectionCard } from "@/components/layout/section-card";
import { getPendingMetaPageSelections, isMetaConfigured, type PendingMetaPageSelection } from "@/lib/meta";
import {
  cancelMetaSelectionAction,
  deleteSocialAccountAction,
  pauseYearImagesAction,
  pauseYearReelsAction,
  publishDueSocialPostsAction,
  saveMetaSelectionAction,
  scheduleYearImagesAction,
  scheduleYearReelsAction,
} from "./actions";
import { AutoPostPlanForm } from "./autopost-plan-form";
import { ManualPostClientForm } from "./manual-post-client-form";

const META_PENDING_COOKIE = "meta_pending_pages";

function maskSecret(value: string | undefined) {
  if (!value) {
    return "missing";
  }

  if (value.length <= 6) {
    return `${value.slice(0, 2)}***`;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function getPlatformLabel(platform: string) {
  if (platform === "FACEBOOK_PAGE") {
    return "Facebook Page";
  }

  if (platform === "INSTAGRAM") {
    return "Instagram";
  }

  if (platform === "TIKTOK") {
    return "TikTok";
  }

  if (platform === "YOUTUBE") {
    return "YouTube";
  }

  return platform.replaceAll("_", " ");
}

function getPostTypeLabel(postType: string) {
  if (postType === "FEED_POST") {
    return "Feed";
  }

  if (postType === "STORY") {
    return "Story";
  }

  if (postType === "SHORT_VIDEO") {
    return "Reel";
  }

  return postType.replaceAll("_", " ");
}

function isGeneratedAutomationLabel(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return (
    /^daily (image|reel)\s+\d{1,3}$/.test(normalized) ||
    /^day \d{1,3} (image|reel) post$/.test(normalized)
  );
}

function getQueuePreview(post: {
  title: string | null;
  caption: string | null;
  asset: { title: string | null } | null;
}) {
  const caption = String(post.caption || "").trim();
  const title = String(post.title || "").trim();
  const assetTitle = String(post.asset?.title || "").trim();

  return (
    (!isGeneratedAutomationLabel(caption) ? caption : "") ||
    (!isGeneratedAutomationLabel(title) ? title : "") ||
    (!isGeneratedAutomationLabel(assetTitle) ? assetTitle : "") ||
    "🙏🙌"
  );
}

function formatAutomationDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function getQueueDisplayText(post: {
  title: string | null;
  caption: string | null;
  asset: { title: string | null } | null;
}) {
  const preview = getQueuePreview(post);

  if (preview.includes("ðŸ")) {
    return "\u{1F64F}\u{1F3FC}\u{1F64C}\u{1F3FD}";
  }

  return preview;
}

function getManualStatusMessage(status: string | null, posted: string | null, failed: string | null) {
  if (!status) {
    return null;
  }

  if (status === "published") {
    return `Publish attempted now. Posted: ${posted || "0"}. Failed: ${failed || "0"}.`;
  }

  if (status === "scheduled") {
    return "Scheduled post created successfully.";
  }

  if (status === "missing-accounts") {
    return "Select at least one connected account.";
  }

  if (status === "missing-content") {
    return "Add a caption or upload a media file before submitting.";
  }

  return `Manual post error: ${status}`;
}

function getManualStatusFeedback(status: string | null, posted: string | null, failed: string | null) {
  if (status !== "published") {
    return null;
  }

  const postedCount = Number(posted || 0);
  const failedCount = Number(failed || 0);

  if (postedCount > 0 && failedCount === 0) {
    return {
      tone: "success" as const,
      message: `Subido correctamente. ${postedCount} publicacion${postedCount === 1 ? "" : "es"} confirmada${postedCount === 1 ? "" : "s"} sin errores.`,
    };
  }

  if (postedCount > 0 && failedCount > 0) {
    return {
      tone: "warning" as const,
      message: `Publicacion parcial. ${postedCount} publicadas y ${failedCount} con error.`,
    };
  }

  if (failedCount > 0) {
    return {
      tone: "error" as const,
      message: `La publicacion no se completo. ${failedCount} intento${failedCount === 1 ? "" : "s"} fallaron.`,
    };
  }

  return null;
}

function getAutoplanStatusMessage(status: string | null) {
  if (status === "images-queued") {
    return "The daily image plan was queued successfully.";
  }

  if (status === "reels-queued") {
    return "The daily reel plan was queued successfully.";
  }

  if (status === "images-paused") {
    return "The daily image plan was paused successfully.";
  }

  if (status === "reels-paused") {
    return "The daily reel plan was paused successfully.";
  }

  return null;
}

async function getVisibleSocialAccounts(churchId: string) {
  return prisma.socialAccount.findMany({
    where: { churchId },
    orderBy: [{ platform: "asc" }, { accountLabel: "asc" }],
  });
}

export default async function AutomationPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requireAuthContext();
  const cookieStore = await cookies();
  const resolvedSearchParams = props.searchParams ? await props.searchParams : {};
  const metaStatus = typeof resolvedSearchParams.meta === "string" ? resolvedSearchParams.meta : null;
  const tiktokStatus = typeof resolvedSearchParams.tiktok === "string" ? resolvedSearchParams.tiktok : null;
  const youtubeStatus = typeof resolvedSearchParams.youtube === "string" ? resolvedSearchParams.youtube : null;
  const manualStatus = typeof resolvedSearchParams.manual === "string" ? resolvedSearchParams.manual : null;
  const manualPosted = typeof resolvedSearchParams.posted === "string" ? resolvedSearchParams.posted : null;
  const manualFailed = typeof resolvedSearchParams.failed === "string" ? resolvedSearchParams.failed : null;
  const autoplanStatus = typeof resolvedSearchParams.autoplan === "string" ? resolvedSearchParams.autoplan : null;

  const rawPendingSelection = cookieStore.get(META_PENDING_COOKIE)?.value;
  let pendingSelections: PendingMetaPageSelection[] = [];
  let pendingProvider: "facebook" | "instagram" = "facebook";

  if (rawPendingSelection) {
    try {
      const parsed = JSON.parse(rawPendingSelection) as {
        provider?: "facebook" | "instagram";
        userAccessToken?: string;
      };
      pendingProvider = parsed.provider === "instagram" ? "instagram" : "facebook";
      const userAccessToken = String(parsed.userAccessToken || "").trim();
      pendingSelections = userAccessToken ? await getPendingMetaPageSelections(userAccessToken) : [];
    } catch {
      pendingSelections = [];
    }
  }

  const socialAccounts = await getVisibleSocialAccounts(auth.churchId);
  const [dbImageAssetCount, dbReelAssetCount, socialPostStats] = await Promise.all([
    prisma.contentAsset.count({
      where: {
        churchId: auth.churchId,
        assetType: "DAILY_IMAGE",
      },
    }),
    prisma.contentAsset.count({
      where: {
        churchId: auth.churchId,
        assetType: "DEVOTIONAL_VIDEO",
      },
    }),
    prisma.socialPost.groupBy({
      by: ["status"],
      where: {
        churchId: auth.churchId,
      },
      _count: {
        _all: true,
      },
    }),
  ]);

  let imageAssetCount = dbImageAssetCount;
  let reelAssetCount = dbReelAssetCount;
  let reelLibraryOptions: { title: string; url: string }[] = [];

  try {
    const [imageBucketFiles, reelBucketFiles] = await Promise.all([
      listMatchingBucketFiles("IMAGES", /^\d{1,3}\.(jpg|jpeg|png|webp)$/i),
      listMatchingBucketFiles("REELS", /^\d{1,3}\.mp4$/i),
    ]);

    imageAssetCount = imageBucketFiles.length;
    reelAssetCount = reelBucketFiles.length;
    reelLibraryOptions = reelBucketFiles.map((fileName) => ({
      title: fileName,
      url: `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/REELS/${fileName}`,
    }));
  } catch {
    imageAssetCount = dbImageAssetCount;
    reelAssetCount = dbReelAssetCount;
    reelLibraryOptions = [];
  }

  const statsByStatus = {
    ready: socialPostStats.find((item) => item.status === "READY")?._count._all ?? 0,
    scheduled: socialPostStats.find((item) => item.status === "SCHEDULED")?._count._all ?? 0,
    posted: socialPostStats.find((item) => item.status === "POSTED")?._count._all ?? 0,
    failed: socialPostStats.find((item) => item.status === "FAILED")?._count._all ?? 0,
  };

  const failedPosts = await prisma.socialPost.findMany({
    where: {
      churchId: auth.churchId,
      status: "FAILED",
    },
    include: {
      socialAccount: true,
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 5,
  });
  const queuedPosts = await prisma.socialPost.findMany({
    where: {
      churchId: auth.churchId,
      status: { in: ["READY", "SCHEDULED"] },
    },
    include: {
      asset: true,
      socialAccount: true,
    },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }],
    take: 10,
  });

  const visiblePendingSelections =
    pendingProvider === "instagram"
      ? pendingSelections.filter((page) => page.instagram)
      : pendingSelections;
  const tiktokScopeString = getTikTokScopeString();
  const manualStatusMessage = getManualStatusMessage(manualStatus, manualPosted, manualFailed);
  const manualStatusFeedback = getManualStatusFeedback(manualStatus, manualPosted, manualFailed);
  const autoplanStatusMessage = getAutoplanStatusMessage(autoplanStatus);

  return (
    <AppShell
      title="Automation"
      subtitle="Connect channels, queue daily plans, and publish one-off posts with media."
      currentPath="/automation"
      actions={
        <form action={publishDueSocialPostsAction}>
          <button className="button" type="submit">
            Run publisher now
          </button>
        </form>
      }
    >
      <section>
        <SectionCard title="Automation status">
          <div className="list compact-list">
            <div className="list-item"><span>Daily images synced</span><strong>{imageAssetCount}</strong></div>
            <div className="list-item"><span>Daily reels synced</span><strong>{reelAssetCount}</strong></div>
            <div className="list-item"><span>Posts ready now</span><strong>{statsByStatus.ready}</strong></div>
            <div className="list-item"><span>Posts scheduled</span><strong>{statsByStatus.scheduled}</strong></div>
            <div className="list-item"><span>Posts already published</span><strong>{statsByStatus.posted}</strong></div>
            <div className="list-item"><span>Posts failed</span><strong>{statsByStatus.failed}</strong></div>
          </div>
        </SectionCard>
      </section>

      {metaStatus || tiktokStatus || youtubeStatus || manualStatusMessage ? (
        <section>
          <SectionCard title="Connection status">
            <div className="list compact-list">
              {metaStatus ? <div className="list-item"><span>Meta</span><strong>{metaStatus}</strong></div> : null}
              {tiktokStatus ? <div className="list-item"><span>TikTok</span><strong>{tiktokStatus}</strong></div> : null}
              {youtubeStatus ? <div className="list-item"><span>YouTube</span><strong>{youtubeStatus}</strong></div> : null}
              {manualStatusMessage ? <div className="list-item"><span>Manual post</span><strong>{manualStatusMessage}</strong></div> : null}
            </div>
          </SectionCard>
        </section>
      ) : null}

      {visiblePendingSelections.length ? (
        <section>
          <SectionCard title={pendingProvider === "instagram" ? "Choose Instagram accounts" : "Choose Facebook pages"}>
            <form className="form-grid simple-form">
              <div className="stack">
                {visiblePendingSelections.map((page) => (
                  <label key={page.id} className="calendar-event">
                    <input type="checkbox" name="selectedPageIds" value={page.id} defaultChecked />
                    {" "}
                    <strong>{pendingProvider === "instagram" ? page.instagram?.label || page.name : page.name}</strong>
                    <div className="muted">{pendingProvider === "instagram" ? "Instagram" : "Facebook Page"}</div>
                  </label>
                ))}
              </div>

              <div className="toolbar toolbar-start">
                <button className="button" formAction={saveMetaSelectionAction} type="submit">
                  Save selected {pendingProvider === "instagram" ? "accounts" : "pages"}
                </button>
                <button className="button secondary" formAction={cancelMetaSelectionAction} type="submit">
                  Cancel
                </button>
              </div>
            </form>
          </SectionCard>
        </section>
      ) : null}

      <section className="two-column narrow-right">
        <SectionCard title="Accounts">
          <div className="list compact-list">
            {socialAccounts.length ? (
              socialAccounts.map((account) => (
                <div key={account.id} className="list-item">
                  <div>
                    <strong>{account.accountLabel}</strong>
                    <div className="muted">{getPlatformLabel(account.platform)}</div>
                  </div>
                  <form action={deleteSocialAccountAction}>
                    <input type="hidden" name="socialAccountId" value={account.id} />
                    <button className="button secondary danger-button" type="submit">
                      Remove
                    </button>
                  </form>
                </div>
              ))
            ) : (
              <div className="list-item">
                <span>No accounts connected yet.</span>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Connect">
          <div className="stack">
            <p className="muted">Connect each destination once, then the scheduler can publish directly from Supabase assets.</p>
            <div className="calendar-event">
              <strong>Meta testing note</strong>
              <div className="muted">
                One Meta app can import many Facebook pages and Instagram accounts. While the app is still in development mode,
                each Facebook user who connects must be added to the Meta app as an admin, developer, or tester.
              </div>
              <div className="muted">
                If Meta keeps reopening the same Facebook login, try the connect button in an incognito window or after logging out
                of Facebook first, then choose the other account.
              </div>
              <div className="muted">
                Example: if you already connected your personal Facebook user, open a private window, sign in with the separate
                Facebook user that owns the church pages, then connect Facebook again and import those pages too.
              </div>
            </div>
            <div className="toolbar toolbar-start wrap-toolbar">
              {isMetaConfigured() ? (
                <>
                  <Link href="/api/meta/connect?provider=facebook" className="button">
                    Facebook
                  </Link>
                  <Link href="/api/meta/connect?provider=instagram" className="button secondary">
                    Instagram
                  </Link>
                </>
              ) : (
                <button className="button secondary" type="button" disabled>
                  Meta unavailable
                </button>
              )}

              {isTikTokConfigured() ? (
                <Link href="/api/tiktok/connect" className="button secondary">
                  TikTok
                </Link>
              ) : (
                <button className="button secondary" type="button" disabled>
                  TikTok unavailable
                </button>
              )}
              {isYouTubeConfigured() ? (
                <Link href="/api/youtube/connect" className="button secondary">
                  YouTube
                </Link>
              ) : (
                <button className="button secondary" type="button" disabled>
                  YouTube unavailable
                </button>
              )}
            </div>
            <div className="muted">
              YouTube automation is for short videos only. In this CRM flow, TikTok is also treated as a short-video destination so
              the manual post form and the daily reel plan stay aligned with what is actually supported today.
            </div>
            {!isYouTubeConfigured() ? (
              <div className="muted">
                YouTube is currently unavailable because the Google OAuth environment variables are still missing in this deployment.
              </div>
            ) : null}
            {env.TIKTOK_USE_SANDBOX ? (
              <div className="muted">
                TikTok sandbox mode is enabled. Login works in sandbox, but live publishing still depends on the TikTok app approval
                level and the connected account permissions.
              </div>
            ) : null}
            <div className="calendar-event">
              <strong>TikTok diagnostic</strong>
              <div className="muted">Client key: {maskSecret(env.TIKTOK_CLIENT_KEY)}</div>
              <div className="muted">Redirect URI: {env.TIKTOK_REDIRECT_URI || "missing"}</div>
              <div className="muted">Scopes: {tiktokScopeString}</div>
              <div className="muted">Current CRM use: short-video publishing</div>
              <div className="muted">Sandbox mode: {env.TIKTOK_USE_SANDBOX ? "enabled" : "disabled"}</div>
            </div>
          </div>
        </SectionCard>
      </section>

      <section>
        <SectionCard title="Daily autopost plans">
          <div className="stack">
            {autoplanStatusMessage ? <div className="calendar-event action-feedback success">{autoplanStatusMessage}</div> : null}
            <AutoPostPlanForm
              accounts={socialAccounts.map((account) => ({
                id: account.id,
                accountLabel: account.accountLabel,
                platformLabel: getPlatformLabel(account.platform),
              }))}
              scheduleYearImagesAction={scheduleYearImagesAction}
              scheduleYearReelsAction={scheduleYearReelsAction}
              pauseYearImagesAction={pauseYearImagesAction}
              pauseYearReelsAction={pauseYearReelsAction}
            />
          </div>
        </SectionCard>
      </section>

      <section className="two-column narrow-right">
        <SectionCard title="Post once">
          {manualStatusFeedback ? (
            <div
              className={`calendar-event action-feedback ${
                manualStatusFeedback.tone === "success"
                  ? "success"
                  : manualStatusFeedback.tone === "warning"
                    ? "warning"
                    : "error"
              }`}
            >
              {manualStatusFeedback.message}
            </div>
          ) : null}
          <ManualPostClientForm
            accounts={socialAccounts.map((account) => ({
              id: account.id,
              accountLabel: account.accountLabel,
              platformLabel: getPlatformLabel(account.platform),
              platform: account.platform,
            }))}
            reelLibraryOptions={reelLibraryOptions}
          />
        </SectionCard>

        <SectionCard title="Queue">
          <div className="list compact-list">
            {queuedPosts.length ? (
              queuedPosts.map((post) => (
                <div key={post.id} className="list-item">
                  <div>
                    <strong>{getQueueDisplayText(post)}</strong>
                    <div className="muted">
                      {getPostTypeLabel(post.postType)}
                      {" | "}
                      {post.socialAccount?.accountLabel || "Unassigned account"}
                    </div>
                    {post.asset?.title && !isGeneratedAutomationLabel(post.asset.title) ? (
                      <div className="muted">Media: {post.asset.title}</div>
                    ) : null}
                  </div>
                  <div className="muted">
                    {post.status === "READY" ? "Ready now" : post.scheduledFor ? formatAutomationDate(post.scheduledFor) : "Queued"}
                  </div>
                </div>
              ))
            ) : (
              <div className="list-item">
                <span>No queued posts yet.</span>
              </div>
            )}
          </div>
        </SectionCard>
      </section>

      <section>
        <SectionCard title="Recent publish failures">
          <div className="list compact-list">
            {failedPosts.length ? (
              failedPosts.map((post) => (
                <div key={post.id} className="list-item">
                  <div>
                    <strong>{post.socialAccount?.accountLabel || "Unknown account"}</strong>
                    <div className="muted">{getPostTypeLabel(post.postType)}</div>
                  </div>
                  <div className="muted">{post.lastErrorMessage || "Publish failed"}</div>
                </div>
              ))
            ) : (
              <div className="list-item">
                <span>No failed posts yet.</span>
              </div>
            )}
          </div>
        </SectionCard>
      </section>
    </AppShell>
  );
}
