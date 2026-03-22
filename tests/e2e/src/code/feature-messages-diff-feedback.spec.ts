import { expect, test } from "@playwright/test";
import { gotoWorkspaces, isRuntimeGatewayReady, openFirstWorkspace } from "./helpers";

const SLO_P95_MS = 120;
const SAMPLE_COUNT = 7;

function percentile95(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? sorted[sorted.length - 1] ?? 0;
}

test("feature messages/diff controls keep feedback latency within release SLO", async ({
  page,
}) => {
  const runtimeReady = await isRuntimeGatewayReady(page.request);
  test.skip(!runtimeReady, "Runtime gateway is not running; skipping runtime-dependent test.");

  await page.setViewportSize({ width: 1280, height: 720 });
  await gotoWorkspaces(page);
  test.skip(
    (await page.locator(".workspace-row").count()) === 0,
    "No workspace fixtures available."
  );
  await openFirstWorkspace(page);

  const measurements: Array<{ id: string; p95: number; samples: number[] }> = [];

  const gitModeSelect = page.getByLabel("Git panel view").first();
  if ((await gitModeSelect.count()) > 0 && (await gitModeSelect.isVisible().catch(() => false))) {
    const samples = await gitModeSelect.evaluate(async (element, sampleCount) => {
      const select = element as HTMLSelectElement;
      const options = Array.from(select.options).map((option) => option.value);
      const nextMode = options.includes("log") ? "log" : (options[0] ?? "diff");
      const fallbackMode = options.includes("diff") ? "diff" : (options[0] ?? nextMode);

      const durations: number[] = [];
      for (let index = 0; index < sampleCount; index += 1) {
        const start = performance.now();
        select.value = nextMode;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        durations.push(performance.now() - start);

        select.value = fallbackMode;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      return durations;
    }, SAMPLE_COUNT);

    measurements.push({
      id: "git-panel-mode-select",
      samples,
      p95: percentile95(samples),
    });
  }

  const jumpToLatest = page.getByRole("button", { name: "Jump to latest updates" }).first();
  if ((await jumpToLatest.count()) > 0 && (await jumpToLatest.isVisible().catch(() => false))) {
    const samples = await jumpToLatest.evaluate(async (element, sampleCount) => {
      const trigger = element as HTMLButtonElement;
      const durations: number[] = [];
      for (let index = 0; index < sampleCount; index += 1) {
        const start = performance.now();
        trigger.click();
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        durations.push(performance.now() - start);
      }
      return durations;
    }, SAMPLE_COUNT);

    measurements.push({
      id: "messages-jump-latest",
      samples,
      p95: percentile95(samples),
    });
  }

  test.skip(measurements.length === 0, "No messages/diff controls available in this fixture.");

  for (const item of measurements) {
    expect(item.p95).toBeLessThanOrEqual(SLO_P95_MS);
  }
});
