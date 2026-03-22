import { expect, test } from "@playwright/test";
import {
  clickByUser,
  gotoWorkspaces,
  isRuntimeGatewayReady,
  openFirstWorkspace,
  waitForWorkspaceShell,
} from "./helpers";

test("sidebar and home shell scaffolds stay stable without reviving legacy wrappers", async ({
  page,
}) => {
  const runtimeReady = await isRuntimeGatewayReady(page.request);
  test.skip(
    !runtimeReady,
    "Runtime gateway is not running; skipping runtime-dependent shell test."
  );

  await page.setViewportSize({ width: 1440, height: 960 });
  await gotoWorkspaces(page);

  const shellReady = await waitForWorkspaceShell(page, 20_000);
  test.skip(!shellReady, "Workspace shell is not ready in this environment.");
  await openFirstWorkspace(page);

  await expect(page.getByRole("complementary").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Go to Home" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide sidebar" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "New project" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Toggle search" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Sort threads" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "User menu" }).first()).toBeVisible();
  await expect(page.getByRole("separator", { name: "Resize sidebar" }).first()).toBeVisible();

  const sidebarHeaderActionsShell = await page
    .locator(".sidebar-header-actions")
    .first()
    .evaluate((element) => {
      const style = window.getComputedStyle(element);
      const borderWidths = [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ];
      const cornerRadii = [
        style.borderTopLeftRadius,
        style.borderTopRightRadius,
        style.borderBottomRightRadius,
        style.borderBottomLeftRadius,
      ];

      return {
        hasBorder: borderWidths.some((value) => Number.parseFloat(value) > 0),
        hasRoundedShell: cornerRadii.some((value) => Number.parseFloat(value) > 0),
        hasShadow: style.boxShadow !== "none",
        backgroundColor: style.backgroundColor,
      };
    });

  expect(sidebarHeaderActionsShell.hasBorder).toBe(false);
  expect(sidebarHeaderActionsShell.hasRoundedShell).toBe(false);
  expect(sidebarHeaderActionsShell.hasShadow).toBe(false);
  expect(sidebarHeaderActionsShell.backgroundColor).toBe("rgba(0, 0, 0, 0)");

  await clickByUser(page, page.getByRole("button", { name: "Go to Home" }).first());
  await expect(page.locator("[data-workspace-shell]").first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Workspace sections" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Home" }).first()).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Operator overview" }).first()
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Browse the shared workspace roster" }).first()
  ).toBeVisible();
});
