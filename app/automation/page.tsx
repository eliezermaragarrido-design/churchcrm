import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { requireAuthContext } from "@/lib/auth";
import { env } from "@/lib/env";
import { isTikTokConfigured } from "@/lib/social/tiktok";
import { isYouTubeConfigured } from "@/lib/social/youtube";
import { AppShell } from "@/components/layout/app-shell";
import { SectionCard } from "@/components/layout/section-card";
import { getPendingMetaPageSelections, isMetaConfigured, type PendingMetaPageSelection } from "@/lib/meta";
import {
  cancelMetaSelectionAction,
  createManualSocialPostAction,
  deleteSocialAccountAction,
  pauseYearImagesAction,
  pauseYearReelsAction,
  publishDueSocialPostsAction,
  saveMetaSelectionAction,
  scheduleYearImagesAction,
  scheduleYearReelsAction,
} from "./actions";

const META_PENDING_COOKIE = "meta_pending_pages";

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
  const [imageAssetCount, reelAssetCount, socialPostStats] = await Promise.all([
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

      {metaStatus || tiktokStatus || youtubeStatus ? (
        <section>
          <SectionCard title="Connection status">
            <div className="list compact-list">
              {metaStatus ? <div className="list-item"><span>Meta</span><strong>{metaStatus}</strong></div> : null}
              {tiktokStatus ? <div className="list-item"><span>TikTok</span><strong>{tiktokStatus}</strong></div> : null}
              {youtubeStatus ? <div className="list-item"><span>YouTube</span><strong>{youtubeStatus}</strong></div> : null}
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
            <div className="muted">YouTube automation is used for videos only. TikTok can publish both image posts and reels from public Supabase URLs.</div>
            <div className="muted">
              Missing right now in `.env`: TikTok client key/secret/redirect URI, Google client id/secret/redirect URI, and `CRON_SECRET`.
            </div>
            {env.TIKTOK_USE_SANDBOX ? (
              <div className="muted">
                TikTok sandbox mode is enabled. The CRM will request only `user.info.basic` so we can verify account connection first.
                Public posting scopes are deferred until production review is approved.
              </div>
            ) : null}
          </div>
        </SectionCard>
      </section>

      <section>
        <SectionCard title="Daily autopost plans">
          <form className="form-grid simple-form" id="autopost-form">
            <div className="stack">
              <p className="muted">Choose which connected accounts should receive the numbered daily image and reel libraries.</p>
              {socialAccounts.length ? (
                socialAccounts.map((account) => (
                  <label key={account.id} className="calendar-event">
                    <input type="checkbox" name="accountIds" value={account.id} defaultChecked />
                    {" "}
                    <strong>{account.accountLabel}</strong>
                    <div className="muted">{getPlatformLabel(account.platform)}</div>
                  </label>
                ))
              ) : (
                <div className="calendar-event">Connect at least one account first.</div>
              )}
            </div>

            <div className="two-up-inputs">
              <div className="stack">
                <label>Images time</label>
                <input className="input" type="time" name="imageTime" defaultValue="09:00" />
              </div>
              <div className="stack">
                <label>Reels time</label>
                <input className="input" type="time" name="reelTime" defaultValue="12:00" />
              </div>
            </div>

            <div className="toolbar toolbar-start">
              <button className="button" formAction={scheduleYearImagesAction} type="submit">
                Queue all year images
              </button>
              <button className="button secondary" formAction={pauseYearImagesAction} type="submit">
                Pause images
              </button>
            </div>

            <div className="toolbar toolbar-start">
              <button className="button" formAction={scheduleYearReelsAction} type="submit">
                Queue all year reels
              </button>
              <button className="button secondary" formAction={pauseYearReelsAction} type="submit">
                Pause reels
              </button>
            </div>
          </form>
        </SectionCard>
      </section>

      <section className="two-column narrow-right">
        <SectionCard title="Post once">
          <form className="form-grid simple-form" action={createManualSocialPostAction}>
            <div className="stack">
              <p className="muted">Pick one or more destinations for this post.</p>
              {socialAccounts.length ? (
                socialAccounts.map((account) => (
                  <label key={`manual-${account.id}`} className="calendar-event">
                    <input type="checkbox" name="accountIds" value={account.id} defaultChecked />
                    {" "}
                    <strong>{account.accountLabel}</strong>
                    <div className="muted">{getPlatformLabel(account.platform)}</div>
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
              <select className="input" name="publishMode" defaultValue="NOW">
                <option value="NOW">Publish as soon as possible</option>
                <option value="SCHEDULE">Schedule for later</option>
              </select>
            </div>

            <div className="stack">
              <label>Scheduled date and time</label>
              <input className="input" type="datetime-local" name="scheduledAt" />
              <div className="muted">This is only used when publish mode is set to scheduled.</div>
            </div>

            <div className="toolbar toolbar-start">
              <button className="button" type="submit">
                Create post
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Queue">
          <div className="list compact-list">
            {queuedPosts.length ? (
              queuedPosts.map((post) => (
                <div key={post.id} className="list-item">
                  <div>
                    <strong>{post.caption || post.asset?.title || "Untitled post"}</strong>
                    <div className="muted">
                      {getPostTypeLabel(post.postType)}
                      {" | "}
                      {post.socialAccount?.accountLabel || "Unassigned account"}
                    </div>
                    {post.asset?.title ? <div className="muted">Media: {post.asset.title}</div> : null}
                  </div>
                  <div className="muted">
                    {post.status === "READY" ? "Ready now" : post.scheduledFor ? post.scheduledFor.toLocaleString("en-US") : "Queued"}
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
