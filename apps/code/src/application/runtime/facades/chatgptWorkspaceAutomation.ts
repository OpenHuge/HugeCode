import { getDesktopHostBridge } from "../ports/desktopHostBridge";
import type { LocalChromeDebuggerEndpointDescriptor } from "../ports/desktopHostBridge";
import type { OAuthAccountSummary } from "../ports/tauriOauth";

const CHATGPT_APP_URL = "https://chatgpt.com/";
const CHATGPT_ACCOUNTS_CHECK_PATH = "/backend-api/accounts/check/v4-2023-04-27";
const DEFAULT_LOCAL_CHROME_DEBUG_PORTS = [9222, 9223, 9333] as const;
const LOCAL_CHROME_DEBUGGING_HINT =
  "Start Chrome or Chromium with --remote-debugging-port=9222, keep ChatGPT signed in, and retry.";

type JsonRecord = Record<string, unknown>;

export type LocalChromeDebuggerEndpoint = {
  httpBaseUrl: string;
  webSocketDebuggerUrl: string;
};

export type RemoteChatgptWorkspace = {
  remoteWorkspaceId: string;
  title: string | null;
  isDeactivated: boolean;
};

export type DeactivatedChatgptWorkspaceCandidate = {
  localWorkspace: NonNullable<OAuthAccountSummary["chatgptWorkspaces"]>[number];
  remoteWorkspace: RemoteChatgptWorkspace;
};

export type ReviewDeactivatedChatgptWorkspacesResult = {
  status: "supported" | "blocked" | "failed";
  message: string;
  endpoint: LocalChromeDebuggerEndpoint | null;
  candidates: DeactivatedChatgptWorkspaceCandidate[];
  remoteWorkspaces: RemoteChatgptWorkspace[];
};

export type LeaveDeactivatedChatgptWorkspacesInput = {
  account: OAuthAccountSummary;
  candidates: readonly DeactivatedChatgptWorkspaceCandidate[];
};

export type LeaveDeactivatedChatgptWorkspacesResult = {
  status: "completed" | "blocked" | "failed";
  message: string;
  endpoint: LocalChromeDebuggerEndpoint | null;
  leftWorkspaceIds: string[];
  failedWorkspaceIds: string[];
};

export type RemoteChatgptAccountIdentity = {
  externalAccountId: string | null;
  email: string | null;
  title: string | null;
};

type ReviewDeactivatedChatgptWorkspacesDeps = {
  resolveChromeDebuggerEndpoint(): Promise<LocalChromeDebuggerEndpoint | null>;
  reviewRemoteWorkspaces(
    endpoint: LocalChromeDebuggerEndpoint,
    account: OAuthAccountSummary
  ): Promise<RemoteChatgptWorkspace[]>;
  readActiveAccountIdentity(
    endpoint: LocalChromeDebuggerEndpoint
  ): Promise<RemoteChatgptAccountIdentity | null>;
};

type LeaveWorkspaceExecutionResult = {
  remoteWorkspaceId: string;
  left: boolean;
  message?: string | null;
};

type LeaveDeactivatedChatgptWorkspacesDeps = {
  resolveChromeDebuggerEndpoint(): Promise<LocalChromeDebuggerEndpoint | null>;
  executeLeave(
    endpoint: LocalChromeDebuggerEndpoint,
    account: OAuthAccountSummary,
    candidate: DeactivatedChatgptWorkspaceCandidate
  ): Promise<LeaveWorkspaceExecutionResult>;
};

type ChromeDebuggerVersionPayload = {
  webSocketDebuggerUrl?: string;
};

type ChromeDebuggerTargetPayload = {
  id?: string;
  type?: string;
  url?: string;
  title?: string;
  webSocketDebuggerUrl?: string;
};

type CdpSession = {
  close(): void;
  send<T>(method: string, params?: Record<string, unknown>): Promise<T>;
};

