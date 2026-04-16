import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireAuthContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/layout/badge";
import { SectionCard } from "@/components/layout/section-card";
import {
  deleteSocialAccountAction,
  pauseYearImagesAction,
  pauseYearReelsAction,
  scheduleYearImagesAction,
  scheduleYearReelsAction,
} from "./actions";

type AutomationSearchParams = Promise<{
  meta?: string | string[];
}>;

function getChicagoDayOfYear(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  const current = Date.UTC(year, month - 1, day);
  const start = Date.UTC(year, 0, 1);

  return Math.floor((current - start) / 86400000) + 1;
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

function getUsableDaySet(fileNames: string[]) {
  const usableDays = new Set<number>();

  for (const fileName of fileNames) {
    const match = fileName.match(/^(\d{1,3})\./i);

    if (!match) {
      continue;
    }

    const dayNumber = Number(match[1]);

    if (!dayNumber || dayNumber < 1 || dayNumber > 365) {
      continue;
    }

    usableDays.add(dayNumber);
  }

  return usableDays;
}

async function getBucketReadiness(bucketName: "IMAGES" | "REELS") {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucketName).list("", {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });

  if (error || !data) {
    return {
      ready: false,
      label: "Missing files",
      tone: "warn" as const,
      helper: `Could not read the ${bucketName} bucket.`,
    };
  }

  const usableDays = getUsableDaySet(data.map((entry) => entry.name));
  const missingDays: number[] = [];

  for (let day = 1; day <= 365; day += 1) {
    if (!usableDays.has(day)) {
      missingDays.push(day);
    }
  }

  if (missingDays.length === 0) {
    return {
      ready: true,
      label: "Ready",
      tone: "default" as const,
      helper: `${bucketName} has all day files from 001 to 365.`,
    };
  }

  return {
    ready: false,
    label: "Missing files",
    tone: "warn" as const,
    helper: `${bucketName} is missing one or more day files between 001 and 365.`,
  };
}

function getMetaMessage(metaStatus?: string) {
  if (!metaStatus) {
    return null;
  }

  if (metaStatus === "connected") {
    return {
      tone: "default" as const,
      title: "Meta connected",
      body: "Facebook returned successfully. If the accounts list is still empty, refresh once so the latest connected pages load into the workspace.",
    };
  }

  const readableStatus = metaStatus
    .replaceAll("+", " ")
    .replaceAll("-", " ")
    .trim();

  return {
    tone: "warn" as const,
    title: "Meta connection needs attention",
    body: readableStatus,
  };
}

export default async function AutomationPage({ searchParams }: { searchParams?: AutomationSearchParams }) {
  const auth = await requireAuthContext();
  const dayOfYear = getChicagoDayOfYear();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const metaParam = Array.isArray(resolvedSearchParams.meta)
    ? resolvedSearchParams.meta[0]
    : resolvedSearchParams.meta;
  const metaMessage = getMetaMessage(metaParam);

  const [socialAccounts, imageStatus, reelStatus] = await Promise.all([
    prisma.socialAccount.findMany({
      where: { churchId: auth.churchId },
      orderBy: [{ platform: "asc" }, { accountLabel: "asc" }],
    }),
    getBucketReadiness("IMAGES"),
    getBucketReadiness("REELS"),
  ]);

  return (
    <AppShell
      title="Automation"
      subtitle="Choose your connected accounts once, set the posting time, and let the yearly image and reel plans run automatically."
      currentPath="/automation"
      actions={<Badge>Day {dayOfYear}</Badge>}
    >
      {metaMessage ? (
        <section>
          <SectionCard title={metaMessage.title}>
            <div className="stack">
              <Badge tone={metaMessage.tone}>{metaMessage.tone === "default" ? "Success" : "Check"}</Badge>
              <div className="muted">{metaMessage.body}</div>
            </div>
          </SectionCard>
        </section>
      ) : null}

      <section className="two-column narrow-right">
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
          </form>
        </SectionCard>

        <SectionCard title="Plan status">
          <div className="list compact-list">
            <div className="list-item">
              <span>Images library</span>
              <Badge tone={imageStatus.tone}>{imageStatus.label}</Badge>
            </div>
            <div className="muted">{imageStatus.helper}</div>

            <div className="list-item">
              <span>Reels library</span>
              <Badge tone={reelStatus.tone}>{reelStatus.label}</Badge>
            </div>
            <div className="muted">{reelStatus.helper}</div>

            <div className="list-item">
              <span>Connected accounts</span>
              <strong>{socialAccounts.length ? `${socialAccounts.length} ready` : "None yet"}</strong>
            </div>
            <div className="list-item">
              <span>Today of year</span>
              <strong>{dayOfYear}</strong>
            </div>
          </div>
        </SectionCard>
      </section>

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

        <SectionCard title="Connect Meta">
          <div className="stack">
            <div className="muted">
              Connect Facebook Page and Instagram first. The CRM will import the Meta accounts available to your login.
            </div>
            <div className="toolbar toolbar-start">
              <Link href="/api/meta/connect" className="button">Connect Meta</Link>
            </div>
            <div className="muted">
              TikTok, YouTube, and X can be added after Meta is working.
            </div>
          </div>
        </SectionCard>
      </section>
    </AppShell>
  );
}
