import { expect, type Route, test } from "@playwright/test";

type MockUser = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type CommunityState = {
  isMember: boolean;
  communityExists: boolean;
  createRequested: boolean;
  joinRequested: boolean;
  leaveRequested: boolean;
};

function normalizeApiPath(pathname: string) {
  return pathname.replace(/^\/api\/v1/, "");
}

function fulfillJson(route: Route, status: number, payload: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });
}

function buildCommunity(slug: string) {
  return {
    id: `community-${slug}`,
    slug,
    name: slug
      .split("-")
      .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
      .join(" "),
    description: `Community ${slug}`,
    creatorId: "creator-1",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
}

function buildCommunityPost(slug: string) {
  return {
    id: `post-${slug}`,
    communityId: `community-${slug}`,
    authorId: "author-1",
    title: `Post in ${slug}`,
    body: "Community feed item",
    linkUrl: null,
    score: 3,
    commentCount: 2,
    createdAt: "2024-01-02T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
    deletedAt: null,
    removedAt: null,
    removedBy: null,
    community: {
      id: `community-${slug}`,
      slug,
      name: buildCommunity(slug).name,
    },
  };
}

type MockRouteContext = {
  route: Route;
  state: CommunityState;
  authUser: MockUser;
  slug: string;
  method: string;
  normalizedPath: string;
};

type MockRouteHandler = (context: MockRouteContext) => Promise<boolean>;

function isApiRequest(context: MockRouteContext, path: string, method: string) {
  return context.normalizedPath === path && context.method === method;
}

async function handleAuthMe(context: MockRouteContext) {
  if (!isApiRequest(context, "/auth/me", "GET")) {
    return false;
  }
  await fulfillJson(context.route, 200, { user: context.authUser });
  return true;
}

async function handleTelemetryIngest(context: MockRouteContext) {
  if (!isApiRequest(context, "/events/ingest", "POST")) {
    return false;
  }
  await fulfillJson(context.route, 202, { accepted: 1, dropped: 0 });
  return true;
}

async function handleMyCommunities(context: MockRouteContext) {
  if (!isApiRequest(context, "/me/communities", "GET")) {
    return false;
  }
  const communities = context.state.isMember ? [buildCommunity(context.slug)] : [];
  await fulfillJson(context.route, 200, communities);
  return true;
}

async function handleCommunityLookup(context: MockRouteContext) {
  if (!isApiRequest(context, `/communities/${context.slug}`, "GET")) {
    return false;
  }
  await fulfillCommunityLookup(context.route, context.state, context.slug);
  return true;
}

async function handleCommunityFeed(context: MockRouteContext) {
  if (!isApiRequest(context, `/communities/${context.slug}/feed`, "GET")) {
    return false;
  }
  await fulfillCommunityFeed(context.route, context.state, context.slug);
  return true;
}

async function handleJoin(context: MockRouteContext) {
  if (!isApiRequest(context, `/communities/${context.slug}/join`, "POST")) {
    return false;
  }
  context.state.joinRequested = true;
  context.state.isMember = true;
  await fulfillJson(context.route, 201, { success: true, slug: context.slug });
  return true;
}

async function handleLeave(context: MockRouteContext) {
  if (!isApiRequest(context, `/communities/${context.slug}/leave`, "POST")) {
    return false;
  }
  context.state.leaveRequested = true;
  context.state.isMember = false;
  await fulfillJson(context.route, 200, { success: true, slug: context.slug });
  return true;
}

async function handleCreateCommunity(context: MockRouteContext) {
  if (!isApiRequest(context, "/communities", "POST")) {
    return false;
  }
  context.state.createRequested = true;
  context.state.communityExists = true;
  await fulfillJson(context.route, 201, buildCommunity(context.slug));
  return true;
}

const mockRouteHandlers: MockRouteHandler[] = [
  handleAuthMe,
  handleTelemetryIngest,
  handleMyCommunities,
  handleCommunityLookup,
  handleCommunityFeed,
  handleJoin,
  handleLeave,
  handleCreateCommunity,
];

async function handleMockApiRoute(
  route: Route,
  state: CommunityState,
  authUser: MockUser,
  slug: string
) {
  const request = route.request();
  const context: MockRouteContext = {
    route,
    state,
    authUser,
    slug,
    method: request.method(),
    normalizedPath: normalizeApiPath(new URL(request.url()).pathname),
  };

  for (const handler of mockRouteHandlers) {
    if (await handler(context)) {
      return;
    }
  }

  return route.continue();
}

function fulfillCommunityLookup(route: Route, state: CommunityState, slug: string) {
  if (!state.communityExists) {
    return fulfillJson(route, 404, {
      error: {
        code: "NOT_FOUND",
        message: "Community not found",
        requestId: "test-request-id",
      },
    });
  }

  return fulfillJson(route, 200, buildCommunity(slug));
}

function fulfillCommunityFeed(route: Route, state: CommunityState, slug: string) {
  if (!state.communityExists) {
    return fulfillJson(route, 404, {
      error: {
        code: "NOT_FOUND",
        message: "Community not found",
        requestId: "test-request-id",
      },
    });
  }

  return fulfillJson(route, 200, {
    items: [buildCommunityPost(slug)],
    nextCursor: null,
  });
}

test.describe("Community identity v1", () => {
  test("supports join/leave actions and shareable link", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "__copiedText", {
        configurable: true,
        writable: true,
        value: "",
      });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as unknown as { __copiedText: string }).__copiedText = text;
          },
        },
      });
    });

    const slug = "my-tech";
    const authUser: MockUser = {
      id: "viewer-1",
      email: "viewer@example.com",
      username: "viewer",
      displayName: "Viewer",
      avatarUrl: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };
    const state: CommunityState = {
      isMember: false,
      communityExists: true,
      createRequested: false,
      joinRequested: false,
      leaveRequested: false,
    };

    await page.route("**/*", (route) => handleMockApiRoute(route, state, authUser, slug));

    await page.goto(`/c/${slug}`);
    await expect(page.getByRole("heading", { name: "My Tech" })).toBeVisible();
    await expect(page.getByText(`Post in ${slug}`)).toBeVisible();

    await page.getByRole("button", { name: "加入社区" }).click();
    await expect.poll(() => state.joinRequested).toBe(true);
    await expect(page.getByRole("button", { name: "退出社区" })).toBeVisible();

    await page.getByRole("button", { name: "分享社区" }).click();
    await expect(page.getByText("社区链接已复制")).toBeVisible();
    const copied = await page.evaluate(
      () => (window as unknown as { __copiedText: string }).__copiedText
    );
    expect(copied).toContain(`/c/${slug}`);

    await page.getByRole("button", { name: "退出社区" }).click();
    await expect.poll(() => state.leaveRequested).toBe(true);
    await expect(page.getByRole("button", { name: "加入社区" })).toBeVisible();
  });

  test("supports one-click create when community does not exist", async ({ page }) => {
    const slug = "new-space";
    const authUser: MockUser = {
      id: "creator-1",
      email: "creator@example.com",
      username: "creator",
      displayName: "Creator",
      avatarUrl: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };
    const state: CommunityState = {
      isMember: true,
      communityExists: false,
      createRequested: false,
      joinRequested: false,
      leaveRequested: false,
    };

    await page.route("**/*", (route) => handleMockApiRoute(route, state, authUser, slug));

    await page.goto(`/c/${slug}`);
    await expect(page.getByRole("heading", { name: "社区不存在" })).toBeVisible();

    await page.getByRole("button", { name: "创建社区" }).click();
    await expect.poll(() => state.createRequested).toBe(true);

    await expect(page).toHaveURL(`/c/${slug}`);
    await expect(page.getByRole("heading", { name: "New Space" })).toBeVisible();
  });
});
