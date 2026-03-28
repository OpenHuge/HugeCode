import type { Locator, Page, TestInfo } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { stabilizeVisualSnapshot, waitForAppBootFallbackToClear } from "./helpers";

test.describe.configure({ mode: "serial", timeout: 90_000 });

type FixtureSmokeMonitor = {
  fatalConsoleErrors: string[];
  moduleFailures: string[];
  pageErrors: string[];
};

type FixtureSmokeOptions = {
  assertions: (page: Page, fixture: Locator) => Promise<void>;
  fixtureId: string;
  fixtureLocator?: (page: Page) => Locator;
  screenshotName: string;
};

function attachFixtureSmokeMonitor(page: Page): FixtureSmokeMonitor {
  const moduleFailures: string[] = [];
  const pageErrors: string[] = [];
  const fatalConsoleErrors: string[] = [];

  page.on("response", (response) => {
    if (response.status() < 500) {
      return;
    }
    const url = response.url();
    if (!url.includes("127.0.0.1:5187") && !url.includes("localhost:5187")) {
      return;
    }
    moduleFailures.push(`${response.status()} ${url}`);
  });

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }
    fatalConsoleErrors.push(message.text());
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  return {
    moduleFailures,
    pageErrors,
    fatalConsoleErrors,
  };
}

async function runFixtureSmoke(
  page: Page,
  testInfo: TestInfo,
  { fixtureId, fixtureLocator, screenshotName, assertions }: FixtureSmokeOptions
) {
  const monitor = attachFixtureSmokeMonitor(page);

  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto(`/fixtures.html?fixture=${fixtureId}`, {
    waitUntil: "domcontentloaded",
  });
  await stabilizeVisualSnapshot(page);
  await waitForAppBootFallbackToClear(page);

  const fixture =
    fixtureLocator?.(page) ?? page.locator(`[data-visual-fixture="${fixtureId}"]`).first();

  await expect(fixture).toBeVisible({ timeout: 15_000 });
  await assertions(page, fixture);

  const screenshot = await fixture.screenshot();
  await testInfo.attach(screenshotName, {
    body: screenshot,
    contentType: "image/png",
  });

  expect(monitor.moduleFailures, monitor.moduleFailures.join("\n")).toEqual([]);
  expect(monitor.pageErrors, monitor.pageErrors.join("\n")).toEqual([]);
  expect(monitor.fatalConsoleErrors, monitor.fatalConsoleErrors.join("\n")).toEqual([]);
}

test("design-system fixture smoke renders the git inspector detail scene", async ({
  page,
}, testInfo) => {
  await runFixtureSmoke(page, testInfo, {
    fixtureId: "git-inspector-detail",
    screenshotName: "git-inspector-detail-fixture-smoke",
    assertions: async (currentPage, fixture) => {
      await expect(currentPage.getByTestId("git-inspector-plan-surface")).toBeVisible();
      await expect(currentPage.getByTestId("git-inspector-diff-surface")).toBeVisible();
      await expect(currentPage.getByPlaceholder("Commit message...")).toBeVisible();
      await expect(
        currentPage.getByRole("button", { name: "Generate commit message" })
      ).toBeVisible();
      await expect(currentPage.getByText("Inspector aligned")).toBeVisible();
      await expect(currentPage.getByText("Fixture data")).toBeVisible();
      await expect(
        currentPage.getByText("Loading the workspace shell and runtime services.")
      ).toHaveCount(0);
      await expect(fixture).toContainText("Inspector aligned");
    },
  });
});

test("mission control fixture smoke renders the unified mission-control grammar", async ({
  page,
}, testInfo) => {
  await runFixtureSmoke(page, testInfo, {
    fixtureId: "mission-control",
    screenshotName: "mission-control-fixture-smoke",
    assertions: async (currentPage) => {
      await expect(
        currentPage.getByRole("heading", { name: "Runtime Supervision Surface" })
      ).toBeVisible();
      await expect(currentPage.getByText("Launch readiness blocked")).toBeVisible();
      await expect(currentPage.getByText("Continuity readiness confirmed")).toBeVisible();
      await expect(currentPage.getByRole("heading", { name: "Control Loop" })).toBeVisible();
    },
  });
});

