import type {
  OAuthAccountUpsertInput,
  OAuthPoolApplyInput,
  OAuthPoolSelectionRequest,
  OAuthProviderId,
  OAuthUsageRefreshMode,
} from "@ku0/code-runtime-host-contract";
import { getCollaborationModes } from "../ports/collaboration";
import { listRuntimeModels } from "../ports/runtimeCatalog";
import { listMcpServerStatus, listWorkspaceDiagnostics } from "../ports/runtimeDiagnostics";
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
  getRuntimeBootstrapSnapshot,
  runtimeDiagnosticsExportV1,
  getRuntimeRemoteStatus,
  getRuntimeSettings,
} from "../ports/runtime";
import { getAccountRateLimits } from "../ports/threads";

export function buildRuntimeDiscoverySystemControl() {
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
    listRuntimeCollaborationModes: async (targetWorkspaceId: string) =>
      getCollaborationModes(targetWorkspaceId),
  };
}

export function buildRuntimeDiscoveryTerminalControl(workspaceId: string) {
  return {
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
  };
}

export function buildRuntimeDiscoveryDiagnosticsControl(workspaceId: string) {
  return {
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
    listRuntimeMcpServerStatus: async (input: {
      workspaceId: string;
      cursor?: string | null;
      limit?: number | null;
    }) => listMcpServerStatus(input.workspaceId, input.cursor ?? null, input.limit ?? null),
  };
}

export function buildRuntimeDiscoveryOperationsControl(workspaceId: string) {
  return {
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
  };
}

export function buildRuntimeDiscoveryPromptControl(workspaceId: string) {
  return {
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
  };
}

export function buildRuntimeDiscoveryOAuthControl() {
  return {
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
    listRuntimeProviderCatalog: async () => getProvidersCatalog(),
  };
}

export function buildRuntimeDiscoveryCatalogControl() {
  return {
    listRuntimeModels: async () => listRuntimeModels(),
  };
}
