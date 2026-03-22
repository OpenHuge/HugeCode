import { invoke, isTauri } from "@tauri-apps/api/core";
import { detectRuntimeMode } from "./runtimeClient";
import {
  isMissingTauriCommandError,
  isMissingTauriInvokeError,
  isMissingTextFileError,
} from "./tauriRuntimeTransport";
import { logRuntimeWarning } from "./tauriRuntimeTurnHelpers";
import { createTextFileGateway, type TextFileResponse } from "./textFileGateway";

export type GlobalAgentsResponse = TextFileResponse;
export type GlobalCodexConfigResponse = TextFileResponse;
export type AgentMdResponse = TextFileResponse;

function getTextFileGateway() {
  return createTextFileGateway({
    isTauri: () => isTauri(),
    detectRuntimeMode,
    invokeRead: async (scope, kind, workspaceId) =>
      invoke<TextFileResponse>("file_read", { scope, kind, workspaceId }),
    invokeWrite: async (scope, kind, content, workspaceId) =>
      invoke("file_write", { scope, kind, workspaceId, content }),
    isMissingTextFileError,
    isMissingTauriInvokeError,
    isMissingTauriCommandError,
    logRuntimeWarning,
  });
}

export async function readGlobalAgentsMd(): Promise<GlobalAgentsResponse> {
  return getTextFileGateway().read("global", "agents");
}

export async function writeGlobalAgentsMd(content: string): Promise<void> {
  return getTextFileGateway().write("global", "agents", content);
}

export async function readGlobalCodexConfigToml(): Promise<GlobalCodexConfigResponse> {
  return getTextFileGateway().read("global", "config");
}

export async function writeGlobalCodexConfigToml(content: string): Promise<void> {
  return getTextFileGateway().write("global", "config", content);
}

export async function readAgentMd(workspaceId: string): Promise<AgentMdResponse> {
  return getTextFileGateway().read("workspace", "agents", workspaceId);
}

export async function writeAgentMd(workspaceId: string, content: string): Promise<void> {
  return getTextFileGateway().write("workspace", "agents", content, workspaceId);
}
