import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE_URL = process.env.UI_AUDIT_URL ?? "http://localhost:5187/workspaces";
const OUTPUT_DIR = path.resolve(process.cwd(), "test-results/ui-audit");
const STAGE_WAIT_MS = 500;

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 720 },
  { name: "phone", width: 390, height: 844 },
];

async function sleep(page, ms) {
  await page.waitForTimeout(ms);
}

function navigationCandidates(url) {
  const candidates = [url];
  try {
    const parsed = new URL(url);
    const root = `${parsed.origin}/`;
    const workspaces = `${parsed.origin}/workspaces`;
    if (!candidates.includes(root)) {
      candidates.push(root);
    }
    if (!candidates.includes(workspaces)) {
      candidates.push(workspaces);
    }
  } catch {
    // Keep original URL only.
  }
  return candidates;
}

async function gotoWithRetry(page, url, attempts = 2) {
  let lastError = null;
  for (const target of navigationCandidates(url)) {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45000 });
        return;
      } catch (error) {
        lastError = error;
        if (attempt >= attempts) {
          break;
        }
        await sleep(page, 900 * attempt);
      }
    }
  }
  if (lastError) {
    throw lastError;
  }
}

async function clickPrimaryTab(page, name) {
  const tab = page.getByRole("button", { name }).first();
  if ((await tab.count()) === 0) {
    return false;
  }
  await tab.click();
  await sleep(page, 240);
  return true;
}

async function clickWorkspace(page) {
  const clicked = await page.evaluate(() => {
    const candidates = [
      ...document.querySelectorAll(".workspace-row"),
      ...document.querySelectorAll('[role="treeitem"]'),
    ];
    const pick = candidates.find((node) => node instanceof HTMLElement);
    if (!(pick instanceof HTMLElement)) {
      return false;
    }
    pick.click();
    return true;
  });
  if (clicked) {
    await sleep(page, STAGE_WAIT_MS);
  }
  return clicked;
}

