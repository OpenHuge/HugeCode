import { expect, test } from "@playwright/test";
import {
  clickWrapEdge,
  getComposerSelectWrap,
  openComposerSelectFixture,
} from "./composerSelectFixtureHelpers";

test("composer select fixture exposes stable select controls", async ({ page }) => {
  await openComposerSelectFixture(page, { width: 1280, height: 720 });

  const reasoningTrigger = page.getByRole("button", { name: "Thinking mode" });
  await clickWrapEdge(getComposerSelectWrap(page, "effort"), "left");
  await expect(reasoningTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("listbox", { name: "Thinking mode" })).toBeVisible();
});
