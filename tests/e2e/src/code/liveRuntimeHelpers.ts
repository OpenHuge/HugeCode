import { test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { isRuntimeGatewayReady } from "./helpers";

const LIVE_RUNTIME_USAGE_LIMIT_TEXT = "The usage limit has been reached";

export async function skipUnlessLiveRuntimeReady(
  page: Page,
  testInfo: TestInfo,
  options?: {
    requireSingleWorker?: boolean;
  }
): Promise<void> {
  test.skip(
    options?.requireSingleWorker !== false && testInfo.config.workers !== 1,
    "Live runtime specs require --workers=1 because they share upstream runtime/account quota."
  );

  const runtimeReady = await isRuntimeGatewayReady(page.request);
  test.skip(!runtimeReady, "Runtime gateway is not running; skipping live runtime test.");
  await skipIfUsageLimitBlocked(page);
}

export async function isUsageLimitVisible(page: Page): Promise<boolean> {
  return page
    .getByText(LIVE_RUNTIME_USAGE_LIMIT_TEXT, { exact: false })
    .first()
    .isVisible()
    .catch(() => false);
}

export async function skipIfUsageLimitBlocked(page: Page): Promise<void> {
  test.skip(
    await isUsageLimitVisible(page),
    "Live runtime account usage limit reached in this environment."
  );
}

export async function getCurrentTurnState(page: Page): Promise<string | null> {
  return page
    .getByTestId("messages-root")
    .getAttribute("data-current-turn-state")
    .catch(() => null);
}

export async function waitForLiveTurnToFinish(page: Page, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    await skipIfUsageLimitBlocked(page);

    const state = await getCurrentTurnState(page);
    if (state === "complete") {
      return;
    }
    if (state === "failed") {
      await skipIfUsageLimitBlocked(page);
      throw new Error("Turn failed before the live runtime scenario completed.");
    }

    await page.waitForTimeout(500);
  }

  await skipIfUsageLimitBlocked(page);
  throw new Error(
    `Live runtime turn did not finish within ${timeoutMs}ms. Last known state: ${await getCurrentTurnState(
      page
    )}`
  );
}

export async function waitForAssistantMessageTextOrSkipUsageLimit(
  page: Page,
  text: string,
  options?: {
    exact?: boolean;
    timeoutMs?: number;
  }
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 20_000;
  const startedAt = Date.now();
  const target = page
    .locator(".messages")
    .locator('[data-message-role="assistant"]')
    .getByText(text, { exact: options?.exact ?? false })
    .last();

  while (Date.now() - startedAt < timeoutMs) {
    await skipIfUsageLimitBlocked(page);

    if (await target.isVisible().catch(() => false)) {
      return;
    }

    const state = await getCurrentTurnState(page);
    if (state === "failed") {
      await skipIfUsageLimitBlocked(page);
      throw new Error(`Turn failed before assistant message "${text}" became visible.`);
    }

    await page.waitForTimeout(500);
  }

  await skipIfUsageLimitBlocked(page);
  throw new Error(`Assistant message "${text}" did not appear within ${timeoutMs}ms.`);
}

export async function waitForLiveTurnToStart(page: Page, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    await skipIfUsageLimitBlocked(page);

    const state = await getCurrentTurnState(page);
    if (state === "working") {
      return;
    }
    if (state === "failed") {
      await skipIfUsageLimitBlocked(page);
      throw new Error("Turn failed before entering the working state.");
    }

    await page.waitForTimeout(250);
  }

  await skipIfUsageLimitBlocked(page);
  throw new Error(`Live runtime turn did not enter working within ${timeoutMs}ms.`);
}

export async function skipUnlessWorkspaceListed(
  workspaceTreeItem: Locator,
  workspaceName: string,
  timeoutMs = 5_000
): Promise<void> {
  const isVisible = await workspaceTreeItem.isVisible({ timeout: timeoutMs }).catch(() => false);
  test.skip(!isVisible, `Workspace "${workspaceName}" is not available in this environment.`);
}
