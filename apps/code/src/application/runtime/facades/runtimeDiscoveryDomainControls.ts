import type {
  RuntimeExtensionGetRequest,
  RuntimeExtensionInstallRequest,
  RuntimeExtensionPermissionsEvaluateRequest,
  RuntimeExtensionSetStateRequest,
  RuntimeExtensionUpdateRequest,
} from "@ku0/code-runtime-host-contract";
import type { DesktopBrowserAssessmentRequest } from "@ku0/code-platform-interfaces";
import { assessBrowserSurface } from "../ports/browserCapability";
import {
  applyWorkspacePatch,
  getRuntimeBrowserDebugStatus,
  getRuntimeMiniProgramStatus,
  runRuntimeBrowserDebug,
  runRuntimeMiniProgramAction,
} from "../ports/runtimeAutomation";
import {
  runtimeBackendRemove,
  runtimeBackendSetState,
  runtimeBackendsList,
  runtimeBackendUpsert,
} from "../ports/remoteServers";
import {
  evaluateRuntimeExtensionPermissions,
  getRuntimeExtension,
  getRuntimeExtensionsConfig,
  installRuntimeExtension,
  listRuntimeExtensionRegistrySources,
  listRuntimeExtensionTools,
  listRuntimeExtensions,
  readRuntimeExtensionHealth,
  readRuntimeExtensionResource,
  removeRuntimeExtension,
  searchRuntimeExtensionRegistry,
  setRuntimeExtensionState,
  updateRuntimeExtension,
} from "../ports/runtimeExtensions";

export function buildRuntimeDiscoveryBackendControl(workspaceId: string) {
  return {
    runtimeBackendSetState: async (input: {
      backendId: string;
      workspaceId?: string | null;
      status?: "active" | "draining" | "disabled";
      rolloutState?: "current" | "ramping" | "draining" | "drained";
      force?: boolean;
      reason?: string | null;
    }) =>
      runtimeBackendSetState({
        workspaceId: input.workspaceId ?? workspaceId,
        backendId: input.backendId,
        status: input.status,
        rolloutState: input.rolloutState,
        force: input.force,
        reason: input.reason ?? null,
      }),
    runtimeBackendRemove: async (input: { backendId: string; workspaceId?: string | null }) =>
      runtimeBackendRemove({
        workspaceId: input.workspaceId ?? workspaceId,
        backendId: input.backendId,
      }),
    runtimeBackendUpsert: async (input: {
      backendId: string;
      workspaceId?: string | null;
      displayName: string;
      capabilities: string[];
      maxConcurrency: number;
      costTier: string;
      latencyClass: string;
      rolloutState: "current" | "ramping" | "draining" | "drained";
      status: "active" | "draining" | "disabled";
    }) =>
      runtimeBackendUpsert({
        workspaceId: input.workspaceId ?? workspaceId,
        backendId: input.backendId,
        displayName: input.displayName,
        capabilities: input.capabilities,
        maxConcurrency: input.maxConcurrency,
        costTier: input.costTier,
        latencyClass: input.latencyClass,
        rolloutState: input.rolloutState,
        status: input.status,
      }),
    runtimeBackendsList: async (targetWorkspaceId?: string | null) =>
      runtimeBackendsList(targetWorkspaceId ?? workspaceId),
  };
}

