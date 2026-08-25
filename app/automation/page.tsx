import Link from "next/link";
import { cookies } from "next/headers";
import { listMatchingBucketFiles } from "@/lib/automation/buckets";
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

export const dynamic = "force-dynamic";

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

  const visiblePendingSelections =
    pendingProvider === "instagram"
      ? pendingSelections.filter((page) => page.instagram)
      : pendingSelections;
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
      </section>
    </AppShell>
  );
}