test("main-shell closure fixture smoke renders the unified shell grammar", async ({
  page,
}, testInfo) => {
  await runFixtureSmoke(page, testInfo, {
    fixtureId: "main-shell-closure",
    screenshotName: "main-shell-closure-fixture-smoke",
    assertions: async (currentPage) => {
      await expect(currentPage.getByText("Topbar chrome")).toBeVisible();
      await currentPage.getByRole("button", { name: "Open user menu" }).click();
      await expect(
        currentPage.getByRole("menu", { name: "Sidebar user menu preview" })
      ).toBeVisible();
      await expect(currentPage.getByText("Home controls")).toBeVisible();
      await currentPage.getByRole("button", { name: "Branch and worktree" }).click();
      await expect(
        currentPage.getByRole("menu", { name: "Composer branch menu preview" })
      ).toBeVisible();
      await expect(currentPage.getByText("feature/main-shell").first()).toBeVisible();
    },
  });
});

test("core-loop closure fixture smoke renders the unified timeline/composer/runtime grammar", async ({
  page,
}, testInfo) => {
  await runFixtureSmoke(page, testInfo, {
    fixtureId: "core-loop-closure",
    screenshotName: "core-loop-closure-fixture-smoke",
    assertions: async (currentPage) => {
      await expect(currentPage.getByText("Thread states")).toBeVisible();
      await expect(currentPage.getByText("Active thread")).toBeVisible();
      await expect(currentPage.getByText("Composer meta rail")).toBeVisible();
      await expect(currentPage.getByText("Runtime run list")).toBeVisible();
      await expect(currentPage.getByText("Review-ready continuity", { exact: true })).toBeVisible();
    },
  });
});

test("review-loop closure fixture smoke renders the unified review grammar", async ({
  page,
}, testInfo) => {
  await runFixtureSmoke(page, testInfo, {
    fixtureId: "review-loop-closure",
    screenshotName: "review-loop-closure-fixture-smoke",
    assertions: async (currentPage, fixture) => {
      await expect(
        fixture
          .getByTestId("mission-overview-panel")
          .getByRole("heading", { name: "Mission triage" })
      ).toBeVisible();
      await expect(
        currentPage.getByText("Unified detail grammar for triage, runtime, and review")
      ).toBeVisible();
      await expect(currentPage.getByText("Review decision rail")).toBeVisible();
      await expect(currentPage.getByText("Runtime continuity and handoff")).toBeVisible();
      await expect(currentPage.getByText("Blocking runtime detail")).toBeVisible();
    },
  });
});

test("home-sidebar closure fixture smoke renders the unified home and sidebar grammar", async ({
  page,
}, testInfo) => {
  await runFixtureSmoke(page, testInfo, {
    fixtureId: "home-sidebar-closure",
    screenshotName: "home-sidebar-closure-fixture-smoke",
    assertions: async (currentPage) => {
      await expect(currentPage.getByRole("button", { name: "New project" })).toBeVisible();
      await expect(currentPage.getByRole("button", { name: "Sort threads" })).toBeVisible();
      await expect(currentPage.getByTestId("home-launchpad-starter-audit-ui")).toBeVisible();
      await expect(currentPage.getByTestId("home-mission-signal-routing")).toBeVisible();
    },
  });
});

test("settings-form-chrome fixture smoke renders the unified settings form grammar", async ({
  page,
}, testInfo) => {
  await runFixtureSmoke(page, testInfo, {
    fixtureId: "settings-form-chrome",
    screenshotName: "settings-form-chrome-fixture-smoke",
    fixtureLocator: (currentPage) => currentPage.locator('[data-ui-dialog-card="true"]').first(),
    assertions: async (_currentPage, fixture) => {
      await expect(fixture.locator('[data-settings-section-frame="true"]')).toBeVisible();
      await expect(fixture).toContainText("Display");
      await expect(fixture.getByRole("button", { name: "Theme" })).toBeVisible();
      await expect(
        fixture.getByRole("switch", { name: "Show remaining Codex limits" })
      ).toBeVisible();
      await expect(fixture.getByLabel("UI font family")).toBeVisible();
      await expect(fixture.getByRole("button", { name: "Test sound" })).toBeVisible();
      await expect(fixture.getByRole("button", { name: "Test notification" })).toBeVisible();
    },
  });
});

