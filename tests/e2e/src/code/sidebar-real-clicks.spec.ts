import { expect, test } from "@playwright/test";
import {
  assertShellHealthy,
  clickByUser,
  gotoWorkspaces,
  getSidebarSearchInput,
  getSidebarSearchToggle,
  getSidebarSortOption,
  getSidebarSortToggle,
  isRuntimeGatewayReady,
  openUserMenu,
  resolveWorkspaceHomeControl,
  waitForWorkspaceShell,
} from "./helpers";

test.describe.configure({ timeout: 90_000 });

const VIEWPORTS = [
  { label: "desktop-1440", width: 1440, height: 900 },
  { label: "desktop-1024", width: 1024, height: 900 },
] as const;

async function ensureRuntimeShell(page: import("@playwright/test").Page) {
  const runtimeReady = await isRuntimeGatewayReady(page.request);
  test.skip(!runtimeReady, "Runtime gateway is not running; skipping runtime-dependent test.");
  await gotoWorkspaces(page);
  const shellReady = await waitForWorkspaceShell(page);
  test.skip(!shellReady, "Workspace shell is not ready in this environment.");
}

async function readTransitionMaxMs(page: import("@playwright/test").Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const parseTimeList = (value: string) =>
        value
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
          .map((part) => {
            if (part.endsWith("ms")) {
              return Number.parseFloat(part);
            }
            if (part.endsWith("s")) {
              return Number.parseFloat(part) * 1000;
            }
            const parsed = Number.parseFloat(part);
            return Number.isFinite(parsed) ? parsed : 0;
          });

      const style = getComputedStyle(element);
      const durations = parseTimeList(style.transitionDuration);
      const delays = parseTimeList(style.transitionDelay);
      const len = Math.max(durations.length, delays.length);
      let max = 0;

      for (let index = 0; index < len; index += 1) {
        const duration = durations[Math.min(index, durations.length - 1)] ?? 0;
        const delay = delays[Math.min(index, delays.length - 1)] ?? 0;
        max = Math.max(max, duration + delay);
      }

      return max;
    });
}

for (const viewport of VIEWPORTS) {
  test(`${viewport.label} sidebar header controls support real clicks`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await ensureRuntimeShell(page);

    const homeShellButton = await resolveWorkspaceHomeControl(page);
    const toggleSearchButton = getSidebarSearchToggle(page);
    const sortThreadsButton = getSidebarSortToggle(page);

    await expect(homeShellButton).toBeVisible();
    await expect(toggleSearchButton).toBeVisible();
    await expect(sortThreadsButton).toBeVisible();

    await clickByUser(page, toggleSearchButton);
    const searchInput = getSidebarSearchInput(page);
    await expect(searchInput).toBeVisible();
    await clickByUser(page, toggleSearchButton);
    await expect(searchInput).toHaveCount(0);

    await clickByUser(page, sortThreadsButton);
    const sortMenu = page.getByTestId("sidebar-sort-menu");
    await expect(sortMenu).toBeVisible();
    await clickByUser(page, getSidebarSortOption(page, "created_at"));
    await expect(sortMenu).toHaveCount(0);

    await assertShellHealthy(page);
  });
}

test("sort menu toggles cleanly and keeps radio actions interactive", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ensureRuntimeShell(page);

  const sortThreadsButton = getSidebarSortToggle(page);

  await clickByUser(page, sortThreadsButton);
  await expect(page.getByTestId("sidebar-sort-menu")).toBeVisible();
  await expect(page.getByTestId("sidebar-sort-menu")).toHaveCount(1);

  await clickByUser(page, sortThreadsButton);
  await expect(page.getByTestId("sidebar-sort-menu")).toHaveCount(0);

  await clickByUser(page, sortThreadsButton);
  await expect(page.getByTestId("sidebar-sort-menu")).toBeVisible();
  await clickByUser(page, getSidebarSortOption(page, "updated_at"));
  await expect(page.getByTestId("sidebar-sort-menu")).toHaveCount(0);
});

test("header actions remain interactive after sequential menu transitions", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ensureRuntimeShell(page);

  const toggleSearchButton = getSidebarSearchToggle(page);
  const sortThreadsButton = getSidebarSortToggle(page);

  await openUserMenu(page);
  const settingsEntry = page
    .getByRole("button", {
      name: /^(Open settings|Manage Accounts & Billing)$/i,
    })
    .first();
  await expect(settingsEntry).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(toggleSearchButton).toBeVisible();
  await expect(sortThreadsButton).toBeVisible();

  await clickByUser(page, toggleSearchButton);
  await expect(getSidebarSearchInput(page)).toBeVisible();
  await clickByUser(page, toggleSearchButton);
  await expect(getSidebarSearchInput(page)).toHaveCount(0);

  await clickByUser(page, sortThreadsButton);
  await expect(page.getByTestId("sidebar-sort-menu")).toBeVisible();
  await clickByUser(page, getSidebarSortOption(page, "created_at"));
  await expect(page.getByTestId("sidebar-sort-menu")).toHaveCount(0);

  await assertShellHealthy(page);
});

test("sidebar resizer keeps a clean seam and disables transitions while dragging", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    window.localStorage.setItem("codexmonitor.sidebarWidth", "280");
  });
  await ensureRuntimeShell(page);

  const resizeSidebar = page.getByRole("separator", { name: "Resize sidebar" });
  await expect(resizeSidebar).toBeVisible();

  const borderWidths = await resizeSidebar.evaluate((element) => {
    const style = getComputedStyle(element);
    return [
      Number.parseFloat(style.borderTopWidth),
      Number.parseFloat(style.borderRightWidth),
      Number.parseFloat(style.borderBottomWidth),
      Number.parseFloat(style.borderLeftWidth),
    ];
  });
  for (const borderWidth of borderWidths) {
    expect(borderWidth).toBe(0);
  }

  const appTransitionBeforeDrag = await readTransitionMaxMs(page, ".app");
  expect(appTransitionBeforeDrag).toBeGreaterThan(0);

  const bounds = await resizeSidebar.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) {
    return;
  }

  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();

  await expect.poll(() => page.evaluate(() => document.body.dataset.resizing)).toBe("sidebar");
  await expect.poll(() => readTransitionMaxMs(page, ".app")).toBe(0);

  await page.mouse.move(x + 100, y, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => document.body.dataset.resizing ?? "")).toBe("");
});
