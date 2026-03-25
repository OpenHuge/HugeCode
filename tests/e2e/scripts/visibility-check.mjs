import { chromium } from "@playwright/test";
import {
  runVisibilityCheckWithTimeout,
  resolveVisibilityCheckExitCode,
  summarizeVisibilityCheckResult,
} from "./visibility-check.shared.mjs";

const url = process.env.CHECK_URL ?? "http://localhost:5187/workspaces";
const useCdp = process.env.CHECK_CDP === "1";
const useTrace = process.env.CHECK_TRACE === "1";
const useInit = process.env.CHECK_INIT === "1";
const headless = process.env.CHECK_HEADLESS !== "0";

const browser = await chromium.launch({ headless });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(5000);

if (useInit) {
  await page.addInitScript(() => {
    const monitor = { tick: 0 };
    // @ts-expect-error
    window.__m = monitor;
    setInterval(() => {
      monitor.tick += 1;
    }, 100);
  });
}

let cdp = null;
if (useCdp) {
  cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
}

if (useTrace) {
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
}

const result = {
  url,
  useCdp,
  useTrace,
  useInit,
  steps: [],
  errors: [],
};

const step = async (label, fn, timeoutMs = 10000) => {
  const t0 = Date.now();
  try {
    const value = await runVisibilityCheckWithTimeout(label, fn, timeoutMs);
    result.steps.push({ label, ok: true, ms: Date.now() - t0, value });
    return value;
  } catch (error) {
    result.steps.push({
      label,
      ok: false,
      ms: Date.now() - t0,
      error: String(error?.message ?? error),
    });
    result.errors.push(`${label}:${String(error?.message ?? error)}`);
    throw error;
  }
};

try {
  await step(
    "goto",
    () => page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }),
    45000
  );
  await step("warmup", () => page.waitForTimeout(1000), 3000);
  const toggleSearchButton = page.getByRole("button", { name: "Toggle search" }).first();
  await step(
    "toggle-search-isVisible",
    () => toggleSearchButton.isVisible().catch(() => false),
    10000
  );
  await step("toggle-search-click", () => toggleSearchButton.click({ timeout: 4000 }), 10000);
  await step(
    "search-visible",
    () =>
      page
        .getByLabel("Search projects")
        .isVisible()
        .catch(() => false),
    10000
  );
} catch {
  // keep summary
}

if (cdp) {
  try {
    const perf = await step("cdp-metrics", () => cdp.send("Performance.getMetrics"), 8000);
    result.metricCount = perf.metrics?.length ?? 0;
  } catch {
    // ignore
  }
}

if (useTrace) {
  try {
    await step("trace-stop", () => context.tracing.stop(), 8000);
  } catch {
    // ignore
  }
}

await browser.close();

const summary = summarizeVisibilityCheckResult(result);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
process.exitCode = resolveVisibilityCheckExitCode(summary);
