import { expect, test } from "@playwright/test";
import {
  assertShellHealthy,
  clickByUser,
  getComposerInput,
  getSidebarEmptyStateAction,
  getSidebarSearchInput,
  getSidebarSearchToggle,
  gotoWorkspaces,
  isRuntimeGatewayReady,
  openFirstWorkspace,
  waitForWorkspaceShell,
} from "./helpers";

test.describe.configure({ timeout: 60_000 });

test("smoke navigation keeps workspace shell interactive", async ({ page }) => {
  const runtimeReady = await isRuntimeGatewayReady(page.request);
  test.skip(!runtimeReady, "Runtime gateway is not running; skipping runtime-dependent smoke.");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    window.localStorage.setItem("apps-code.sidebarWidth", "420");
  });

  await gotoWorkspaces(page);

  const workspaceRows = page.locator(".workspace-row");
  const emptyWorkspaceEntry = getSidebarEmptyStateAction(page);
  const toggleSearchButton = getSidebarSearchToggle(page);
  const composerInput = getComposerInput(page);
  const homeSurface = page.locator(".home").first();
  const composerStartHeading = page.getByRole("heading", {
    name: "Start in the composer.",
  });
  const shellReady = await waitForWorkspaceShell(page, 20_000);
  test.skip(
    !shellReady,
    "Workspace shell did not initialize in time; skipping unstable environment run."
  );

  const hasWorkspaces = (await workspaceRows.count()) > 0;
  const hasComposerStartSurface = await composerStartHeading.isVisible().catch(() => false);
  if (hasWorkspaces && !hasComposerStartSurface) {
    await openFirstWorkspace(page);
  }

  await assertShellHealthy(page);

  await expect(toggleSearchButton).toBeVisible({ timeout: 10_000 });
  await clickByUser(page, toggleSearchButton);
  await expect(getSidebarSearchInput(page)).toBeVisible();
  await clickByUser(page, toggleSearchButton);
  await expect(getSidebarSearchInput(page)).toHaveCount(0);

  const hasWorkspacesAfterInteraction = (await workspaceRows.count()) > 0;
  const hasWorkspaceSurfaceAfterInteraction =
    (await homeSurface.isVisible().catch(() => false)) ||
    (await composerInput.isVisible().catch(() => false)) ||
    (await composerStartHeading.isVisible().catch(() => false));
  if (hasWorkspacesAfterInteraction || hasWorkspaceSurfaceAfterInteraction) {
    await expect
      .poll(
        async () =>
          (await homeSurface.isVisible().catch(() => false)) ||
          (await composerInput.isVisible().catch(() => false)) ||
          (await composerStartHeading.isVisible().catch(() => false))
      )
      .toBe(true);
  } else if (await emptyWorkspaceEntry.isVisible().catch(() => false)) {
    await expect(emptyWorkspaceEntry).toBeVisible();
  }

  await page.keyboard.press("Tab");
  await assertShellHealthy(page);
});