async function clickThread(page) {
  const threadRow = page.locator(".thread-row").first();
  if ((await threadRow.count()) > 0) {
    await threadRow.click();
    await sleep(page, STAGE_WAIT_MS);
    return true;
  }

  const threadButton = page.getByRole("button", { name: /^New thread/i }).first();
  if ((await threadButton.count()) > 0) {
    try {
      await threadButton.click();
      await sleep(page, STAGE_WAIT_MS);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

async function openSettings(page, viewportName) {
  if (viewportName === "phone") {
    await clickPrimaryTab(page, "Projects");
  }

  const userMenu = page.getByRole("button", { name: "User menu" }).first();
  if ((await userMenu.count()) === 0) {
    return false;
  }
  await userMenu.click();
  await sleep(page, 180);

  const openSettingsButton = page.getByRole("button", { name: "Open settings" }).first();
  if ((await openSettingsButton.count()) > 0) {
    await openSettingsButton.click();
    await sleep(page, 260);
    return true;
  }

  const fallbackSettingsButton = page.getByRole("button", { name: "Settings" }).first();
  if ((await fallbackSettingsButton.count()) === 0) {
    return false;
  }
  await fallbackSettingsButton.click();
  await sleep(page, 260);
  return true;
}

async function closeSettings(page) {
  const closeButton = page.getByRole("button", { name: "Close settings" }).first();
  if ((await closeButton.count()) === 0) {
    return false;
  }
  await closeButton.click();
  await sleep(page, 220);
  return true;
}

async function openModelMenuAndMeasure(page) {
  const clicked = await page.evaluate(() => {
    const visible = (rect) =>
      rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < 10000;
    const triggers = [
      ...document.querySelectorAll(".composer-select-control--model .ds-select-trigger"),
    ]
      .filter((node) => node instanceof HTMLElement)
      .filter((node) => visible(node.getBoundingClientRect()));
    if (triggers.length === 0) {
      return false;
    }
    triggers
      .sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0]
      .click();
    return true;
  });
  if (!clicked) {
    return null;
  }
  await sleep(page, 220);
  const menuMetrics = await page.evaluate(() => {
    const visible = (rect) =>
      rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < 10000;
    const triggerCandidates = [
      ...document.querySelectorAll(".composer-select-control--model .ds-select-trigger"),
    ]
      .filter((node) => node instanceof HTMLElement)
      .filter((node) => visible(node.getBoundingClientRect()));
    const trigger = triggerCandidates.sort(
      (a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom
    )[0];
    const menu = document.querySelector(".ds-select-menu");
    if (!(trigger instanceof HTMLElement) || !(menu instanceof HTMLElement)) {
      return null;
    }
    const tr = trigger.getBoundingClientRect();
    const mr = menu.getBoundingClientRect();
    const placement = mr.top >= tr.bottom ? "down" : "up";
    return {
      trigger: {
        width: Math.round(tr.width),
        height: Math.round(tr.height),
        left: Math.round(tr.left),
        top: Math.round(tr.top),
        bottom: Math.round(tr.bottom),
      },
      menu: {
        width: Math.round(mr.width),
        height: Math.round(mr.height),
        left: Math.round(mr.left),
        top: Math.round(mr.top),
        bottom: Math.round(mr.bottom),
      },
      placement,
      horizontalDelta: Math.round(mr.left - tr.left),
      gap: placement === "down" ? Math.round(mr.top - tr.bottom) : Math.round(tr.top - mr.bottom),
      optionCount: menu.querySelectorAll(".ds-select-option").length,
      hasEmptyState: menu.querySelector(".ds-select-empty") instanceof HTMLElement,
    };
  });
  await page.mouse.click(6, 6);
  return menuMetrics;
}

async function collectSettingsMetrics(page, viewportName, runId) {
  const metrics = await page.evaluate(() => {
    const overlay = document.querySelector(".settings-overlay");
    const windowNode = document.querySelector(".settings-window");
    const navItems = document.querySelectorAll(".settings-nav").length;
    const sectionTitle = document.querySelector(".settings-section-title");
    const closeButton = document.querySelector('.settings-close[aria-label="Close settings"]');
    const rect =
      windowNode instanceof HTMLElement
        ? windowNode.getBoundingClientRect()
        : overlay instanceof HTMLElement
          ? overlay.getBoundingClientRect()
          : null;
    return {
      overlayVisible: overlay instanceof HTMLElement,
      navItems,
      hasSectionTitle: sectionTitle instanceof HTMLElement,
      hasCloseButton: closeButton instanceof HTMLElement,
      modalRect: rect
        ? {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            top: Math.round(rect.top),
          }
        : null,
    };
  });

  const screenshot = path.join(OUTPUT_DIR, `${runId}-${viewportName}-settings.png`);
  await page.screenshot({ path: screenshot, fullPage: false });

  const violations = [];
  if (!metrics.overlayVisible) {
    violations.push("settings overlay missing");
  }
  if (!metrics.hasCloseButton) {
    violations.push("settings close button missing");
  }
  if (viewportName === "desktop" && metrics.navItems < 8) {
    violations.push(`settings nav items too few (${metrics.navItems})`);
  }

  return {
    stageName: "settings",
    screenshot,
    metrics,
    violations,
  };
}

async function collectStageMetrics(page, viewportName, stageName, runId) {
  const metrics = await page.evaluate(() => {
    const visible = (rect) =>
      rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < 10000;
    const app = document.querySelector(".app");
    const wraps = [...document.querySelectorAll(".composer-select-wrap")].filter(
      (node) => node instanceof HTMLElement && visible(node.getBoundingClientRect())
    );
    const triggers = [...document.querySelectorAll(".composer-select-wrap .ds-select-trigger")]
      .filter((node) => node instanceof HTMLElement)
      .filter((node) => visible(node.getBoundingClientRect()))
      .map((node) => {
        const r = node.getBoundingClientRect();
        return {
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
      });
    const quickActions = document.querySelectorAll(".composer-quick-action").length;
    return {
      appClass: app instanceof HTMLElement ? app.className : "",
      visibleSelectWrapCount: wraps.length,
      triggerSizes: triggers,
      quickActions,
      routingVisible:
        document.querySelector(".composer-select-wrap--accounts") instanceof HTMLElement &&
        visible(document.querySelector(".composer-select-wrap--accounts").getBoundingClientRect()),
    };
  });

  const modelMenu = await openModelMenuAndMeasure(page);
  const screenshot = path.join(OUTPUT_DIR, `${runId}-${viewportName}-${stageName}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });

  const violations = [];
  const averageTriggerHeight =
    metrics.triggerSizes.length > 0
      ? metrics.triggerSizes.reduce((sum, item) => sum + item.height, 0) /
        metrics.triggerSizes.length
      : 0;

  if (viewportName === "phone" && metrics.routingVisible) {
    violations.push("phone composer still shows routing selector");
  }
  if (stageName === "workspace-home" && metrics.visibleSelectWrapCount > 4) {
    violations.push("workspace home exposes duplicate selector rows");
  }
  if (averageTriggerHeight > 28) {
    violations.push(`trigger height too large (${averageTriggerHeight.toFixed(1)}px)`);
  }
  if (modelMenu) {
    if (Math.abs(modelMenu.horizontalDelta) > 8) {
      violations.push(`menu horizontal delta too large (${modelMenu.horizontalDelta}px)`);
    }
    if (Math.abs(modelMenu.gap) > 8) {
      violations.push(`menu gap too large (${modelMenu.gap}px)`);
    }
    if (modelMenu.optionCount === 0 || modelMenu.hasEmptyState) {
      violations.push("model menu has no runtime options");
    }
  } else {
    violations.push("model menu not measurable");
  }

  return {
    stageName,
    screenshot,
    metrics: {
      ...metrics,
      averageTriggerHeight: Number(averageTriggerHeight.toFixed(2)),
      modelMenu,
    },
    violations,
  };
}

async function runViewport(browser, viewport, runId) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  });
  await gotoWithRetry(page, BASE_URL);
  await sleep(page, 1200);

  const stages = [];
  stages.push(await collectStageMetrics(page, viewport.name, "home", runId));
  const settingsOpened = await openSettings(page, viewport.name);
  if (settingsOpened) {
    stages.push(await collectSettingsMetrics(page, viewport.name, runId));
    await closeSettings(page);
  }
  if (viewport.name === "phone") {
    await clickPrimaryTab(page, "Codex");
  }

  const workspaceOpened = await clickWorkspace(page);
  if (workspaceOpened) {
    stages.push(await collectStageMetrics(page, viewport.name, "workspace-home", runId));
    const composerInput = page.locator("textarea").last();
    if ((await composerInput.count()) > 0) {
      if (await composerInput.isEnabled()) {
        await composerInput.fill("ui audit prompt");
      }
      const sendButton = page.getByRole("button", { name: "Send" }).last();
      if ((await sendButton.count()) > 0) {
        if (await sendButton.isEnabled()) {
          await sendButton.click();
          await sleep(page, 650);
        }
      }
    }
    const threadOpened = await clickThread(page);
    const canCollectThread =
      threadOpened ||
      !(await page
        .locator(".workspace-home")
        .first()
        .isVisible()
        .catch(() => false));
    if (canCollectThread) {
      stages.push(await collectStageMetrics(page, viewport.name, "thread", runId));
    }
  }

  await page.close();
  return {
    viewport,
    stages,
    violations: stages.flatMap((stage) =>
      stage.violations.map((item) => `${stage.stageName}: ${item}`)
    ),
  };
}

async function main() {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const report = {
    runId,
    baseUrl: BASE_URL,
    generatedAt: new Date().toISOString(),
    results: [],
  };

  try {
    for (const viewport of VIEWPORTS) {
      report.results.push(await runViewport(browser, viewport, runId));
    }
  } finally {
    await browser.close();
  }

  const allViolations = report.results.flatMap((result) =>
    result.violations.map((item) => `${result.viewport.name}: ${item}`)
  );
  const summary = {
    runId,
    violations: allViolations,
    totalViolations: allViolations.length,
  };
  const reportPath = path.join(OUTPUT_DIR, `${runId}.json`);
  await fs.writeFile(reportPath, JSON.stringify({ summary, report }, null, 2), "utf8");
  process.stdout.write(`${JSON.stringify({ reportPath, summary }, null, 2)}\n`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
