import { chromium } from "@playwright/test";

const url = process.env.IDLE_URL ?? "http://localhost:5187/workspaces";
const waitMs = Number.parseInt(process.env.IDLE_WAIT_MS ?? "10000", 10);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

page.on("console", (msg) => {
  if (msg.type() === "error") {
  }
});

await page.addInitScript(() => {
  const monitor = {
    longTasks: [],
    timerDriftMs: [],
    startedAt: performance.now(),
  };
  // @ts-expect-error
  window.__idleMon = monitor;

  if ("PerformanceObserver" in window) {
    try {
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === "longtask") {
            monitor.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
          }
        }
      });
      obs.observe({ entryTypes: ["longtask"] });
    } catch {
      // ignore
    }
  }

  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const drift = now - last - 100;
    if (drift > 100) {
      monitor.timerDriftMs.push(drift);
    }
    last = now;
  }, 100);
});

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(waitMs);

const data = await page.evaluate(() => {
  // @ts-expect-error
  const m = window.__idleMon;
  return {
    readyState: document.readyState,
    longTasksCount: m?.longTasks?.length ?? 0,
    maxLongTaskMs:
      m?.longTasks?.length > 0 ? Math.max(...m.longTasks.map((item) => item.duration)) : 0,
    over500msLongTasks: m?.longTasks?.filter((item) => item.duration > 500).length ?? 0,
    timerDriftCount: m?.timerDriftMs?.length ?? 0,
    maxTimerDriftMs: m?.timerDriftMs?.length > 0 ? Math.max(...m.timerDriftMs) : 0,
    activeElement: document.activeElement?.tagName ?? null,
  };
});

await browser.close();
