import type {
  OAuthAccountUpsertInput,
  OAuthPoolApplyInput,
  OAuthPoolSelectionRequest,
  OAuthProviderId,
  OAuthUsageRefreshMode,
  RuntimeExtensionGetRequest,
  RuntimeExtensionInstallRequest,
  RuntimeExtensionPermissionsEvaluateRequest,
  RuntimeExtensionSetStateRequest,
  RuntimeExtensionUpdateRequest,
} from "@ku0/code-runtime-host-contract";
import {
  applyWorkspacePatch,
  getRuntimeBrowserDebugStatus,
  runRuntimeBrowserDebug,
} from "../ports/runtimeAutomation";
import { getCollaborationModes } from "../ports/collaboration";
import { listRuntimeModels } from "../ports/runtimeCatalog";
import { listMcpServerStatus, listWorkspaceDiagnostics } from "../ports/runtimeDiagnostics";
import {
  evaluateRuntimeExtensionPermissions,
  getRuntimeExtension,
  getRuntimeExtensionsConfig,
  installRuntimeExtension,
  listRuntimeExtensionRegistrySources,
  listRuntimeExtensionTools,
  listRuntimeExtensions,
  readRuntimeExtensionResource,
  readRuntimeExtensionHealth,
  removeRuntimeExtension,
  searchRuntimeExtensionRegistry,
  setRuntimeExtensionState,
  updateRuntimeExtension,
} from "../ports/runtimeExtensions";
import {
  runRuntimeCodexDoctor,
  runRuntimeCodexUpdate,
  runtimeSecurityPreflightV1,
  runtimeSessionDeleteV1,
  runtimeSessionExportV1,
  runtimeSessionImportV1,
} from "../ports/runtimeOperations";
import { getRuntimePolicy, setRuntimePolicy } from "../ports/runtimePolicy";
import {
  createRuntimePrompt,
  deleteRuntimePrompt,
  listRuntimePrompts,
  moveRuntimePrompt,
  updateRuntimePrompt,
} from "../ports/runtimePrompts";
import {
  closeRuntimeTerminalSession,
  interruptRuntimeTerminalSession,
  openRuntimeTerminalSession,
  readRuntimeTerminalSession,
  resizeRuntimeTerminalSession,
  writeRuntimeTerminalSession,
} from "../ports/runtimeTerminal";
import {
  applyOAuthPool,
  getAccountInfo,
  getProvidersCatalog,
  listOAuthAccounts,
  listOAuthPoolMembers,
  listOAuthPools,
  removeOAuthAccount,
  removeOAuthPool,
  selectOAuthPoolAccount,
  upsertOAuthAccount,
} from "../ports/oauth";
import {
  runtimeBackendRemove,
  runtimeBackendSetState,
  runtimeBackendsList,
  runtimeBackendUpsert,
} from "../ports/remoteServers";
import {
  getRuntimeBootstrapSnapshot,
  runtimeDiagnosticsExportV1,
  getRuntimeRemoteStatus,
  getRuntimeSettings,
} from "../ports/runtime";
import { getAccountRateLimits } from "../ports/threads";

