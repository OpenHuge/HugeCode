import { invoke, isDesktopHostRuntime } from "../application/runtime/ports/desktopHostCore";
import { open } from "../application/runtime/ports/desktopHostDialogs";
import type { WorkspaceInfo, WorkspaceSettings } from "../types";
import { logger } from "./logger";
import { detectRuntimeMode, getRuntimeClient } from "./runtimeClient";
import { resolveWebRuntimeEndpoint } from "./runtimeClientWebGateway";
import {
  isMissingDesktopHostCommandError,
  isMissingDesktopHostInvokeError,
  isRuntimeMethodUnsupportedError,
} from "@ku0/code-runtime-client/runtimeErrorClassifier";
import { invokeWebRuntimeDirectRpc } from "./runtimeWebDirectRpc";
import { normalizePathForDisplay } from "../utils/platformPaths";

export type RuntimeWorkspaceSummary = {
  id: string;
  path: string;
  displayName: string;
  connected: boolean;
};

const RUNTIME_WORKSPACES_LIST_METHOD = "code_workspaces_list";
const RUNTIME_WORKSPACE_PICK_DIRECTORY_METHOD = "code_workspace_pick_directory";
const RUNTIME_WORKSPACE_CREATE_METHOD = "code_workspace_create";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function normalizeRuntimeWorkspaceSummary(value: unknown): RuntimeWorkspaceSummary | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const path = typeof record.path === "string" ? record.path.trim() : "";
  if (!id || !path) {
    return null;
  }
  const displayNameRaw =
    typeof record.displayName === "string"
      ? record.displayName
      : typeof record.display_name === "string"
        ? record.display_name
        : "";
  return {
    id,
    path,
    displayName: displayNameRaw,
    connected: record.connected !== false,
  };
}

function normalizeRuntimeWorkspaceList(value: unknown): RuntimeWorkspaceSummary[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeRuntimeWorkspaceSummary(entry))
      .filter((entry): entry is RuntimeWorkspaceSummary => Boolean(entry));
  }
  const record = asRecord(value);
  const result = record?.result;
  if (Array.isArray(result)) {
    return result
      .map((entry) => normalizeRuntimeWorkspaceSummary(entry))
      .filter((entry): entry is RuntimeWorkspaceSummary => Boolean(entry));
  }
  const resultRecord = asRecord(result);
  const resultData = resultRecord?.data;
  if (Array.isArray(resultData)) {
    return resultData
      .map((entry) => normalizeRuntimeWorkspaceSummary(entry))
      .filter((entry): entry is RuntimeWorkspaceSummary => Boolean(entry));
  }
  const topLevelData = record?.data;
  if (Array.isArray(topLevelData)) {
    return topLevelData
      .map((entry) => normalizeRuntimeWorkspaceSummary(entry))
      .filter((entry): entry is RuntimeWorkspaceSummary => Boolean(entry));
  }
  return [];
}

