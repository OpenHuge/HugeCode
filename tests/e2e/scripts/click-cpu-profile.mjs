import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const url = process.env.PROFILE_URL ?? "http://localhost:5187/workspaces";
const outDir = process.env.PROFILE_OUT_DIR
  ? path.resolve(process.env.PROFILE_OUT_DIR)
  : path.resolve(process.cwd(), "profile-output");
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(4000);

const cdp = await context.newCDPSession(page);
await cdp.send("Profiler.enable");

function withTimeout(label, fn, timeoutMs) {
  return Promise.race([
    Promise.resolve().then(fn),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timeout:${label}:${timeoutMs}`)), timeoutMs)
    ),
  ]);
}

const result = {
  url,
  clickError: null,
  topFunctions: [],
  totalSampleMs: 0,
};

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(1000);
  const button = page.getByRole("button", { name: "Toggle search" }).first();
  result.buttonVisible = await button.isVisible().catch(() => false);

  await cdp.send("Profiler.start");
  const startedAt = Date.now();
  try {
    await withTimeout("button.click", () => button.click({ timeout: 3000 }), 3500);
  } catch (error) {
    result.clickError = String(error?.message ?? error);
  }
  await withTimeout("post-click-wait", () => page.waitForTimeout(200), 1500).catch((error) => {
    result.postClickWaitError = String(error?.message ?? error);
  });
  const elapsedMs = Date.now() - startedAt;
  result.profileWindowMs = elapsedMs;

  const stopped = await withTimeout("Profiler.stop", () => cdp.send("Profiler.stop"), 5000);
  const profile = stopped.profile;
  await fs.writeFile(path.join(outDir, "profile.raw.json"), JSON.stringify(profile));

  const nodeById = new Map(profile.nodes.map((n) => [n.id, n]));
  const totalsByNode = new Map();
  const samples = profile.samples ?? [];
  const deltas = profile.timeDeltas ?? [];

  for (let i = 0; i < samples.length; i += 1) {
    const nodeId = samples[i];
    const delta = deltas[i] ?? 0;
    totalsByNode.set(nodeId, (totalsByNode.get(nodeId) ?? 0) + delta);
  }

  const rows = [...totalsByNode.entries()]
    .map(([nodeId, micro]) => {
      const node = nodeById.get(nodeId);
      const call = node?.callFrame;
      return {
        nodeId,
        ms: micro / 1000,
        functionName: call?.functionName || "(anonymous)",
        url: call?.url || "",
        lineNumber: (call?.lineNumber ?? -1) + 1,
        columnNumber: (call?.columnNumber ?? -1) + 1,
      };
    })
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 40);

  result.totalSampleMs = rows.reduce((sum, row) => sum + row.ms, 0);
  result.topFunctions = rows;

  await fs.writeFile(path.join(outDir, "profile.summary.json"), JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
