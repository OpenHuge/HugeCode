import { expect, test } from "@playwright/test";

async function waitForServiceWorker(page: import("@playwright/test").Page) {
  await expect
    .poll(async () => {
      return await page.evaluate(async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.length;
      });
    })
    .toBeGreaterThan(0);
}

test.describe("HugeCode web PWA", () => {
  test("publishes an installable manifest and registers a service worker", async ({ page }) => {
    await page.goto("/");
    await waitForServiceWorker(page);

    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/manifest.webmanifest"
    );

    const manifest = await page.evaluate(async () => {
      const response = await fetch("/manifest.webmanifest");
      return await response.json();
    });

    expect(manifest.id).toBe("/app");
    expect(manifest.scope).toBe("/");
    expect(manifest.start_url).toBe("/app?source=pwa");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/pwa/icon-192.png" }),
        expect.objectContaining({ src: "/pwa/icon-512-maskable.png", purpose: "maskable" }),
      ])
    );
  });

  test("reopens cached routes offline and shows the workspace offline boundary", async ({
    browserName,
    context,
    page,
  }) => {
    test.skip(
      browserName !== "chromium",
      "PWA/service worker coverage is Chromium-only in this suite."
    );

    await page.goto("/about");
    await waitForServiceWorker(page);
    await page.reload();
    await expect(page.getByRole("region", { name: "About HugeCode" })).toBeVisible();

    await page.goto("/app");
    await page.waitForLoadState("networkidle");

    await context.setOffline(true);

    await page.goto("/about");
    await expect(page.getByRole("region", { name: "About HugeCode" })).toBeVisible();

    await page.goto("/app");
    await expect(
      page.getByText(/The HugeCode shell opened offline, but runtime access is paused\./)
    ).toBeVisible();

    await page.goto("/offline");
    await expect(
      page.getByText(/You're offline, but HugeCode still has a cached web shell\./)
    ).toBeVisible();

    await context.setOffline(false);
  });
});
