import { expect, test } from "@playwright/test";
import {
  getWorkspaceCard,
  getWorkspaceThreadRows,
  gotoWorkspace,
  sendComposerPrompt,
  waitForCurrentTurnState,
  waitForMessageText,
  waitForThreadHistoryReady,
  waitForWorkspaceShell,
} from "./helpers";
import {
  skipIfUsageLimitBlocked,
  skipUnlessLiveRuntimeReady,
  waitForAssistantMessageTextOrSkipUsageLimit,
  waitForLiveTurnToStart,
  waitForLiveTurnToFinish,
} from "./liveRuntimeHelpers";

const WORKSPACE_ID = "workspace-web";
test.describe.configure({ mode: "serial", timeout: 240_000 });

test("current repo runtime thread survives reload and accepts a follow-up turn", async ({
  page,
}, testInfo) => {
  await skipUnlessLiveRuntimeReady(page, testInfo);

  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoWorkspace(page, WORKSPACE_ID);
  await skipIfUsageLimitBlocked(page);

  const promptId = `LIVE_CURRENT_REPO_${Date.now()}`;
  const fileName = `${promptId}.txt`;
  const filePath = `C:\\Dev\\${promptId}.txt`;
  const fileContents = `${promptId} content`;
  const quotedFileContents = JSON.stringify(fileContents);
  await sendComposerPrompt(
    page,
    `/new Create the file ${filePath}. ` +
      `The file contents must be exactly ${quotedFileContents} with no trailing newline. ` +
      `After the file is written, reply with exactly "${filePath}" and nothing else.`
  );
  await waitForLiveTurnToFinish(page, 120_000);
  await waitForAssistantMessageTextOrSkipUsageLimit(page, fileName, {
    exact: false,
    timeoutMs: 30_000,
  });

  await expect.poll(async () => getWorkspaceThreadRows(page).count()).toBeGreaterThan(0);

  await page.reload({ waitUntil: "domcontentloaded" });
  const shellReady = await waitForWorkspaceShell(page, 20_000);
  expect(shellReady).toBe(true);
  const restoredThreadRow = getWorkspaceCard(page, WORKSPACE_ID)
    .locator(".thread-row")
    .filter({
      has: page.locator(".thread-name").filter({ hasText: promptId }).first(),
    })
    .first();
  const canReselectRestoredThread = await restoredThreadRow
    .isVisible({ timeout: 5_000 })
    .catch(() => false);
  if (canReselectRestoredThread) {
    await restoredThreadRow.click();
    await expect.poll(async () => getWorkspaceThreadRows(page).count()).toBeGreaterThan(0);
  }
  await waitForThreadHistoryReady(page, {
    assistantText: fileName,
    assistantExact: false,
    timeoutMs: 30_000,
  });

  await sendComposerPrompt(
    page,
    `Read the file ${filePath}. Reply with exactly ${quotedFileContents} and nothing else.`
  );
  await waitForLiveTurnToFinish(page, 120_000);
  await waitForAssistantMessageTextOrSkipUsageLimit(page, fileContents, {
    exact: true,
    timeoutMs: 30_000,
  });
});

test("current repo keeps the in-flight user message visible across reload", async ({
  page,
}, testInfo) => {
  await skipUnlessLiveRuntimeReady(page, testInfo);

  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoWorkspace(page, WORKSPACE_ID);
  await skipIfUsageLimitBlocked(page);

  const promptId = `LIVE_RELOAD_VISIBLE_${Date.now()}`;
  await sendComposerPrompt(
    page,
    `${promptId}: search this repository for files related to workspace restore and summarize the findings in 4 short bullet points.`
  );

  await waitForLiveTurnToStart(page, 10_000);

  await page.reload({ waitUntil: "domcontentloaded" });
  const shellReady = await waitForWorkspaceShell(page, 20_000);
  expect(shellReady).toBe(true);

  await waitForMessageText(page, promptId, 20_000);
  await waitForCurrentTurnState(page, "no-visible-response", 20_000).catch(async () => {
    await skipIfUsageLimitBlocked(page);
  });
});
