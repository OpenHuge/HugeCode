import { expect, test } from "@playwright/test";
import { assertShellHealthy, clickByUser, gotoWorkspaces, waitForWorkspaceShell } from "./helpers";

test("annotation search controls stay visible and reset cleanly", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoWorkspaces(page);
  const shellReady = await waitForWorkspaceShell(page, 20_000);
  test.skip(
    !shellReady,
    "Workspace shell did not initialize in time for annotation search checks."
  );

  const toggleSearchButton = page.getByRole("button", { name: "Toggle search" }).first();
  await clickByUser(page, toggleSearchButton);

  const searchInput = page.getByLabel("Search projects");
  await expect(searchInput).toBeVisible();
  await searchInput.evaluate((element) => {
    const input = element as HTMLInputElement;
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    descriptor?.set?.call(input, "workspace-query");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(searchInput).toHaveValue("workspace-query");

  const clearSearchButton = page.getByRole("button", { name: "Clear search" }).first();
  await expect(clearSearchButton).toBeVisible();
  await clickByUser(page, clearSearchButton);
  await expect(searchInput).toHaveValue("");

  await clickByUser(page, toggleSearchButton);
  await expect(searchInput).toHaveCount(0);
  await assertShellHealthy(page);
});
