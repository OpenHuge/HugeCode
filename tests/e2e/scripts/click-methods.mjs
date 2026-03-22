import { chromium } from "@playwright/test";

const url = process.env.CLICK_URL ?? "http://localhost:5187/workspaces";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(4000);

async function checkSearchVisible() {
  return page
    .getByLabel("Search projects")
    .isVisible()
    .catch(() => false);
}

async function runMethod(name, runner) {
  const out = { name };
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(800);
    const button = page.getByRole("button", { name: "Toggle search" }).first();
    const bbox = await button.boundingBox();
    out.boundingBox = bbox;
    out.isVisible = await button.isVisible().catch(() => false);
    const t0 = Date.now();
    await runner(button, bbox);
    out.actionMs = Date.now() - t0;
    out.ok = true;
  } catch (error) {
    out.ok = false;
    out.error = String(error?.message ?? error);
  }

  out.searchVisibleAfter = await checkSearchVisible();
  return out;
}

const results = [];
results.push(
  await runMethod("locator.click", async (button) => {
    await button.click({ timeout: 3000 });
  })
);
results.push(
  await runMethod("locator.click.force", async (button) => {
    await button.click({ timeout: 3000, force: true });
  })
);
results.push(
  await runMethod("page.mouse.click", async (_button, bbox) => {
    if (!bbox) {
      throw new Error("missing bounding box");
    }
    await page.mouse.click(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
  })
);
results.push(
  await runMethod("locator.dispatchEvent.click", async (button) => {
    await button.dispatchEvent("click");
  })
);
results.push(
  await runMethod("locator.evaluate.el.click", async (button) => {
    await button.evaluate((element) => {
      element.click();
    });
  })
);

await browser.close();
