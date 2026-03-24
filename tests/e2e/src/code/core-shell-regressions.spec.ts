import { expect, test } from "@playwright/test";
import {
  assertShellHealthy,
  clickUserMenuAction,
  gotoWorkspaces,
  isRuntimeGatewayReady,
  waitForWorkspaceShell,
} from "./helpers";

test.describe.configure({ timeout: 90_000 });

test("settings dialog reopens cleanly after reload", async ({ page }) => {
  const runtimeReady = await isRuntimeGatewayReady(page.request);
  test.skip(!runtimeReady, "Runtime gateway is not running; skipping runtime-dependent test.");

  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoWorkspaces(page);
  const shellReady = await waitForWorkspaceShell(page);
  test.skip(!shellReady, "Workspace shell is not ready in this environment.");

  const settingsDialog = page.getByRole("dialog", { name: "Settings" });

  await clickUserMenuAction(page, "Open settings");
  await expect(settingsDialog).toBeVisible();
  await expect(settingsDialog).toHaveCount(1);

  await page.reload({ waitUntil: "domcontentloaded" });
  const shellReadyAfterReload = await waitForWorkspaceShell(page);
  expect(shellReadyAfterReload).toBe(true);

  await clickUserMenuAction(page, "Open settings");
  await expect(settingsDialog).toBeVisible();
});

test("debug panel remains interactive across repeated open and escape cycles", async ({ page }) => {
  const runtimeReady = await isRuntimeGatewayReady(page.request);
  test.skip(!runtimeReady, "Runtime gateway is not running; skipping runtime-dependent test.");

  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoWorkspaces(page);
  const shellReady = await waitForWorkspaceShell(page);
  test.skip(!shellReady, "Workspace shell is not ready in this environment.");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await clickUserMenuAction(page, "Open debug log");
    await expect(page.locator(".app")).toBeVisible();
    if (attempt === 0) {
      const debugPanel = page.locator(".debug-panel").first();
      await expect(debugPanel).toBeVisible();
      const resizer = debugPanel.locator("button.debug-panel-resizer").first();
      if ((await resizer.count()) > 0) {
        await expect(resizer).toBeVisible();
      }
    }
    await page.keyboard.press("Escape");
  }

  await assertShellHealthy(page);
});
