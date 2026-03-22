import { expect, test } from "@playwright/test";
import { openFixture } from "./fixtureHelpers";

test("feature compact gated tabs show inline guidance and auto-dismiss", async ({ page }) => {
  await openFixture(page, {
    name: "shell-controls",
    heading: "Shell Controls Fixture",
    viewport: { width: 430, height: 900 },
  });

  const homeTab = page.getByRole("button", { name: "Home" });
  const workspacesTab = page.getByRole("button", { name: "Workspaces" });
  const missionsTab = page.getByRole("button", { name: "Missions" });
  const reviewTab = page.getByRole("button", { name: "Review" });
  const hint = page.locator(".tabbar-hint");

  await expect(homeTab).toHaveAttribute("aria-current", "page");
  await expect(missionsTab).toHaveAttribute("data-gated", "true");
  await expect(reviewTab).toHaveAttribute("data-gated", "true");
  await expect(missionsTab.locator(".tabbar-lock")).toHaveCount(1);
  await expect(reviewTab.locator(".tabbar-lock")).toHaveCount(1);

  await missionsTab.click();
  await expect(workspacesTab).toHaveAttribute("aria-current", "page");
  await expect(hint).toBeVisible();
  await expect.poll(async () => (await hint.textContent())?.trim().length ?? 0).toBeGreaterThan(0);

  await page.waitForTimeout(1500);
  await reviewTab.click();
  await expect(workspacesTab).toHaveAttribute("aria-current", "page");

  await page.waitForTimeout(1500);
  await expect(hint).toBeVisible();

  await page.waitForTimeout(1200);
  await expect(hint).toHaveCount(0);
});
