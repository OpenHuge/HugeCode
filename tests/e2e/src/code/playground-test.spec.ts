import { test, expect } from "@playwright/test";
import {
  assertPageResponsive,
  clickByDom,
  getComposerInput,
  getWorkspaceCard,
  gotoWorkspaces,
  isRuntimeGatewayReady,
  waitForCurrentTurnState,
  waitForMessageText,
  waitForWorkspaceShell,
} from "./helpers";

test("Playground workspace interactions", async ({ page }) => {
  const runtimeReady = await isRuntimeGatewayReady(page.request);
  test.skip(!runtimeReady, "Runtime gateway is not running");

  // Collect errors from the moment the page loads
  const errors: string[] = [];
  page.on("pageerror", (err) => {
    errors.push(err.message);
  });

  // Navigate to workspaces, then open the playground
  await gotoWorkspaces(page);
  const playgroundRow = getWorkspaceCard(page, "playground").locator(".workspace-row").first();
  await expect(playgroundRow).toBeVisible({ timeout: 15_000 });
  await clickByDom(playgroundRow);

  const shellReady = await waitForWorkspaceShell(page, 15_000);
  expect(shellReady).toBe(true);
  await assertPageResponsive(page);

  // 1. Verify the VS Code dropdown is present
  const vsCodeBtn = page.getByRole("button", { name: /VS Code/i }).first();
  if ((await vsCodeBtn.count()) > 0) {
    await vsCodeBtn.click();
    await page.waitForTimeout(300);
    // Dismiss any dropdown that may have opened
    await page.keyboard.press("Escape");
  }

  // 2. Submit a message to create a thread and surface the right‑panel
  const composerInput = getComposerInput(page);
  if ((await composerInput.count()) > 0) {
    const token = `PLAYGROUND_E2E_${Date.now()}`;
    await composerInput.fill(`Reply with exactly: ${token}`);
    await page.keyboard.press("Enter");
    await waitForCurrentTurnState(page, "complete", 60_000);
    await waitForMessageText(page, token, 15_000);
  }

  // 3. Open Context rail (only visible once a thread exists)
  const contextTab = page.locator('button[role="tab"]:has-text("Context")').first();
  if ((await contextTab.count()) > 0) {
    await contextTab.click();
    await page.waitForTimeout(500);

    // 4. Open Changes tab if available
    const changesTab = page.locator('button[role="tab"]:has-text("Changes")').first();
    if ((await changesTab.count()) > 0 && (await changesTab.isVisible())) {
      await changesTab.click();
      await page.waitForTimeout(500);
    }

    // 5. Open Files tab if available
    const filesTab = page.locator('button[role="tab"]:has-text("Files")').first();
    if ((await filesTab.count()) > 0 && (await filesTab.isVisible())) {
      await filesTab.click();
      await page.waitForTimeout(500);
    }
  }

  // 6. Terminal toggle
  const terminalBtn = page.getByRole("button", { name: /terminal/i }).first();
  if ((await terminalBtn.count()) > 0) {
    await terminalBtn.click();
    await page.waitForTimeout(500);
  }

  await assertPageResponsive(page);

  // Filter out non‑fatal dev‑environment noise
  const fatal = errors.filter(
    (e) => !e.includes("Failed to load resource") && !e.includes("favicon")
  );
  expect(fatal, `Unexpected page errors: ${fatal.join("; ")}`).toHaveLength(0);
});
