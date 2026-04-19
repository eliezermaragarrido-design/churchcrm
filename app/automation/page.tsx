import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { requireAuthContext } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { SectionCard } from "@/components/layout/section-card";
import { getPendingMetaPageSelections, isMetaConfigured, type PendingMetaPageSelection } from "@/lib/meta";
import {
  cancelMetaSelectionAction,
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

export default async function AutomationPage() {
  const auth = await requireAuthContext();
  const cookieStore = await cookies();
  const rawPendingSelection = cookieStore.get(META_PENDING_COOKIE)?.value;
  let pendingSelections: PendingMetaPageSelection[] = [];

  if (rawPendingSelection) {
    try {
      const parsed = JSON.parse(rawPendingSelection) as {
        userAccessToken?: string;
      };
      const userAccessToken = String(parsed.userAccessToken || "").trim();
      pendingSelections = userAccessToken ? await getPendingMetaPageSelections(userAccessToken) : [];
    } catch {
      pendingSelections = [];
    }
  }

  const socialAccounts = await getVisibleSocialAccounts(auth.churchId);

  return (
    <AppShell
      title="Automation"
      subtitle="Connect your accounts, choose the posting time, and let the daily image and reel plans run automatically."
      currentPath="/automation"
    >
      {pendingSelections.length ? (
        <section>
          <SectionCard title="Choose the pages to connect">
            <form className="form-grid simple-form">
              <div className="stack">
                <div className="muted">
                  Select only the Facebook pages you want to keep connected to ChurchCRM.
                </div>
                {pendingSelections.map((page) => (
                  <label key={page.id} className="calendar-event">
                    <input type="checkbox" name="selectedPageIds" value={page.id} defaultChecked />
                    {" "}
                    <strong>{page.name}</strong>
                    <div className="muted">
                      Facebook Page{page.instagram ? ` + ${page.instagram.label}` : ""}
                    </div>
                  </label>
                ))}
              </div>

              <div className="toolbar toolbar-start">
                <button className="button" formAction={saveMetaSelectionAction} type="submit">Save selected pages</button>
                <button className="button secondary" formAction={cancelMetaSelectionAction} type="submit">Cancel</button>
              </div>
            </form>
          </SectionCard>
        </section>
      ) : null}

      <section className="two-column narrow-right">
        <SectionCard title="Connected accounts">
          <div className="list compact-list">
            {socialAccounts.length ? socialAccounts.map((account) => (
              <div key={account.id} className="list-item">
                <div>
                  <strong>{account.accountLabel}</strong>
                  <div className="muted">{getPlatformLabel(account.platform)}</div>
                </div>
                <form action={deleteSocialAccountAction}>
                  <input type="hidden" name="socialAccountId" value={account.id} />
                  <button className="button secondary danger-button" type="submit">Remove</button>
                </form>
              </div>
            )) : <div className="list-item"><span>No connected accounts yet.</span></div>}
          </div>
        </SectionCard>

        <SectionCard title="Connect accounts">
          <div className="stack">
            <div className="muted">
              Add the social accounts that should be available for automatic posting.
            </div>
            <div className="toolbar toolbar-start">
              {isMetaConfigured() ? (
                <Link href="/api/meta/connect" className="button">Connect Facebook + Instagram</Link>
              ) : (
                <button className="button secondary" type="button" disabled>Meta not configured</button>
              )}
            </div>
            <div className="toolbar toolbar-start">
              <button className="button secondary" type="button" disabled>TikTok soon</button>
              <button className="button secondary" type="button" disabled>YouTube soon</button>
            </div>
          </div>
        </SectionCard>
      </section>

      <section>
        <SectionCard title="Autopost setup">
          <form className="form-grid simple-form">
            <div className="stack">
              {socialAccounts.length ? socialAccounts.map((account) => (
                <label key={account.id} className="calendar-event">
                  <input type="checkbox" name="accountIds" value={account.id} defaultChecked />
                  {" "}
                  <strong>{account.accountLabel}</strong>
                  <div className="muted">{getPlatformLabel(account.platform)}</div>
                </label>
              )) : (
                <div className="calendar-event">Connect Meta first, then choose the accounts that should publish automatically.</div>
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
              <button className="button" formAction={scheduleYearImagesAction} type="submit">Publish all year images</button>
              <button className="button secondary" formAction={pauseYearImagesAction} type="submit">Pause images</button>
            </div>

            <div className="toolbar toolbar-start">
              <button className="button" formAction={scheduleYearReelsAction} type="submit">Publish all year reels</button>
              <button className="button secondary" formAction={pauseYearReelsAction} type="submit">Pause reels</button>
            </div>

            <div className="muted">
              Images and reels are matched automatically in the background by day number, from 001 to 365.
            </div>
          </form>
        </SectionCard>
      </section>
    </AppShell>
  );
}
