import { expect, type Locator, test } from "@playwright/test";
import {
  expectMenuAlignedWithTrigger,
  openComposerSelectFixture,
} from "./composerSelectFixtureHelpers";

type AlignmentCase = {
  triggerName: string;
  menuName: string;
};

const ALIGNMENT_CASES: AlignmentCase[] = [
  { triggerName: "Model", menuName: "Model" },
  { triggerName: "Thinking mode", menuName: "Thinking mode" },
  { triggerName: "Agent access", menuName: "Agent access" },
  { triggerName: "Execution path", menuName: "Execution path" },
];

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 800, height: 720 },
  { width: 390, height: 844 },
];

async function assertMenuAligned(trigger: Locator, menu: Locator) {
  const triggerBox = await trigger.boundingBox();
  const menuBox = await menu.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(menuBox).not.toBeNull();
  if (!triggerBox || !menuBox) {
    return;
  }

  const viewport = trigger.page().viewportSize();
  const viewportWidth = viewport?.width ?? 1280;
  const viewportHeight = viewport?.height ?? 720;
  const startDelta = Math.abs(menuBox.x - triggerBox.x);
  const endDelta = Math.abs(menuBox.x + menuBox.width - (triggerBox.x + triggerBox.width));
  const gapBelow = Math.abs(menuBox.y - (triggerBox.y + triggerBox.height));
  const gapAbove = Math.abs(triggerBox.y - (menuBox.y + menuBox.height));
  const verticalGap = Math.min(gapBelow, gapAbove);

  expect(Math.min(startDelta, endDelta)).toBeLessThanOrEqual(4);
  expect(verticalGap).toBeLessThanOrEqual(10);
  expect(menuBox.width + 3).toBeGreaterThanOrEqual(triggerBox.width);
  expect(menuBox.x).toBeGreaterThanOrEqual(7);
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewportWidth - 7);
  expect(menuBox.y).toBeGreaterThanOrEqual(7);
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewportHeight - 7);
}

test("feature select alignment matrix remains stable on desktop, middle, and phone viewports", async ({
  page,
}) => {
  for (const viewport of VIEWPORTS) {
    await openComposerSelectFixture(page, viewport);

    for (const item of ALIGNMENT_CASES) {
      const trigger = page.getByRole("button", { name: item.triggerName }).first();
      await expect(trigger).toBeVisible();
      await trigger.click();

      const menu = page.getByRole("listbox", { name: item.menuName }).last();
      await expect(menu).toBeVisible();
      await assertMenuAligned(trigger, menu);
      await expectMenuAlignedWithTrigger(trigger, menu);

      await page.keyboard.press("Escape");
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
    }
  }
});
