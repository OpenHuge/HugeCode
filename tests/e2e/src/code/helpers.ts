import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export function getSidebarSearchToggle(page: Page): Locator {
  return page.getByTestId("sidebar-search-toggle").first();
}

export function getSidebarSortToggle(page: Page): Locator {
  return page.getByTestId("sidebar-sort-toggle").first();
}

export function getSidebarSearchInput(page: Page): Locator {
  return page.getByTestId("sidebar-search-input").first();
}

export function getSidebarEmptyStateAction(page: Page): Locator {
  return page.getByTestId("sidebar-empty-state-action").first();
}

export function getComposerStartHeading(page: Page): Locator {
  return page.getByRole("heading", { name: "Start in the composer." }).first();
}

export function getSidebarSortOption(page: Page, sortKey: "created_at" | "updated_at"): Locator {
  return page
    .getByTestId(sortKey === "created_at" ? "sidebar-sort-created-at" : "sidebar-sort-updated-at")
    .first();
}

export async function clickByDom(locator: Locator) {
  await locator.evaluate((element) => {
    (element as HTMLElement).click();
  });
}

export async function clickByUser(page: Page, locator: Locator, clickTimeoutMs = 5000) {
  await locator.click({ timeout: clickTimeoutMs });
  await assertPageResponsive(page);
}

