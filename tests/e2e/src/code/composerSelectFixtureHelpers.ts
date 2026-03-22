import { expect, type Locator, type Page } from "@playwright/test";
import { openFixture } from "./fixtureHelpers";

export async function openComposerSelectFixture(
  page: Page,
  viewport: { width: number; height: number }
) {
  await openFixture(page, {
    name: "composer-select",
    heading: "Composer Select Fixture",
    viewport,
  });
}

export function getComposerSelectWrap(
  page: Page,
  name: "access" | "model" | "effort" | "execution"
): Locator {
  return page.locator(`.composer-select-wrap--${name}`).first();
}

export async function clickWrapEdge(wrap: Locator, edge: "left" | "right") {
  const box = await wrap.boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }
  await wrap.click({
    position: {
      x:
        edge === "left"
          ? Math.min(Math.max(16, Math.round(box.width * 0.24)), Math.round(box.width - 16))
          : Math.max(16, Math.round(box.width - 16)),
      y: Math.round(box.height / 2),
    },
  });
}

export async function ensureMenuVisible(trigger: Locator, label: string): Promise<Locator> {
  const resolveMenu = () => trigger.page().getByRole("listbox", { name: label }).last();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const menu = resolveMenu();
    if (await menu.isVisible().catch(() => false)) {
      return menu;
    }
    await trigger.click({ timeout: 2_500 }).catch(() => undefined);
  }

  const menu = resolveMenu();
  await expect(menu).toBeVisible({ timeout: 10_000 });
  return menu;
}

export async function expectMenuAlignedWithTrigger(trigger: Locator, menu: Locator) {
  const triggerBox = await trigger.boundingBox();
  const menuBox = await menu.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(menuBox).not.toBeNull();
  if (!triggerBox || !menuBox) {
    return;
  }

  const menuRight = menuBox.x + menuBox.width;
  const triggerRight = triggerBox.x + triggerBox.width;
  const leftEdgeDelta = Math.abs(menuBox.x - triggerBox.x);
  const rightEdgeDelta = Math.abs(menuRight - triggerRight);
  expect(Math.min(leftEdgeDelta, rightEdgeDelta)).toBeLessThanOrEqual(20);
  expect(menuBox.width + 1).toBeGreaterThanOrEqual(triggerBox.width - 1);
}

export async function expectMenuAnchored(trigger: Locator, menu: Locator) {
  const triggerBox = await trigger.boundingBox();
  const menuBox = await menu.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(menuBox).not.toBeNull();
  if (!triggerBox || !menuBox) {
    return;
  }

  const triggerRight = triggerBox.x + triggerBox.width;
  const menuRight = menuBox.x + menuBox.width;
  const horizontalOverlap = Math.max(
    0,
    Math.min(triggerRight, menuRight) - Math.max(triggerBox.x, menuBox.x)
  );
  expect(horizontalOverlap).toBeGreaterThanOrEqual(Math.min(triggerBox.width, menuBox.width) * 0.4);

  const gapBelow = Math.abs(menuBox.y - triggerBox.y - triggerBox.height);
  const gapAbove = Math.abs(triggerBox.y - (menuBox.y + menuBox.height));
  expect(gapBelow <= 32 || gapAbove <= 32).toBe(true);
}

export async function expectMenuWidthAlignedWithTrigger(selectTrigger: Locator, menu: Locator) {
  const triggerBox = await selectTrigger.boundingBox();
  const menuBox = await menu.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(menuBox).not.toBeNull();
  if (!triggerBox || !menuBox) {
    return;
  }
  expect(menuBox.width + 1).toBeGreaterThanOrEqual(triggerBox.width - 1);
  expect(menuBox.width).toBeLessThanOrEqual(
    Math.max(triggerBox.width + 120, triggerBox.width * 2.4)
  );
}

export async function expectLabelNotClipped(selectTrigger: Locator) {
  const markedLabel = selectTrigger.locator("[data-ui-select-label='true']").first();
  const target = (await markedLabel.count()) > 0 ? markedLabel : selectTrigger;
  await expect(target).toBeVisible();
  const fits = await target.evaluate((element) => {
    const target = element as HTMLElement;
    return target.scrollWidth <= target.clientWidth + 1;
  });
  expect(fits).toBe(true);
}

export async function expectCaretInsideTrigger(selectTrigger: Locator) {
  const caret = selectTrigger.locator("[data-ui-select-caret='true']").first();
  if ((await caret.count()) === 0) {
    await expect(selectTrigger).toBeVisible();
    return;
  }
  await expect(caret).toBeVisible();
  const triggerBox = await selectTrigger.boundingBox();
  const caretBox = await caret.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(caretBox).not.toBeNull();
  if (!triggerBox || !caretBox) {
    return;
  }
  expect(caretBox.x).toBeGreaterThanOrEqual(triggerBox.x - 1);
  expect(caretBox.x + caretBox.width).toBeLessThanOrEqual(triggerBox.x + triggerBox.width + 1);
}