export function buildRuntimeDiscoveryAutomationControl() {
  return {
    getRuntimeBrowserDebugStatus: async (input: { workspaceId: string }) =>
      getRuntimeBrowserDebugStatus(input.workspaceId),
    getRuntimeMiniProgramStatus: async (input: { workspaceId: string }) =>
      getRuntimeMiniProgramStatus(input.workspaceId),
    assessRuntimeBrowserSurface: async (input: {
      workspaceId: string;
      target: DesktopBrowserAssessmentRequest["target"];
      selector?: string | null;
      waitForMs?: number | null;
    }) =>
      assessBrowserSurface({
        target: input.target,
        selector: input.selector ?? null,
        waitForMs: input.waitForMs ?? undefined,
      }),
    runRuntimeBrowserDebug: async (input: {
      workspaceId: string;
      operation: "inspect" | "automation" | "chatgpt_decision_lab" | "provider_decision_lab";
      prompt?: string | null;
      includeScreenshot?: boolean | null;
      timeoutMs?: number | null;
      steps?: Array<{
        toolName: string;
        arguments?: Record<string, unknown> | null;
      }> | null;
      decisionLab?: {
        question: string;
        options: Array<{
          id: string;
          label: string;
          summary?: string | null;
        }>;
        constraints?: string[] | null;
        allowLiveWebResearch?: boolean | null;
        chatgptUrl?: string | null;
      } | null;
    }) =>
      runRuntimeBrowserDebug({
        workspaceId: input.workspaceId,
        operation: input.operation,
        prompt: input.prompt ?? null,
        includeScreenshot: input.includeScreenshot ?? null,
        timeoutMs: input.timeoutMs ?? null,
        steps: input.steps ?? null,
        decisionLab: input.decisionLab ?? null,
      }),
    runRuntimeMiniProgramAction: async (input: {
      workspaceId: string;
      action:
        | "open_project"
        | "refresh_project"
        | "build_npm"
        | "preview"
        | "upload"
        | "reset_file_watch";
      compileType?: "miniprogram" | "plugin" | null;
      compileCondition?: {
        pathName?: string | null;
        query?: string | null;
        scene?: number | null;
      } | null;
      version?: string | null;
      desc?: string | null;
      qrOutputMode?: "none" | "terminal" | "base64" | "image" | null;
      infoOutputMode?: "none" | "inline" | null;
    }) =>
      runRuntimeMiniProgramAction({
        workspaceId: input.workspaceId,
        action: input.action,
        compileType: input.compileType ?? null,
        compileCondition: input.compileCondition ?? null,
        version: input.version ?? null,
        desc: input.desc ?? null,
        qrOutputMode: input.qrOutputMode ?? null,
        infoOutputMode: input.infoOutputMode ?? null,
      }),
    applyWorkspacePatch: async (input: {
      workspaceId: string;
      diff: string;
      dryRun?: boolean | null;
    }) =>
      applyWorkspacePatch({
        workspaceId: input.workspaceId,
        diff: input.diff,
        dryRun: input.dryRun ?? null,
      }),
  };
}

export function buildRuntimeDiscoveryExtensionControl(workspaceId: string) {
  return {
    listRuntimeExtensions: async (targetWorkspaceId?: string | null) =>
      listRuntimeExtensions(targetWorkspaceId ?? workspaceId),
    getRuntimeExtension: async (input: RuntimeExtensionGetRequest) =>
      getRuntimeExtension({
        workspaceId: input.workspaceId ?? workspaceId,
        extensionId: input.extensionId,
      }),
    listRuntimeExtensionTools: async (input: {
      workspaceId?: string | null;
      extensionId: string;
    }) =>
      listRuntimeExtensionTools({
        workspaceId: input.workspaceId ?? workspaceId,
        extensionId: input.extensionId,
      }),
    getRuntimeExtensionsConfig: async (targetWorkspaceId?: string | null) =>
      getRuntimeExtensionsConfig(targetWorkspaceId ?? workspaceId),
    installRuntimeExtension: async (input: RuntimeExtensionInstallRequest) =>
      installRuntimeExtension(input),
    updateRuntimeExtension: async (input: RuntimeExtensionUpdateRequest) =>
      updateRuntimeExtension({
        ...input,
        workspaceId: input.workspaceId ?? workspaceId,
      }),
    setRuntimeExtensionState: async (input: RuntimeExtensionSetStateRequest) =>
      setRuntimeExtensionState({
        workspaceId: input.workspaceId ?? workspaceId,
        extensionId: input.extensionId,
        enabled: input.enabled,
      }),
    removeRuntimeExtension: async (input: { workspaceId?: string | null; extensionId: string }) =>
      removeRuntimeExtension({
        workspaceId: input.workspaceId ?? workspaceId,
        extensionId: input.extensionId,
      }),
    readRuntimeExtensionResource: async (input: {
      workspaceId?: string | null;
      extensionId: string;
      resourceId: string;
    }) =>
      readRuntimeExtensionResource({
        workspaceId: input.workspaceId ?? workspaceId,
        extensionId: input.extensionId,
        resourceId: input.resourceId,
      }),
    searchRuntimeExtensionRegistry: async (input?: {
      workspaceId?: string | null;
      query?: string | null;
      kinds?: string[] | null;
      sourceIds?: string[] | null;
    }) =>
      searchRuntimeExtensionRegistry({
        workspaceId: input?.workspaceId ?? workspaceId,
        query: input?.query ?? null,
        kinds: input?.kinds ?? null,
        sourceIds: input?.sourceIds ?? null,
      }),
    listRuntimeExtensionRegistrySources: async (targetWorkspaceId?: string | null) =>
      listRuntimeExtensionRegistrySources(targetWorkspaceId ?? workspaceId),
    evaluateRuntimeExtensionPermissions: async (
      input: RuntimeExtensionPermissionsEvaluateRequest
    ) =>
      evaluateRuntimeExtensionPermissions({
        workspaceId: input.workspaceId ?? workspaceId,
        extensionId: input.extensionId,
      }),
    readRuntimeExtensionHealth: async (input: {
      workspaceId?: string | null;
      extensionId: string;
    }) =>
      readRuntimeExtensionHealth({
        workspaceId: input.workspaceId ?? workspaceId,
        extensionId: input.extensionId,
      }),
  };
}