type ResolveLocalChromeDebuggerEndpointDeps = {
  fallbackPorts?: readonly number[];
  fetchVersionPayload(httpBaseUrl: string): Promise<ChromeDebuggerVersionPayload>;
  listDesktopHostEndpoints(): Promise<LocalChromeDebuggerEndpoint[]>;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  return null;
}

function normalizeWorkspaceKey(value: string | null | undefined): string | null {
  const text = readNonEmptyText(value);
  return text ? text.toLocaleLowerCase() : null;
}

function readWorkspaceTitle(
  workspace: NonNullable<OAuthAccountSummary["chatgptWorkspaces"]>[number]
): string | null {
  return readNonEmptyText(workspace.title) ?? readNonEmptyText(workspace.workspaceId);
}

function formatWorkspaceList(workspaces: readonly string[]): string {
  if (workspaces.length === 0) {
    return "";
  }
  if (workspaces.length === 1) {
    return workspaces[0] ?? "";
  }
  return `${workspaces.slice(0, -1).join(", ")} and ${workspaces.at(-1)}`;
}

function buildUnavailableResult(message: string): ReviewDeactivatedChatgptWorkspacesResult {
  return {
    status: "blocked",
    message,
    endpoint: null,
    candidates: [],
    remoteWorkspaces: [],
  };
}

export function doesActiveChatgptAccountMatch(
  account: OAuthAccountSummary,
  activeAccount: RemoteChatgptAccountIdentity | null
): boolean {
  if (!activeAccount) {
    return false;
  }
  const localExternalAccountId = normalizeWorkspaceKey(account.externalAccountId);
  const localEmail = normalizeWorkspaceKey(account.email);
  const activeExternalAccountId = normalizeWorkspaceKey(activeAccount.externalAccountId);
  const activeEmail = normalizeWorkspaceKey(activeAccount.email);
  const externalAccountMatches =
    localExternalAccountId !== null &&
    activeExternalAccountId !== null &&
    localExternalAccountId === activeExternalAccountId;
  const emailMatches = localEmail !== null && activeEmail !== null && localEmail === activeEmail;
  return externalAccountMatches || emailMatches;
}

