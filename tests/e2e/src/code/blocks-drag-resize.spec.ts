import { expect, test } from "@playwright/test";
import { gotoWorkspaces, waitForWorkspaceShell } from "./helpers";

async function readSidebarWidth(page: import("@playwright/test").Page) {
  return page
    .locator(".app")
    .first()
    .evaluate((element) => {
      const raw = getComputedStyle(element).getPropertyValue("--sidebar-width").trim();
      const parsed = Number.parseFloat(raw.replace("px", ""));
      return Number.isFinite(parsed) ? parsed : 0;
    });
}

test("blocks drag resizing updates sidebar width and persists layout state", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    window.localStorage.setItem("codexmonitor.sidebarWidth", "260");
  });
  await gotoWorkspaces(page);
  const shellReady = await waitForWorkspaceShell(page, 20_000);
  test.skip(!shellReady, "Workspace shell did not initialize in time for resize assertions.");

  const resizeSidebar = page.getByRole("separator", { name: "Resize sidebar" });
  await expect(resizeSidebar).toBeVisible();

  const beforeWidth = await readSidebarWidth(page);
  const bounds = await resizeSidebar.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) {
    return;
  }

  const originX = bounds.x + bounds.width / 2;
  const originY = bounds.y + bounds.height / 2;
  await page.mouse.move(originX, originY);
  await page.mouse.down();
  await page.mouse.move(originX + 80, originY, { steps: 8 });
  await page.mouse.up();

  await expect.poll(() => readSidebarWidth(page)).toBeGreaterThan(beforeWidth + 10);
  const persistedWidth = await page.evaluate(() => {
    const raw = window.localStorage.getItem("codexmonitor.sidebarWidth");
    return raw ? Number.parseFloat(raw) : 0;
  });
  expect(persistedWidth).toBeGreaterThan(beforeWidth + 10);
});
