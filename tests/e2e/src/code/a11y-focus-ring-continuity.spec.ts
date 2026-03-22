import { expect, type Page, test } from "@playwright/test";
import {
  gotoWorkspaces,
  isRuntimeGatewayReady,
  openFirstWorkspace,
  waitForWorkspaceShell,
} from "./helpers";

async function waitForShellFocusStyles(page: Page) {
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const control = document.querySelector(".sidebar-action") as HTMLElement | null;
        if (!control) {
          return false;
        }
        const style = window.getComputedStyle(control);
        return (
          (style.borderColor &&
            style.borderColor !== "transparent" &&
            style.borderColor !== "rgba(0, 0, 0, 0)") ||
          style.boxShadow !== "none"
        );
      });
    })
    .toBeTruthy();
}

async function sampleFocusableControlsByTab(page: Page, maxSamples = 6, maxSteps = 220) {
  const seenKeys = new Set<string>();
  const samples: Array<{ key: string; isFocusVisible: boolean; hasIndicator: boolean }> = [];

  await page.mouse.click(4, 4);
  for (let step = 0; step < maxSteps && samples.length < maxSamples; step += 1) {
    await page.keyboard.press("Tab");
    const snapshot = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element) {
        return null;
      }
      const interactiveSelector = "button, [role='button'], input, textarea, select";
      if (!element.matches(interactiveSelector)) {
        return null;
      }
      const style = window.getComputedStyle(element);
      const key =
        element.getAttribute("aria-label") ||
        element.textContent?.trim() ||
        element.className ||
        element.tagName.toLowerCase();
      const hasOutline =
        style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) >= 1;
      const hasShadow = Boolean(style.boxShadow && style.boxShadow !== "none");
      const hasBorderIndicator = Boolean(
        style.borderColor &&
        style.borderColor !== "transparent" &&
        style.borderColor !== "rgba(0, 0, 0, 0)"
      );
      return {
        key,
        isFocusVisible: element.matches(":focus-visible"),
        hasIndicator: hasOutline || hasShadow || hasBorderIndicator,
      };
    });

    if (!snapshot || seenKeys.has(snapshot.key)) {
      continue;
    }
    seenKeys.add(snapshot.key);
    samples.push(snapshot);
  }

  return samples;
}

test("a11y focus ring continuity is preserved for core shell and composer controls", async ({
  page,
}) => {
  const runtimeReady = await isRuntimeGatewayReady(page.request);
  test.skip(!runtimeReady, "Runtime gateway is not running; skipping runtime-dependent test.");

  await page.setViewportSize({ width: 1280, height: 720 });
  await gotoWorkspaces(page);
  const shellReady = await waitForWorkspaceShell(page, 20_000);
  test.skip(!shellReady, "Workspace shell did not initialize in time for accessibility checks.");

  const workspaceRows = page.locator(".workspace-row");
  if ((await workspaceRows.count()) > 0) {
    await openFirstWorkspace(page);
  }
  await waitForShellFocusStyles(page);
  const focusSamples = await sampleFocusableControlsByTab(page);
  expect(focusSamples.length).toBeGreaterThanOrEqual(4);
  for (const sample of focusSamples) {
    expect(sample.isFocusVisible).toBe(true);
    expect(sample.hasIndicator).toBe(true);
  }
});