export async function reviewDeactivatedChatgptWorkspacesWithDeps(
  account: OAuthAccountSummary,
  deps: ReviewDeactivatedChatgptWorkspacesDeps
): Promise<ReviewDeactivatedChatgptWorkspacesResult> {
  const memberships = account.chatgptWorkspaces ?? [];
  if (memberships.length === 0) {
    return {
      status: "supported",
      message: "No ChatGPT workspaces are recorded for this account.",
      endpoint: null,
      candidates: [],
      remoteWorkspaces: [],
    };
  }

  const endpoint = await deps.resolveChromeDebuggerEndpoint();
  if (!endpoint) {
    return buildUnavailableResult(
      `Local Chrome DevTools is unavailable. ${LOCAL_CHROME_DEBUGGING_HINT}`
    );
  }

  try {
    const remoteWorkspaces = await deps.reviewRemoteWorkspaces(endpoint, account);
    const activeAccount = await deps.readActiveAccountIdentity(endpoint);
    if (!doesActiveChatgptAccountMatch(account, activeAccount)) {
      const activeIdentityLabel =
        readNonEmptyText(activeAccount?.email) ??
        readNonEmptyText(activeAccount?.title) ??
        readNonEmptyText(activeAccount?.externalAccountId) ??
        "an unverified ChatGPT account";
      return {
        status: "blocked",
        message: `The active ChatGPT session belongs to ${activeIdentityLabel}, which does not match HugeCode account ${account.accountId}. Switch to the matching ChatGPT account before leaving workspaces.`,
        endpoint,
        candidates: [],
        remoteWorkspaces,
      };
    }
    const candidates = memberships.flatMap((localWorkspace) => {
      const localId = normalizeWorkspaceKey(localWorkspace.workspaceId);
      const localTitle = normalizeWorkspaceKey(readWorkspaceTitle(localWorkspace));
      const remoteWorkspace =
        remoteWorkspaces.find((candidate) => {
          const remoteId = normalizeWorkspaceKey(candidate.remoteWorkspaceId);
          const remoteTitle = normalizeWorkspaceKey(candidate.title);
          const idMatches = localId !== null && remoteId !== null && remoteId === localId;
          const titleMatches =
            localTitle !== null && remoteTitle !== null && remoteTitle === localTitle;
          return (idMatches || titleMatches) && candidate.isDeactivated;
        }) ?? null;
      return remoteWorkspace
        ? [
            {
              localWorkspace,
              remoteWorkspace,
            } satisfies DeactivatedChatgptWorkspaceCandidate,
          ]
        : [];
    });

    if (candidates.length === 0) {
      return {
        status: "supported",
        message: "No deactivated ChatGPT workspaces were confirmed.",
        endpoint,
        candidates,
        remoteWorkspaces,
      };
    }

    const candidateNames = candidates.map(
      (candidate) =>
        readWorkspaceTitle(candidate.localWorkspace) ??
        candidate.remoteWorkspace.title ??
        candidate.remoteWorkspace.remoteWorkspaceId
    );
    return {
      status: "supported",
      message: `Found ${candidates.length} deactivated ChatGPT workspace${candidates.length === 1 ? "" : "s"}: ${formatWorkspaceList(candidateNames)}.`,
      endpoint,
      candidates,
      remoteWorkspaces,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : "Failed to inspect ChatGPT workspaces through local Chrome DevTools.";
    return {
      status: "failed",
      message,
      endpoint,
      candidates: [],
      remoteWorkspaces: [],
    };
  }
}

export async function leaveDeactivatedChatgptWorkspacesWithDeps(
  input: LeaveDeactivatedChatgptWorkspacesInput,
  deps: LeaveDeactivatedChatgptWorkspacesDeps
): Promise<LeaveDeactivatedChatgptWorkspacesResult> {
  if (input.candidates.length === 0) {
    return {
      status: "completed",
      message: "No workspaces were left.",
      endpoint: null,
      leftWorkspaceIds: [],
      failedWorkspaceIds: [],
    };
  }

  const endpoint = await deps.resolveChromeDebuggerEndpoint();
  if (!endpoint) {
    return {
      status: "blocked",
      message: `Local Chrome DevTools is unavailable. ${LOCAL_CHROME_DEBUGGING_HINT}`,
      endpoint: null,
      leftWorkspaceIds: [],
      failedWorkspaceIds: input.candidates.map((candidate) => candidate.localWorkspace.workspaceId),
    };
  }

  try {
    const results = await Promise.all(
      input.candidates.map((candidate) => deps.executeLeave(endpoint, input.account, candidate))
    );
    const leftWorkspaceIds = results
      .filter((result) => result.left)
      .map((result) => result.remoteWorkspaceId);
    const failedWorkspaceIds = results
      .filter((result) => !result.left)
      .map((result) => result.remoteWorkspaceId);
    const leftNames = input.candidates
      .filter((candidate) => leftWorkspaceIds.includes(candidate.localWorkspace.workspaceId))
      .map(
        (candidate) =>
          readWorkspaceTitle(candidate.localWorkspace) ??
          candidate.remoteWorkspace.title ??
          candidate.localWorkspace.workspaceId
      );
    return {
      status: failedWorkspaceIds.length === 0 ? "completed" : "failed",
      message:
        leftNames.length > 0
          ? `Left ${formatWorkspaceList(leftNames)}.`
          : "Failed to leave the selected ChatGPT workspaces.",
      endpoint,
      leftWorkspaceIds,
      failedWorkspaceIds,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : "Failed to leave deactivated ChatGPT workspaces.";
    return {
      status: "failed",
      message,
      endpoint,
      leftWorkspaceIds: [],
      failedWorkspaceIds: input.candidates.map((candidate) => candidate.localWorkspace.workspaceId),
    };
  }
}

export function reviewDeactivatedChatgptWorkspaces(account: OAuthAccountSummary) {
  return reviewDeactivatedChatgptWorkspacesWithDeps(account, {
    resolveChromeDebuggerEndpoint: resolveLocalChromeDebuggerEndpoint,
    reviewRemoteWorkspaces: reviewRemoteChatgptWorkspaces,
    readActiveAccountIdentity: readActiveRemoteChatgptAccountIdentity,
  });
}

export function leaveDeactivatedChatgptWorkspaces(input: LeaveDeactivatedChatgptWorkspacesInput) {
  return leaveDeactivatedChatgptWorkspacesWithDeps(input, {
    resolveChromeDebuggerEndpoint: resolveLocalChromeDebuggerEndpoint,
    executeLeave: leaveRemoteChatgptWorkspace,
  });
}

function normalizeDesktopHostDebuggerEndpoint(
  endpoint: LocalChromeDebuggerEndpointDescriptor
): LocalChromeDebuggerEndpoint | null {
  const httpBaseUrl = readNonEmptyText(endpoint.httpBaseUrl);
  const webSocketDebuggerUrl = readNonEmptyText(endpoint.webSocketDebuggerUrl);
  if (!httpBaseUrl || !webSocketDebuggerUrl) {
    return null;
  }

  return {
    httpBaseUrl,
    webSocketDebuggerUrl,
  };
}

async function listDesktopHostChromeDebuggerEndpoints(): Promise<LocalChromeDebuggerEndpoint[]> {
  const desktopHostBridge = getDesktopHostBridge();
  try {
    const endpoints = await desktopHostBridge?.browserDebug?.listLocalChromeDebuggerEndpoints?.();
    if (!Array.isArray(endpoints) || endpoints.length === 0) {
      return [];
    }

    return endpoints
      .map((endpoint) => normalizeDesktopHostDebuggerEndpoint(endpoint))
      .filter((endpoint): endpoint is LocalChromeDebuggerEndpoint => endpoint !== null);
  } catch {
    return [];
  }
}

export async function resolveLocalChromeDebuggerEndpointWithDeps(
  deps: ResolveLocalChromeDebuggerEndpointDeps
): Promise<LocalChromeDebuggerEndpoint | null> {
  const desktopHostEndpoints = await deps.listDesktopHostEndpoints();
  if (desktopHostEndpoints.length > 0) {
    return desktopHostEndpoints[0] ?? null;
  }

  for (const port of deps.fallbackPorts ?? DEFAULT_LOCAL_CHROME_DEBUG_PORTS) {
    const httpBaseUrl = `http://127.0.0.1:${port}`;
    try {
      const payload = await deps.fetchVersionPayload(httpBaseUrl);
      const webSocketDebuggerUrl = readNonEmptyText(payload?.webSocketDebuggerUrl);
      if (!webSocketDebuggerUrl) {
        continue;
      }
      return {
        httpBaseUrl,
        webSocketDebuggerUrl,
      };
    } catch {
      continue;
    }
  }

  return null;
}

async function resolveLocalChromeDebuggerEndpoint(): Promise<LocalChromeDebuggerEndpoint | null> {
  if (typeof fetch !== "function") {
    return null;
  }

  return resolveLocalChromeDebuggerEndpointWithDeps({
    fetchVersionPayload(httpBaseUrl) {
      return fetchJsonWithTimeout<ChromeDebuggerVersionPayload>(`${httpBaseUrl}/json/version`);
    },
    listDesktopHostEndpoints: listDesktopHostChromeDebuggerEndpoints,
  });
}

async function fetchJsonWithTimeout<T>(url: string, options: RequestInit = {}): Promise<T> {
  if (typeof fetch !== "function") {
    throw new Error("Fetch API is unavailable in this runtime.");
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1_200);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}.`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isChatgptTargetUrl(url: string | null | undefined): boolean {
  const text = readNonEmptyText(url);
  if (!text) {
    return false;
  }
  return text.startsWith("https://chatgpt.com") || text.startsWith("https://chat.openai.com");
}

async function listChromeDebuggerTargets(
  endpoint: LocalChromeDebuggerEndpoint
): Promise<ChromeDebuggerTargetPayload[]> {
  const payload = await fetchJsonWithTimeout<unknown>(`${endpoint.httpBaseUrl}/json/list`);
  return Array.isArray(payload) ? payload.filter(isRecord) : [];
}

async function openChromeDebuggerTarget(
  endpoint: LocalChromeDebuggerEndpoint
): Promise<ChromeDebuggerTargetPayload> {
  const response = await fetchJsonWithTimeout<unknown>(
    `${endpoint.httpBaseUrl}/json/new?${encodeURIComponent(CHATGPT_APP_URL)}`,
    { method: "PUT" }
  );
  if (!isRecord(response)) {
    throw new Error("Chrome DevTools returned an invalid target payload.");
  }
  return response as ChromeDebuggerTargetPayload;
}

async function resolveChatgptTarget(
  endpoint: LocalChromeDebuggerEndpoint
): Promise<ChromeDebuggerTargetPayload> {
  const targets = await listChromeDebuggerTargets(endpoint);
  const existingTarget =
    targets.find(
      (target) =>
        target.type === "page" &&
        isChatgptTargetUrl(target.url) &&
        readNonEmptyText(target.webSocketDebuggerUrl) !== null
    ) ?? null;
  if (existingTarget) {
    return existingTarget;
  }
  const openedTarget = await openChromeDebuggerTarget(endpoint);
  if (readNonEmptyText(openedTarget.webSocketDebuggerUrl) === null) {
    throw new Error("Chrome DevTools opened a ChatGPT tab without a debuggable page target.");
  }
  return openedTarget;
}

async function connectCdpSession(webSocketUrl: string): Promise<CdpSession> {
  if (typeof WebSocket !== "function") {
    throw new Error("WebSocket is unavailable in this runtime.");
  }

  const socket = new WebSocket(webSocketUrl);
  let closed = false;
  let nextMessageId = 0;
  const pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (reason?: unknown) => void;
    }
  >();

  const openPromise = new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener(
      "error",
      () => reject(new Error("Unable to connect to Chrome DevTools WebSocket.")),
      { once: true }
    );
  });

  socket.addEventListener("message", (event) => {
    let payload: unknown;
    try {
      payload =
        typeof event.data === "string" ? JSON.parse(event.data) : JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (!isRecord(payload) || typeof payload.id !== "number") {
      return;
    }
    const entry = pending.get(payload.id);
    if (!entry) {
      return;
    }
    pending.delete(payload.id);
    if ("error" in payload && payload.error) {
      entry.reject(
        new Error(
          readNonEmptyText((payload.error as JsonRecord).message) ??
            "Chrome DevTools command failed."
        )
      );
      return;
    }
    entry.resolve(payload.result);
  });

  socket.addEventListener("close", () => {
    closed = true;
    for (const entry of pending.values()) {
      entry.reject(new Error("Chrome DevTools connection closed before the command completed."));
    }
    pending.clear();
  });

  await openPromise;

  return {
    close() {
      if (closed) {
        return;
      }
      closed = true;
      socket.close();
    },
    send<T>(method: string, params?: Record<string, unknown>) {
      if (closed) {
        return Promise.reject(new Error("Chrome DevTools connection is already closed."));
      }
      nextMessageId += 1;
      const id = nextMessageId;
      return new Promise<T>((resolve, reject) => {
        pending.set(id, {
          resolve(value) {
            resolve(value as T);
          },
          reject,
        });
        socket.send(
          JSON.stringify({
            id,
            method,
            params,
          })
        );
      });
    },
  };
}

async function evaluateJson<T>(session: CdpSession, expression: string): Promise<T> {
  const payload = await session.send<{
    result?: {
      type?: string;
      value?: unknown;
      description?: string;
    };
    exceptionDetails?: {
      text?: string;
      exception?: {
        description?: string;
      };
    };
  }>("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (payload.exceptionDetails) {
    throw new Error(
      readNonEmptyText(payload.exceptionDetails.exception?.description) ??
        readNonEmptyText(payload.exceptionDetails.text) ??
        "Chrome DevTools page evaluation failed."
    );
  }
  return (payload.result?.value ?? null) as T;
}

function buildWorkspaceReviewExpression() {
  return `(() => (async () => {
    const response = await fetch(${JSON.stringify(CHATGPT_ACCOUNTS_CHECK_PATH)}, {
      credentials: "include",
      headers: { "accept": "application/json" }
    });
    if (!response.ok) {
      throw new Error("ChatGPT workspace check failed with status " + response.status);
    }
    return await response.json();
  })())()`;
}

function buildWorkspaceLeaveExpression(
  candidate: DeactivatedChatgptWorkspaceCandidate,
  account: OAuthAccountSummary
) {
  return `(() => (async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const normalize = (value) => typeof value === "string" ? value.trim().toLowerCase() : "";
    const workspaceTitle = ${JSON.stringify(candidate.remoteWorkspace.title ?? readWorkspaceTitle(candidate.localWorkspace) ?? candidate.localWorkspace.workspaceId)};
    const accountEmail = ${JSON.stringify(readNonEmptyText(account.email))};
    const clickElement = (element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      element.click();
      element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      return true;
    };
    const findByText = (selector, text, root = document) => {
      const normalizedText = normalize(text);
      return Array.from(root.querySelectorAll(selector)).find((element) => {
        const content = normalize(element.textContent || "");
        return content.includes(normalizedText);
      }) || null;
    };
    const findAllByText = (selector, text, root = document) => {
      const normalizedText = normalize(text);
      return Array.from(root.querySelectorAll(selector)).filter((element) => {
        const content = normalize(element.textContent || "");
        return content.includes(normalizedText);
      });
    };
    const allButtons = () => Array.from(document.querySelectorAll("button,[role='button'],[aria-haspopup='menu']"));
    const accountMenuTriggers =
      accountEmail
        ? allButtons().filter((element) => {
            const content = normalize(element.textContent || "");
            return content.includes(normalize(accountEmail));
          })
        : [];
    const workspaceMenuTriggers = allButtons().filter((element) => {
      const content = normalize(element.textContent || "");
      return content.includes(normalize(workspaceTitle));
    });
    const menuTriggerCandidates =
      accountMenuTriggers.length > 0 ? accountMenuTriggers : workspaceMenuTriggers;
    if (menuTriggerCandidates.length > 1) {
      throw new Error("Unable to uniquely identify the ChatGPT workspace switcher for this account.");
    }
    const menuTrigger = menuTriggerCandidates[0] || null;
    if (!menuTrigger || !clickElement(menuTrigger)) {
      throw new Error("Unable to open the ChatGPT workspace switcher.");
    }
    await sleep(250);
    const workspaceRows =
      findAllByText("[role='menuitem'],button,div,li", workspaceTitle).filter(
        (element) => !menuTriggerCandidates.includes(element)
      ) || [];
    if (workspaceRows.length > 1) {
      throw new Error("Multiple ChatGPT workspaces share this title. Leave the workspace manually from ChatGPT.");
    }
    const workspaceRow = workspaceRows[0] || findByText("*", workspaceTitle);
    if (!workspaceRow) {
      throw new Error("Unable to find the deactivated ChatGPT workspace in the switcher.");
    }
    const actionButton =
      workspaceRow.querySelector("button[aria-haspopup='menu'],button,[role='button']") ||
      workspaceRow.closest("li,div")?.querySelector("button[aria-haspopup='menu'],button,[role='button']") ||
      null;
    if (!actionButton || !clickElement(actionButton)) {
      throw new Error("Unable to open workspace actions for the deactivated workspace.");
    }
    await sleep(250);
    const leaveAction = findByText("[role='menuitem'],button,[role='button']", "Leave workspace");
    if (!leaveAction || !clickElement(leaveAction)) {
      throw new Error("Unable to find the Leave workspace action.");
    }
    await sleep(250);
    if (accountEmail) {
      const emailInput =
        document.querySelector("input[type='email']") ||
        Array.from(document.querySelectorAll("input")).find((element) => {
          const label = normalize(element.getAttribute("placeholder") || "");
          return label.includes("email");
        }) ||
        null;
      if (emailInput instanceof HTMLInputElement) {
        emailInput.focus();
        emailInput.value = accountEmail;
        emailInput.dispatchEvent(new Event("input", { bubbles: true }));
        emailInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    await sleep(150);
    const confirmButton = Array.from(document.querySelectorAll("button")).find((element) => {
      const content = normalize(element.textContent || "");
      return content === "leave workspace";
    }) || null;
    if (!confirmButton || !clickElement(confirmButton)) {
      throw new Error("Unable to confirm leaving the workspace.");
    }
    await sleep(600);
    return { left: true };
  })())()`;
}

async function withChatgptPageSession<T>(
  endpoint: LocalChromeDebuggerEndpoint,
  handler: (session: CdpSession) => Promise<T>
): Promise<T> {
  const target = await resolveChatgptTarget(endpoint);
  const pageSocketUrl = readNonEmptyText(target.webSocketDebuggerUrl);
  if (!pageSocketUrl) {
    throw new Error("ChatGPT page target is not debuggable.");
  }
  const session = await connectCdpSession(pageSocketUrl);
  try {
    await session.send("Page.enable");
    await session.send("Runtime.enable");
    if (!isChatgptTargetUrl(target.url)) {
      await session.send("Page.navigate", { url: CHATGPT_APP_URL });
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    await session.send("Page.bringToFront");
    return await handler(session);
  } finally {
    session.close();
  }
}

function parseRemoteChatgptWorkspaces(payload: unknown): RemoteChatgptWorkspace[] {
  const candidateRecords: JsonRecord[] = [];
  if (isRecord(payload)) {
    const directArrays = [
      payload.accounts,
      payload.workspaces,
      payload.organizations,
      payload.accounts_ordered,
    ];
    for (const value of directArrays) {
      if (Array.isArray(value)) {
        candidateRecords.push(...value.filter(isRecord));
      }
    }
  }

  const seenKeys = new Set<string>();
  return candidateRecords.flatMap((record) => {
    const remoteWorkspaceId =
      readNonEmptyText(record.account_id) ??
      readNonEmptyText(record.accountId) ??
      readNonEmptyText(record.workspace_id) ??
      readNonEmptyText(record.workspaceId) ??
      readNonEmptyText(record.organization_id) ??
      readNonEmptyText(record.organizationId) ??
      readNonEmptyText(record.id);
    const title =
      readNonEmptyText(record.account_name) ??
      readNonEmptyText(record.accountName) ??
      readNonEmptyText(record.workspace_name) ??
      readNonEmptyText(record.workspaceName) ??
      readNonEmptyText(record.organization_name) ??
      readNonEmptyText(record.organizationName) ??
      readNonEmptyText(record.name) ??
      readNonEmptyText(record.title);
    const isDeactivated =
      readBoolean(record.is_deactivated) ??
      readBoolean(record.isDeactivated) ??
      readBoolean(record.deactivated) ??
      false;
    if (!remoteWorkspaceId) {
      return [];
    }
    const seenKey = `${remoteWorkspaceId}:${title ?? ""}`;
    if (seenKeys.has(seenKey)) {
      return [];
    }
    seenKeys.add(seenKey);
    return [
      {
        remoteWorkspaceId,
        title,
        isDeactivated,
      } satisfies RemoteChatgptWorkspace,
    ];
  });
}

export function parseRemoteChatgptAccountIdentity(
  payload: unknown
): RemoteChatgptAccountIdentity | null {
  if (!isRecord(payload)) {
    return null;
  }

  const accountRecords = [
    payload.accounts,
    payload.accounts_ordered,
    payload.workspaces,
    payload.organizations,
  ]
    .flatMap((value) => (Array.isArray(value) ? value.filter(isRecord) : []))
    .map((record) => ({
      externalAccountId:
        readNonEmptyText(record.account_id) ??
        readNonEmptyText(record.accountId) ??
        readNonEmptyText(record.workspace_id) ??
        readNonEmptyText(record.workspaceId) ??
        readNonEmptyText(record.organization_id) ??
        readNonEmptyText(record.organizationId) ??
        readNonEmptyText(record.id),
      email:
        readNonEmptyText(record.email) ??
        readNonEmptyText(record.account_email) ??
        readNonEmptyText(record.accountEmail) ??
        readNonEmptyText(record.user_email) ??
        readNonEmptyText(record.userEmail),
      title:
        readNonEmptyText(record.account_name) ??
        readNonEmptyText(record.accountName) ??
        readNonEmptyText(record.workspace_name) ??
        readNonEmptyText(record.workspaceName) ??
        readNonEmptyText(record.organization_name) ??
        readNonEmptyText(record.organizationName) ??
        readNonEmptyText(record.name) ??
        readNonEmptyText(record.title),
      isActive:
        readBoolean(record.is_current) ??
        readBoolean(record.isCurrent) ??
        readBoolean(record.current) ??
        readBoolean(record.is_selected) ??
        readBoolean(record.isSelected) ??
        readBoolean(record.selected) ??
        readBoolean(record.is_active) ??
        readBoolean(record.isActive) ??
        readBoolean(record.active) ??
        readBoolean(record.is_default) ??
        readBoolean(record.isDefault) ??
        readBoolean(record.default) ??
        false,
    }));

  if (accountRecords.length === 0) {
    return null;
  }

  const activeRecord =
    accountRecords.find((record) => record.isActive) ??
    accountRecords.find(
      (record) =>
        normalizeWorkspaceKey(record.externalAccountId) ===
        normalizeWorkspaceKey(
          readNonEmptyText(payload.current_account_id) ??
            readNonEmptyText(payload.currentAccountId) ??
            readNonEmptyText(payload.active_account_id) ??
            readNonEmptyText(payload.activeAccountId)
        )
    ) ??
    (accountRecords.length === 1 ? (accountRecords[0] ?? null) : null);

  if (!activeRecord) {
    return null;
  }

  return {
    externalAccountId: activeRecord.externalAccountId,
    email: activeRecord.email,
    title: activeRecord.title,
  };
}

async function reviewRemoteChatgptWorkspaces(
  endpoint: LocalChromeDebuggerEndpoint
): Promise<RemoteChatgptWorkspace[]> {
  return withChatgptPageSession(endpoint, async (session) => {
    const payload = await evaluateJson<unknown>(session, buildWorkspaceReviewExpression());
    return parseRemoteChatgptWorkspaces(payload);
  });
}

async function readActiveRemoteChatgptAccountIdentity(
  endpoint: LocalChromeDebuggerEndpoint
): Promise<RemoteChatgptAccountIdentity | null> {
  return withChatgptPageSession(endpoint, async (session) => {
    const payload = await evaluateJson<unknown>(session, buildWorkspaceReviewExpression());
    return parseRemoteChatgptAccountIdentity(payload);
  });
}

async function leaveRemoteChatgptWorkspace(
  endpoint: LocalChromeDebuggerEndpoint,
  account: OAuthAccountSummary,
  candidate: DeactivatedChatgptWorkspaceCandidate
): Promise<LeaveWorkspaceExecutionResult> {
  return withChatgptPageSession(endpoint, async (session) => {
    const result = await evaluateJson<{ left?: boolean }>(
      session,
      buildWorkspaceLeaveExpression(candidate, account)
    );
    return {
      remoteWorkspaceId: candidate.localWorkspace.workspaceId,
      left: result?.left === true,
      message: result?.left === true ? "left" : "failed",
    };
  });
}