export async function assertPageResponsive(page: Page, timeoutMs = 2000) {
  const pageState = await Promise.race([
    page.evaluate(() => ({
      readyState: document.readyState,
      rootMounted: Boolean(document.getElementById("root")),
    })),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Page did not respond in ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);

  expect(pageState.readyState).toBe("complete");
  expect(pageState.rootMounted).toBe(true);
}

export async function assertShellHealthy(page: Page) {
  await assertPageResponsive(page);
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function escapeRegExpText(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function pollBoolean(
  predicate: () => Promise<boolean>,
  options?: {
    timeoutMs?: number;
  }
): Promise<boolean> {
  try {
    await expect
      .poll(async () => Boolean(await predicate()), {
        timeout: options?.timeoutMs ?? 5_000,
      })
      .toBe(true);
    return true;
  } catch {
    return false;
  }
}

async function isLocatorActionable(locator: Locator): Promise<boolean> {
  const [visible, enabled] = await Promise.all([
    locator.isVisible().catch(() => false),
    locator.isEnabled().catch(() => false),
  ]);
  return visible && enabled;
}

async function isWorkspaceSurfaceVisible(page: Page): Promise<boolean> {
  const [homeVisible, composerVisible, composerStartVisible, thinkingVisible] = await Promise.all([
    page
      .locator('[data-home-page="true"], [data-home-content="true"]')
      .first()
      .isVisible()
      .catch(() => false),
    getComposerInput(page)
      .isVisible()
      .catch(() => false),
    getComposerStartHeading(page)
      .isVisible()
      .catch(() => false),
    page
      .getByRole("button", { name: "Thinking mode" })
      .first()
      .isVisible()
      .catch(() => false),
  ]);
  return homeVisible || composerVisible || composerStartVisible || thinkingVisible;
}

async function isWorkspaceShellVisible(page: Page): Promise<boolean> {
  const [
    shellVisible,
    homeVisible,
    userMenuVisible,
    workspaceSectionsVisible,
    toggleSearchVisible,
    sortThreadsVisible,
  ] = await Promise.all([
    page
      .locator("[data-workspace-shell]")
      .first()
      .isVisible()
      .catch(() => false),
    page
      .locator('[data-home-page="true"], [data-home-content="true"]')
      .first()
      .isVisible()
      .catch(() => false),
    page
      .getByRole("button", { name: "User menu" })
      .first()
      .isVisible()
      .catch(() => false),
    page
      .getByRole("navigation", { name: "Workspace sections" })
      .first()
      .isVisible()
      .catch(() => false),
    page
      .getByTestId("sidebar-search-toggle")
      .first()
      .isVisible()
      .catch(() => false),
    page
      .getByTestId("sidebar-sort-toggle")
      .first()
      .isVisible()
      .catch(() => false),
  ]);
  return (
    shellVisible ||
    homeVisible ||
    userMenuVisible ||
    workspaceSectionsVisible ||
    toggleSearchVisible ||
    sortThreadsVisible
  );
}

const WORKSPACE_HOME_CONTROL_LABELS = ["Open home", "Hide sidebar", "Show threads sidebar"];

export async function resolveWorkspaceHomeControl(page: Page): Promise<Locator> {
  for (const label of WORKSPACE_HOME_CONTROL_LABELS) {
    const candidate = page.getByRole("button", { name: label }).first();
    if ((await candidate.count()) > 0) {
      return candidate;
    }
  }
  return page.getByRole("button", { name: "Hide sidebar" }).first();
}

export async function openUserMenu(page: Page): Promise<void> {
  const userMenuButton = page.getByRole("button", { name: "User menu" }).first();
  await expect(userMenuButton).toBeVisible();
  await clickByUser(page, userMenuButton);
}

export async function assertUserMenuActionsVisible(
  page: Page,
  actionLabels: string[]
): Promise<void> {
  await openUserMenu(page);
  for (const actionLabel of actionLabels) {
    await expect(page.getByRole("button", { name: actionLabel }).first()).toBeVisible();
  }
  await page.keyboard.press("Escape");
}

export async function clickUserMenuAction(page: Page, actionLabel: string): Promise<void> {
  await openUserMenu(page);
  const actionButton = page.getByRole("button", { name: actionLabel }).first();
  await expect(actionButton).toBeVisible();
  await clickByUser(page, actionButton);
}

const WORKSPACES_NAV_MAX_ATTEMPTS = 4;
const WORKSPACES_NAV_TIMEOUT_MS = 30_000;
const WORKSPACES_NAV_RETRY_DELAY_MS = 1_000;

export async function gotoWorkspaces(page: Page): Promise<void> {
  for (let attempt = 1; attempt <= WORKSPACES_NAV_MAX_ATTEMPTS; attempt += 1) {
    try {
      await page.goto("/workspaces", {
        waitUntil: "domcontentloaded",
        timeout: WORKSPACES_NAV_TIMEOUT_MS,
      });
      await page.waitForSelector("#root", {
        state: "attached",
        timeout: 3_000,
      });
      return;
    } catch (error) {
      if (attempt >= WORKSPACES_NAV_MAX_ATTEMPTS || page.isClosed()) {
        throw error;
      }
      await delay(WORKSPACES_NAV_RETRY_DELAY_MS);
    }
  }
}

export async function gotoWorkspace(page: Page, workspaceId: string): Promise<void> {
  await gotoWorkspaces(page);
  const workspaceNamePattern =
    workspaceId === "workspace-web" ? /Web Workspace/i : new RegExp(workspaceId, "i");
  const openWorkspaceRoute = async () => {
    await page.goto(`/workspaces/${workspaceId}`, {
      waitUntil: "domcontentloaded",
      timeout: WORKSPACES_NAV_TIMEOUT_MS,
    });
  };
  const workspaceCard = getWorkspaceCard(page, workspaceId);
  const workspaceRow = workspaceCard.locator(".workspace-row").first();
  const activeWorkspaceRow = workspaceCard.locator(".workspace-row.active").first();
  const workspaceTreeItem = page.getByRole("treeitem", { name: workspaceNamePattern }).first();
  const fallbackWorkspaceLabel = workspaceId === "workspace-web" ? "Web Workspace" : workspaceId;
  const workspaceLabel =
    (await workspaceRow.textContent().catch(() => fallbackWorkspaceLabel))?.trim() ||
    fallbackWorkspaceLabel;
  const isTargetWorkspaceVisible = async () => {
    if (await activeWorkspaceRow.isVisible().catch(() => false)) {
      return true;
    }
    const workspacePickerText = await page
      .getByRole("button", { name: "Select workspace" })
      .first()
      .textContent()
      .catch(() => null);
    return (
      (typeof workspacePickerText === "string" &&
        (workspacePickerText.includes(workspaceLabel) ||
          workspacePickerText.includes(workspaceId))) ||
      page.url().includes(`/workspaces/${workspaceId}`)
    );
  };

  const clickedWorkspaceHomeButton = await pollBoolean(
    () =>
      page.evaluate(
        (pattern) => {
          const regex = new RegExp(pattern, "i");
          const buttons = Array.from(
            document.querySelectorAll<HTMLElement>('main button, main [role="button"]')
          );
          const target = buttons.find((button) => regex.test(button.textContent ?? ""));
          if (!target) {
            return false;
          }
          target.click();
          return true;
        },
        workspaceId === "workspace-web" ? "Web Workspace" : workspaceId
      ),
    { timeoutMs: 15_000 }
  );
  const hasWorkspaceRow = await workspaceRow.isVisible({ timeout: 15_000 }).catch(() => false);
  if (clickedWorkspaceHomeButton) {
    await assertPageResponsive(page);
    if (
      workspaceId === "workspace-web" &&
      (await pollBoolean(() => isWorkspaceSurfaceVisible(page), { timeoutMs: 20_000 }))
    ) {
      return;
    }
  } else if (hasWorkspaceRow) {
    await clickByDom(workspaceRow);
  } else if (await workspaceTreeItem.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await clickByUser(page, workspaceTreeItem);
  } else {
    await openWorkspaceRoute();
  }

  let shellReady = await waitForWorkspaceShell(page, 20_000);
  let targetWorkspaceActive = await isTargetWorkspaceVisible();
  if (!shellReady || !targetWorkspaceActive) {
    await openWorkspaceRoute();
    shellReady = await waitForWorkspaceShell(page, 20_000);
    targetWorkspaceActive = await pollBoolean(isTargetWorkspaceVisible, {
      timeoutMs: 15_000,
    });
  }
  expect(shellReady).toBe(true);
  expect(targetWorkspaceActive).toBe(true);
  await assertPageResponsive(page);
}

export async function openFirstWorkspace(page: Page): Promise<void> {
  if (await isWorkspaceSurfaceVisible(page)) {
    return;
  }

  const clickedSharedShellWorkspaceButton = await pollBoolean(
    () =>
      page.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll<HTMLElement>('main button, main [role="button"]')
        );
        const target = buttons.find((button) =>
          /Connected|Needs runtime connection/i.test(button.textContent ?? "")
        );
        if (!target) {
          return false;
        }
        target.click();
        return true;
      }),
    { timeoutMs: 15_000 }
  );
  if (clickedSharedShellWorkspaceButton) {
    await assertPageResponsive(page);
    await expect.poll(() => isWorkspaceSurfaceVisible(page), { timeout: 15_000 }).toBe(true);
    return;
  }

  const firstRow = page.locator(".workspace-row").first();
  await expect.poll(async () => firstRow.count(), { timeout: 15_000 }).toBeGreaterThan(0);

  await expect(firstRow).toBeVisible();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await clickByDom(firstRow);
    if (await isWorkspaceSurfaceVisible(page)) {
      return;
    }
  }

  await expect.poll(() => isWorkspaceSurfaceVisible(page), { timeout: 15_000 }).toBe(true);
}

