import { chromium } from "@playwright/test";

const url = process.env.CHECK_URL ?? "http://localhost:5187/workspaces";
const labels = (
  process.env.CHECK_LABELS ?? "Toggle search,Sort threads,Open settings,Open debug log,Open home"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const results = [];
for (const label of labels) {
  const entry = { label };
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1000);
    const locator = page.getByRole("button", { name: label }).first();
    entry.visible = await locator.isVisible().catch(() => false);
    const t0 = Date.now();
    await Promise.race([
      locator.click({ timeout: 4000 }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`race-timeout:${label}`)), 4500)
      ),
    ]);
    entry.clickMs = Date.now() - t0;
    entry.ok = true;
  } catch (error) {
    entry.ok = false;
    entry.error = String(error?.message ?? error);
  }
  results.push(entry);
}

await browser.close();
