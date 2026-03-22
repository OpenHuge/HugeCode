import { expect, test } from "@playwright/test";
import {
  clickByDom,
  gotoWorkspaces,
  isRuntimeGatewayReady,
  openFirstWorkspace,
  waitForWorkspaceShell,
} from "./helpers";

test.describe.configure({ timeout: 90_000 });

test("workspace rail stays outside the composer footer and remains interactive", async ({
  page,
}) => {
  const runtimeReady = await isRuntimeGatewayReady(page.request);
  test.skip(!runtimeReady, "Runtime gateway is not running; skipping runtime-dependent test.");

  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoWorkspaces(page);
  const shellReady = await waitForWorkspaceShell(page, 20_000);
  test.skip(!shellReady, "Workspace shell is not ready in this environment.");
  await openFirstWorkspace(page);

  const workspaceFooter = page.locator('[data-composer-workspace-footer="true"]').first();
  const nestedWorkspaceFooter = page
    .locator('[data-composer-footer-bar="true"] [data-composer-workspace-footer="true"]')
    .first();

  await expect(workspaceFooter).toBeVisible();
  await expect(nestedWorkspaceFooter).toHaveCount(0);

  const accessButton = page.getByRole("button", { name: "Agent access" }).first();
  await expect(accessButton).toBeVisible();
  await accessButton.click();
  const readOnlyOption = page.getByRole("option", { name: "Read only" }).first();
  await expect(readOnlyOption).toBeVisible();
  await clickByDom(readOnlyOption);

  const branchButton = page.getByRole("button", { name: "Branch & worktree" }).first();
  await expect(branchButton).toBeVisible();
  await branchButton.click();
  await expect(
    page.getByRole("textbox", { name: "Search branches or pull requests" }).first()
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("textbox", { name: "Search branches or pull requests" }).first()
  ).toHaveCount(0);

  await branchButton.click();
  await expect(
    page.getByRole("textbox", { name: "Search branches or pull requests" }).first()
  ).toBeVisible();
});
