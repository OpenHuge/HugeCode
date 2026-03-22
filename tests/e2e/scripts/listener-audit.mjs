import { chromium } from "@playwright/test";

const url = process.env.AUDIT_URL ?? "http://localhost:5187/workspaces";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.addInitScript(() => {
  const original = EventTarget.prototype.addEventListener;
  const counts = new Map();
  const samples = [];

  const keyOf = (target, type) => {
    const ctor = target?.constructor ? target.constructor.name : "Unknown";
    return `${ctor}:${String(type)}`;
  };

  EventTarget.prototype.addEventListener = function patched(type, listener, options) {
    const key = keyOf(this, type);
    counts.set(key, (counts.get(key) ?? 0) + 1);

    if (samples.length < 400) {
      let stack = "";
      try {
        stack = new Error().stack ?? "";
      } catch {
        stack = "";
      }
      samples.push({ key, stack });
    }

    return original.call(this, type, listener, options);
  };

  // @ts-expect-error
  window.__listenerAudit = {
    getSummary: () => {
      const rows = Array.from(counts.entries()).map(([key, count]) => ({ key, count }));
      rows.sort((a, b) => b.count - a.count);
      return {
        rows,
        samples,
      };
    },
  };
});

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(1200);

const data = await page.evaluate(() => {
  // @ts-expect-error
  const audit = window.__listenerAudit;
  if (!audit) {
    return null;
  }
  return audit.getSummary();
});

const interesting = data?.rows?.filter((row) => {
  const lower = row.key.toLowerCase();
  return (
    lower.includes("mousedown") ||
    lower.includes("mouseup") ||
    lower.includes("click") ||
    lower.includes("pointerdown") ||
    lower.includes("pointerup") ||
    lower.includes("pointermove") ||
    lower.includes("mousemove")
  );
});

await browser.close();
