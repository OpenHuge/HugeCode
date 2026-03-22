import { expect, type Locator, test } from "@playwright/test";
import { openFixture } from "./fixtureHelpers";

function expectMenuAnchored(
  triggerBox: NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>,
  menuBox: NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>
) {
  const triggerRight = triggerBox.x + triggerBox.width;
  const menuRight = menuBox.x + menuBox.width;
  const horizontalOverlap = Math.max(
    0,
    Math.min(triggerRight, menuRight) - Math.max(triggerBox.x, menuBox.x)
  );
  expect(horizontalOverlap).toBeGreaterThanOrEqual(Math.min(triggerBox.width, menuBox.width) * 0.4);

  const gapBelow = Math.abs(menuBox.y - triggerBox.y - triggerBox.height);
  const gapAbove = Math.abs(triggerBox.y - (menuBox.y + menuBox.height));
  const anchoredToBottom = gapBelow <= 32;
  const anchoredToTop = gapAbove <= 32;

  expect(anchoredToBottom || anchoredToTop).toBe(true);
}

function expectMenuAlignedWithTrigger(
  triggerBox: NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>,
  menuBox: NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>
) {
  const menuRight = menuBox.x + menuBox.width;
  const triggerRight = triggerBox.x + triggerBox.width;
  const leftEdgeDelta = Math.abs(menuBox.x - triggerBox.x);
  const rightEdgeDelta = Math.abs(menuRight - triggerRight);
  expect(Math.min(leftEdgeDelta, rightEdgeDelta)).toBeLessThanOrEqual(20);
  expect(menuBox.width + 1).toBeGreaterThanOrEqual(triggerBox.width - 1);
}

async function ensureMenuVisible(trigger: Locator, label: string): Promise<Locator> {
  const resolveMenu = () => trigger.page().getByRole("listbox", { name: label });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const menu = resolveMenu();
    if (await menu.isVisible().catch(() => false)) {
      return menu;
    }
    try {
      await trigger.click({ timeout: 2_500 });
    } catch {
      await trigger.evaluate((element) => {
        (element as HTMLElement).click();
      });
    }
  }

  const menu = resolveMenu();
  await expect(menu).toBeVisible({ timeout: 10_000 });
  return menu;
}

async function safeBoundingBox(locator: Locator) {
  return locator.boundingBox().catch(() => null);
}

test("feature ds-select stays anchored to trigger across viewport changes", async ({ page }) => {
  test.setTimeout(60_000);
  await openFixture(page, {
    name: "composer-select",
    heading: "Composer Select Fixture",
    viewport: { width: 1280, height: 560 },
  });

  const modelTrigger = page.getByRole("button", { name: "Model" });
  await expect(modelTrigger).toBeVisible();
  const menu = await ensureMenuVisible(modelTrigger, "Model");

  const triggerBoxBefore = await safeBoundingBox(modelTrigger);
  const menuBoxBefore = await safeBoundingBox(menu);
  expect(triggerBoxBefore).not.toBeNull();
  expect(menuBoxBefore).not.toBeNull();
  if (!triggerBoxBefore || !menuBoxBefore) {
    return;
  }
  expectMenuAnchored(triggerBoxBefore, menuBoxBefore);
  expectMenuAlignedWithTrigger(triggerBoxBefore, menuBoxBefore);

  await page.setViewportSize({ width: 1090, height: 560 });
  const modelTriggerAfterResize = page.getByRole("button", { name: "Model" });
  await expect(modelTriggerAfterResize).toBeVisible({ timeout: 10_000 });
  await modelTriggerAfterResize.scrollIntoViewIfNeeded().catch(() => undefined);
  let menuAfterResize = await ensureMenuVisible(modelTriggerAfterResize, "Model");

  const triggerBoxAfter = await safeBoundingBox(modelTriggerAfterResize);
  let menuBoxAfter = await safeBoundingBox(menuAfterResize);
  if (!menuBoxAfter) {
    menuAfterResize = await ensureMenuVisible(modelTriggerAfterResize, "Model");
    menuBoxAfter = await safeBoundingBox(menuAfterResize);
  }
  expect(triggerBoxAfter).not.toBeNull();
  expect(menuBoxAfter).not.toBeNull();
  if (!triggerBoxAfter || !menuBoxAfter) {
    return;
  }
  expectMenuAnchored(triggerBoxAfter, menuBoxAfter);
  expectMenuAlignedWithTrigger(triggerBoxAfter, menuBoxAfter);
});