export function buildRuntimeDiscoveryControl(workspaceId: string) {
  return {
    getRuntimePolicy: async () => getRuntimePolicy(),
    setRuntimePolicy: async (input: {
      mode: "strict" | "balanced" | "aggressive";
      actor?: string | null;
    }) =>
      setRuntimePolicy({
        mode: input.mode,
        actor: input.actor ?? null,
      }),
    getRuntimeRemoteStatus: async () => getRuntimeRemoteStatus(),
    getRuntimeSettings: async () => getRuntimeSettings(),
    getRuntimeBootstrapSnapshot: async () => getRuntimeBootstrapSnapshot(),
    openRuntimeTerminalSession: async (input?: { workspaceId?: string | null }) =>
      openRuntimeTerminalSession(input?.workspaceId ?? workspaceId),
    readRuntimeTerminalSession: async (sessionId: string) => readRuntimeTerminalSession(sessionId),
    writeRuntimeTerminalSession: async (input: { sessionId: string; input: string }) =>
      writeRuntimeTerminalSession({
        sessionId: input.sessionId,
        input: input.input,
      }),
    interruptRuntimeTerminalSession: async (sessionId: string) =>
      interruptRuntimeTerminalSession(sessionId),
    resizeRuntimeTerminalSession: async (input: {
      sessionId: string;
      rows: number;
      cols: number;
    }) =>
      resizeRuntimeTerminalSession({
        sessionId: input.sessionId,
        rows: input.rows,
        cols: input.cols,
      }),
    closeRuntimeTerminalSession: async (sessionId: string) =>
      closeRuntimeTerminalSession(sessionId),
    runtimeDiagnosticsExportV1: async (input?: {
      workspaceId?: string | null;
      redactionLevel?: "strict" | "balanced" | "minimal";
      includeTaskSummaries?: boolean;
    }) =>
      runtimeDiagnosticsExportV1({
        workspaceId: input?.workspaceId ?? workspaceId,
        redactionLevel: input?.redactionLevel,
        includeTaskSummaries: input?.includeTaskSummaries,
      }),
    runtimeSessionExportV1: async (input: {
      workspaceId: string;
      threadId: string;
      includeAgentTasks?: boolean;
    }) =>
      runtimeSessionExportV1({
        workspaceId: input.workspaceId,
        threadId: input.threadId,
        includeAgentTasks: input.includeAgentTasks,
      }),
    runtimeSessionImportV1: async (input: {
      workspaceId: string;
      snapshot: Record<string, unknown>;
      threadId?: string | null;
    }) =>
      runtimeSessionImportV1({
        workspaceId: input.workspaceId,
        snapshot: input.snapshot,
        threadId: input.threadId ?? null,
      }),
    runtimeSessionDeleteV1: async (input: { workspaceId: string; threadId: string }) =>
      runtimeSessionDeleteV1({
        workspaceId: input.workspaceId,
        threadId: input.threadId,
      }),
    runtimeSecurityPreflightV1: async (input: {
      workspaceId?: string | null;
      toolName?: string | null;
      command?: string | null;
      input?: Record<string, unknown> | null;
      checkPackageAdvisory?: boolean;
      checkExecPolicy?: boolean;
      execPolicyRules?: string[] | null;
    }) =>
      runtimeSecurityPreflightV1({
        workspaceId: input.workspaceId ?? workspaceId,
        toolName: input.toolName ?? null,
        command: input.command ?? null,
        input: input.input ?? null,
        checkPackageAdvisory: input.checkPackageAdvisory,
        checkExecPolicy: input.checkExecPolicy,
        execPolicyRules: input.execPolicyRules ?? null,
      }),
    runRuntimeCodexDoctor: async (input?: {
      codexBin?: string | null;
      codexArgs?: string[] | null;
    }) =>
      runRuntimeCodexDoctor({
        codexBin: input?.codexBin ?? null,
        codexArgs: input?.codexArgs ?? null,
      }),
    runRuntimeCodexUpdate: async (input?: {
      codexBin?: string | null;
      codexArgs?: string[] | null;
    }) =>
      runRuntimeCodexUpdate({
        codexBin: input?.codexBin ?? null,
        codexArgs: input?.codexArgs ?? null,
      }),
    listRuntimePrompts: async (targetWorkspaceId?: string | null) =>
      listRuntimePrompts(targetWorkspaceId === undefined ? workspaceId : targetWorkspaceId),
    createRuntimePrompt: async (input: {
      workspaceId?: string | null;
      scope: "workspace" | "global";
      title: string;
      description: string;
      content: string;
    }) =>
      createRuntimePrompt({
        workspaceId: input.workspaceId === undefined ? workspaceId : input.workspaceId,
        scope: input.scope,
        title: input.title,
        description: input.description,
        content: input.content,
      }),
    updateRuntimePrompt: async (input: {
      workspaceId?: string | null;
      promptId: string;
      title: string;
      description: string;
      content: string;
    }) =>
      updateRuntimePrompt({
        workspaceId: input.workspaceId === undefined ? workspaceId : input.workspaceId,
        promptId: input.promptId,
        title: input.title,
        description: input.description,
        content: input.content,
      }),
    deleteRuntimePrompt: async (input: { workspaceId?: string | null; promptId: string }) =>
      deleteRuntimePrompt({
        workspaceId: input.workspaceId === undefined ? workspaceId : input.workspaceId,
        promptId: input.promptId,
      }),
    moveRuntimePrompt: async (input: {
      workspaceId?: string | null;
      promptId: string;
      targetScope: "workspace" | "global";
    }) =>
      moveRuntimePrompt({
        workspaceId: input.workspaceId === undefined ? workspaceId : input.workspaceId,
        promptId: input.promptId,
        targetScope: input.targetScope,
      }),
    listRuntimeOAuthAccounts: async (
      provider?: OAuthProviderId | null,
      options?: { usageRefresh?: OAuthUsageRefreshMode | null }
    ) =>
      listOAuthAccounts(provider ?? null, {
        usageRefresh: options?.usageRefresh ?? null,
      }),
    getRuntimeAccountInfo: async (targetWorkspaceId: string) => getAccountInfo(targetWorkspaceId),
    getRuntimeAccountRateLimits: async (targetWorkspaceId: string) =>
      getAccountRateLimits(targetWorkspaceId),
    upsertRuntimeOAuthAccount: async (input: OAuthAccountUpsertInput) => upsertOAuthAccount(input),
    removeRuntimeOAuthAccount: async (accountId: string) => removeOAuthAccount(accountId),
    listRuntimeOAuthPools: async (provider?: OAuthProviderId | null) =>
      listOAuthPools(provider ?? null),
    listRuntimeOAuthPoolMembers: async (poolId: string) => listOAuthPoolMembers(poolId),
    applyRuntimeOAuthPool: async (input: OAuthPoolApplyInput) => applyOAuthPool(input),
    removeRuntimeOAuthPool: async (poolId: string) => removeOAuthPool(poolId),
    selectRuntimeOAuthPoolAccount: async (input: OAuthPoolSelectionRequest) =>
      selectOAuthPoolAccount(input),
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
    listRuntimeModels: async () => listRuntimeModels(),
    listWorkspaceDiagnostics: async (input: {
      workspaceId: string;
      paths?: string[] | null;
      severities?: Array<"error" | "warning" | "info" | "hint"> | null;
      maxItems?: number | null;
      includeProviderDetails?: boolean;
    }) =>
      listWorkspaceDiagnostics({
        workspaceId: input.workspaceId,
        paths: input.paths ?? null,
        severities: input.severities ?? null,
        maxItems: input.maxItems ?? null,
        includeProviderDetails: input.includeProviderDetails,
      }),
    getRuntimeBrowserDebugStatus: async (input: { workspaceId: string }) =>
      getRuntimeBrowserDebugStatus(input.workspaceId),
    runRuntimeBrowserDebug: async (input: {
      workspaceId: string;
      operation: "inspect" | "automation" | "chatgpt_decision_lab";
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
    listRuntimeMcpServerStatus: async (input: {
      workspaceId: string;
      cursor?: string | null;
      limit?: number | null;
    }) => listMcpServerStatus(input.workspaceId, input.cursor ?? null, input.limit ?? null),
    listRuntimeCollaborationModes: async (targetWorkspaceId: string) =>
      getCollaborationModes(targetWorkspaceId),
    listRuntimeProviderCatalog: async () => getProvidersCatalog(),
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