function normalizeRuntimeWorkspacePickedPath(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
  if (value === null || value === undefined) {
    return null;
  }
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const directPath =
    typeof record.path === "string"
      ? record.path
      : typeof record.selectedPath === "string"
        ? record.selectedPath
        : typeof record.selected_path === "string"
          ? record.selected_path
          : null;
  if (directPath) {
    const normalized = directPath.trim();
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return normalizeRuntimeWorkspacePickedPath(record.result);
}

async function invokeWebRuntimeRpc(method: string, params: Record<string, unknown>) {
  return invokeWebRuntimeDirectRpc(method, params);
}

function shouldUseWebRuntimeRpcFallback() {
  return detectRuntimeMode() === "runtime-gateway-web" && Boolean(resolveWebRuntimeEndpoint());
}

async function pickWorkspacePathFromRuntime(): Promise<string | null> {
  let pickedPath: string | null = null;
  try {
    pickedPath = await getRuntimeClient().workspacePickDirectory();
  } catch (primaryError) {
    if (!shouldUseWebRuntimeRpcFallback()) {
      throw primaryError;
    }
    try {
      const fallbackPayload = await invokeWebRuntimeRpc(
        RUNTIME_WORKSPACE_PICK_DIRECTORY_METHOD,
        {}
      );
      pickedPath = normalizeRuntimeWorkspacePickedPath(fallbackPayload);
    } catch (fallbackError) {
      if (isRuntimeMethodUnsupportedError(fallbackError, RUNTIME_WORKSPACE_PICK_DIRECTORY_METHOD)) {
        throw new Error(
          "Runtime does not support workspace directory picker. Please update runtime service to the latest version."
        );
      }
      throw fallbackError;
    }
  }
  return normalizeRuntimeWorkspacePickedPath(pickedPath);
}

function logRuntimeWarning(message: string, context?: unknown) {
  logger.warn(message, context);
}

function createDefaultWorkspaceSettings(sortOrder?: number): WorkspaceSettings {
  return {
    sidebarCollapsed: false,
    sortOrder: sortOrder ?? null,
    groupId: null,
    gitRoot: null,
    codexHome: null,
    codexArgs: null,
    launchScript: null,
    launchScripts: null,
    worktreeSetupScript: null,
  };
}

export function getPathBasename(path: string): string {
  const trimmed = normalizePathForDisplay(path).replace(/[\\/]+$/, "");
  if (!trimmed) {
    return "workspace";
  }
  const segments = trimmed.split(/[\\/]/).filter(Boolean);
  return segments.at(-1) ?? "workspace";
}

function normalizeComparableDisplayPath(value: string): string {
  return normalizePathForDisplay(value)
    .replace(/\//g, "\\")
    .replace(/[\\]+$/, "")
    .toLowerCase();
}

function resolveWorkspaceName(workspace: RuntimeWorkspaceSummary): string {
  const normalizedDisplayName = normalizePathForDisplay(workspace.displayName);
  const normalizedPath = normalizePathForDisplay(workspace.path);
  if (!normalizedDisplayName) {
    return getPathBasename(normalizedPath);
  }
  if (
    normalizeComparableDisplayPath(normalizedDisplayName) ===
    normalizeComparableDisplayPath(normalizedPath)
  ) {
    return getPathBasename(normalizedPath);
  }
  return normalizedDisplayName;
}

function toRuntimeWorkspaceInfo(
  workspace: RuntimeWorkspaceSummary,
  sortOrder?: number
): WorkspaceInfo {
  return {
    id: workspace.id,
    name: resolveWorkspaceName(workspace),
    path: workspace.path,
    connected: Boolean(workspace.connected),
    codex_bin: null,
    kind: "main",
    parentId: null,
    worktree: null,
    settings: createDefaultWorkspaceSettings(sortOrder),
  };
}

export async function resolveRuntimeWorkspacePath(workspaceId: string): Promise<string> {
  try {
    const runtimeWorkspaces = (await getRuntimeClient().workspaces()) as RuntimeWorkspaceSummary[];
    const match = runtimeWorkspaces.find((workspace) => workspace.id === workspaceId);
    if (match?.path) {
      return match.path;
    }
  } catch {
    return "";
  }
  return "";
}

export async function pickWorkspacePath(): Promise<string | null> {
  if (detectRuntimeMode() === "runtime-gateway-web") {
    return pickWorkspacePathFromRuntime();
  }
  try {
    const selection = await open({ directory: true, multiple: false });
    if (!selection || Array.isArray(selection)) {
      return null;
    }
    return selection;
  } catch (error) {
    if (isMissingDesktopHostInvokeError(error) || isMissingDesktopHostCommandError(error, "open")) {
      logRuntimeWarning("Workspace picker unavailable; returning null selection.");
      return null;
    }
    throw error;
  }
}

export async function pickWorkspacePaths(): Promise<string[]> {
  if (detectRuntimeMode() === "runtime-gateway-web") {
    const picked = await pickWorkspacePathFromRuntime();
    return picked ? [picked] : [];
  }
  try {
    const selection = await open({ directory: true, multiple: true });
    if (!selection) {
      return [];
    }
    return Array.isArray(selection) ? selection : [selection];
  } catch (error) {
    if (isMissingDesktopHostInvokeError(error) || isMissingDesktopHostCommandError(error, "open")) {
      logRuntimeWarning("Workspace picker unavailable; returning empty selections.");
      return [];
    }
    throw error;
  }
}

export async function pickAttachmentFiles(): Promise<string[]> {
  if (!isDesktopHostRuntime()) {
    return [];
  }
  try {
    const selection = await open({
      multiple: true,
    });
    if (!selection) {
      return [];
    }
    return Array.isArray(selection) ? selection : [selection];
  } catch (error) {
    if (isMissingDesktopHostInvokeError(error) || isMissingDesktopHostCommandError(error, "open")) {
      logRuntimeWarning("Attachment picker unavailable; returning empty attachment selections.");
      return [];
    }
    throw error;
  }
}

export async function pickImageFiles(): Promise<string[]> {
  const picked = await pickAttachmentFiles();
  return picked.filter((path) => /\.(png|jpg|jpeg|gif|webp|bmp|tiff|tif)$/i.test(path));
}

export async function listWorkspaces(): Promise<WorkspaceInfo[]> {
  let runtimeWorkspaces: RuntimeWorkspaceSummary[] = [];
  try {
    runtimeWorkspaces = (await getRuntimeClient().workspaces()) as RuntimeWorkspaceSummary[];
  } catch (primaryError) {
    if (!shouldUseWebRuntimeRpcFallback()) {
      throw primaryError;
    }
    const fallbackPayload = await invokeWebRuntimeRpc(RUNTIME_WORKSPACES_LIST_METHOD, {});
    runtimeWorkspaces = normalizeRuntimeWorkspaceList(fallbackPayload);
  }
  return runtimeWorkspaces.map((workspace, index) => toRuntimeWorkspaceInfo(workspace, index));
}

export async function addWorkspace(path: string, codex_bin: string | null): Promise<WorkspaceInfo> {
  void codex_bin;
  let runtimeWorkspace: RuntimeWorkspaceSummary | null = null;
  try {
    runtimeWorkspace = (await getRuntimeClient().workspaceCreate(
      path,
      null
    )) as RuntimeWorkspaceSummary;
  } catch (primaryError) {
    if (!shouldUseWebRuntimeRpcFallback()) {
      throw primaryError;
    }
    const fallbackPayload = await invokeWebRuntimeRpc(RUNTIME_WORKSPACE_CREATE_METHOD, {
      path,
      displayName: null,
    });
    runtimeWorkspace = normalizeRuntimeWorkspaceSummary(fallbackPayload);
  }
  if (!runtimeWorkspace) {
    throw new Error("Failed to create workspace.");
  }
  return toRuntimeWorkspaceInfo(runtimeWorkspace);
}

export async function renameWorkspace(id: string, displayName: string): Promise<WorkspaceInfo> {
  const normalizedName = displayName.trim();
  if (!normalizedName) {
    throw new Error("Workspace name is required.");
  }
  const renamed = (await getRuntimeClient().workspaceRename(
    id,
    normalizedName
  )) as RuntimeWorkspaceSummary | null;
  if (!renamed) {
    throw new Error("Workspace not found.");
  }
  return toRuntimeWorkspaceInfo(renamed);
}

export async function isWorkspacePathDir(path: string): Promise<boolean> {
  if (!isDesktopHostRuntime()) {
    void path;
    throw new Error("Workspace path validation is only available in Desktop host runtime.");
  }
  return invoke<boolean>("is_workspace_path_dir", { path });
}

export async function addClone(
  sourceWorkspaceId: string,
  copiesFolder: string,
  copyName: string
): Promise<WorkspaceInfo> {
  if (!isDesktopHostRuntime()) {
    void sourceWorkspaceId;
    void copiesFolder;
    void copyName;
    throw new Error("Workspace cloning is only available in Desktop host runtime.");
  }
  return invoke<WorkspaceInfo>("add_clone", {
    sourceWorkspaceId,
    copiesFolder,
    copyName,
  });
}

export async function addWorktree(
  parentId: string,
  branch: string,
  name: string | null,
  copyAgentsMd = true
): Promise<WorkspaceInfo> {
  if (!isDesktopHostRuntime()) {
    void parentId;
    void branch;
    void name;
    void copyAgentsMd;
    throw new Error("Worktree creation is only available in Desktop host runtime.");
  }
  return invoke<WorkspaceInfo>("add_worktree", { parentId, branch, name, copyAgentsMd });
}

export async function updateWorkspaceSettings(
  id: string,
  settings: WorkspaceSettings
): Promise<WorkspaceInfo> {
  if (!isDesktopHostRuntime()) {
    void id;
    void settings;
    throw new Error("Workspace settings update is only available in Desktop host runtime.");
  }
  return invoke<WorkspaceInfo>("update_workspace_settings", { id, settings });
}

export async function updateWorkspaceCodexBin(
  id: string,
  codex_bin: string | null
): Promise<WorkspaceInfo> {
  if (!isDesktopHostRuntime()) {
    void id;
    void codex_bin;
    throw new Error("Workspace codex bin update is only available in Desktop host runtime.");
  }
  return invoke<WorkspaceInfo>("update_workspace_codex_bin", { id, codex_bin });
}

export async function removeWorkspace(id: string): Promise<void> {
  await getRuntimeClient().workspaceRemove(id);
}

export async function removeWorktree(id: string): Promise<void> {
  if (!isDesktopHostRuntime()) {
    void id;
    throw new Error("Worktree removal is only available in Desktop host runtime.");
  }
  return invoke("remove_worktree", { id });
}

export async function renameWorktree(id: string, branch: string): Promise<WorkspaceInfo> {
  if (!isDesktopHostRuntime()) {
    void id;
    void branch;
    throw new Error("Worktree rename is only available in Desktop host runtime.");
  }
  return invoke<WorkspaceInfo>("rename_worktree", { id, branch });
}

export async function connectWorkspace(id: string): Promise<void> {
  const runtimeWorkspaces = (await getRuntimeClient().workspaces()) as RuntimeWorkspaceSummary[];
  if (runtimeWorkspaces.some((workspace) => workspace.id === id && workspace.connected)) {
    return;
  }
}
