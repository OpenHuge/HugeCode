import fs from "node:fs/promises";
import path from "node:path";
import { expect, type Locator, test } from "@playwright/test";
import { gotoWorkspaces, isRuntimeGatewayReady, openFirstWorkspace } from "./helpers";

const SLO_P95_MS = 120;
const SAMPLE_COUNT = 9;
const OUTPUT_DIR = path.resolve(process.cwd(), ".codex/ux-audit");

function percentile95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? sorted[sorted.length - 1] ?? 0;
}

async function measureSelectOpenLatency(trigger: Locator) {
  const samples = await trigger.evaluate(async (element, sampleCount) => {
    const triggerElement = element as HTMLButtonElement;
    const menuLabel = triggerElement.getAttribute("aria-label") ?? "";
    const waitFor = async (predicate: () => boolean, timeoutMs = 1200) => {
      const start = performance.now();
      while (performance.now() - start < timeoutMs) {
        if (predicate()) {
          return;
        }
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      throw new Error("timed out waiting for select open state");
    };
    const visible = (node: Element) => {
      if (!(node instanceof HTMLElement)) {
        return false;
      }
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
    };
    const resolveMenu = () => {
      return Array.from(
        document.querySelectorAll(`.ds-select-menu[role="listbox"][aria-label="${menuLabel}"]`)
      ).find(visible);
    };

    const timings: number[] = [];
    // Warm up the menu mount/positioning path so the sampled runs reflect steady-state latency.
    triggerElement.click();
    await waitFor(() => Boolean(resolveMenu()));
    triggerElement.click();
    await waitFor(() => !resolveMenu(), 900);
    await new Promise((resolve) => setTimeout(resolve, 20));

    for (let index = 0; index < sampleCount; index += 1) {
      const start = performance.now();
      triggerElement.click();
      await waitFor(() => Boolean(resolveMenu()));
      timings.push(performance.now() - start);

      triggerElement.click();
      await waitFor(() => !resolveMenu(), 900);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return timings;
  }, SAMPLE_COUNT);
  return samples;
}

test("feature key feedback latency stays under P95 120ms for core interactions", async ({
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

  const triggerCandidates = [
    { id: "composer-model-open", label: "Model" },
    { id: "composer-access-open", label: "Agent access" },
    { id: "composer-execution-open", label: "Execution path" },
  ];
  const measuredSelectActions: { id: string; samples: number[]; p95: number }[] = [];
  for (const candidate of triggerCandidates) {
    const trigger = page.getByRole("button", { name: candidate.label }).first();
    if (!(await trigger.isVisible().catch(() => false))) {
      continue;
    }
    const samples = await measureSelectOpenLatency(trigger);
    measuredSelectActions.push({
      id: candidate.id,
      samples,
      p95: percentile95(samples),
    });
    if (measuredSelectActions.length >= 2) {
      break;
    }
  }

  test.skip(
    measuredSelectActions.length === 0,
    "No measurable select trigger is visible in current fixture."
  );

  const metrics = {
    generatedAt: new Date().toISOString(),
    slo: {
      p95OpenMenuMs: SLO_P95_MS,
      p95SurfaceToggleMs: SLO_P95_MS,
    },
    actions: measuredSelectActions,
  };

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const safeTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await fs.writeFile(
    path.join(OUTPUT_DIR, `perf-${safeTimestamp}.json`),
    `${JSON.stringify(metrics, null, 2)}\n`,
    "utf8"
  );

  for (const action of metrics.actions) {
    expect(action.p95).toBeLessThanOrEqual(SLO_P95_MS);
  }
});
