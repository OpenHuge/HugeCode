import { expect, type Page, test } from "@playwright/test";
import {
  clickByUser,
  gotoWorkspaces,
  isRuntimeGatewayReady,
  openFirstWorkspace,
  waitForWorkspaceShell,
} from "./helpers";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 720, minNavItems: 8 },
  { name: "phone", width: 390, height: 844, minNavItems: 4 },
];

async function openSettings(page: Page, viewportName: string) {
  if (viewportName === "phone") {
    const projectsTab = page.getByRole("button", { name: "Projects" }).first();
    if ((await projectsTab.count()) > 0) {
      await clickByUser(page, projectsTab);
    }
  }

  const userMenu = page.getByRole("button", { name: "User menu" }).first();
  if (await userMenu.isVisible().catch(() => false)) {
    await clickByUser(page, userMenu);

    const openSettingsButton = page.getByRole("button", { name: "Open settings" }).first();
    if ((await openSettingsButton.count()) > 0) {
      await clickByUser(page, openSettingsButton);
      return;
    }
  }

  const fallbackSettingsButton = page.getByRole("button", { name: "Settings" }).first();
  await expect(fallbackSettingsButton).toBeVisible();
  await clickByUser(page, fallbackSettingsButton);
}

test("core settings structure remains consistent on desktop and phone", async ({ page }) => {
  test.setTimeout(90_000);
  const runtimeReady = await isRuntimeGatewayReady(page.request);
  test.skip(!runtimeReady, "Runtime gateway is not running; skipping runtime-dependent test.");

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await gotoWorkspaces(page);
    const shellReady = await waitForWorkspaceShell(page);
    test.skip(!shellReady, "Workspace shell is not ready in this environment.");
    await openFirstWorkspace(page);

    await openSettings(page, viewport.name);

    const overlay = page.locator(".settings-overlay").first();
    const windowNode = page.locator(".settings-window").first();
    const closeButton = page.getByRole("button", { name: "Close settings" }).first();
    const navItems = page.locator('[data-settings-sidebar-nav="true"] button');
    const contentFrame = page.locator('[data-settings-content-frame="true"]').first();
    const mobileDetailHeader = page.locator('[data-settings-mobile-detail-header="true"]').first();

    await expect(overlay).toBeVisible();
    await expect(windowNode).toBeVisible();
    await expect(closeButton).toBeVisible();
    await expect(page.locator('[data-settings-scaffold="true"]').first()).toBeVisible();
    const navCount = await navItems.count();
    expect(navCount).toBeGreaterThanOrEqual(viewport.minNavItems);
    const hasContentFrame = await contentFrame.isVisible().catch(() => false);
    const hasMobileDetailHeader = await mobileDetailHeader.isVisible().catch(() => false);
    if (!hasContentFrame && !hasMobileDetailHeader && navCount > 0) {
      await clickByUser(page, navItems.first());
    }
    const hasContentAfterSelect = await contentFrame.isVisible().catch(() => false);
    const hasMobileDetailAfterSelect = await mobileDetailHeader.isVisible().catch(() => false);
    expect(hasContentAfterSelect || hasMobileDetailAfterSelect).toBe(true);

    await clickByUser(page, closeButton);
    await expect(overlay).toHaveCount(0);
  }
});
