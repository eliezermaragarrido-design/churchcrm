import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireAuthContext } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { SectionCard } from "@/components/layout/section-card";
import {
  deleteSocialAccountAction,
  pauseYearImagesAction,
  pauseYearReelsAction,
  scheduleYearImagesAction,
  scheduleYearReelsAction,
} from "./actions";

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
  const churchAccounts = await prisma.socialAccount.findMany({
    where: { churchId },
    orderBy: [{ platform: "asc" }, { accountLabel: "asc" }],
  });

  if (churchAccounts.length) {
    return churchAccounts;
  }

  return prisma.socialAccount.findMany({
    where: { isActive: true },
    orderBy: [{ platform: "asc" }, { accountLabel: "asc" }],
  });
}

export default async function AutomationPage() {
  const auth = await requireAuthContext();

  const socialAccounts = await getVisibleSocialAccounts(auth.churchId);

  return (
    <AppShell
      title="Automation"
      subtitle="Connect your accounts, choose the posting time, and let the daily image and reel plans run automatically."
      currentPath="/automation"
    >
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
              <Link href="/api/meta/connect" className="button">Connect Facebook + Instagram</Link>
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
