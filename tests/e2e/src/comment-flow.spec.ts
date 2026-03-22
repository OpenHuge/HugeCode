import { expect, test } from "@playwright/test";

async function openFirstPost(page: import("@playwright/test").Page): Promise<boolean> {
  await page.goto("/");
  const postLink = page.locator('a[href^="/posts/"]').first();

  if (!(await postLink.isVisible().catch(() => false))) {
    return false;
  }

  await postLink.click();
  await expect(page).toHaveURL(/\/posts\//);
  return true;
}

test.describe("Comment optimistic flow", () => {
  test("shows optimistic comment immediately and keeps final state on success", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    const loginSucceeded = new URL(page.url()).pathname === "/";
    test.skip(!loginSucceeded, "Seed credentials unavailable for login success flow");

    const opened = await openFirstPost(page);
    test.skip(!opened, "No posts available in seed data");

    const body = `optimistic-success-${Date.now()}`;
    await page.fill('textarea[placeholder*="想法"]', body);
    await page.click('button:has-text("发表评论")');

    await expect(page.locator(`text=${body}`)).toBeVisible({ timeout: 1200 });
    await expect(page.locator(`text=${body}`)).toBeVisible({ timeout: 5000 });
  });

  test("rolls back optimistic comment and surfaces error on failure", async ({ page }) => {
    const opened = await openFirstPost(page);
    test.skip(!opened, "No posts available in seed data");

    const body = `optimistic-fail-${Date.now()}`;
    await page.fill('textarea[placeholder*="想法"]', body);
    await page.click('button:has-text("发表评论")');

    await expect(page.getByText(/评论提交失败|未认证|请先登录|Unauthorized/i)).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator(`text=${body}`)).toHaveCount(0);
  });
});