export function getActiveWorkspaceCard(page: Page): Locator {
  return page
    .locator(".workspace-card")
    .filter({ has: page.locator(".workspace-row.active") })
    .first();
}

export function getWorkspaceCard(page: Page, workspaceName: string): Locator {
  const byId = page.locator(`.workspace-card[data-workspace-id="${workspaceName}"]`).first();
  const byName = page
    .locator(".workspace-card")
    .filter({ has: page.locator(".workspace-row").filter({ hasText: workspaceName }).first() })
    .first();
  return byId.or(byName).first();
}

export function getWorkspaceThreadRows(
  page: Page,
  options?: {
    workspaceName?: string;
  }
): Locator {
  const workspaceCard = options?.workspaceName
    ? getWorkspaceCard(page, options.workspaceName)
    : getActiveWorkspaceCard(page);
  return workspaceCard.locator(".thread-row");
}

export async function waitForWorkspaceShell(page: Page, timeoutMs = 15_000): Promise<boolean> {
  return pollBoolean(() => isWorkspaceShellVisible(page), { timeoutMs });
}

const SHARED_SHELL_PENDING_COPY = [
  "Runtime summary is loading in the background so the shared shell can render immediately.",
  "Runtime activity is loading in the background.",
  "Review signals load after the shell becomes interactive.",
];

