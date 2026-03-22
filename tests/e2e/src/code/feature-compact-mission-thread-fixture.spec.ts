import { expect, test, type Page } from "@playwright/test";
import { openFixture as openNamedFixture } from "./fixtureHelpers";

test.describe.configure({ timeout: 45_000 });

async function openFixture(page: Page, params: Record<string, string> = {}) {
  await openNamedFixture(page, {
    name: "compact-mission-thread",
    heading: "Compact Mission Thread Fixture",
    viewport: { width: 390, height: 844 },
    params,
  });
}

async function distanceToBottom(page: Page): Promise<number | null> {
  return await page.getByTestId("messages-root").evaluate((element) => {
    if (!(element instanceof HTMLElement)) {
      return null;
    }
    return element.scrollHeight - element.scrollTop - element.clientHeight;
  });
}

test("compact mission fixture pins mobile threads to the latest reply without jump chrome", async ({
  page,
}) => {
  await openFixture(page, { scenario: "overflow-latest" });

  await expect(page.getByText("Mission overview")).toHaveCount(0);
  await expect(page.locator('[data-message-role="assistant"]').last()).toBeVisible();
  await expect.poll(() => distanceToBottom(page), { timeout: 10_000 }).toBeLessThanOrEqual(1);
  await expect(page.getByLabel("Jump to latest updates")).toHaveCount(0);
});

test("compact mission fixture surfaces the no-visible-response footer deterministically", async ({
  page,
}) => {
  await openFixture(page, { scenario: "no-visible-response" });

  const footer = page.getByTestId("current-turn-footer");
  await expect(footer).toBeVisible();
  await expect
    .poll(async () => (await footer.textContent())?.trim().length ?? 0)
    .toBeGreaterThan(0);
  await expect(footer).toHaveAttribute("data-current-turn-indicator-state", "warning");
});

test("compact mission fixture exposes a working-state sample without jump chrome", async ({
  page,
}) => {
  await openFixture(page, { scenario: "working" });

  const indicator = page.getByTestId("current-turn-working-indicator");
  await expect(indicator).toBeVisible();
  await expect
    .poll(async () => (await indicator.textContent())?.trim().length ?? 0)
    .toBeGreaterThan(0);
  await expect(page.getByLabel("Jump to latest updates")).toHaveCount(0);
});

test("compact mission fixture exposes tool-only completion copy deterministically", async ({
  page,
}) => {
  await openFixture(page, { scenario: "tool-only" });

  const footer = page.getByTestId("current-turn-footer");
  await expect(footer).toBeVisible();
  await expect
    .poll(async () => (await footer.textContent())?.trim().length ?? 0)
    .toBeGreaterThan(0);
  await expect(footer).toHaveAttribute("data-current-turn-indicator-state", "tool-only");
});
