import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial", timeout: 90_000 });
test.setTimeout(120_000);

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
  await expect(page.getByRole("heading", { name: "AutoDrive Navigation Fixture" })).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByRole("switch", { name: "Toggle AutoDrive" })).toBeVisible();
}

async function openMobileFixture(page: Page, params: Record<string, string> = {}) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(fixtureUrl(params), {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: "AutoDrive Navigation Fixture" })).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByRole("switch", { name: "Toggle AutoDrive" })).toBeVisible();
}

function autoDriveStatusRail(page: Page) {
  return page.getByLabel("AutoDrive status rail");
}

async function openAutoDriveControls(page: Page) {
  const rail = autoDriveStatusRail(page);
  await expect(rail).toBeVisible();
  const toggle = rail.getByRole("button").first();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  return rail;
}

function ledgerRegion(page: Page) {
  return page.getByLabel("AutoDrive ledger");
}

async function waitForActionButton(page: Page, label: string, timeout = 20_000) {
  await expect(page.getByRole("button", { name: label })).toBeVisible({ timeout });
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await browser.newPage();
  try {
    await page.goto(fixtureUrl(), {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("heading", { name: "AutoDrive Navigation Fixture" })).toBeVisible({
      timeout: 90_000,
    });
  } finally {
    await page.close();
  }
});

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

  const rail = await openAutoDriveControls(page);
  await expect(rail).toContainText("Ready to launch");
  await expect(rail).toContainText("Automatic runtime routing");
  await expect(rail.getByRole("button", { name: "Start AutoDrive" })).toBeVisible();
  expect(consoleErrors.some((entry) => entry.includes("Maximum update depth exceeded"))).toBe(
    false
  );

  await rail.getByRole("button", { name: "Start AutoDrive" }).click();

  await waitForActionButton(page, "Restart AutoDrive");
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

  const rail = await openAutoDriveControls(page);
  await rail.getByRole("button", { name: "Start AutoDrive" }).click();
  await waitForActionButton(page, "Pause AutoDrive", 5_000);

  await page.getByRole("button", { name: "Pause AutoDrive" }).click();

  await waitForActionButton(page, "Resume AutoDrive");
  await expect(page.getByRole("button", { name: "Resume AutoDrive" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop AutoDrive" })).toBeVisible();

  await page.getByRole("button", { name: "Resume AutoDrive" }).click();

  await waitForActionButton(page, "Restart AutoDrive");
});

test("autodrive navigation fixture supports an explicit operator stop", async ({ page }) => {
  await openFixture(page, { "step-delay-ms": "900" });

  const rail = await openAutoDriveControls(page);
  await rail.getByRole("button", { name: "Start AutoDrive" }).click();
  await waitForActionButton(page, "Stop AutoDrive", 5_000);

  await page.getByRole("button", { name: "Stop AutoDrive" }).click();

  await waitForActionButton(page, "Restart AutoDrive");
  await expect(ledgerRegion(page)).not.toContainText("0 artifact(s)");
});

test("autodrive navigation fixture recovers a paused route after reload", async ({ page }) => {
  await openFixture(page, {
    "step-delay-ms": "900",
    "persist-key": "autodrive-recovery",
    "reset-state": "1",
  });

  const rail = await openAutoDriveControls(page);
  await rail.getByRole("button", { name: "Start AutoDrive" }).click();
  await waitForActionButton(page, "Pause AutoDrive", 5_000);

  await page.getByRole("button", { name: "Pause AutoDrive" }).click();

  await waitForActionButton(page, "Resume AutoDrive");

  await page.reload({
    waitUntil: "domcontentloaded",
  });

  await openFixture(page, {
    "step-delay-ms": "900",
    "persist-key": "autodrive-recovery",
    "reset-state": "1",
  });
  const recoveredRail = await openAutoDriveControls(page);
  await expect(recoveredRail.getByRole("button", { name: "Resume AutoDrive" })).toBeVisible();
  await expect(ledgerRegion(page)).not.toContainText("0 artifact(s)");
});

test("autodrive navigation fixture surfaces reroute-stop outcomes explicitly", async ({ page }) => {
  await openFixture(page, { scenario: "reroute-stop" });

  const rail = await openAutoDriveControls(page);
  await rail.getByRole("button", { name: "Start AutoDrive" }).click();

  await waitForActionButton(page, "Restart AutoDrive");

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

  const rail = await openAutoDriveControls(page);
  await rail.getByRole("button", { name: "Start AutoDrive" }).click();

  await waitForActionButton(page, "Restart AutoDrive");
  await expect(ledgerRegion(page)).toContainText("11 artifact(s)");
  await expect(page.getByText(".hugecode/runs/autodrive-e2e-run/context/3.json")).toBeVisible();
  await expect(page.getByText(".hugecode/runs/autodrive-e2e-run/summary/3.json")).toBeVisible();
});

test("autodrive navigation fixture keeps the navigation console usable on mobile", async ({
  page,
}) => {
  await openMobileFixture(page, { scenario: "goal-reached" });

  const rail = await openAutoDriveControls(page);
  await rail.getByRole("button", { name: "Start AutoDrive" }).click();

  await waitForActionButton(page, "Restart AutoDrive");

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
