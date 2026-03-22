import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE_URL = process.env.UX_AUDIT_URL ?? "http://localhost:5187/workspaces";
const OUTPUT_DIR = path.resolve(process.cwd(), ".codex/ux-audit");
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "screenshots");
const VIEWPORTS = [
  { id: "desktop", width: 1280, height: 720 },
  { id: "mid", width: 800, height: 720 },
  { id: "phone", width: 390, height: 844 },
];
const SLO_THRESHOLD_MS = 120;
const SLO_SAMPLES = 7;
const UX_AUDIT_MAX_P0 = readNonNegativeIntegerEnv("UX_AUDIT_MAX_P0", 0);
const UX_AUDIT_MAX_P1 = readNonNegativeIntegerEnv("UX_AUDIT_MAX_P1", 0);
const UX_AUDIT_MAX_P2 = readNonNegativeIntegerEnv("UX_AUDIT_MAX_P2", 8);
const UX_AUDIT_MAX_SKIPS = readOptionalNonNegativeIntegerEnv("UX_AUDIT_MAX_SKIPS");

function readNonNegativeIntegerEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer (received "${raw}")`);
  }
  return parsed;
}

function readOptionalNonNegativeIntegerEnv(name) {
  const raw = process.env[name];
  if (!raw) {
    return null;
  }
  return readNonNegativeIntegerEnv(name, 0);
}

function percentile95(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? sorted[sorted.length - 1] ?? 0;
}

async function sleep(page, ms) {
  await page.waitForTimeout(ms);
}

async function safeGoto(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await sleep(page, 600);
}

async function openWorkspaceTabIfNeeded(page, viewportId) {
  if (viewportId !== "phone") {
    return;
  }
  const projectsTab = page.getByRole("button", { name: "Projects" }).first();
  if ((await projectsTab.count()) === 0 || !(await projectsTab.isVisible().catch(() => false))) {
    return;
  }
  await projectsTab.click();
  await sleep(page, 350);
}

async function ensureWorkspaceFixture(page) {
  const rows = page.locator(".workspace-row");
  if ((await rows.count()) > 0) {
    return true;
  }
  const newProjectButton = page.getByRole("button", { name: "New project" }).first();
  if (
    (await newProjectButton.count()) > 0 &&
    (await newProjectButton.isVisible().catch(() => false))
  ) {
    await newProjectButton.click();
    await sleep(page, 700);
  }
  return (await rows.count()) > 0;
}

async function openFirstWorkspaceIfAny(page, viewportId) {
  await openWorkspaceTabIfNeeded(page, viewportId);
  if (!(await ensureWorkspaceFixture(page))) {
    return false;
  }
  const rows = page.locator(".workspace-row");
  await rows.first().click();
  await sleep(page, 500);
  return true;
}

async function collectVisibleControlIssues(page) {
  return page.evaluate(() => {
    const controls = Array.from(
      document.querySelectorAll(
        "button, [role='button'], [role='tab'], [role='menuitem'], input, textarea, select"
      )
    );
    const isVisible = (node) => {
      if (!(node instanceof HTMLElement)) {
        return false;
      }
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
    };
    const issues = [];
    let visibleControlCount = 0;
    const hitAreaRoles = new Set([
      "button",
      "tab",
      "menuitem",
      "menuitemradio",
      "menuitemcheckbox",
    ]);
    const cssPath = (node) => {
      if (!(node instanceof Element)) {
        return "";
      }
      const parts = [];
      let current = node;
      while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 6) {
        let token = current.tagName.toLowerCase();
        if (current.id) {
          token += `#${current.id}`;
          parts.unshift(token);
          break;
        }
        const className = (current.className ?? "").toString().trim();
        if (className.length > 0) {
          const classes = className.split(/\s+/u).filter(Boolean).slice(0, 2);
          if (classes.length > 0) {
            token += `.${classes.join(".")}`;
          }
        }
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            (candidate) => candidate.tagName === current.tagName
          );
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            token += `:nth-of-type(${index})`;
          }
        }
        parts.unshift(token);
        current = current.parentElement;
      }
      return parts.join(" > ");
    };

    for (const node of controls) {
      if (!(node instanceof HTMLElement) || !isVisible(node)) {
        continue;
      }
      visibleControlCount += 1;
      const rect = node.getBoundingClientRect();
      const role = node.getAttribute("role") || node.tagName.toLowerCase();
      const text = node.textContent?.trim() || "";
      const ariaLabel = node.getAttribute("aria-label") || "";
      const hasSvg = node.querySelector("svg") instanceof SVGElement;
      const tagName = node.tagName.toLowerCase();

      const isIconOnly = hasSvg && text.length === 0;
      if (isIconOnly && ariaLabel.length === 0) {
        issues.push({
          type: "icon-only-missing-aria-label",
          severity: "P2",
          element: role,
          detail: "Icon-only control is missing aria-label.",
          selector: cssPath(node),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }

      const shouldEnforceHitArea = tagName === "button" || hitAreaRoles.has(role);
      const minTargetWidth = 24;
      const minTargetHeight = 20;
      if (shouldEnforceHitArea && (rect.width < minTargetWidth || rect.height < minTargetHeight)) {
        issues.push({
          type: "small-hit-area",
          severity: "P2",
          element: role,
          detail: `Clickable area is too small (${Math.round(rect.width)}x${Math.round(rect.height)}).`,
          selector: cssPath(node),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    }

    return {
      visibleControlCount,
      issues,
    };
  });
}

async function measureMenuAlignment(page, label) {
  const trigger = page.getByRole("button", { name: label }).first();
  if ((await trigger.count()) === 0 || !(await trigger.isVisible().catch(() => false))) {
    return null;
  }
  await trigger.click();
  const menu = page.getByRole("listbox", { name: label }).last();
  if (!(await menu.isVisible().catch(() => false))) {
    return null;
  }

  const [triggerBox, menuBox] = await Promise.all([trigger.boundingBox(), menu.boundingBox()]);
  await page.keyboard.press("Escape");
  if (!triggerBox || !menuBox) {
    return null;
  }

  const startDelta = Math.abs(menuBox.x - triggerBox.x);
  const endDelta = Math.abs(menuBox.x + menuBox.width - (triggerBox.x + triggerBox.width));
  const gapBelow = Math.abs(menuBox.y - (triggerBox.y + triggerBox.height));
  const gapAbove = Math.abs(triggerBox.y - (menuBox.y + menuBox.height));
  const verticalGap = Math.min(gapBelow, gapAbove);

  return {
    label,
    startDelta: Number(startDelta.toFixed(2)),
    endDelta: Number(endDelta.toFixed(2)),
    verticalGap: Number(verticalGap.toFixed(2)),
    minDelta: Number(Math.min(startDelta, endDelta).toFixed(2)),
  };
}

async function measureActionLatency(page, action) {
  const samples = [];
  for (let index = 0; index < SLO_SAMPLES; index += 1) {
    const start = await page.evaluate(() => performance.now());
    await action();
    const end = await page.evaluate(() => performance.now());
    samples.push(Number((end - start).toFixed(2)));
    await sleep(page, 25);
  }
  return samples;
}

function scoreSurface(defects, hasSloViolation) {
  const score = {
    visualAlignment: 5,
    interactionIntuition: 5,
    accessibility: 5,
    stateFeedback: 5,
    performanceFeeling: hasSloViolation ? 3.8 : 4.9,
  };

  for (const defect of defects) {
    if (defect.severity === "P2") {
      continue;
    }
    if (defect.type === "select-alignment-offset") {
      score.visualAlignment = Math.max(
        0,
        score.visualAlignment - (defect.severity === "P0" ? 1.4 : 0.7)
      );
    } else if (defect.type === "small-hit-area") {
      score.interactionIntuition = Math.max(0, score.interactionIntuition - 0.6);
    } else if (defect.type === "icon-only-missing-aria-label") {
      score.accessibility = Math.max(0, score.accessibility - 0.8);
    } else {
      score.stateFeedback = Math.max(0, score.stateFeedback - 0.5);
    }
  }

  const total =
    (score.visualAlignment +
      score.interactionIntuition +
      score.accessibility +
      score.stateFeedback +
      score.performanceFeeling) /
    5;

  return {
    ...score,
    total: Number(total.toFixed(2)),
  };
}
async function captureSurface(
  page,
  runId,
  viewportId,
  surfaceId,
  defectIdRef,
  { measureSelectAlignment = true } = {}
) {
  const screenshotPath = path.join(SCREENSHOT_DIR, `${runId}-${viewportId}-${surfaceId}.png`);
  const controlAudit = await collectVisibleControlIssues(page);

  const alignmentMeasurements = [];
  if (measureSelectAlignment) {
    const selectLabels = ["Model", "Thinking mode", "Agent access", "Execution path"];
    for (const label of selectLabels) {
      const measurement = await measureMenuAlignment(page, label);
      if (measurement) {
        alignmentMeasurements.push(measurement);
      }
    }
  }

  const defects = [];
  for (const issue of controlAudit.issues) {
    const evidenceParts = [];
    if (issue.selector) {
      evidenceParts.push(`selector=${issue.selector}`);
    }
    if (Number.isFinite(issue.width) && Number.isFinite(issue.height)) {
      evidenceParts.push(`size=${issue.width}x${issue.height}`);
    }
    const evidence = evidenceParts.length > 0 ? evidenceParts.join(" | ") : null;
    defectIdRef.current += 1;
    defects.push({
      id: `UX-${defectIdRef.current}`,
      page: surfaceId,
      element: issue.element,
      severity: issue.severity,
      reproSteps: "Open the target page and tab/click through visible controls.",
      expected: "Controls should be fully accessible and have comfortable hit targets.",
      actual: issue.detail,
      recommendation:
        issue.type === "icon-only-missing-aria-label"
          ? "Add aria-label for icon-only controls."
          : "Increase control size or merge into a larger clickable capsule.",
      owner: "apps/code-ui",
      evidence: evidence ?? undefined,
      type: issue.type,
    });
  }

  for (const alignment of alignmentMeasurements) {
    if (alignment.minDelta > 4 || alignment.verticalGap > 10) {
      defectIdRef.current += 1;
      defects.push({
        id: `UX-${defectIdRef.current}`,
        page: surfaceId,
        element: alignment.label,
        severity: "P1",
        reproSteps: `Open "${alignment.label}" select and inspect trigger/menu alignment.`,
        expected: "Menu should stay visually adjacent to trigger with stable alignment.",
        actual: `Offset minDelta=${alignment.minDelta}px, verticalGap=${alignment.verticalGap}px.`,
        recommendation:
          "Use trigger-first anchoring and keep start alignment unless overflow requires end.",
        owner: "apps/code-ui",
        type: "select-alignment-offset",
      });
    }
  }

  await page.screenshot({ path: screenshotPath, fullPage: false });
  return {
    id: surfaceId,
    viewport: viewportId,
    visibleControlCount: controlAudit.visibleControlCount,
    alignmentMeasurements,
    defects,
    screenshots: [screenshotPath],
  };
}

async function runViewportAudit(browser, viewport, runId, defectIdRef) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const surfaces = [];
  const skips = [];

  await safeGoto(page, BASE_URL);
  surfaces.push(await captureSurface(page, runId, viewport.id, "home", defectIdRef));

  const openedWorkspace = await openFirstWorkspaceIfAny(page, viewport.id);
  if (openedWorkspace) {
    surfaces.push(await captureSurface(page, runId, viewport.id, "workspace", defectIdRef));
  } else {
    skips.push({
      id: "no-workspace-fixture",
      viewport: viewport.id,
      reason: "No .workspace-row fixture is available in the current environment.",
    });
  }

  const userMenu = page.getByRole("button", { name: "User menu" }).first();
  if ((await userMenu.count()) > 0 && (await userMenu.isVisible().catch(() => false))) {
    await userMenu.click();
    await sleep(page, 180);
    const openSettings = page.getByRole("button", { name: "Open settings" }).first();
    const settingsFallback = page.getByRole("button", { name: "Settings" }).first();
    if ((await openSettings.count()) > 0) {
      await openSettings.click();
      await sleep(page, 240);
      surfaces.push(
        await captureSurface(page, runId, viewport.id, "settings", defectIdRef, {
          measureSelectAlignment: false,
        })
      );
      const closeButton = page.getByRole("button", { name: "Close settings" }).first();
      if ((await closeButton.count()) > 0) {
        await closeButton.click();
      }
    } else if ((await settingsFallback.count()) > 0) {
      await settingsFallback.click();
      await sleep(page, 240);
      surfaces.push(
        await captureSurface(page, runId, viewport.id, "settings", defectIdRef, {
          measureSelectAlignment: false,
        })
      );
    }
  }

  let slo = null;
  if (openedWorkspace) {
    const thinkingTrigger = page.getByRole("button", { name: "Thinking mode" }).first();
    const executionTrigger = page.getByRole("button", { name: "Execution path" }).first();

    if ((await thinkingTrigger.count()) > 0 && (await executionTrigger.count()) > 0) {
      const thinkingSamples = await measureActionLatency(page, async () => {
        await thinkingTrigger.click();
        await page
          .getByRole("listbox", { name: "Thinking mode" })
          .last()
          .waitFor({ state: "visible" });
        await page.keyboard.press("Escape");
      });
      const executionSamples = await measureActionLatency(page, async () => {
        await executionTrigger.click();
        await page
          .getByRole("listbox", { name: "Execution path" })
          .last()
          .waitFor({ state: "visible" });
        await page.keyboard.press("Escape");
      });

      slo = {
        thresholdMs: SLO_THRESHOLD_MS,
        actions: [
          {
            id: "composer-thinking-open",
            samples: thinkingSamples,
            p95: percentile95(thinkingSamples),
          },
          {
            id: "composer-execution-open",
            samples: executionSamples,
            p95: percentile95(executionSamples),
          },
        ],
      };
    }
  }

  await page.close();
  return { surfaces, slo, skips };
}

async function main() {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const defectIdRef = { current: 0 };
  const pages = [];
  const sloActions = [];
  const skips = [];

  try {
    for (const viewport of VIEWPORTS) {
      const result = await runViewportAudit(browser, viewport, runId, defectIdRef);
      for (const surface of result.surfaces) {
        pages.push(surface);
      }
      if (result.slo?.actions) {
        for (const action of result.slo.actions) {
          sloActions.push({ ...action, viewport: viewport.id });
        }
      }
      if (Array.isArray(result.skips)) {
        skips.push(...result.skips);
      }
    }
  } finally {
    await browser.close();
  }

  const defects = pages.flatMap((page) => page.defects);
  const severityCounts = {
    p0: defects.filter((item) => item.severity === "P0").length,
    p1: defects.filter((item) => item.severity === "P1").length,
    p2: defects.filter((item) => item.severity === "P2").length,
  };

  const sloViolations = sloActions
    .filter((action) => action.p95 > SLO_THRESHOLD_MS)
    .map((action) => `${action.viewport}:${action.id} p95=${action.p95.toFixed(2)}ms`);
  const hasSloViolation = sloViolations.length > 0;

  const reportPages = pages.map((page) => ({
    id: page.id,
    viewport: page.viewport,
    scores: scoreSurface(page.defects, hasSloViolation),
    defects: page.defects.map(({ type: _type, ...rest }) => rest),
    screenshots: page.screenshots,
  }));

  const coreReport = {
    version: 1,
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    summary: {
      totalDefects: defects.length,
      p0: severityCounts.p0,
      p1: severityCounts.p1,
      p2: severityCounts.p2,
    },
    pages: reportPages,
    slo: {
      thresholdMs: SLO_THRESHOLD_MS,
      actions: sloActions.map(({ viewport, ...rest }) => ({
        id: `${viewport}:${rest.id}`,
        ...rest,
      })),
      violations: sloViolations,
    },
    skips,
  };

  const perfReport = {
    generatedAt: coreReport.generatedAt,
    thresholdMs: SLO_THRESHOLD_MS,
    actions: sloActions,
    violations: sloViolations,
    skips,
  };

  const coreReportPath = path.join(OUTPUT_DIR, `core-${runId}.json`);
  const perfReportPath = path.join(OUTPUT_DIR, `perf-${runId}.json`);
  await fs.writeFile(coreReportPath, `${JSON.stringify(coreReport, null, 2)}\n`, "utf8");
  await fs.writeFile(perfReportPath, `${JSON.stringify(perfReport, null, 2)}\n`, "utf8");

  const thresholdBreaches = [];
  if (severityCounts.p0 > UX_AUDIT_MAX_P0) {
    thresholdBreaches.push(`P0 defects ${severityCounts.p0} > limit ${UX_AUDIT_MAX_P0}`);
  }
  if (severityCounts.p1 > UX_AUDIT_MAX_P1) {
    thresholdBreaches.push(`P1 defects ${severityCounts.p1} > limit ${UX_AUDIT_MAX_P1}`);
  }
  if (severityCounts.p2 > UX_AUDIT_MAX_P2) {
    thresholdBreaches.push(`P2 defects ${severityCounts.p2} > limit ${UX_AUDIT_MAX_P2}`);
  }
  if (UX_AUDIT_MAX_SKIPS !== null && skips.length > UX_AUDIT_MAX_SKIPS) {
    thresholdBreaches.push(`Skipped surfaces ${skips.length} > limit ${UX_AUDIT_MAX_SKIPS}`);
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        coreReportPath,
        perfReportPath,
        totalDefects: defects.length,
        sloViolations,
        thresholds: {
          maxP0: UX_AUDIT_MAX_P0,
          maxP1: UX_AUDIT_MAX_P1,
          maxP2: UX_AUDIT_MAX_P2,
          maxSkips: UX_AUDIT_MAX_SKIPS,
          breaches: thresholdBreaches,
        },
      },
      null,
      2
    )}\n`
  );
  if (thresholdBreaches.length > 0) {
    process.stderr.write(`UX audit threshold failed:\n- ${thresholdBreaches.join("\n- ")}\n`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
