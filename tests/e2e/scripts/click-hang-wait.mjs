import { chromium } from "@playwright/test";

const waitMs = Number.parseInt(process.env.HANG_WAIT_MS ?? "120000", 10);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto("http://localhost:5187/workspaces", {
  waitUntil: "domcontentloaded",
  timeout: 45000,
});
await page.waitForTimeout(1000);

const button = page.getByRole("button", { name: "Toggle search" }).first();
try {
  await button.click({ timeout: 3000 });
} catch {}

await new Promise((resolve) => setTimeout(resolve, waitMs));

await browser.close();
