import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

function withTimeout(label, fn, ms) {
  return Promise.race([
    Promise.resolve().then(fn),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout:${label}:${ms}`)), ms)),
  ]);
}

await page.addInitScript(() => {
  // @ts-expect-error
  window.__clickEvents = [];
  const record = (type, event) => {
    const target = event.target;
    const tag = target?.tagName ? target.tagName.toLowerCase() : null;
    const cls = target && typeof target.className === "string" ? target.className : null;
    // @ts-expect-error
    window.__clickEvents.push({ type, tag, cls, ts: performance.now() });
  };
  document.addEventListener("pointerdown", (e) => record("pointerdown", e), true);
  document.addEventListener("pointerup", (e) => record("pointerup", e), true);
  document.addEventListener("mousedown", (e) => record("mousedown", e), true);
  document.addEventListener("mouseup", (e) => record("mouseup", e), true);
  document.addEventListener("click", (e) => record("click", e), true);
});

const out = {};
try {
  await page.goto("http://localhost:5187/workspaces", {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await page.waitForTimeout(1000);
  const button = page.getByRole("button", { name: "Toggle search" }).first();
  await withTimeout("button.click", () => button.click({ timeout: 3000 }), 3500);
  out.clickOk = true;
} catch (error) {
  out.clickOk = false;
  out.clickError = String(error?.message ?? error);
}

try {
  out.events = await withTimeout(
    "events-read",
    () =>
      page.evaluate(() => {
        // @ts-expect-error
        return (window.__clickEvents || []).slice(-20);
      }),
    3000
  );
} catch (error) {
  out.eventsReadError = String(error?.message ?? error);
}

await browser.close();
