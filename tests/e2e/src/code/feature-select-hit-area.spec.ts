import { expect, test } from "@playwright/test";
import {
  clickWrapEdge,
  getComposerSelectWrap,
  openComposerSelectFixture,
} from "./composerSelectFixtureHelpers";

test("feature ds-select opens from full composer capsule hit area", async ({ page }) => {
  await openComposerSelectFixture(page, { width: 1600, height: 720 });

  const effortTrigger = page.getByRole("button", { name: "Thinking mode" });
  await clickWrapEdge(getComposerSelectWrap(page, "effort"), "left");
  const effortMenu = page.getByRole("listbox", { name: "Thinking mode" });
  await expect(effortTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(effortMenu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(effortTrigger).toHaveAttribute("aria-expanded", "false");

  const accessTrigger = page.getByRole("button", { name: "Agent access" });
  await clickWrapEdge(getComposerSelectWrap(page, "access"), "right");
  const accessMenu = page.getByRole("listbox", { name: "Agent access" });
  await expect(accessTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(accessMenu).toBeVisible();
});
