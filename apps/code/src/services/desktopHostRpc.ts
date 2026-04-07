import { invokeDesktopCommand } from "../application/runtime/ports/desktopHostCore";
import type {
  RuntimeBrowserDebugRunRequest,
  RuntimeBrowserDebugRunResponse,
  RuntimeBrowserDebugStatusResponse,
  RuntimeMiniProgramActionRunRequest,
  RuntimeMiniProgramActionRunResponse,
  RuntimeMiniProgramStatusResponse,
  WorkspacePatchApplyRequest,
  WorkspacePatchApplyResponse,
} from "@ku0/code-runtime-host-contract";
import { getRuntimeClient } from "./runtimeClient";
import {
  isMissingDesktopHostCommandError,
  isMissingDesktopHostInvokeError,
} from "@ku0/code-runtime-client/runtimeErrorClassifier";
import {
  getCodexConfigPathWithFallback,
  listCollaborationModesWithFallback,
  listMcpServerStatusWithFallback,
} from "./runtimeClientCodex";

type LooseResultEnvelope = Record<string, unknown>;

function deriveFallbackRunTitle(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return "New thread";
  }
  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? trimmed;
  const normalized = firstLine.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "New thread";
  }
  return normalized.length > 64 ? normalized.slice(0, 64) : normalized;
}

function slugifyRunTitle(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "thread";
}

export async function getCodexConfigPath(): Promise<string> {
  return getCodexConfigPathWithFallback(getRuntimeClient());
}

export async function getConfigModel(workspaceId: string): Promise<string | null> {
  let response: { model?: string | null } | undefined;
  try {
    response = await invokeDesktopCommand<{ model?: string | null }>("get_config_model", {
      workspaceId,
    });
  } catch (error) {
    if (
      isMissingDesktopHostInvokeError(error) ||
      isMissingDesktopHostCommandError(error, "get_config_model")
    ) {
      return null;
    }
    throw error;
  }
  const model = response?.model;
  if (typeof model !== "string") {
    return null;
  }
  const trimmed = model.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function forkThread(
  workspaceId: string,
  threadId: string
): Promise<LooseResultEnvelope> {
  return invokeDesktopCommand<LooseResultEnvelope>("fork_thread", { workspaceId, threadId });
}

export async function compactThread(
  workspaceId: string,
  threadId: string
): Promise<LooseResultEnvelope> {
  return invokeDesktopCommand<LooseResultEnvelope>("compact_thread", { workspaceId, threadId });
}

export async function generateRunMetadata(workspaceId: string, prompt: string) {
  try {
    return await invokeDesktopCommand<{ title: string; worktreeName: string }>(
      "generate_run_metadata",
      {
        workspaceId,
        prompt,
      }
    );
  } catch (error) {
    if (
      !isMissingDesktopHostInvokeError(error) &&
      !isMissingDesktopHostCommandError(error, "generate_run_metadata")
    ) {
      throw error;
    }
    const title = deriveFallbackRunTitle(prompt);
    return {
      title,
      worktreeName: slugifyRunTitle(title),
    };
  }
}

export async function getCollaborationModes(workspaceId: string): Promise<LooseResultEnvelope> {
  return listCollaborationModesWithFallback(getRuntimeClient(), workspaceId);
}

export async function getWorkspacePromptsDir(workspaceId: string) {
  return invokeDesktopCommand<string>("prompts_workspace_dir", { workspaceId });
}

export async function getGlobalPromptsDir(workspaceId: string) {
  return invokeDesktopCommand<string>("prompts_global_dir", { workspaceId });
}

export async function listMcpServerStatus(
  workspaceId: string,
  cursor?: string | null,
  limit?: number | null
): Promise<LooseResultEnvelope> {
  return listMcpServerStatusWithFallback(getRuntimeClient(), {
    workspaceId,
    cursor: cursor ?? null,
    limit: limit ?? null,
  });
}

export async function getRuntimeBrowserDebugStatus(
  workspaceId: string
): Promise<RuntimeBrowserDebugStatusResponse> {
  return getRuntimeClient().browserDebugStatusV1({ workspaceId });
}

export async function applyWorkspacePatch(
  request: WorkspacePatchApplyRequest
): Promise<WorkspacePatchApplyResponse> {
  return getRuntimeClient().workspacePatchApplyV1(request);
}

export async function runRuntimeBrowserDebug(
  request: RuntimeBrowserDebugRunRequest
): Promise<RuntimeBrowserDebugRunResponse> {
  return getRuntimeClient().browserDebugRunV1(request);
}

export async function getRuntimeMiniProgramStatus(
  workspaceId: string
): Promise<RuntimeMiniProgramStatusResponse> {
  return getRuntimeClient().miniProgramStatusV1({ workspaceId });
}

export async function runRuntimeMiniProgramAction(
  request: RuntimeMiniProgramActionRunRequest
): Promise<RuntimeMiniProgramActionRunResponse> {
  return getRuntimeClient().miniProgramRunV1(request);
}

export async function setThreadName(
  workspaceId: string,
  threadId: string,
  name: string
): Promise<LooseResultEnvelope> {
  return invokeDesktopCommand<LooseResultEnvelope>("set_thread_name", {
    workspaceId,
    threadId,
    name,
  });
}
