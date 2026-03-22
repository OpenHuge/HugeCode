import { expect, test } from "@playwright/test";
import { gotoWorkspaces, isRuntimeGatewayReady, openFirstWorkspace } from "./helpers";

test("feature file-tree rows keep full-width hit area", async ({ page }) => {
  const runtimeReady = await isRuntimeGatewayReady(page.request);
  test.skip(!runtimeReady, "Runtime gateway is not running; skipping runtime-dependent test.");

  await page.setViewportSize({ width: 1280, height: 720 });
  await gotoWorkspaces(page);
  test.skip(
    (await page.locator(".workspace-row").count()) === 0,
    "No workspace fixtures available."
  );
  await openFirstWorkspace(page);

  const fileTreePanel = page.locator(".file-tree-panel").first();
  test.skip(
    !(await fileTreePanel.isVisible().catch(() => false)),
    "File tree panel is not visible."
  );

  const row = fileTreePanel.locator(".file-tree-row").first();
  test.skip((await row.count()) === 0, "No file-tree rows are available in this fixture.");
  await expect(row).toBeVisible();

  const box = await row.boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }

  const clickAt = async (x: number) => {
    await row.click({
      position: {
        x,
        y: Math.max(6, Math.floor(box.height / 2)),
      },
    });
    await expect(row).toBeFocused();
  };

  await clickAt(8);
  await clickAt(Math.max(8, Math.floor(box.width - 8)));

  expect(box.width).toBeGreaterThanOrEqual(160);
  expect(box.height).toBeGreaterThanOrEqual(28);
});
