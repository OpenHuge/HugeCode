import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";

const outDir = process.env.MONITOR_OUT_DIR
  ? path.resolve(process.env.MONITOR_OUT_DIR)
  : path.resolve(process.cwd(), "monitor-output");
await fs.mkdir(outDir, { recursive: true });

const baseUrl = process.env.MONITOR_URL ?? "http://localhost:5187/workspaces";
const maxRunMs = Number.parseInt(process.env.MONITOR_MAX_RUN_MS ?? "180000", 10);
const stepTimeoutMs = Number.parseInt(process.env.MONITOR_STEP_TIMEOUT_MS ?? "3000", 10);
const tracePath = path.join(outDir, "trace.zip");
const screenshotPath = path.join(outDir, "final.png");
const jsonPath = path.join(outDir, "monitor-report.json");
const consolePath = path.join(outDir, "console.log");

const report = {
  startedAt: new Date().toISOString(),
  baseUrl,
  maxRunMs,
  stepTimeoutMs,
  interactionCycles: 0,
  responsivenessSamplesMs: [],
  interactionErrors: [],
  timedOutSteps: [],
  pageErrors: [],
  requestFailures: [],
  console: [],
  crashed: false,
  closedUnexpectedly: false,
  watchdogTriggered: false,
  perfMetrics: {},
  monitorData: null,
};

function pushCapped(list, value, cap = 300) {
  if (list.length < cap) {
    list.push(value);
  }
}

async function clickIfVisible(_page, locator) {
  if (await locator.isVisible().catch(() => false)) {
    await locator.click({ timeout: 2000 });
    return true;
  }
  return false;
}

async function withTimeout(label, fn, timeoutMs = stepTimeoutMs) {
  const timeoutSentinel = Symbol("timeout");
  const wrapped = Promise.resolve()
    .then(fn)
    .then(
      (value) => ({ kind: "ok", value }),
      (error) => ({ kind: "error", error })
    );
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => resolve(timeoutSentinel), timeoutMs);
  });

  const outcome = await Promise.race([wrapped, timeoutPromise]);
  if (outcome === timeoutSentinel) {
    throw new Error(`step_timeout:${label}:${timeoutMs}ms`);
  }
  if (outcome.kind === "error") {
    throw outcome.error;
  }
  return outcome.value;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
page.setDefaultTimeout(stepTimeoutMs);
page.setDefaultNavigationTimeout(20_000);

page.on("crash", () => {
  report.crashed = true;
});
page.on("close", () => {
  report.closedUnexpectedly = true;
});
page.on("pageerror", (error) => {
  pushCapped(report.pageErrors, {
    message: String(error?.message ?? error),
    stack: String(error?.stack ?? ""),
  });
});
page.on("requestfailed", (request) => {
  pushCapped(report.requestFailures, {
    url: request.url(),
    method: request.method(),
    failure: request.failure()?.errorText ?? "unknown",
  });
});
page.on("console", (msg) => {
  pushCapped(
    report.console,
    {
      type: msg.type(),
      text: msg.text(),
    },
    1000
  );
});

await cdp.send("Performance.enable");
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

await page.addInitScript(() => {
  const monitor = {
    startedAt: Date.now(),
    longTasks: [],
    timerDriftMs: [],
    unhandled: [],
  };
  // @ts-expect-error
  window.__owMonitor = monitor;

  if ("PerformanceObserver" in window) {
    try {
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === "longtask") {
            monitor.longTasks.push({
              startTime: entry.startTime,
              duration: entry.duration,
              name: entry.name,
            });
          }
        }
      });
      obs.observe({ entryTypes: ["longtask"] });
    } catch {
      // ignore
    }
  }

  let lastTick = performance.now();
  setInterval(() => {
    const now = performance.now();
    const drift = now - lastTick - 100;
    if (drift > 120) {
      monitor.timerDriftMs.push(drift);
    }
    lastTick = now;
  }, 100);

  window.addEventListener("unhandledrejection", (event) => {
    monitor.unhandled.push({ type: "unhandledrejection", reason: String(event.reason) });
  });
  window.addEventListener("error", (event) => {
    monitor.unhandled.push({ type: "error", message: String(event.message) });
  });
});