export async function waitForSharedShellMissionSummaryToSettle(
  page: Page,
  timeoutMs = 15_000
): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate((pendingCopy) => {
          const shell = document.querySelector("[data-workspace-shell]");
          if (!shell) {
            return false;
          }

          const text = shell.textContent ?? "";
          return pendingCopy.every((message) => !text.includes(message));
        }, SHARED_SHELL_PENDING_COPY),
      { timeout: timeoutMs }
    )
    .toBe(true);

  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export async function waitForAppBootFallbackToClear(
  page: Page,
  options?: {
    timeoutMs?: number;
  }
): Promise<void> {
  await expect
    .poll(
      async () =>
        page
          .locator("[data-app-boot]")
          .count()
          .catch(() => 0),
      {
        timeout: options?.timeoutMs ?? 45_000,
      }
    )
    .toBe(0);
}

export async function openFirstThread(
  page: Page,
  options?: {
    workspaceName?: string;
  }
): Promise<boolean> {
  const firstThread = getWorkspaceThreadRows(page, options).first();
  try {
    await expect.poll(async () => firstThread.count(), { timeout: 10_000 }).toBeGreaterThan(0);
  } catch {
    return false;
  }
  await expect(firstThread).toBeVisible();
  await clickByDom(firstThread);
  await assertPageResponsive(page);
  return true;
}

export function getComposerInput(page: Page): Locator {
  return page
    .getByRole("textbox", { name: "Composer draft" })
    .or(page.getByRole("textbox", { name: "Ask Codex to do something..." }))
    .first();
}

export function getQueueButton(page: Page): Locator {
  return page.getByRole("button", { name: "Queue message" }).first();
}

export function getSendButton(page: Page): Locator {
  return page.getByRole("button", { name: "Send" }).first();
}

export function getMessagesSurface(page: Page): Locator {
  return page.locator(".messages").first();
}

export async function selectComposerOption(
  page: Page,
  controlName: "Model" | "Thinking mode" | "Execution path" | "Agent access",
  optionName: string
): Promise<void> {
  const trigger = page.getByRole("button", { name: controlName }).first();
  await expect(trigger).toBeVisible();
  await clickByUser(page, trigger);
  const listbox = page.getByRole("listbox", { name: controlName }).last();
  await expect(listbox).toBeVisible();
  const option = listbox.getByRole("option", { name: optionName }).first();
  await expect(option).toBeVisible({ timeout: 5_000 });
  await clickByDom(option);
  await assertPageResponsive(page);
  await expect(listbox).toBeHidden({ timeout: 5_000 });
  await expectComposerControlValue(page, controlName, optionName, 5_000);
}

export async function expectComposerControlValue(
  page: Page,
  controlName: "Model" | "Thinking mode" | "Execution path" | "Agent access",
  expectedValue: string,
  timeoutMs = 5_000
): Promise<void> {
  const trigger = page.getByRole("button", { name: controlName }).first();
  await expect(trigger).toBeVisible({ timeout: timeoutMs });
  await expect(trigger).toContainText(new RegExp(escapeRegExpText(expectedValue), "i"), {
    timeout: timeoutMs,
  });
}

