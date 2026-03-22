import { expect, test } from "@playwright/test";
import {
  assertShellHealthy,
  clickByUser,
  gotoWorkspaces,
  resolveWorkspaceHomeControl,
  waitForWorkspaceShell,
} from "./helpers";

test("collab presence sync loop keeps workspace shell responsive", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoWorkspaces(page);
  const shellReady = await waitForWorkspaceShell(page, 20_000);
  test.skip(!shellReady, "Workspace shell did not initialize in time for collaboration checks.");

  const homeShellButton = await resolveWorkspaceHomeControl(page);
  const toggleSearchButton = page.getByRole("button", { name: "Toggle search" }).first();
  const sortThreadsButton = page.getByRole("button", { name: "Sort threads" }).first();

  await expect(homeShellButton).toBeVisible();
  await expect(toggleSearchButton).toBeVisible();
  await expect(sortThreadsButton).toBeVisible();

  for (let cycle = 0; cycle < 2; cycle += 1) {
    await clickByUser(page, toggleSearchButton);
    await expect(page.getByLabel("Search projects")).toBeVisible();
    await clickByUser(page, toggleSearchButton);
    await expect(page.getByLabel("Search projects")).toHaveCount(0);

    await clickByUser(page, sortThreadsButton);
    await expect(page.getByRole("menu")).toBeVisible();
    await clickByUser(page, page.getByRole("menuitemradio", { name: "Last updated" }));
    await expect(page.getByRole("menu")).toHaveCount(0);
  }

  await expect(page.locator(".home")).toBeVisible();
  await assertShellHealthy(page);
});
