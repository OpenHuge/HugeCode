import { expect, test } from "@playwright/test";
import {
  ensureRuntimeWorkspaceExists,
  gotoWorkspace,
  sendComposerPrompt,
  waitForThreadHistoryReady,
  waitForWorkspaceShell,
} from "./helpers";
import {
  skipIfUsageLimitBlocked,
  skipUnlessLiveRuntimeReady,
  waitForAssistantMessageTextOrSkipUsageLimit,
  waitForLiveTurnToFinish,
} from "./liveRuntimeHelpers";

const WORKSPACE_ID = "demo";
const FILE_PREFIX = "E2E_DEMO_RUNTIME_CHAIN";
const DEMO_WORKSPACE_PATH = process.env.E2E_DEMO_WORKSPACE_PATH ?? "/tmp/hypecode-demo";

test.describe.configure({ mode: "serial", timeout: 240_000 });

test("workspace route follows sidebar selection and survives reload", async ({
  page,
}, testInfo) => {
  await skipUnlessLiveRuntimeReady(page, testInfo);
  await ensureRuntimeWorkspaceExists(page.request, {
    displayName: WORKSPACE_ID,
    path: DEMO_WORKSPACE_PATH,
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoWorkspace(page, "workspace-web");
  await skipIfUsageLimitBlocked(page);

  const demoWorkspaceTreeItem = page.getByRole("treeitem", { name: /^demo\b/i }).first();
  await expect(demoWorkspaceTreeItem).toBeVisible({ timeout: 15_000 });
  const demoWorkspaceId = await demoWorkspaceTreeItem.getAttribute("data-workspace-id");
  expect(demoWorkspaceId).toBeTruthy();
  await demoWorkspaceTreeItem.click();

  await expect(page).toHaveURL(new RegExp(`/workspaces/${demoWorkspaceId}(?:\\?|$)`));
  await expect(demoWorkspaceTreeItem).toHaveAttribute("aria-selected", "true");

  await page.goBack({ waitUntil: "domcontentloaded" });
  expect(await waitForWorkspaceShell(page, 20_000)).toBe(true);
  await expect(page).toHaveURL(/\/workspaces\/workspace-web(?:\?|$)/);
  await expect(page.getByRole("treeitem", { name: /^Web Workspace\b/i }).first()).toHaveAttribute(
    "aria-selected",
    "true"
  );

  await page.goForward({ waitUntil: "domcontentloaded" });
  expect(await waitForWorkspaceShell(page, 20_000)).toBe(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  const shellReady = await waitForWorkspaceShell(page, 20_000);
  expect(shellReady).toBe(true);
  await expect(page).toHaveURL(new RegExp(`/workspaces/${demoWorkspaceId}(?:\\?|$)`));
  await expect(page.getByRole("treeitem", { name: /^demo\b/i }).first()).toHaveAttribute(
    "aria-selected",
    "true"
  );
});

test("demo workspace executes a real write-read flow across reload", async ({ page }, testInfo) => {
  await skipUnlessLiveRuntimeReady(page, testInfo);
  await ensureRuntimeWorkspaceExists(page.request, {
    displayName: WORKSPACE_ID,
    path: DEMO_WORKSPACE_PATH,
  });

  const promptId = `${FILE_PREFIX}_${Date.now()}`;
  const fileName = `${promptId}.txt`;
  const filePath = `${promptId}.txt`;
  const fileContents = `${promptId} content`;
  const quotedFileContents = JSON.stringify(fileContents);

  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoWorkspace(page, WORKSPACE_ID);

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

  await page.reload({ waitUntil: "domcontentloaded" });
  const shellReady = await waitForWorkspaceShell(page, 20_000);
  expect(shellReady).toBe(true);
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
