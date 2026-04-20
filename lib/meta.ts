import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";

const META_GRAPH_VERSION = "v23.0";
const META_SCOPES = [
  "public_profile",
  "pages_show_list",
  "business_management",
  "instagram_basic",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_content_publish",
].join(",");

export type MetaConnectProvider = "facebook" | "instagram";

function requireMetaEnv() {
  if (!env.META_APP_ID || !env.META_APP_SECRET || !env.META_REDIRECT_URI) {
    throw new Error("Meta environment variables are missing.");
  }
}

export function isMetaConfigured() {
  return Boolean(env.META_APP_ID && env.META_APP_SECRET && env.META_REDIRECT_URI);
}

export function getMetaConnectUrl(
  churchId: string,
  options?: {
    forceRelogin?: boolean;
    provider?: MetaConnectProvider;
  },
) {
  requireMetaEnv();

  const state = Buffer.from(
    JSON.stringify({
      churchId,
      provider: options?.provider || "facebook",
    }),
  ).toString("base64url");
  const url = new URL(`https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", env.META_APP_ID!);
  url.searchParams.set("redirect_uri", env.META_REDIRECT_URI!);
  url.searchParams.set("scope", META_SCOPES);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  if (options?.forceRelogin) {
    url.searchParams.set("auth_type", "reauthenticate");
    url.searchParams.set("prompt", "select_account");
  } else {
    url.searchParams.set("auth_type", "rerequest");
  }

  return url.toString();
}

function decodeState(state: string | null) {
  if (!state) {
    return null;
  }

  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as {
      churchId?: string;
      provider?: MetaConnectProvider;
    };
    return {
      churchId: parsed.churchId ?? null,
      provider: parsed.provider === "instagram" ? "instagram" : "facebook",
    };
  } catch {
    return null;
  }
}

export async function exchangeMetaCodeForToken(code: string) {
  requireMetaEnv();

  const tokenUrl = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", env.META_APP_ID!);
  tokenUrl.searchParams.set("client_secret", env.META_APP_SECRET!);
  tokenUrl.searchParams.set("redirect_uri", env.META_REDIRECT_URI!);
  tokenUrl.searchParams.set("code", code);

  const response = await fetch(tokenUrl.toString(), { cache: "no-store" });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Meta token exchange failed.");
  }

  return data.access_token as string;
}

type MetaPage = {
  id: string;
  name: string;
  access_token?: string;
  tasks?: string[];
  instagram_business_account?: {
    id: string;
    username?: string;
    name?: string;
  };
  connected_instagram_account?: {
    id: string;
    username?: string;
    name?: string;
  };
};

export type PendingMetaPageSelection = {
  id: string;
  name: string;
  accessTokenRef: string | null;
  instagram?: {
    id: string;
    label: string;
  };
};

async function fetchMetaPagesFromUserToken(userAccessToken: string) {
  const pagesUrl = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts`);
  pagesUrl.searchParams.set(
    "fields",
    [
      "id",
      "name",
      "access_token",
      "tasks",
      "instagram_business_account{id,username,name}",
      "connected_instagram_account{id,username,name}",
    ].join(","),
  );
  pagesUrl.searchParams.set("limit", "200");
  pagesUrl.searchParams.set("access_token", userAccessToken);

  const response = await fetch(pagesUrl.toString(), { cache: "no-store" });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Could not load Meta pages.");
  }

  return (data.data || []) as MetaPage[];
}

export async function getPendingMetaPageSelections(userAccessToken: string) {
  const pages = await fetchMetaPagesFromUserToken(userAccessToken);

  return pages.map((page) => {
    const instagramAccount = page.instagram_business_account || page.connected_instagram_account;

    return {
      id: page.id,
      name: page.name,
      accessTokenRef: page.access_token || null,
      instagram: instagramAccount
        ? {
            id: instagramAccount.id,
            label: instagramAccount.username || instagramAccount.name || `Instagram ${instagramAccount.id}`,
          }
        : undefined,
    };
  }) satisfies PendingMetaPageSelection[];
}

export async function fetchMetaPagesFromCode(code: string, state: string | null, fallbackChurchId: string) {
  const decodedState = decodeState(state);
  const churchId = decodedState?.churchId || fallbackChurchId;
  const provider = decodedState?.provider || "facebook";
  const userAccessToken = await exchangeMetaCodeForToken(code);
  const selections = await getPendingMetaPageSelections(userAccessToken);

  console.info("Meta page import response", {
    churchId,
    pageCount: selections.length,
    pageLabels: selections.map((page) => page.name),
    scopesRequested: META_SCOPES,
  });

  return {
    churchId,
    provider,
    pageCount: selections.length,
    userAccessToken,
    selections,
  };
}

export async function saveSelectedMetaPages(
  churchId: string,
  selections: PendingMetaPageSelection[],
  selectedPageIds: string[],
  provider: MetaConnectProvider = "facebook",
) {
  let importedCount = 0;
  const importedLabels: string[] = [];

  for (const page of selections) {
    if (!selectedPageIds.includes(page.id)) {
      continue;
    }

    if (provider === "facebook") {
      const existingPage = await prisma.socialAccount.findFirst({
        where: {
          churchId,
          platform: "FACEBOOK_PAGE",
          externalAccountId: page.id,
        },
      });

      if (existingPage) {
        await prisma.socialAccount.update({
          where: { id: existingPage.id },
          data: {
            accountLabel: page.name,
            accessTokenRef: page.accessTokenRef,
            isActive: true,
          },
        });
      } else {
        await prisma.socialAccount.create({
          data: {
            churchId,
            platform: "FACEBOOK_PAGE",
            accountLabel: page.name,
            externalAccountId: page.id,
            accessTokenRef: page.accessTokenRef,
            isActive: true,
          },
        });
      }

      importedCount += 1;
      importedLabels.push(page.name);
    }

    if (provider === "instagram" && page.instagram) {
      const ig = page.instagram;
      const label = ig.label;
      const existingIg = await prisma.socialAccount.findFirst({
        where: {
          churchId,
          platform: "INSTAGRAM",
          externalAccountId: ig.id,
        },
      });

      if (existingIg) {
        await prisma.socialAccount.update({
          where: { id: existingIg.id },
          data: {
            accountLabel: label,
            accessTokenRef: page.accessTokenRef,
            isActive: true,
          },
        });
      } else {
        await prisma.socialAccount.create({
          data: {
            churchId,
            platform: "INSTAGRAM",
            accountLabel: label,
            externalAccountId: ig.id,
            accessTokenRef: page.accessTokenRef,
            isActive: true,
          },
        });
      }

      importedCount += 1;
      importedLabels.push(label);
    }
  }

  return {
    churchId,
    importedCount,
    importedLabels,
    pageCount: selections.length,
  };
}