export async function sendComposerPrompt(
  page: Page,
  prompt: string,
  options?: { submitWithEnter?: boolean }
): Promise<void> {
  const composer = getComposerInput(page);
  await expect(composer).toBeVisible();
  await composer.fill(prompt);
  if (options?.submitWithEnter === false) {
    return;
  }
  const sendButton = getSendButton(page);
  const sendButtonReady = await pollBoolean(() => isLocatorActionable(sendButton), {
    timeoutMs: 5_000,
  });

  if (sendButtonReady) {
    try {
      await clickByUser(page, sendButton);
      return;
    } catch {
      // Fall back to Enter when the control detaches or rerenders during submission.
    }
  }

  await composer.press("Enter");
  await assertPageResponsive(page);
}

export async function queueComposerPrompt(page: Page, prompt: string): Promise<void> {
  const composer = getComposerInput(page);
  await expect(composer).toBeVisible();
  const queueButton = getQueueButton(page);
  const queuedPrompt = page.locator(".composer-queue").getByText(prompt, { exact: false }).first();
  const queueButtonReady = await pollBoolean(
    async () => {
      const currentValue = await composer.inputValue().catch(() => "");
      if (currentValue !== prompt) {
        await composer.fill(prompt);
      }
      return isLocatorActionable(queueButton);
    },
    {
      timeoutMs: 10_000,
    }
  );

  if (!queueButtonReady) {
    throw new Error(
      "Composer never exposed an actionable queue control while the active run was still queueable."
    );
  }

  const queuedCountBefore = await queuedPrompt.count().catch(() => 0);
  await clickByUser(page, queueButton, 2_000);
  const queueAccepted = await pollBoolean(
    async () => {
      const [queuedCount, currentDraftValue] = await Promise.all([
        queuedPrompt.count().catch(() => 0),
        composer.inputValue().catch(() => prompt),
      ]);
      return queuedCount > queuedCountBefore || currentDraftValue !== prompt;
    },
    {
      timeoutMs: 4_000,
    }
  );

  if (queueAccepted) {
    await assertPageResponsive(page);
    return;
  }

  throw new Error(
    "Composer never queued the follow-up prompt while the active run was still queueable."
  );
}

export async function waitForMessageText(
  page: Page,
  text: string,
  timeoutMs = 20_000
): Promise<void> {
  await expect(getMessagesSurface(page).getByText(text, { exact: false }).last()).toBeVisible({
    timeout: timeoutMs,
  });
}

export async function waitForCurrentTurnState(
  page: Page,
  state: "failed" | "complete" | "working" | "idle" | "no-visible-response",
  timeoutMs = 20_000
): Promise<void> {
  await expect
    .poll(
      async () =>
        page
          .getByTestId("messages-root")
          .getAttribute("data-current-turn-state")
          .catch(() => null),
      { timeout: timeoutMs }
    )
    .toBe(state);
}

export async function waitForAssistantMessageText(
  page: Page,
  text: string,
  options?: {
    exact?: boolean;
    timeoutMs?: number;
  }
): Promise<void> {
  await expect(
    getMessagesSurface(page)
      .locator('[data-message-role="assistant"]')
      .getByText(text, { exact: options?.exact ?? false })
      .last()
  ).toBeVisible({
    timeout: options?.timeoutMs ?? 20_000,
  });
}

export async function waitForThreadHistoryReady(
  page: Page,
  options?: {
    assistantText?: string;
    assistantExact?: boolean;
    timeoutMs?: number;
  }
): Promise<void> {
  await expect
    .poll(async () => getMessagesSurface(page).getAttribute("data-thread-history-loading"), {
      timeout: options?.timeoutMs ?? 30_000,
    })
    .toBe("false");

  if (options?.assistantText) {
    await waitForAssistantMessageText(page, options.assistantText, {
      exact: options.assistantExact,
      timeoutMs: options?.timeoutMs,
    });
  }
}

