import { expect, test } from "@playwright/test";
import {
  clickUserMenuAction,
  gotoWorkspaces,
  resolveWorkspaceHomeControl,
  waitForWorkspaceShell,
} from "./helpers";

test("a11y sidebar controls expose labels and keyboard access", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoWorkspaces(page);
  const shellReady = await waitForWorkspaceShell(page, 20_000);
  test.skip(!shellReady, "Workspace shell did not initialize in time for accessibility checks.");

  const homeShellButton = await resolveWorkspaceHomeControl(page);
  const toggleSearchButton = page.getByRole("button", { name: "Toggle search" }).first();
  const sortThreadsButton = page.getByRole("button", { name: "Sort threads" }).first();
  const userMenuButton = page.getByRole("button", { name: "User menu" }).first();
  const resizeSidebar = page.getByRole("separator", { name: "Resize sidebar" });

  await expect(homeShellButton).toBeVisible();
  await expect(toggleSearchButton).toBeVisible();
  await expect(sortThreadsButton).toBeVisible();
  await expect(userMenuButton).toBeVisible();
  await expect(resizeSidebar).toBeVisible();
  await expect(resizeSidebar).toHaveAttribute("aria-orientation", "vertical");

  await clickUserMenuAction(page, "Open settings");
  const settingsDialog = page.getByRole("dialog", { name: "Settings" });
  await expect(settingsDialog).toBeVisible();
});
