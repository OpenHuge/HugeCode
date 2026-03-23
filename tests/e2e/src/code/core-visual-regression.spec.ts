import { expect, test } from "@playwright/test";
import {
  gotoWorkspaces,
  isRuntimeGatewayReady,
  openFirstThread,
  openFirstWorkspace,
  setAppTheme,
  stabilizeVisualSnapshot,
  waitForAppBootFallbackToClear,
  waitForSharedShellMissionSummaryToSettle,
  waitForWorkspaceShell,
} from "./helpers";

const THEMES = ["dark", "light", "dim"] as const;
const VIEWPORT = { width: 1440, height: 960 };

test.describe.configure({ mode: "serial", timeout: 90_000 });

for (const theme of THEMES) {
  test(`core visual baseline captures welcome shell in ${theme}`, async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await gotoWorkspaces(page);
    await stabilizeVisualSnapshot(page);
    await waitForAppBootFallbackToClear(page);

    const shellReady = await waitForWorkspaceShell(page, 20_000);
    expect(shellReady).toBe(true);
    await waitForSharedShellMissionSummaryToSettle(page);

    await setAppTheme(page, theme);

    const shell = page.locator("[data-workspace-shell]").first();
    await expect(shell).toBeVisible();
    await expect(shell).toHaveScreenshot(`core-welcome-${theme}.png`, {
      animations: "disabled",
      caret: "hide",
      mask: [page.locator(".thread-time"), page.locator(".working-timer-clock")],
    });
  });

  test(`core visual baseline captures workspace shell in ${theme}`, async ({ page }) => {
    const runtimeReady = await isRuntimeGatewayReady(page.request);
    test.skip(
      !runtimeReady,
      "Runtime gateway is not running; skipping runtime-dependent visual baseline."
    );

    await page.setViewportSize(VIEWPORT);
    await gotoWorkspaces(page);
    await stabilizeVisualSnapshot(page);
    await waitForAppBootFallbackToClear(page);

    const shellReady = await waitForWorkspaceShell(page, 20_000);
    expect(shellReady).toBe(true);

    await openFirstWorkspace(page);
    const threadOpened = await openFirstThread(page);
    test.skip(!threadOpened, "Workspace thread list is not ready in this environment.");

    await setAppTheme(page, theme);

    const main = page.locator(".main").first();
    await expect(main).toBeVisible();
    await expect(main).toHaveScreenshot(`core-workspace-shell-${theme}.png`, {
      animations: "disabled",
      caret: "hide",
      mask: [page.locator(".thread-time"), page.locator(".working-timer-clock")],
    });
  });

  test(`core visual baseline captures execution detail in ${theme}`, async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto("/fixtures.html?fixture=execution-detail", { waitUntil: "domcontentloaded" });
    await stabilizeVisualSnapshot(page);
    await waitForAppBootFallbackToClear(page);
    await setAppTheme(page, theme);

    const fixture = page.locator('[data-visual-fixture="execution-detail"]').first();
    await expect(fixture).toBeVisible();
    await expect(fixture).toHaveScreenshot(`core-execution-detail-${theme}.png`, {
      animations: "disabled",
      caret: "hide",
    });
  });

  test(`core visual capture records git inspector detail fixture in ${theme}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/fixtures.html?fixture=git-inspector-detail", {
      waitUntil: "domcontentloaded",
    });
    await stabilizeVisualSnapshot(page);
    await waitForAppBootFallbackToClear(page);
    await setAppTheme(page, theme);

    const fixture = page.locator('[data-visual-fixture="git-inspector-detail"]').first();
    await expect(fixture).toBeVisible();
    await expect(page.getByTestId("git-inspector-plan-surface")).toBeVisible();
    await expect(page.getByTestId("git-inspector-diff-surface")).toBeVisible();
    await expect(
      page.getByText("Deterministic visual regression scene", { exact: false })
    ).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach(`git-inspector-detail-${theme}`, {
      body: screenshot,
      contentType: "image/png",
    });
  });
}
