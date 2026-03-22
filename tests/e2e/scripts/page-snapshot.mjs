import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const outDir = process.env.SNAPSHOT_OUT_DIR;
const url = process.env.SNAPSHOT_URL ?? "http://localhost:5187/workspaces";
if (!outDir) {
  throw new Error("SNAPSHOT_OUT_DIR is required");
}
await fs.mkdir(outDir, { recursive: true });

function withTimeout(label, fn, timeoutMs = 10000) {
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

  return Promise.race([wrapped, timeoutPromise]).then((outcome) => {
    if (outcome === timeoutSentinel) {
      throw new Error(`timeout:${label}:${timeoutMs}`);
    }
    if (outcome.kind === "error") {
      throw outcome.error;
    }
    return outcome.value;
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(5000);

const logs = [];
page.on("console", (msg) => logs.push({ type: msg.type(), text: msg.text() }));
page.on("pageerror", (err) => logs.push({ type: "pageerror", text: String(err?.message ?? err) }));

const result = {
  url,
  startedAt: new Date().toISOString(),
  errors: [],
};

try {
  await withTimeout(
    "goto",
    () => page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }),
    45000
  );
  await withTimeout("warmup", () => page.waitForTimeout(2000), 5000);

  result.state = await withTimeout(
    "state",
    () =>
      page.evaluate(() => {
        const root = document.getElementById("root");
        return {
          readyState: document.readyState,
          title: document.title,
          bodyTextLength: document.body?.innerText?.length ?? 0,
          rootExists: Boolean(root),
          rootChildCount: root?.childElementCount ?? 0,
          rootHtmlLength: root?.innerHTML?.length ?? 0,
          homeExists: Boolean(document.querySelector(".home")),
          appExists: Boolean(document.querySelector(".app")),
          buttons: Array.from(document.querySelectorAll("button"))
            .slice(0, 20)
            .map((b) => ({
              text: b.textContent?.trim() ?? "",
              aria: b.getAttribute("aria-label") ?? "",
            })),
        };
      }),
    8000
  );

  const html = await withTimeout("html", () => page.content(), 8000);
  await fs.writeFile(path.join(outDir, "page.html"), html, "utf8");
  await withTimeout(
    "screenshot",
    () => page.screenshot({ path: path.join(outDir, "snapshot.png"), fullPage: true }),
    8000
  );
} catch (error) {
  result.errors.push(String(error?.message ?? error));
}

result.logs = logs;
result.endedAt = new Date().toISOString();
await fs.writeFile(path.join(outDir, "snapshot-report.json"), JSON.stringify(result, null, 2));
await browser.close();
