import { isTauri } from "../../../application/runtime/ports/tauriCore";
import { ask, message } from "../../../application/runtime/ports/tauriDialogs";
import type { WorkspaceGroup, WorkspaceInfo } from "../../../types";
import {
  readSafeLocalStorageItem,
  writeSafeLocalStorageItem,
} from "../../../utils/safeLocalStorage";

const GROUP_ID_RANDOM_MODULUS = 1_000_000;
const SORT_ORDER_FALLBACK = Number.MAX_SAFE_INTEGER;
export const RESERVED_WORKSPACE_GROUP_NAME = "Ungrouped";
const RESERVED_GROUP_NAME_NORMALIZED = RESERVED_WORKSPACE_GROUP_NAME.toLowerCase();
const WEB_RUNTIME_SIDEBAR_COLLAPSE_STORAGE_KEY = "codexmonitor.webRuntimeWorkspaceSidebarCollapsed";
const WEB_RUNTIME_WORKSPACE_SORT_ORDER_STORAGE_KEY = "codexmonitor.webRuntimeWorkspaceSortOrder";

type AskOptions = Parameters<typeof ask>[1];
type MessageOptions = Parameters<typeof message>[1];

export function normalizeGroupName(name: string) {
  return name.trim();
}

export function getSortOrderValue(value: number | null | undefined) {
  return typeof value === "number" ? value : SORT_ORDER_FALLBACK;
}

export function isReservedGroupName(name: string) {
  return normalizeGroupName(name).toLowerCase() === RESERVED_GROUP_NAME_NORMALIZED;
}

export function isDuplicateGroupName(name: string, groups: WorkspaceGroup[], excludeId?: string) {
  const normalized = normalizeGroupName(name).toLowerCase();
  return groups.some(
    (group) => group.id !== excludeId && normalizeGroupName(group.name).toLowerCase() === normalized
  );
}

export function createGroupId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * GROUP_ID_RANDOM_MODULUS)}`;
}

export function normalizeWorkspacePathKey(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  let normalizedPath = trimmed;
  if (trimmed.toLowerCase().startsWith("file://")) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "file:") {
        const decodedPath = decodeURIComponent(parsed.pathname || "");
        const withHost = parsed.host ? `//${parsed.host}${decodedPath}` : decodedPath;
        normalizedPath = withHost;
      }
    } catch {
      normalizedPath = trimmed;
    }
  }

  // Normalize Windows drive paths that come from file:// URIs.
  if (/^\/[A-Za-z]:\//.test(normalizedPath)) {
    normalizedPath = normalizedPath.slice(1);
  }

  return normalizedPath.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function normalizeWorkspaceLoadError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message.length > 0) {
      return message;
    }
    return error.name;
  }
  if (typeof error === "string") {
    const message = error.trim();
    return message.length > 0 ? message : "unknown error";
  }
  return "unknown error";
}

type WebRuntimeSidebarCollapseState = Record<string, boolean>;
type WebRuntimeWorkspaceSortOrderState = Record<string, number | null>;

function readWebRuntimeSidebarCollapseState(): WebRuntimeSidebarCollapseState {
  const raw = readSafeLocalStorageItem(WEB_RUNTIME_SIDEBAR_COLLAPSE_STORAGE_KEY);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, boolean] =>
          typeof entry[0] === "string" && typeof entry[1] === "boolean"
      )
    );
  } catch {
    return {};
  }
}

function writeWebRuntimeSidebarCollapseState(nextState: WebRuntimeSidebarCollapseState) {
  writeSafeLocalStorageItem(WEB_RUNTIME_SIDEBAR_COLLAPSE_STORAGE_KEY, JSON.stringify(nextState));
}

function readWebRuntimeWorkspaceSortOrderState(): WebRuntimeWorkspaceSortOrderState {
  const raw = readSafeLocalStorageItem(WEB_RUNTIME_WORKSPACE_SORT_ORDER_STORAGE_KEY);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number | null] =>
          typeof entry[0] === "string" && (typeof entry[1] === "number" || entry[1] === null)
      )
    );
  } catch {
    return {};
  }
}

function writeWebRuntimeWorkspaceSortOrderState(nextState: WebRuntimeWorkspaceSortOrderState) {
  writeSafeLocalStorageItem(
    WEB_RUNTIME_WORKSPACE_SORT_ORDER_STORAGE_KEY,
    JSON.stringify(nextState)
  );
}

export function writeWebRuntimeWorkspaceSidebarCollapsed(workspaceId: string, collapsed: boolean) {
  const nextState = readWebRuntimeSidebarCollapseState();
  nextState[workspaceId] = collapsed;
  writeWebRuntimeSidebarCollapseState(nextState);
}

export function writeWebRuntimeWorkspaceSortOrder(
  workspaceId: string,
  sortOrder: number | null | undefined
) {
  const nextState = readWebRuntimeWorkspaceSortOrderState();
  nextState[workspaceId] = typeof sortOrder === "number" ? sortOrder : null;
  writeWebRuntimeWorkspaceSortOrderState(nextState);
}