test("composer-select fixture smoke renders the shared composer select grammar", async ({
  page,
}, testInfo) => {
  await runFixtureSmoke(page, testInfo, {
    fixtureId: "composer-select",
    screenshotName: "composer-select-fixture-smoke",
    assertions: async (currentPage) => {
      await expect(
        currentPage.getByRole("heading", { name: "Composer Select Fixture" })
      ).toBeVisible();
      await expect(
        currentPage.getByRole("region", { name: "Composer select surface" })
      ).toBeVisible();
      await expect(currentPage.getByRole("button", { name: "Agent access" }).first()).toBeVisible();
      await expect(currentPage.getByText("GPT-5.4").first()).toBeVisible();
      await expect(
        currentPage.getByRole("button", { name: "Execution path" }).first()
      ).toBeVisible();
      await expect(currentPage.getByText("Runtime").first()).toBeVisible();
      const modeToggle = currentPage.getByRole("button", { name: "Chat" }).first();
      await expect(modeToggle).toBeVisible();
      await modeToggle.click();
      await expect(currentPage.getByRole("button", { name: "Plan" }).first()).toBeVisible();
    },
  });
});

test("composer-action-stop fixture smoke renders the stop action grammar", async ({
  page,
}, testInfo) => {
  await runFixtureSmoke(page, testInfo, {
    fixtureId: "composer-action-stop",
    screenshotName: "composer-action-stop-fixture-smoke",
    assertions: async (currentPage, fixture) => {
      await expect(
        currentPage.getByRole("heading", { name: "Composer Action Stop Fixture" })
      ).toBeVisible();
      await expect(currentPage.getByText("Starting response")).toBeVisible();
      await expect(currentPage.getByText("Stop ready")).toBeVisible();
      await expect(fixture.locator("[data-stop-state]")).toHaveCount(2);
      await expect(currentPage.locator(".composer-action-stop-square")).toHaveCount(2);
      await expect(currentPage.locator('button[aria-label="Starting response"]')).toBeVisible();
      await expect(currentPage.locator('button[aria-label="Stop"]')).toBeVisible();
    },
  });
});

test("autodrive-navigation fixture smoke renders the route and ledger grammar", async ({
  page,
}, testInfo) => {
  await runFixtureSmoke(page, testInfo, {
    fixtureId: "autodrive-navigation",
    screenshotName: "autodrive-navigation-fixture-smoke",
    assertions: async (currentPage) => {
      await expect(
        currentPage.getByRole("heading", { name: "AutoDrive Navigation Fixture" })
      ).toBeVisible();
      await expect(currentPage.getByText("Ledger artifacts")).toBeVisible();
      await expect(currentPage.getByTestId("autodrive-ledger-path").first()).toBeVisible();
      await expect(currentPage.getByText("No artifacts written yet.")).toBeVisible();
      await expect(currentPage.getByRole("button", { name: "Execution path" })).toContainText(
        "Runtime"
      );
      await expect(currentPage.getByRole("switch", { name: "Toggle AutoDrive" })).toBeVisible();
      await expect(currentPage.getByText(/Scenario /)).toBeVisible();
    },
  });
});

test("runtime-subagent-observability fixture smoke renders delegated observability grammar", async ({
  page,
}, testInfo) => {
  await runFixtureSmoke(page, testInfo, {
    fixtureId: "runtime-subagent-observability",
    screenshotName: "runtime-subagent-observability-fixture-smoke",
    assertions: async (currentPage) => {
      await expect(
        currentPage.getByRole("heading", { name: "Sub-agent observability" })
      ).toBeVisible();
      await expect(currentPage.getByRole("heading", { name: "Run list" })).toBeVisible();
      await expect(currentPage.getByText("Approval required")).toBeVisible();
      await expect(currentPage.getByText("Resume ready 1")).toBeVisible();
      await expect(
        currentPage.getByTestId("workspace-runtime-subagent-observability")
      ).toBeVisible();
      await expect(currentPage.getByText("Delegated sessions", { exact: true })).toBeVisible();
    },
  });
});