export async function expectQueuedPromptVisible(
  page: Page,
  prompt: string,
  timeoutMs = 10_000
): Promise<void> {
  await expect(
    page.locator(".composer-queue").getByText(prompt, { exact: false }).first()
  ).toBeVisible({
    timeout: timeoutMs,
  });
}

export async function expectQueuedPromptCleared(
  page: Page,
  prompt: string,
  timeoutMs = 20_000
): Promise<void> {
  await expect(
    page.locator(".composer-queue").getByText(prompt, { exact: false }).first()
  ).toBeHidden({
    timeout: timeoutMs,
  });
}

export async function setAppTheme(page: Page, theme: "light" | "dark" | "dim"): Promise<void> {
  await page.evaluate(async (nextTheme) => {
    document.documentElement.dataset.theme = nextTheme;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }, theme);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme ?? null), {
      timeout: 3_000,
    })
    .toBe(theme);
}

export async function stabilizeVisualSnapshot(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
    `,
  });
}

function resolveRuntimeHealthEndpoint(): string {
  const runtimeHealthEndpoint = process.env.CODE_RUNTIME_REPLAY_HEALTH_ENDPOINT?.trim();
  if (runtimeHealthEndpoint) {
    return runtimeHealthEndpoint;
  }

  const runtimeRpcEndpoint =
    process.env.CODE_RUNTIME_REPLAY_RPC_ENDPOINT?.trim() ??
    process.env.VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT?.trim();
  if (!runtimeRpcEndpoint) {
    return "http://127.0.0.1:8788/health";
  }
  try {
    const parsed = new URL(runtimeRpcEndpoint);
    parsed.pathname = "/health";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "http://127.0.0.1:8788/health";
  }
}

function resolveRuntimeRpcEndpoint(): string {
  const runtimeRpcEndpoint =
    process.env.CODE_RUNTIME_REPLAY_RPC_ENDPOINT?.trim() ??
    process.env.VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT?.trim();
  if (!runtimeRpcEndpoint) {
    return "http://127.0.0.1:8788/rpc";
  }
  return runtimeRpcEndpoint;
}

type RuntimeWorkspaceListEntry = {
  id?: string;
  displayName?: string;
  path?: string;
};

async function runtimeRpcRequest<T>(
  request: APIRequestContext,
  method: string,
  params: Record<string, unknown>
): Promise<T> {
  const response = await request.post(resolveRuntimeRpcEndpoint(), {
    timeout: 5_000,
    data: {
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    },
  });
  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as {
    ok?: boolean;
    result?: T;
    error?: { message?: string };
  };
  expect(payload.ok).toBe(true);
  return payload.result as T;
}

export async function ensureRuntimeWorkspaceExists(
  request: APIRequestContext,
  options: {
    displayName: string;
    path: string;
  }
): Promise<string> {
  const workspaces = await runtimeRpcRequest<RuntimeWorkspaceListEntry[]>(
    request,
    "code_workspaces_list",
    {}
  );
  const existing = workspaces.find(
    (entry) => entry.displayName === options.displayName || entry.path === options.path
  );
  if (existing?.id) {
    return existing.id;
  }

  const created = await runtimeRpcRequest<RuntimeWorkspaceListEntry>(
    request,
    "code_workspace_create",
    {
      path: options.path,
      displayName: options.displayName,
    }
  );
  expect(created.id).toBeTruthy();
  return created.id as string;
}

export async function isRuntimeGatewayReady(request: APIRequestContext): Promise<boolean> {
  const healthEndpoint = resolveRuntimeHealthEndpoint();
  try {
    const response = await request.get(healthEndpoint, { timeout: 1_500 });
    if (!response.ok()) {
      return false;
    }
    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return true;
    }
    const app = (payload as { app?: unknown }).app;
    if (typeof app === "string" && app.length > 0) {
      return app === "code-runtime-service-rs";
    }
    return true;
  } catch {
    return false;
  }
}
