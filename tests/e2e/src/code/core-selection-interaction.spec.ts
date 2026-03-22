import { expect, type Locator, type Page, test } from "@playwright/test";
import { getWorkspaceThreadRows, gotoWorkspaces } from "./helpers";

test.describe.configure({ mode: "serial" });

function firstWorkspaceRow(page: Page): Locator {
  return page.locator(".workspace-row").first();
}

function sidebarNewProjectButton(page: Page): Locator {
  return page.getByRole("button", { name: /New project|Add workspaces/i }).first();
}

async function clickByDom(locator: Locator): Promise<void> {
  await locator.evaluate((element) => {
    (element as HTMLElement).click();
  });
}

async function ensureWorkspaceThreadsVisible(page: Page): Promise<void> {
  const showAgentsButton = page.getByRole("button", { name: "Show agents" }).first();
  if (await showAgentsButton.isVisible()) {
    await clickByDom(showAgentsButton);
  }
}

async function selectFirstWorkspace(page: Page): Promise<void> {
  const workspaceRow = firstWorkspaceRow(page);
  if (!(await workspaceRow.isVisible().catch(() => false))) {
    return;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await clickByDom(workspaceRow);
    const isHomeVisible = await page
      .locator(".home")
      .isVisible()
      .catch(() => false);
    if (isHomeVisible) {
      return;
    }
  }

  await expect(page.locator(".home")).toBeVisible();
}

test("core selection flow keeps project rows interactive in web runtime gateway", async ({
  page,
}) => {
  test.skip(
    process.env.E2E_RUN_WORKSPACE_DIRECTORY_WEB_TEST !== "true",
    "workspace directory web flow test is opt-in; run with E2E_RUN_WORKSPACE_DIRECTORY_WEB_TEST=true."
  );

  await gotoWorkspaces(page);

  const homeView = page.locator(".home");
  await expect(homeView).toBeVisible();

  await expect(sidebarNewProjectButton(page)).toBeVisible();
  await selectFirstWorkspace(page);
  await expect(homeView).toBeVisible();
});

test("core selection flow keeps workspace controls interactive", async ({ page }) => {
  await gotoWorkspaces(page);

  await selectFirstWorkspace(page);
  const starterCard = page.locator(".home-launchpad-starter-card").first();
  const isHomeVisible = await starterCard.isVisible().catch(() => false);
  if (isHomeVisible) {
    await clickByDom(starterCard);
    await expect(page.locator(".home")).toBeVisible();
    return;
  }

  await ensureWorkspaceThreadsVisible(page);

  const hideAgentsButton = page.getByRole("button", { name: "Hide agents" }).first();
  const showAgentsButton = page.getByRole("button", { name: "Show agents" }).first();
  if (await hideAgentsButton.isVisible()) {
    await clickByDom(hideAgentsButton);
    await expect
      .poll(async () => {
        const showVisible = await showAgentsButton.isVisible().catch(() => false);
        const hideVisible = await hideAgentsButton.isVisible().catch(() => false);
        return showVisible || hideVisible;
      })
      .toBe(true);
    if (await showAgentsButton.isVisible().catch(() => false)) {
      await clickByDom(showAgentsButton);
      await expect(hideAgentsButton).toBeVisible();
    } else {
      await expect(hideAgentsButton).toBeVisible();
    }
  }

  const threadRow = getWorkspaceThreadRows(page).first();
  if (await threadRow.isVisible()) {
    await clickByDom(threadRow);
    await expect(threadRow).toBeVisible();
  }
});