try {
  const startedAtMs = Date.now();
  const deadlineMs = startedAtMs + maxRunMs;

  await withTimeout("goto-workspaces", () =>
    page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 45000 })
  );
  await withTimeout("warmup-wait", () => page.waitForTimeout(1500));

  const openSettingsButton = page.getByRole("button", { name: "Open settings" }).first();
  const openDebugButton = page.getByRole("button", { name: "Open debug log" }).first();
  const toggleSearchButton = page.getByRole("button", { name: "Toggle search" }).first();
  const sortThreadsButton = page.getByRole("button", { name: "Sort threads" }).first();

  for (let cycle = 0; cycle < 24; cycle += 1) {
    if (Date.now() >= deadlineMs) {
      report.watchdogTriggered = true;
      break;
    }
    report.interactionCycles = cycle + 1;

    try {
      if (
        await withTimeout("toggle-search-visible", () => clickIfVisible(page, toggleSearchButton))
      ) {
        const searchInput = page.getByLabel("Search projects");
        if (
          await withTimeout("search-input-visible", () =>
            searchInput.isVisible().catch(() => false)
          )
        ) {
          await withTimeout("search-fill", () =>
            searchInput.fill(`monitor-${cycle}`, { timeout: 1500 })
          );
          const clearSearchButton = page.getByRole("button", { name: "Clear search" }).first();
          await withTimeout("search-clear", () => clickIfVisible(page, clearSearchButton));
          await withTimeout("search-close", () => clickIfVisible(page, toggleSearchButton));
        }
      }

      if (await withTimeout("sort-open", () => clickIfVisible(page, sortThreadsButton))) {
        const mostRecent = page
          .getByRole("menuitemradio", { name: /Most recent|Last updated/i })
          .first();
        await withTimeout("sort-select", () => clickIfVisible(page, mostRecent));
      }

      if (await withTimeout("debug-open", () => clickIfVisible(page, openDebugButton))) {
        await withTimeout("debug-escape", () => page.keyboard.press("Escape"));
      }

      if (
        cycle % 4 === 0 &&
        (await withTimeout("settings-visible", () =>
          openSettingsButton.isVisible().catch(() => false)
        ))
      ) {
        await withTimeout("settings-open", () => openSettingsButton.click({ timeout: 1500 }));
        await withTimeout("settings-wait", () => page.waitForTimeout(200));
        await withTimeout("settings-escape", () =>
          page.keyboard.press("Escape").catch(() => undefined)
        );
      }

      if (cycle % 6 === 0) {
        await withTimeout("page-reload", () =>
          page.reload({ waitUntil: "domcontentloaded", timeout: 20000 })
        );
      }

      const t0 = Date.now();
      await withTimeout(
        "ui-ping",
        () =>
          page
            .locator("body")
            .first()
            .isVisible()
            .catch(() => true),
        1500
      );
      const dt = Date.now() - t0;
      report.responsivenessSamplesMs.push(dt);
    } catch (error) {
      const message = String(error?.message ?? error);
      if (message.includes("step_timeout:")) {
        pushCapped(report.timedOutSteps, { cycle, message }, 1000);
      }
      pushCapped(report.interactionErrors, {
        cycle,
        message,
      });
      await withTimeout("error-recovery-wait", () => page.waitForTimeout(300));
    }

    await withTimeout("cycle-wait", () => page.waitForTimeout(150));
  }

  try {
    report.monitorData = await withTimeout("collect-monitor-data", () =>
      page.evaluate(() => {
        // @ts-expect-error
        const m = window.__owMonitor;
        if (!m) {
          return null;
        }
        return {
          longTasksCount: m.longTasks.length,
          maxLongTaskMs: m.longTasks.length ? Math.max(...m.longTasks.map((i) => i.duration)) : 0,
          timerDriftCount: m.timerDriftMs.length,
          maxTimerDriftMs: m.timerDriftMs.length ? Math.max(...m.timerDriftMs) : 0,
          unhandled: m.unhandled.slice(0, 40),
        };
      })
    );
  } catch {
    report.monitorData = { readFailed: true };
  }

  try {
    const perf = await withTimeout("collect-cdp-metrics", () => cdp.send("Performance.getMetrics"));
    const metricMap = Object.fromEntries(perf.metrics.map((m) => [m.name, m.value]));
    report.perfMetrics = {
      JSHeapUsedSize: metricMap.JSHeapUsedSize,
      JSHeapTotalSize: metricMap.JSHeapTotalSize,
      TaskDuration: metricMap.TaskDuration,
      ScriptDuration: metricMap.ScriptDuration,
      LayoutDuration: metricMap.LayoutDuration,
      RecalcStyleDuration: metricMap.RecalcStyleDuration,
      Nodes: metricMap.Nodes,
      Documents: metricMap.Documents,
    };
  } catch {
    report.perfMetrics = { readFailed: true };
  }

  await withTimeout("final-screenshot", () =>
    page.screenshot({ path: screenshotPath, fullPage: true })
  );
} catch (error) {
  pushCapped(report.interactionErrors, {
    cycle: report.interactionCycles,
    message: `fatal: ${String(error?.message ?? error)}`,
  });
} finally {
  report.endedAt = new Date().toISOString();
  await context.tracing.stop({ path: tracePath }).catch(() => undefined);
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
  await fs.writeFile(
    consolePath,
    report.console.map((c) => `[${c.type}] ${c.text}`).join("\n"),
    "utf8"
  );
  await browser.close();
}
