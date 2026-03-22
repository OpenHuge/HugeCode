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

type ProfileState = {
  meProfile: MockUser;
  byUsernameRequested: boolean;
  postsByAuthorRequested: boolean;
  profileGetRequested: boolean;
  profilePutRequested: boolean;
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

function buildProfilePost(authorId: string) {
  return {
    id: "post-1",
    communityId: "community-1",
    authorId,
    title: "Profile API Post",
    body: "Loaded by authorId filter",
    linkUrl: null,
    score: 3,
    commentCount: 0,
    createdAt: "2024-01-02T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
    deletedAt: null,
    removedAt: null,
    removedBy: null,
  };
}

async function handleMockApiRoute(
  route: Route,
  state: ProfileState,
  authUser: MockUser,
  profileUser: MockUser
) {
  const request = route.request();
  const method = request.method();
  const url = new URL(request.url());
  const normalizedPath = normalizeApiPath(url.pathname);

  if (normalizedPath === "/auth/me" && method === "GET") {
    return fulfillJson(route, 200, { user: authUser });
  }

  if (normalizedPath.startsWith("/users/by-username/") && method === "GET") {
    state.byUsernameRequested = true;
    return fulfillJson(route, 200, { user: profileUser });
  }

  if (normalizedPath === "/posts" && method === "GET") {
    if (url.searchParams.get("authorId") !== profileUser.id) {
      return route.continue();
    }
    state.postsByAuthorRequested = true;
    return fulfillJson(route, 200, {
      items: [buildProfilePost(profileUser.id)],
      nextCursor: null,
    });
  }

  if (normalizedPath === "/me/profile" && method === "GET") {
    state.profileGetRequested = true;
    return fulfillJson(route, 200, { user: state.meProfile });
  }

  if (normalizedPath === "/me/profile" && method === "PUT") {
    state.profilePutRequested = true;
    const payload = request.postDataJSON() as {
      displayName?: string | null;
      avatarUrl?: string | null;
    };
    state.meProfile = {
      ...state.meProfile,
      ...payload,
      updatedAt: new Date().toISOString(),
    };
    return fulfillJson(route, 200, { user: state.meProfile });
  }

  return route.continue();
}

test.describe("Profile + Settings real API wiring", () => {
  test("loads profile by username and persists settings updates", async ({ page }) => {
    const authUser: MockUser = {
      id: "viewer-1",
      email: "viewer@example.com",
      username: "viewer",
      displayName: "Viewer",
      avatarUrl: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    const profileUser: MockUser = {
      id: "alice-1",
      email: "alice@example.com",
      username: "alice",
      displayName: "Alice Profile",
      avatarUrl: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    const state: ProfileState = {
      meProfile: {
        ...authUser,
        displayName: "Viewer Before Save",
      },
      byUsernameRequested: false,
      postsByAuthorRequested: false,
      profileGetRequested: false,
      profilePutRequested: false,
    };

    await page.route("**/*", (route) => handleMockApiRoute(route, state, authUser, profileUser));

    await page.goto(`/u/${profileUser.username}`);
    await expect
      .poll(() => ({
        byUsernameRequested: state.byUsernameRequested,
        postsByAuthorRequested: state.postsByAuthorRequested,
      }))
      .toEqual({
        byUsernameRequested: true,
        postsByAuthorRequested: true,
      });
    await expect(page.getByRole("heading", { name: "Alice Profile" })).toBeVisible();
    await expect(page.getByText("Profile API Post")).toBeVisible();

    await page.goto("/settings");
    await expect.poll(() => state.profileGetRequested).toBe(true);
    const displayNameInput = page.getByLabel("显示名称");
    await expect(displayNameInput).toHaveValue("Viewer Before Save");

    await displayNameInput.fill("Viewer After Save");
    await page.getByRole("button", { name: "保存设置" }).click();
    await expect.poll(() => state.profilePutRequested).toBe(true);
    await expect(page.getByText("资料已保存")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("显示名称")).toHaveValue("Viewer After Save");
  });
});
