import { expect, test } from "@playwright/test";
import { openComposerSelectFixture } from "./composerSelectFixtureHelpers";

test("feature ds-select keeps options reachable in compact viewport", async ({ page }) => {
  const viewport = { width: 1280, height: 320 };
  await openComposerSelectFixture(page, viewport);

  const accessTrigger = page.getByRole("button", { name: "Agent access" }).first();
  await expect(accessTrigger).toBeVisible();

  await accessTrigger.click();

  const menu = page.getByRole("listbox", { name: "Agent access" }).last();
  await expect(menu).toBeVisible();

  const isPortaled = await menu.evaluate((element) => element.parentElement === document.body);
  expect(isPortaled).toBe(true);

  const menuBounds = await menu.boundingBox();
  expect(menuBounds).not.toBeNull();
  if (!menuBounds) {
    return;
  }

  const top = menuBounds.y;
  const bottom = menuBounds.y + menuBounds.height;
  const width = menuBounds.width;
  expect(top).toBeGreaterThanOrEqual(-1);
  expect(bottom).toBeLessThanOrEqual(viewport.height + 1);
  expect(width).toBeLessThanOrEqual(420);

  const fullAccessOption = page.getByRole("option", { name: /Full access/i }).first();
  await fullAccessOption.click();
  await expect(accessTrigger).toContainText("Full access");
});
