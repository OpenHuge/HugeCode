import { expect, type Page } from "@playwright/test";

export function buildFixtureUrl(name: string, params: Record<string, string> = {}): string {
  const searchParams = new URLSearchParams({
    fixture: name,
    ...params,
  });
  return `/fixtures.html?${searchParams.toString()}`;
}

export async function openFixture(
  page: Page,
  options: {
    name: string;
    heading: string;
    viewport: { width: number; height: number };
    params?: Record<string, string>;
  }
) {
  await page.setViewportSize(options.viewport);
  await page.goto(buildFixtureUrl(options.name, options.params), {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: options.heading })).toBeVisible({
    timeout: 20_000,
  });
}
