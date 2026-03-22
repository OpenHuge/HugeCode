import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 60_000 });

test("first navigation shows a visible boot shell before the app chunk resolves", async ({
  page,
}) => {
  await page.goto("/workspaces?boot-smoke=1", { waitUntil: "commit" });

  const bootStatus = page.locator('[data-app-boot="workspace"]').first();
  await expect(bootStatus).toBeVisible();
  await expect(bootStatus).toContainText("Loading the workspace shell and runtime services.");

  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("#root")).toHaveCount(1);
});