export function applyWebRuntimeWorkspaceSidebarCollapseState(
  workspaces: WorkspaceInfo[],
  runtimeMode: string
) {
  if (runtimeMode !== "runtime-gateway-web") {
    return workspaces;
  }

  const sidebarCollapseState = readWebRuntimeSidebarCollapseState();
  const workspaceSortOrderState = readWebRuntimeWorkspaceSortOrderState();
  const workspaceIds = new Set(workspaces.map((workspace) => workspace.id));
  const staleSidebarCollapseIds = Object.keys(sidebarCollapseState).filter(
    (workspaceId) => !workspaceIds.has(workspaceId)
  );
  if (staleSidebarCollapseIds.length > 0) {
    staleSidebarCollapseIds.forEach((workspaceId) => {
      delete sidebarCollapseState[workspaceId];
    });
    writeWebRuntimeSidebarCollapseState(sidebarCollapseState);
  }
  const staleSortOrderIds = Object.keys(workspaceSortOrderState).filter(
    (workspaceId) => !workspaceIds.has(workspaceId)
  );
  if (staleSortOrderIds.length > 0) {
    staleSortOrderIds.forEach((workspaceId) => {
      delete workspaceSortOrderState[workspaceId];
    });
    writeWebRuntimeWorkspaceSortOrderState(workspaceSortOrderState);
  }

  return workspaces.map((workspace) => {
    const override = sidebarCollapseState[workspace.id];
    const sortOrderOverride = workspaceSortOrderState[workspace.id];
    const hasCollapsedOverride = typeof override === "boolean";
    const hasSortOrderOverride =
      typeof sortOrderOverride === "number" || sortOrderOverride === null;
    if (
      (!hasCollapsedOverride || override === workspace.settings.sidebarCollapsed) &&
      (!hasSortOrderOverride || sortOrderOverride === workspace.settings.sortOrder)
    ) {
      return workspace;
    }
    return {
      ...workspace,
      settings: {
        ...workspace.settings,
        ...(hasCollapsedOverride ? { sidebarCollapsed: override } : {}),
        ...(hasSortOrderOverride ? { sortOrder: sortOrderOverride } : {}),
      },
    };
  });
}

type WorkspaceValidationErrorLike = {
  code?: unknown;
  name?: unknown;
  method?: unknown;
  error?: unknown;
  cause?: unknown;
  details?: unknown;
};

function readWorkspaceValidationErrorField(
  error: unknown,
  field: keyof WorkspaceValidationErrorLike
): string {
  const queue: unknown[] = [error];
  const seen = new Set<unknown>();
  while (queue.length > 0) {
    const candidate = queue.shift();
    if (!candidate || typeof candidate !== "object" || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    const record = candidate as WorkspaceValidationErrorLike;
    const value = record[field];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (record.error && typeof record.error === "object") {
      queue.push(record.error);
    }
    if (record.cause && typeof record.cause === "object") {
      queue.push(record.cause);
    }
    if (record.details && typeof record.details === "object") {
      const details = record.details as Record<string, unknown>;
      if (details.error && typeof details.error === "object") {
        queue.push(details.error);
      }
    }
  }
  return "";
}

function normalizeWorkspaceValidationCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s.-]+/g, "_");
}

export function isWorkspacePathValidationUnavailableError(error: unknown): boolean {
  const code = normalizeWorkspaceValidationCode(readWorkspaceValidationErrorField(error, "code"));
  const method = readWorkspaceValidationErrorField(error, "method").toLowerCase();
  const name = readWorkspaceValidationErrorField(error, "name").toLowerCase();
  const isWorkspacePathValidationMethod = method.includes("is_workspace_path_dir");

  if (code === "workspace_path_validation_unavailable") {
    return true;
  }
  if (
    isWorkspacePathValidationMethod &&
    (code.includes("method_not_found") || code.includes("method_unavailable"))
  ) {
    return true;
  }
  if (name === "runtimerpcmethodunsupportederror" && isWorkspacePathValidationMethod) {
    return true;
  }
  return false;
}

export function supportsWorkspacePathValidation(): boolean {
  try {
    return isTauri();
  } catch {
    return false;
  }
}

function getDialogTitle(options?: AskOptions | MessageOptions): string {
  if (!options || typeof options === "string") {
    return "";
  }
  return typeof options.title === "string" ? options.title.trim() : "";
}

export async function askWithFallback(content: string, options?: AskOptions) {
  if (isTauri()) {
    try {
      return await ask(content, options);
    } catch {
      // Fall back to browser confirm when native dialog bridge is unavailable.
    }
  }
  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    return false;
  }
  const title = getDialogTitle(options);
  const prompt = title ? `${title}\n\n${content}` : content;
  return window.confirm(prompt);
}

export function messageWithFallback(content: string, options?: MessageOptions) {
  if (isTauri()) {
    try {
      void message(content, options);
      return;
    } catch {
      // Fall back to browser alert when native dialog bridge is unavailable.
    }
  }
  if (typeof window === "undefined" || typeof window.alert !== "function") {
    return;
  }
  const title = getDialogTitle(options);
  window.alert(title ? `${title}\n\n${content}` : content);
}
