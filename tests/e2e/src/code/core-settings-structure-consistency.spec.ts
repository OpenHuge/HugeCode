import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  clickByUser,
  gotoWorkspaces,
  isRuntimeGatewayReady,
  openUserMenu,
  waitForWorkspaceShell,
} from "./helpers";

const VIEWPORTS = [{ name: "desktop", width: 1280, height: 720, minNavItems: 8 }];

async function findVisibleButton(page: Page, name: string): Promise<Locator | null> {
  const buttons = page.getByRole("button", { name });
  const count = await buttons.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = buttons.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }
  return null;
}

async function findVisibleSettingsEntry(page: Page): Promise<Locator | null> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const manageAccountsButton = await findVisibleButton(page, "Manage Accounts & Billing");
    if (manageAccountsButton) {
      return manageAccountsButton;
    }
    const openSettingsButton = await findVisibleButton(page, "Open settings");
    if (openSettingsButton) {
      return openSettingsButton;
    }
    await page.waitForTimeout(250);
  }
  return null;
}

async function openSettings(page: Page, viewportName: string): Promise<boolean> {
  const existingCloseButton = page.getByRole("button", { name: "Close settings" }).first();
  if (await existingCloseButton.isVisible().catch(() => false)) {
    await clickByUser(page, existingCloseButton);
    await expect(page.locator(".settings-overlay")).toHaveCount(0);
  }

  if (viewportName === "phone") {
    const settingsTab = await findVisibleButton(page, "Settings");
    if (settingsTab) {
      await clickByUser(page, settingsTab);
    }

    const homeSettingsTrigger = page.getByTestId("home-settings-trigger").first();
    if (await homeSettingsTrigger.isVisible().catch(() => false)) {
      await clickByUser(page, homeSettingsTrigger);
      return true;
    }
  }

  const userMenu = await findVisibleButton(page, "User menu");
  if (userMenu) {
    await openUserMenu(page);

    const settingsEntry = await findVisibleSettingsEntry(page);
    if (settingsEntry) {
      await clickByUser(page, settingsEntry);
      return true;
    }
  }

  if (viewportName === "phone") {
    return false;
  }

  throw new Error("Unable to locate a settings entry point in the workspace shell.");
}

test("core settings structure remains consistent on desktop", async ({ page }) => {
  test.setTimeout(90_000);
  const runtimeReady = await isRuntimeGatewayReady(page.request);
  test.skip(!runtimeReady, "Runtime gateway is not running; skipping runtime-dependent test.");

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await gotoWorkspaces(page);
    const shellReady = await waitForWorkspaceShell(page);
    test.skip(!shellReady, "Workspace shell is not ready in this environment.");

    const settingsOpened = await openSettings(page, viewport.name);
    if (!settingsOpened) {
      continue;
    }

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
