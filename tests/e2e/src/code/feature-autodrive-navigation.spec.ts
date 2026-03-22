import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 45_000 });

function fixtureUrl(params: Record<string, string> = {}): string {
  const searchParams = new URLSearchParams({
    fixture: "autodrive-navigation",
    ...params,
  });
  return `/fixtures.html?${searchParams.toString()}`;
}

async function openFixture(page: Page, params: Record<string, string> = {}) {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(fixtureUrl(params), {
    waitUntil: "domcontentloaded",
  });
  await expect
    .poll(async () => page.locator("body").textContent(), {
      timeout: 20_000,
    })
    .toContain("AutoDrive Navigation Fixture");
}

async function openMobileFixture(page: Page, params: Record<string, string> = {}) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(fixtureUrl(params), {
    waitUntil: "domcontentloaded",
  });
  await expect
    .poll(async () => page.locator("body").textContent(), {
      timeout: 20_000,
    })
    .toContain("AutoDrive Navigation Fixture");
}

async function openAutoDriveSettings(page: Page) {
  await page.getByRole("button", { name: "AutoDrive", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "AutoDrive settings" });
  await expect(dialog).toBeVisible();
  return dialog;
}

function ledgerRegion(page: Page) {
  return page.getByLabel("AutoDrive ledger");
}

async function waitForFixtureStatus(
  page: Page,
  status: "paused" | "stopped" | "completed",
  timeout = 20_000
) {
  await expect
    .poll(async () => page.locator("body").textContent(), {
      timeout,
    })
    .toContain(`Status: ${status}`);
}

test("autodrive dropdown launches without update-loop errors and stops on the token cap", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await openFixture(page);

  const dialog = await openAutoDriveSettings(page);
  await expect(dialog).toContainText("Degraded");
  await expect(dialog).toContainText("Enabled");
  await expect(dialog).toContainText("Runtime snapshot unavailable");
  await expect(dialog).toContainText("AutoDrive is armed.");
  await expect(dialog.getByRole("button", { name: "Start AutoDrive" })).toBeVisible();
  expect(consoleErrors.some((entry) => entry.includes("Maximum update depth exceeded"))).toBe(
    false
  );

  await dialog.getByRole("button", { name: "Start AutoDrive" }).click();

  await waitForFixtureStatus(page, "stopped");
  await expect(page.getByRole("button", { name: "Restart AutoDrive" })).toBeVisible();
  await expect(ledgerRegion(page)).toContainText("8 artifact(s)");
  await expect(page.getByText(".hugecode/runs/autodrive-e2e-run/context/1.json")).toBeVisible();
  await expect(page.getByText(".hugecode/runs/autodrive-e2e-run/context/2.json")).toBeVisible();
  await expect(page.getByText(".hugecode/runs/autodrive-e2e-run/summary/2.json")).toBeVisible();
  await expect(page.getByText(".hugecode/runs/autodrive-e2e-run/final-report.md")).toBeVisible();
});

test("autodrive navigation fixture can pause and resume with a delayed deterministic loop", async ({
  page,
}) => {
  await openFixture(page, { "step-delay-ms": "900" });

  const dialog = await openAutoDriveSettings(page);
  await dialog.getByRole("button", { name: "Start AutoDrive" }).click();
  await expect(dialog.getByRole("button", { name: "Pause AutoDrive" })).toBeVisible({
    timeout: 5_000,
  });

  await dialog.getByRole("button", { name: "Pause AutoDrive" }).click();

  await waitForFixtureStatus(page, "paused");
  await expect(page.getByRole("button", { name: "Resume AutoDrive" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop AutoDrive" })).toBeVisible();

  await page.getByRole("button", { name: "Resume AutoDrive" }).click();

  await waitForFixtureStatus(page, "stopped");
});

test("autodrive navigation fixture supports an explicit operator stop", async ({ page }) => {
  await openFixture(page, { "step-delay-ms": "900" });

  const dialog = await openAutoDriveSettings(page);
  await dialog.getByRole("button", { name: "Start AutoDrive" }).click();
  await expect(dialog.getByRole("button", { name: "Stop AutoDrive" })).toBeVisible({
    timeout: 5_000,
  });

  await dialog.getByRole("button", { name: "Stop AutoDrive" }).click();

  await waitForFixtureStatus(page, "stopped");
  await expect(page.getByRole("button", { name: "Restart AutoDrive" })).toBeVisible();
  await expect(ledgerRegion(page)).not.toContainText("0 artifact(s)");
});

test("autodrive navigation fixture recovers a paused route after reload", async ({ page }) => {
  await openFixture(page, {
    "step-delay-ms": "900",
    "persist-key": "autodrive-recovery",
    "reset-state": "1",
  });

  const dialog = await openAutoDriveSettings(page);
  await dialog.getByRole("button", { name: "Start AutoDrive" }).click();
  await expect(dialog.getByRole("button", { name: "Pause AutoDrive" })).toBeVisible({
    timeout: 5_000,
  });

  await dialog.getByRole("button", { name: "Pause AutoDrive" }).click();

  await waitForFixtureStatus(page, "paused");

  await page.reload({
    waitUntil: "domcontentloaded",
  });

  const recoveredDialog = await openAutoDriveSettings(page);
  await expect(recoveredDialog.getByRole("button", { name: "Resume AutoDrive" })).toBeVisible();
  await expect(page.getByText("Status: paused", { exact: false })).toBeVisible();
  await expect(ledgerRegion(page)).not.toContainText("0 artifact(s)");
});

test("autodrive navigation fixture surfaces reroute-stop outcomes explicitly", async ({ page }) => {
  await openFixture(page, { scenario: "reroute-stop" });

  const dialog = await openAutoDriveSettings(page);
  await dialog.getByRole("button", { name: "Start AutoDrive" }).click();

  await waitForFixtureStatus(page, "stopped");

  await expect(
    page
      .getByText(
        "The current waypoint diverged from the planned route and needs a course correction."
      )
      .first()
  ).toBeVisible();
  await expect(page.getByText(".hugecode/runs/autodrive-e2e-run/reroute/1.json")).toBeVisible();
});

test("autodrive navigation fixture can arrive at the destination in the goal-reached scenario", async ({
  page,
}) => {
  await openFixture(page, { scenario: "goal-reached" });

  const dialog = await openAutoDriveSettings(page);
  await dialog.getByRole("button", { name: "Start AutoDrive" }).click();

  await waitForFixtureStatus(page, "completed");

  await expect(page.getByRole("button", { name: "Restart AutoDrive" })).toBeVisible();
  await expect(ledgerRegion(page)).toContainText("8 artifact(s)");
});

test("autodrive navigation fixture keeps the navigation console usable on mobile", async ({
  page,
}) => {
  await openMobileFixture(page, { scenario: "goal-reached" });

  const dialog = await openAutoDriveSettings(page);
  await dialog.getByRole("button", { name: "Start AutoDrive" }).click();

  await waitForFixtureStatus(page, "completed");

  await expect(page.getByRole("button", { name: "Restart AutoDrive" })).toBeVisible();

  await expect
    .poll(
      async () =>
        page.evaluate(() => ({
          canScrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          viewportWidth: window.innerWidth,
        })),
      {
        timeout: 5_000,
      }
    )
    .toEqual({
      canScrollX: false,
      viewportWidth: 390,
    });
});
