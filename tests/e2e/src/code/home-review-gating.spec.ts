import { expect, test } from "@playwright/test";
import { getComposerInput, getSendButton, gotoWorkspaces } from "./helpers";

test("home /review stays on launchpad and shows desktop-only guidance in web mode", async ({
  page,
}) => {
  await gotoWorkspaces(page);
  await expect(page).toHaveURL(/\/workspaces$/);

  const composer = getComposerInput(page);
  await expect(composer).toBeVisible();

  await composer.fill("/review base main");
  await getSendButton(page).click();

  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect
    .poll(async () => (await page.getByRole("alert").textContent())?.trim().length ?? 0)
    .toBeGreaterThan(0);
  await expect(composer).toHaveValue("/review base main");
  await expect(page).not.toHaveURL(/\/workspaces\/workspace-web/);
});
