import { expect, test } from "@playwright/test";
import {
  clickWrapEdge,
  getComposerSelectWrap,
  openComposerSelectFixture,
} from "./composerSelectFixtureHelpers";

type HitAreaCase = {
  wrapName: "access" | "model" | "effort" | "execution";
  triggerName: string;
  menuName: string;
  fullWrapHitArea: boolean;
};

const HIT_AREA_CASES: HitAreaCase[] = [
  {
    wrapName: "model",
    triggerName: "Model",
    menuName: "Model",
    fullWrapHitArea: true,
  },
  {
    wrapName: "effort",
    triggerName: "Thinking mode",
    menuName: "Thinking mode",
    fullWrapHitArea: true,
  },
  {
    wrapName: "access",
    triggerName: "Agent access",
    menuName: "Agent access",
    fullWrapHitArea: false,
  },
  {
    wrapName: "execution",
    triggerName: "Execution path",
    menuName: "Execution path",
    fullWrapHitArea: true,
  },
];

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
];

async function closeMenu(
  page: import("@playwright/test").Page,
  trigger: import("@playwright/test").Locator
) {
  await page.keyboard.press("Escape");
  if ((await trigger.getAttribute("aria-expanded")) === "true") {
    await trigger.click();
  }
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
}

test("feature composer select capsules open from full hit area across desktop and phone", async ({
  page,
}) => {
  for (const viewport of VIEWPORTS) {
    await openComposerSelectFixture(page, viewport);

    for (const item of HIT_AREA_CASES) {
      const wrap = getComposerSelectWrap(page, item.wrapName);
      const trigger = page.getByRole("button", { name: item.triggerName }).first();
      await expect(wrap).toBeVisible();
      await expect(trigger).toBeVisible();

      if (item.fullWrapHitArea) {
        await clickWrapEdge(wrap, "left");
      } else {
        await trigger.click();
      }
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByRole("listbox", { name: item.menuName }).last()).toBeVisible();
      await closeMenu(page, trigger);

      if (item.fullWrapHitArea) {
        await clickWrapEdge(wrap, "right");
      } else {
        await trigger.click();
      }
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByRole("listbox", { name: item.menuName }).last()).toBeVisible();
      await closeMenu(page, trigger);
    }
  }
});
