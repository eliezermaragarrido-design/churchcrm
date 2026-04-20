import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { requireAuthContext } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { SectionCard } from "@/components/layout/section-card";
import { getPendingMetaPageSelections, isMetaConfigured, type PendingMetaPageSelection } from "@/lib/meta";
import {
  cancelMetaSelectionAction,
  createManualSocialPostAction,
  deleteSocialAccountAction,
  pauseYearImagesAction,
  pauseYearReelsAction,
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
  if (props.searchParams) {
    await props.searchParams;
  }
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
  const queuedPosts = await prisma.socialPost.findMany({
    where: {
      churchId: auth.churchId,
      status: { in: ["READY", "SCHEDULED"] },
    },
    include: {
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
    <AppShell title="Automation" subtitle="Connect accounts and let the daily plans run." currentPath="/automation">
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
                <span>No accounts yet.</span>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Connect">
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

            <button className="button secondary" type="button" disabled>
              TikTok
            </button>
            <button className="button secondary" type="button" disabled>
              YouTube
            </button>
          </div>
        </SectionCard>
      </section>

      <section>
        <SectionCard title="Autopost">
          <form className="form-grid simple-form" id="autopost-form">
            <div className="stack">
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
                <div className="calendar-event">Add at least one account first.</div>
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
                Publish all year images
              </button>
              <button className="button secondary" formAction={pauseYearImagesAction} type="submit">
                Pause images
              </button>
            </div>

            <div className="toolbar toolbar-start">
              <button className="button" formAction={scheduleYearReelsAction} type="submit">
                Publish all year reels
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
          <form className="form-grid simple-form">
            <div className="stack">
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
              <label>Title</label>
              <input className="input" type="text" name="title" placeholder="Optional title" />
            </div>

            <div className="stack">
              <label>Caption</label>
              <textarea className="input" name="caption" rows={5} placeholder="Write the text for the selected accounts." />
            </div>

            <div className="two-up-inputs">
              <div className="stack">
                <label>Feed / story time</label>
                <input className="input" type="time" name="manualPostTime" defaultValue="10:00" />
              </div>
              <div className="stack">
                <label>Reel time</label>
                <input className="input" type="time" name="manualReelTime" defaultValue="12:30" />
              </div>
            </div>

            <div className="stack">
              <label>When</label>
              <select className="input" name="scheduleMode" defaultValue="next">
                <option value="next">Queue for the selected time today</option>
                <option value="now">Send as soon as possible</option>
              </select>
            </div>

            <div className="toolbar toolbar-start">
              <button className="button" formAction={createManualSocialPostAction} type="submit">
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
                    <strong>{post.title || post.caption || "Untitled post"}</strong>
                    <div className="muted">
                      {post.postType === "FEED_POST" ? "Feed" : post.postType === "STORY" ? "Story" : "Reel"}
                      {" | "}
                      {post.socialAccount?.accountLabel || "Unassigned account"}
                    </div>
                  </div>
                  <div className="muted">
                    {post.scheduledFor ? post.scheduledFor.toLocaleString("en-US") : "Queued"}
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
    </AppShell>
  );
}
