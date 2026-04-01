// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RUNTIME_MESSAGE_CODES } from "@ku0/code-runtime-client/runtimeMessageCodes";
import {
  __resetRuntimeToolExecutionMetricsForTests,
  readRuntimeToolExecutionMetrics,
} from "./runtimeToolExecutionMetrics";
import {
  __resetRuntimeToolGuardrailOverridesForTests,
  __resetRuntimeToolMetricsRecordOverrideForTests,
  __setRuntimeToolGuardrailEvaluateOverrideForTests,
  __setRuntimeToolGuardrailRecordOutcomeOverrideForTests,
  __setRuntimeToolMetricsRecordOverrideForTests,
} from "./runtimeToolExecutionMetricsReporter";
import { __resetRuntimeToolReliabilityPolicyForTests } from "./runtimeToolReliabilityPolicy";
import {
  type AgentCommandCenterActions,
  type AgentCommandCenterSnapshot,
  syncWebMcpAgentControl,
  teardownWebMcpAgentControl,
  WEB_MCP_ALL_TOOL_NAMES,
  WEB_MCP_RUNTIME_CONTROL_TOOL_NAMES,
} from "./webMcpBridge";
import { RUNTIME_TOOL_OUTPUT_MAX_CHARS } from "./webMcpBridgeRuntimeToolHelpers";

type ModelContextStub = {
  provideContext?: (payload: {
    tools?: unknown[];
    resources?: unknown[];
    prompts?: unknown[];
  }) => void | Promise<void>;
};

function setModelContext(stub: ModelContextStub | null) {
  Object.defineProperty(window.navigator, "modelContext", {
    configurable: true,
    value: stub ?? undefined,
  });
}

const snapshot: AgentCommandCenterSnapshot = {
  workspaceId: "ws-1",
  workspaceName: "workspace-one",
  intent: {
    objective: "Ship webmcp integration",
    constraints: "No regression",
    successCriteria: "UI and tools available",
    deadline: null,
    priority: "high",
    managerNotes: "Keep risk low",
  },
  tasks: [
    {
      id: "task-1",
      title: "Build UI",
      owner: "alice",
      status: "backlog",
      priority: "medium",
      blocked: false,
      dueDate: null,
      notes: "",
      updatedAt: Date.now(),
    },
  ],
  governance: {
    policy: {
      autoEnabled: false,
      intervalMinutes: 5,
      pauseBlockedInProgress: true,
      reassignUnowned: true,
      terminateOverdueDays: 5,
      ownerPool: ["alice"],
    },
    lastCycle: null,
  },
  auditLog: [],
  updatedAt: Date.now(),
};

const actions: AgentCommandCenterActions = {
  setIntentPatch: () => snapshot.intent,
  setGovernancePolicyPatch: () => snapshot.governance.policy,
  runGovernanceCycle: () => ({
    source: "webmcp",
    runAt: Date.now(),
    inspected: 0,
    pausedCount: 0,
    terminatedCount: 0,
    reassignedCount: 0,
    ownerPool: ["alice"],
    notes: [],
  }),
  upsertTask: () => snapshot.tasks[0],
  moveTask: () => snapshot.tasks[0],
  pauseTask: () => snapshot.tasks[0],
  resumeTask: () => snapshot.tasks[0],
  terminateTask: () => snapshot.tasks[0],
  rebalanceTasks: () => ({ updatedCount: 1, owners: ["alice"] }),
  assignTask: () => snapshot.tasks[0],
  removeTask: () => true,
  clearCompleted: () => 0,
};

const RUNTIME_SUB_AGENT_TOOL_NAMES = [
  "orchestrate-runtime-sub-agent-batch",
  "spawn-runtime-sub-agent-session",
  "send-runtime-sub-agent-instruction",
  "wait-runtime-sub-agent-session",
  "get-runtime-sub-agent-session-status",
  "interrupt-runtime-sub-agent-session",
  "close-runtime-sub-agent-session",
] as const;

const RUNTIME_PHASE_ONE_TOOL_NAMES = [
  "get-runtime-policy",
  "set-runtime-policy",
  "list-runtime-models",
  "list-runtime-provider-catalog",
  "list-runtime-oauth-accounts",
  "get-runtime-account-info",
  "get-runtime-account-rate-limits",
  "upsert-runtime-oauth-account",
  "remove-runtime-oauth-account",
  "list-runtime-oauth-pools",
  "list-runtime-oauth-pool-members",
  "apply-runtime-oauth-pool",
  "remove-runtime-oauth-pool",
  "select-runtime-oauth-pool-account",
  "list-runtime-collaboration-modes",
  "list-runtime-mcp-server-status",
  "list-runtime-extensions",
  "get-runtime-extension",
  "install-runtime-extension",
  "update-runtime-extension",
  "set-runtime-extension-state",
  "remove-runtime-extension",
  "search-runtime-extension-registry",
  "list-runtime-extension-registry-sources",
  "list-runtime-extension-tools",
  "evaluate-runtime-extension-permissions",
  "read-runtime-extension-resource",
  "get-runtime-extension-health",
  "get-runtime-extensions-config",
] as const;

const RUNTIME_OPERATIONS_TOOL_NAMES = [
  "get-runtime-remote-status",
  "get-runtime-settings",
  "get-runtime-bootstrap-snapshot",
  "export-runtime-diagnostics",
  "evaluate-runtime-security-preflight",
  "run-runtime-codex-doctor",
  "run-runtime-codex-update",
  "export-runtime-session",
  "import-runtime-session",
  "delete-runtime-session",
] as const;

const RUNTIME_PROMPT_TOOL_NAMES = [
  "list-runtime-prompts",
  "create-runtime-prompt",
  "update-runtime-prompt",
  "delete-runtime-prompt",
  "move-runtime-prompt",
] as const;

const RUNTIME_BACKEND_CONTROL_TOOL_NAMES = [
  "set-runtime-backend-state",
  "remove-runtime-backend",
  "upsert-runtime-backend",
] as const;

const RUNTIME_TERMINAL_TOOL_NAMES = [
  "open-runtime-terminal-session",
  "read-runtime-terminal-session",
  "write-runtime-terminal-session",
  "interrupt-runtime-terminal-session",
  "resize-runtime-terminal-session",
  "close-runtime-terminal-session",
] as const;

const RUNTIME_ACTION_REQUIRED_TOOL_NAMES = [
  "list-runtime-action-required",
  "get-runtime-action-required",
  "resolve-runtime-action-required",
] as const;

beforeEach(() => {
  __setRuntimeToolMetricsRecordOverrideForTests(async () => undefined);
  __setRuntimeToolGuardrailEvaluateOverrideForTests(async () => ({
    allowed: true,
    blockReason: null,
    errorCode: null,
    message: null,
    channelHealth: {
      status: "healthy",
      reason: null,
      lastErrorCode: null,
      updatedAt: Date.now(),
    },
    circuitBreaker: null,
    updatedAt: Date.now(),
  }));
  __setRuntimeToolGuardrailRecordOutcomeOverrideForTests(async () => undefined);
  __resetRuntimeToolReliabilityPolicyForTests();
});

afterEach(async () => {
  await teardownWebMcpAgentControl();
  setModelContext(null);
  __resetRuntimeToolExecutionMetricsForTests();
  __resetRuntimeToolReliabilityPolicyForTests();
  __resetRuntimeToolMetricsRecordOverrideForTests();
  __resetRuntimeToolGuardrailOverridesForTests();
});

describe("webMcpBridge runtime orchestration integration", () => {
  it("registers runtime orchestration tools and executes list/terminate operations", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const now = Date.now();
    const runtimeTasks = [
      {
        taskId: "runtime-1",
        workspaceId: snapshot.workspaceId,
        threadId: null,
        title: "runtime task",
        status: "awaiting_approval" as const,
        accessMode: "on-request" as const,
        distributedStatus: null,
        currentStep: 1,
        createdAt: now - 20_000,
        updatedAt: now - 10_000,
        startedAt: now - 15_000,
        completedAt: null,
        errorCode: null,
        errorMessage: null,
        pendingApprovalId: "approval-1",
      },
      {
        taskId: "runtime-2",
        workspaceId: snapshot.workspaceId,
        threadId: null,
        title: "runtime queued task",
        status: "queued" as const,
        accessMode: "on-request" as const,
        distributedStatus: null,
        currentStep: 0,
        createdAt: now - 6_000,
        updatedAt: now - 5_000,
        startedAt: null,
        completedAt: null,
        errorCode: null,
        errorMessage: null,
        pendingApprovalId: null,
      },
    ];
    const listTasks = vi.fn(async (input: { status?: "awaiting_approval" | null }) =>
      input.status === "awaiting_approval"
        ? runtimeTasks.filter((task) => task.status === "awaiting_approval")
        : runtimeTasks
    );
    const getTaskStatus = vi.fn(async () => null);
    const startTask = vi.fn(async (input: { requestId?: string }) => ({
      ...runtimeTasks[0],
      taskId: "runtime-started-1",
      requestId: input.requestId ?? null,
      status: "running" as const,
    }));
    const interruptTask = vi.fn(async () => ({
      accepted: true,
      taskId: "runtime-1",
      status: "interrupted",
      message: "interrupted",
    }));
    const resumeTask = vi.fn(async () => ({
      accepted: true,
      taskId: "runtime-1",
      status: "running" as const,
      message: "resumed",
      recovered: true,
      checkpointId: "checkpoint-1",
    }));
    const submitDecision = vi.fn(async () => ({
      recorded: true,
      approvalId: "approval-1",
      taskId: "runtime-1",
      status: "running",
      message: "recorded",
    }));
    const actionRequiredGetV2 = vi.fn(async (requestId: string) =>
      requestId === "approval-1"
        ? {
            requestId,
            kind: "approval" as const,
            status: "submitted" as const,
            action: "approve runtime task",
            reason: null,
            input: null,
            createdAt: now - 20_000,
            decidedAt: null,
            decisionReason: null,
          }
        : requestId === "user-input-1"
          ? {
              requestId,
              kind: "elicitation" as const,
              status: "submitted" as const,
              action: "collect user input",
              reason: null,
              input: null,
              createdAt: now - 9_000,
              decidedAt: null,
              decisionReason: null,
            }
          : null
    );
    const actionRequiredSubmitV2 = vi.fn(async () => "submitted" as const);
    const respondToServerRequest = vi.fn(async () => ({ accepted: true }));
    const respondToUserInputRequest = vi.fn(async () => ({ submitted: true }));
    const respondToServerRequestResult = vi.fn(async () => ({ cancelled: true }));
    const responseRequiredState = {
      approvals: [
        {
          workspace_id: snapshot.workspaceId,
          request_id: 77,
          method: "workspace/requestApproval/runCommand",
          params: {
            thread_id: "thread-approval-1",
            turn_id: "turn-approval-1",
            item_id: "item-approval-1",
          },
        },
      ],
      userInputRequests: [
        {
          workspace_id: snapshot.workspaceId,
          request_id: "user-input-1",
          params: {
            thread_id: "thread-user-input-1",
            turn_id: "turn-user-input-1",
            item_id: "item-user-input-1",
            questions: [{ id: "q1", header: "Repo", question: "Pick repo" }],
          },
        },
      ],
    };
    const spawnSubAgentSession = vi.fn(async () => ({
      sessionId: "sub-agent-session-1",
      workspaceId: snapshot.workspaceId,
      threadId: null,
      title: "sub-agent",
      status: "idle",
      accessMode: "on-request",
      reasonEffort: "medium",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      activeTaskId: null,
      lastTaskId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      closedAt: null,
      errorCode: null,
      errorMessage: null,
      scopeProfile: "research" as const,
      allowedSkillIds: ["core-grep", "core-read"],
      allowNetwork: false,
      workspaceReadPaths: ["src", "docs"],
      parentRunId: "parent-runtime-1",
      profileDescriptor: null,
      checkpointId: "checkpoint-sub-1",
      traceId: "trace-sub-1",
      recovered: false,
      checkpointState: null,
      approvalEvents: null,
      compactionSummary: null,
      evalTags: null,
    }));
    const sendSubAgentInstruction = vi.fn(async () => ({
      session: {
        sessionId: "sub-agent-session-1",
        workspaceId: snapshot.workspaceId,
        threadId: null,
        title: "sub-agent",
        status: "running" as const,
        accessMode: "on-request" as const,
        reasonEffort: "medium" as const,
        provider: "openai" as const,
        modelId: "gpt-5.3-codex" as const,
        activeTaskId: "runtime-sub-task-1",
        lastTaskId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        closedAt: null,
        errorCode: null,
        errorMessage: null,
        scopeProfile: "research" as const,
        allowedSkillIds: ["core-grep", "core-read"],
        allowNetwork: false,
        workspaceReadPaths: ["src", "docs"],
        parentRunId: "parent-runtime-1",
        profileDescriptor: null,
        checkpointId: "checkpoint-sub-1",
        traceId: "trace-sub-1",
        recovered: false,
        checkpointState: null,
        approvalEvents: null,
        compactionSummary: null,
        evalTags: null,
      },
      task: null,
    }));
    const waitSubAgentSession = vi.fn(async () => ({
      session: {
        sessionId: "sub-agent-session-1",
        workspaceId: snapshot.workspaceId,
        threadId: null,
        title: "sub-agent",
        status: "completed" as const,
        accessMode: "on-request" as const,
        reasonEffort: "medium" as const,
        provider: "openai" as const,
        modelId: "gpt-5.3-codex" as const,
        activeTaskId: null,
        lastTaskId: "runtime-sub-task-1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        closedAt: null,
        errorCode: null,
        errorMessage: null,
        scopeProfile: "research" as const,
        allowedSkillIds: ["core-grep", "core-read"],
        allowNetwork: false,
        workspaceReadPaths: ["src", "docs"],
        parentRunId: "parent-runtime-1",
        profileDescriptor: null,
        checkpointId: "checkpoint-sub-1",
        traceId: "trace-sub-1",
        recovered: true,
        checkpointState: null,
        approvalEvents: null,
        compactionSummary: null,
        evalTags: null,
      },
      task: null,
      done: true,
      timedOut: false,
    }));
    const getSubAgentSessionStatus = vi.fn(async () => null);
    const interruptSubAgentSession = vi.fn(async () => ({
      accepted: true,
      sessionId: "sub-agent-session-1",
      taskId: null,
      status: "interrupted",
      message: "interrupted",
    }));
    const closeSubAgentSession = vi.fn(async () => ({
      closed: true,
      sessionId: "sub-agent-session-1",
      status: "closed",
      message: "closed",
    }));
    const listLiveSkills = vi.fn(async () => [
      {
        id: "grep",
        name: "Grep",
        description: "Search",
        kind: "file_search",
        source: "builtin",
        version: "1.0.0",
        enabled: true,
        supportsNetwork: false,
        tags: ["core", "search"],
        aliases: ["grep", "rg", "search"],
      },
      {
        id: "read_file",
        name: "Read File",
        description: "Read workspace files",
        kind: "file_read",
        source: "builtin",
        version: "1.0.0",
        enabled: true,
        supportsNetwork: false,
        tags: ["core", "read"],
      },
      {
        id: "core-grep",
        name: "Core Grep",
        description: "Search",
        kind: "file_search",
        source: "builtin",
        version: "1.0.0",
        enabled: true,
        supportsNetwork: false,
        tags: ["core", "search"],
        aliases: ["core-grep", "grep", "rg", "search", "ripgrep", "project-search"],
      },
      {
        id: "core-computer-observe",
        name: "Core Computer Observe",
        description: "Read-only computer observation",
        kind: "computer_observe",
        source: "builtin",
        version: "1.0.0",
        enabled: true,
        supportsNetwork: false,
        tags: ["core", "computer", "observe"],
      },
    ]);
    const runLiveSkill = vi.fn(async (request: Record<string, unknown>) => ({
      runId: "live-skill-run-1",
      skillId: String(request.skillId ?? "core-grep"),
      status: "completed",
      message: "ok",
      output: "x".repeat(RUNTIME_TOOL_OUTPUT_MAX_CHARS + 1_024),
      network: null,
      metadata: {},
    }));
    const runtimeBackendsList = vi.fn(async () => [
      {
        backendId: "backend-openai",
        provider: "openai",
        modelId: "gpt-5.3-codex",
        state: "ready",
      },
    ]);
    const distributedTaskGraph = vi.fn(async (input: { taskId?: string }) => ({
      taskId: input.taskId ?? "unknown",
      nodes: [],
      edges: [],
    }));
    const runtimeBackendSetState = vi.fn(
      async (input: {
        backendId: string;
        status?: string;
        rolloutState?: string;
        reason?: string | null;
      }) => ({
        backendId: input.backendId,
        status: input.status ?? "active",
        rolloutState: input.rolloutState ?? "current",
        reason: input.reason ?? null,
      })
    );
    const runtimeBackendRemove = vi.fn(async () => true);
    const runtimeBackendUpsert = vi.fn(
      async (input: {
        backendId: string;
        displayName: string;
        capabilities: string[];
        maxConcurrency: number;
        costTier: string;
        latencyClass: string;
        rolloutState: string;
        status: string;
      }) => ({
        ...input,
        healthy: true,
      })
    );
    const getRuntimeCapabilitiesSummary = vi.fn(async () => ({
      mode: "runtime-gateway-web",
    }));
    const getRuntimeHealth = vi.fn(async () => ({
      ok: true,
    }));
    const getRuntimeTerminalStatus = vi.fn(async () => ({
      state: "ready",
      message: "Terminal runtime ready.",
    }));
    const openRuntimeTerminalSession = vi.fn(async (input?: { workspaceId?: string | null }) => ({
      id: "terminal-session-1",
      workspaceId: input?.workspaceId ?? snapshot.workspaceId,
      state: "created",
      createdAt: now,
      updatedAt: now,
      lines: ["$"],
    }));
    const readRuntimeTerminalSession = vi.fn(async (sessionId: string) => ({
      id: sessionId,
      workspaceId: snapshot.workspaceId,
      state: "created",
      createdAt: now,
      updatedAt: now + 1,
      lines: ["$ pwd", "/tmp/project"],
    }));
    const writeRuntimeTerminalSession = vi.fn(
      async (input: { sessionId: string; input: string }) => ({
        id: input.sessionId,
        workspaceId: snapshot.workspaceId,
        state: "created",
        createdAt: now,
        updatedAt: now + 2,
        lines: ["$ pwd", "/tmp/project"],
      })
    );
    const interruptRuntimeTerminalSession = vi.fn(async () => true);
    const resizeRuntimeTerminalSession = vi.fn(async () => true);
    const closeRuntimeTerminalSession = vi.fn(async () => true);
    const runtimeToolMetricsRead = vi.fn(async () => ({
      ...readRuntimeToolExecutionMetrics(),
      windowSize: 500,
      channelHealth: {
        status: "healthy",
        reason: null,
        lastErrorCode: null,
        updatedAt: Date.now(),
      },
      circuitBreakers: [],
    }));
    const runtimeToolGuardrailRead = vi.fn(async () => ({
      channelHealth: {
        status: "healthy",
        reason: null,
        lastErrorCode: null,
        updatedAt: Date.now(),
      },
      circuitBreakers: [],
      updatedAt: Date.now(),
    }));
    const getRuntimePolicy = vi.fn(async () => ({
      mode: "balanced",
      updatedAt: now,
    }));
    const setRuntimePolicy = vi.fn(async (input: { mode: string; actor?: string | null }) => ({
      mode: input.mode,
      updatedAt: now + 1,
      actor: input.actor ?? null,
    }));
    const listRuntimeModels = vi.fn(async () => [
      { id: "gpt-5.3-codex", provider: "openai" },
      { id: "claude-sonnet", provider: "anthropic" },
    ]);
    const listRuntimeProviderCatalog = vi.fn(async () => [
      { provider: "openai", status: "ready" },
      { provider: "anthropic", status: "ready" },
    ]);
    const listRuntimeOAuthAccounts = vi.fn(async () => [
      {
        accountId: "acc-1",
        provider: "codex",
        email: "user@example.com",
        displayName: "User",
        externalAccountId: null,
        status: "enabled",
        disabledReason: null,
        metadata: { planType: "pro" },
        createdAt: now,
        updatedAt: now,
      },
    ]);
    const getRuntimeAccountInfo = vi.fn(async () => ({
      result: {
        account: {
          type: "chatgpt",
          provider: "codex",
          email: "user@example.com",
          accountId: "acc-1",
          displayName: "User",
          planType: "pro",
        },
        requiresOpenaiAuth: false,
        requires_openai_auth: false,
      },
    }));
    const getRuntimeAccountRateLimits = vi.fn(async () => ({
      result: {
        rateLimits: {
          codex: {
            usedPercent: 12,
          },
        },
        rate_limits: {
          codex: {
            usedPercent: 12,
          },
        },
      },
    }));
    const upsertRuntimeOAuthAccount = vi.fn(async (input: Record<string, unknown>) => ({
      ...input,
      createdAt: now,
      updatedAt: now + 1,
    }));
    const removeRuntimeOAuthAccount = vi.fn(async () => true);
    const listRuntimeOAuthPools = vi.fn(async () => [
      {
        poolId: "pool-1",
        provider: "codex",
        name: "Primary Pool",
        strategy: "round_robin",
        stickyMode: "cache_first",
        preferredAccountId: "acc-1",
        enabled: true,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      },
    ]);
    const listRuntimeOAuthPoolMembers = vi.fn(async () => [
      {
        poolId: "pool-1",
        accountId: "acc-1",
        weight: 1,
        priority: 0,
        position: 0,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    const applyRuntimeOAuthPool = vi.fn(async (input: Record<string, unknown>) => ({
      pool: {
        ...(input.pool as Record<string, unknown>),
        createdAt: now,
        updatedAt: now + 1,
      },
      members: [
        {
          poolId: "pool-1",
          accountId: "acc-1",
          weight: 1,
          priority: 0,
          position: 0,
          enabled: true,
          createdAt: now,
          updatedAt: now + 1,
        },
      ],
    }));
    const removeRuntimeOAuthPool = vi.fn(async () => true);
    const selectRuntimeOAuthPoolAccount = vi.fn(async () => ({
      poolId: "pool-1",
      reason: "preferred_account",
      account: {
        accountId: "acc-1",
        provider: "codex",
        email: "user@example.com",
        displayName: "User",
        externalAccountId: null,
        status: "enabled",
        disabledReason: null,
        metadata: { planType: "pro" },
        createdAt: now,
        updatedAt: now,
      },
    }));
    const listRuntimeCollaborationModes = vi.fn(async (workspaceId: string) => ({
      data: [{ mode: "planner", label: "Planner", id: "planner", model: "gpt-5.3-codex" }],
      warnings: workspaceId ? [] : ["missing workspace"],
    }));
    const listRuntimeMcpServerStatus = vi.fn(async () => ({
      data: [{ name: "filesystem", status: "ready" }],
      nextCursor: null,
      warnings: [],
    }));
    const listRuntimeExtensions = vi.fn(async () => [
      {
        extensionId: "ext-1",
        name: "Extension One",
        transport: "builtin",
        enabled: true,
        workspaceId: snapshot.workspaceId,
        config: {},
        installedAt: now,
        updatedAt: now,
      },
    ]);
    const listRuntimeExtensionTools = vi.fn(async () => [
      {
        extensionId: "ext-1",
        toolName: "ext-tool",
        description: "Extension tool",
        inputSchema: { type: "object" },
        readOnly: true,
      },
    ]);
    const readRuntimeExtensionResource = vi.fn(async () => ({
      extensionId: "ext-1",
      resourceId: "resource-1",
      contentType: "text/plain",
      content: "resource body",
      metadata: { version: 1 },
    }));
    const getRuntimeExtensionsConfig = vi.fn(async () => ({
      extensions: [
        {
          extensionId: "ext-1",
          name: "Extension One",
          transport: "builtin",
          enabled: true,
          workspaceId: snapshot.workspaceId,
          config: {},
          installedAt: now,
          updatedAt: now,
        },
      ],
      warnings: [],
    }));
    const installRuntimeExtension = vi.fn(async (input: Record<string, unknown>) => ({
      ...input,
      enabled: true,
      installedAt: now,
      updatedAt: now + 1,
    }));
    const removeRuntimeExtension = vi.fn(async () => true);
    const getRuntimeRemoteStatus = vi.fn(async () => ({
      connected: true,
      transport: "electron-bridge",
    }));
    const getRuntimeSettings = vi.fn(async () => ({
      mode: "balanced",
      approvals: "on-request",
    }));
    const getRuntimeBootstrapSnapshot = vi.fn(async () => ({
      runtimeReady: true,
      workspaceId: snapshot.workspaceId,
    }));
    const runtimeDiagnosticsExportV1 = vi.fn(
      async (input?: { workspaceId?: string; redactionLevel?: string }) => ({
        workspaceId: input?.workspaceId ?? snapshot.workspaceId,
        redactionLevel: input?.redactionLevel ?? "strict",
        diagnosticsId: "diag-1",
      })
    );
    const runtimeSecurityPreflightV1 = vi.fn(
      async (input: { workspaceId?: string; toolName?: string | null }) => ({
        action: "allow",
        request: input,
      })
    );
    const runtimeSessionExportV1 = vi.fn(
      async (input: { workspaceId: string; threadId: string; includeAgentTasks?: boolean }) => ({
        workspaceId: input.workspaceId,
        threadId: input.threadId,
        includeAgentTasks: input.includeAgentTasks ?? false,
        snapshot: { version: 1 },
      })
    );
    const runtimeSessionImportV1 = vi.fn(
      async (input: { workspaceId: string; threadId?: string | null }) => ({
        workspaceId: input.workspaceId,
        threadId: input.threadId ?? null,
        imported: true,
      })
    );
    const runtimeSessionDeleteV1 = vi.fn(async () => true);
    const runRuntimeCodexDoctor = vi.fn(async () => ({
      ok: true,
      codexBin: "codex",
      version: "1.0.0",
      appServerOk: true,
      details: null,
      path: "/usr/local/bin/codex",
      nodeOk: true,
      nodeVersion: "v22.0.0",
      nodeDetails: null,
      warnings: [],
    }));
    const runRuntimeCodexUpdate = vi.fn(async () => ({
      ok: true,
      method: "npm",
      package: "codex",
      beforeVersion: "1.0.0",
      afterVersion: "1.0.1",
      upgraded: true,
      output: "updated",
      details: null,
      warnings: [],
    }));
    const listRuntimePrompts = vi.fn(async (workspaceId?: string | null) =>
      workspaceId === null
        ? [
            {
              id: "prompt-global-1",
              title: "Global Prompt",
              description: "global description",
              content: "global content",
              scope: "global",
            },
          ]
        : [
            {
              id: "prompt-workspace-1",
              title: "Workspace Prompt",
              description: "workspace description",
              content: "workspace content",
              scope: "workspace",
            },
          ]
    );
    const createRuntimePrompt = vi.fn(async () => ({
      id: "prompt-created-1",
      title: "Created Prompt",
      description: "created description",
      content: "created content",
      scope: "workspace",
    }));
    const updateRuntimePrompt = vi.fn(async () => ({
      id: "prompt-created-1",
      title: "Updated Prompt",
      description: "updated description",
      content: "updated content",
      scope: "workspace",
    }));
    const deleteRuntimePrompt = vi.fn(async () => true);
    const moveRuntimePrompt = vi.fn(async () => ({
      id: "prompt-created-1",
      title: "Updated Prompt",
      description: "updated description",
      content: "updated content",
      scope: "global",
    }));
    const getGitStatus = vi.fn(async () => ({
      branchName: "fastcode",
      files: [],
      stagedFiles: [],
      unstagedFiles: [],
      totalAdditions: 0,
      totalDeletions: 0,
    }));
    const getGitDiffs = vi.fn(async () => [
      {
        path: "apps/code/src/services/webMcpBridge.ts",
        diff: "@@ -1 +1 @@",
      },
    ]);
    const listGitBranches = vi.fn(async () => ({
      currentBranch: "fastcode",
      branches: [{ name: "fastcode" }],
    }));
    const stageGitFile = vi.fn(async () => undefined);
    const stageGitAll = vi.fn(async () => undefined);
    const unstageGitFile = vi.fn(async () => undefined);
    const revertGitFile = vi.fn(async () => undefined);
    const commitGit = vi.fn(async () => undefined);
    const createGitBranch = vi.fn(async () => undefined);
    const checkoutGitBranch = vi.fn(async () => undefined);
    const runtimeControl = {
      listTasks,
      getTaskStatus,
      startTask,
      interruptTask,
      resumeTask,
      submitTaskApprovalDecision: submitDecision,
      actionRequiredGetV2,
      actionRequiredSubmitV2,
      respondToServerRequest,
      respondToUserInputRequest,
      respondToServerRequestResult,
      listLiveSkills,
      runLiveSkill,
      spawnSubAgentSession,
      sendSubAgentInstruction,
      waitSubAgentSession,
      getSubAgentSessionStatus,
      interruptSubAgentSession,
      closeSubAgentSession,
      runtimeBackendsList,
      runtimeBackendSetState,
      runtimeBackendRemove,
      runtimeBackendUpsert,
      distributedTaskGraph,
      getRuntimeCapabilitiesSummary,
      getRuntimeHealth,
      getRuntimeTerminalStatus,
      openRuntimeTerminalSession,
      readRuntimeTerminalSession,
      writeRuntimeTerminalSession,
      interruptRuntimeTerminalSession,
      resizeRuntimeTerminalSession,
      closeRuntimeTerminalSession,
      runtimeToolMetricsRead,
      runtimeToolGuardrailRead,
      getRuntimePolicy,
      setRuntimePolicy,
      listRuntimeModels,
      listRuntimeProviderCatalog,
      listRuntimeOAuthAccounts,
      getRuntimeAccountInfo,
      getRuntimeAccountRateLimits,
      upsertRuntimeOAuthAccount,
      removeRuntimeOAuthAccount,
      listRuntimeOAuthPools,
      listRuntimeOAuthPoolMembers,
      applyRuntimeOAuthPool,
      removeRuntimeOAuthPool,
      selectRuntimeOAuthPoolAccount,
      listRuntimeCollaborationModes,
      listRuntimeMcpServerStatus,
      listRuntimeExtensions,
      installRuntimeExtension,
      removeRuntimeExtension,
      listRuntimeExtensionTools,
      readRuntimeExtensionResource,
      getRuntimeExtensionsConfig,
      getRuntimeRemoteStatus,
      getRuntimeSettings,
      getRuntimeBootstrapSnapshot,
      runtimeDiagnosticsExportV1,
      runtimeSecurityPreflightV1,
      runtimeSessionExportV1,
      runtimeSessionImportV1,
      runtimeSessionDeleteV1,
      runRuntimeCodexDoctor,
      runRuntimeCodexUpdate,
      listRuntimePrompts,
      createRuntimePrompt,
      updateRuntimePrompt,
      deleteRuntimePrompt,
      moveRuntimePrompt,
      getGitStatus,
      getGitDiffs,
      listGitBranches,
      stageGitFile,
      stageGitAll,
      unstageGitFile,
      revertGitFile,
      commitGit,
      createGitBranch,
      checkoutGitBranch,
    } as unknown as NonNullable<Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]>;

    const result = await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: false,
      snapshot,
      actions,
      runtimeControl,
      responseRequiredState,
    });

    expect(result.registeredTools).toBe(WEB_MCP_ALL_TOOL_NAMES.length);
    expect(registeredTools).toHaveLength(WEB_MCP_ALL_TOOL_NAMES.length);
    WEB_MCP_RUNTIME_CONTROL_TOOL_NAMES.forEach((toolName) => {
      expect(registeredTools.some((tool) => tool.name === toolName)).toBe(true);
    });
    RUNTIME_SUB_AGENT_TOOL_NAMES.forEach((toolName) => {
      expect(registeredTools.some((tool) => tool.name === toolName)).toBe(true);
    });
    RUNTIME_PHASE_ONE_TOOL_NAMES.forEach((toolName) => {
      expect(registeredTools.some((tool) => tool.name === toolName)).toBe(true);
    });
    RUNTIME_OPERATIONS_TOOL_NAMES.forEach((toolName) => {
      expect(registeredTools.some((tool) => tool.name === toolName)).toBe(true);
    });
    RUNTIME_PROMPT_TOOL_NAMES.forEach((toolName) => {
      expect(registeredTools.some((tool) => tool.name === toolName)).toBe(true);
    });
    RUNTIME_BACKEND_CONTROL_TOOL_NAMES.forEach((toolName) => {
      expect(registeredTools.some((tool) => tool.name === toolName)).toBe(true);
    });
    RUNTIME_TERMINAL_TOOL_NAMES.forEach((toolName) => {
      expect(registeredTools.some((tool) => tool.name === toolName)).toBe(true);
    });
    RUNTIME_ACTION_REQUIRED_TOOL_NAMES.forEach((toolName) => {
      expect(registeredTools.some((tool) => tool.name === toolName)).toBe(true);
    });
    expect(registeredTools.some((tool) => tool.name === "submit-runtime-approval-decision")).toBe(
      false
    );
    expect(registeredTools.some((tool) => tool.name === "list-runtime-approval-queue")).toBe(false);
    expect(registeredTools.some((tool) => tool.name === "list-runtime-extension-ui-apps")).toBe(
      false
    );

    const listTool = registeredTools.find((tool) => tool.name === "list-runtime-runs");
    expect(listTool).toBeTruthy();
    if (!listTool) {
      throw new Error("list-runtime-runs tool not found");
    }
    const listResponse = await Promise.resolve(listTool.execute({}, null));
    expect(listTasks).toHaveBeenCalledWith({
      workspaceId: snapshot.workspaceId,
      status: null,
      limit: null,
    });
    expect(listResponse).toMatchObject({
      ok: true,
      code: expect.any(String),
      message: "Runtime tasks retrieved.",
    });

    const searchTool = registeredTools.find((tool) => tool.name === "search-workspace-files");
    expect(searchTool).toBeTruthy();
    if (!searchTool) {
      throw new Error("search-workspace-files tool not found");
    }
    const searchResponse = await Promise.resolve(
      searchTool.execute(
        {
          pattern: "workspaceId",
          mode: "literal",
          path: "apps/code/src",
          includeGlobs: "src/**/*.ts,src/**/*.tsx",
          excludeGlobs: "**/*.test.ts",
          contextBefore: 1,
          contextAfter: 2,
        },
        null
      )
    );
    expect(listLiveSkills).toHaveBeenCalledTimes(1);
    expect(runLiveSkill).toHaveBeenCalledWith({
      skillId: "core-grep",
      input: "workspaceId",
      options: {
        workspaceId: snapshot.workspaceId,
        path: "apps/code/src",
        pattern: "workspaceId",
        query: "workspaceId",
        matchMode: "literal",
        caseSensitive: null,
        wholeWord: null,
        includeHidden: null,
        maxResults: null,
        includeGlobs: ["src/**/*.ts", "src/**/*.tsx"],
        excludeGlobs: ["**/*.test.ts"],
        contextBefore: 1,
        contextAfter: 2,
      },
    });
    expect(searchResponse).toMatchObject({
      ok: true,
      code: expect.any(String),
      message: "Workspace file search completed.",
    });

    const listSkillsTool = registeredTools.find((tool) => tool.name === "list-runtime-live-skills");
    expect(listSkillsTool).toBeTruthy();
    if (!listSkillsTool) {
      throw new Error("list-runtime-live-skills tool not found");
    }
    const listSkillsResponse = await Promise.resolve(
      listSkillsTool.execute(
        {
          enabled: true,
          tag: "search",
          canonicalOnly: true,
        },
        null
      )
    );
    expect(listLiveSkills).toHaveBeenCalledTimes(2);
    expect(listSkillsResponse).toMatchObject({
      ok: true,
      code: expect.any(String),
      message: "Runtime live skills retrieved.",
      data: {
        total: 1,
        canonicalOnly: true,
        skills: [
          expect.objectContaining({
            id: "core-grep",
            canonicalSkillId: "core-grep",
            isCanonicalId: true,
            acceptedSkillIds: expect.arrayContaining(["core-grep", "grep", "search", "ripgrep"]),
            alternateSkillIds: expect.arrayContaining(["grep", "search", "ripgrep"]),
            discoveredSkillIds: ["core-grep", "grep"],
          }),
        ],
      },
    });

    const getToolExecutionMetricsTool = registeredTools.find(
      (tool) => tool.name === "get-runtime-tool-execution-metrics"
    );
    expect(getToolExecutionMetricsTool).toBeTruthy();
    if (!getToolExecutionMetricsTool) {
      throw new Error("get-runtime-tool-execution-metrics tool not found");
    }
    const toolExecutionMetricsResponse = await Promise.resolve(
      getToolExecutionMetricsTool.execute({}, null)
    );
    expect(toolExecutionMetricsResponse).toMatchObject({
      ok: true,
      code: RUNTIME_MESSAGE_CODES.runtime.toolExecution.metricsRetrieved,
      message: "Runtime tool execution metrics retrieved.",
      data: {
        workspaceId: snapshot.workspaceId,
        metrics: expect.objectContaining({
          totals: expect.objectContaining({
            attemptedTotal: expect.any(Number),
            completedTotal: expect.any(Number),
          }),
          byTool: expect.any(Object),
          recent: expect.any(Array),
        }),
        metricsSummary: expect.objectContaining({
          gate: expect.objectContaining({
            minSuccessRate: 0.95,
            successRate: expect.any(Number),
            denominator: expect.any(Number),
            blockedTotal: expect.any(Number),
          }),
          scopeSuccessRates: expect.any(Array),
          topFailedTools: expect.any(Array),
        }),
      },
    });

    const listBackendsTool = registeredTools.find((tool) => tool.name === "list-runtime-backends");
    expect(listBackendsTool).toBeTruthy();
    if (!listBackendsTool) {
      throw new Error("list-runtime-backends tool not found");
    }
    const listBackendsResponse = await Promise.resolve(listBackendsTool.execute({}, null));
    expect(runtimeBackendsList).toHaveBeenCalledWith(snapshot.workspaceId);
    expect(listBackendsResponse).toMatchObject({
      ok: true,
      code: expect.any(String),
      message: "Runtime backends listed.",
    });

    const setRuntimeBackendStateTool = registeredTools.find(
      (tool) => tool.name === "set-runtime-backend-state"
    );
    expect(setRuntimeBackendStateTool).toBeTruthy();
    if (!setRuntimeBackendStateTool) {
      throw new Error("set-runtime-backend-state tool not found");
    }
    const setRuntimeBackendStateResponse = await Promise.resolve(
      setRuntimeBackendStateTool.execute(
        {
          backendId: "backend-openai",
          status: "draining",
          rolloutState: "draining",
          reason: "webmcp:rebalance",
        },
        null
      )
    );
    expect(runtimeBackendSetState).toHaveBeenCalledWith({
      workspaceId: snapshot.workspaceId,
      backendId: "backend-openai",
      status: "draining",
      rolloutState: "draining",
      force: undefined,
      reason: "webmcp:rebalance",
    });
    expect(setRuntimeBackendStateResponse).toMatchObject({
      message: "Runtime backend state updated.",
      data: {
        backend: {
          backendId: "backend-openai",
          status: "draining",
        },
      },
    });

    const removeRuntimeBackendTool = registeredTools.find(
      (tool) => tool.name === "remove-runtime-backend"
    );
    expect(removeRuntimeBackendTool).toBeTruthy();
    if (!removeRuntimeBackendTool) {
      throw new Error("remove-runtime-backend tool not found");
    }
    const removeRuntimeBackendResponse = await Promise.resolve(
      removeRuntimeBackendTool.execute({ backendId: "backend-openai" }, null)
    );
    expect(runtimeBackendRemove).toHaveBeenCalledWith({
      workspaceId: snapshot.workspaceId,
      backendId: "backend-openai",
    });
    expect(removeRuntimeBackendResponse).toMatchObject({
      message: "Runtime backend removed.",
      data: {
        backendId: "backend-openai",
        removed: true,
      },
    });

    const upsertRuntimeBackendTool = registeredTools.find(
      (tool) => tool.name === "upsert-runtime-backend"
    );
    expect(upsertRuntimeBackendTool).toBeTruthy();
    if (!upsertRuntimeBackendTool) {
      throw new Error("upsert-runtime-backend tool not found");
    }
    const upsertRuntimeBackendResponse = await Promise.resolve(
      upsertRuntimeBackendTool.execute(
        {
          backendId: "backend-z",
          displayName: "Backend Z",
          capabilities: ["general"],
          maxConcurrency: 2,
          costTier: "standard",
          latencyClass: "regional",
          rolloutState: "current",
          status: "active",
        },
        null
      )
    );
    expect(runtimeBackendUpsert).toHaveBeenCalledWith({
      workspaceId: snapshot.workspaceId,
      backendId: "backend-z",
      displayName: "Backend Z",
      capabilities: ["general"],
      maxConcurrency: 2,
      costTier: "standard",
      latencyClass: "regional",
      rolloutState: "current",
      status: "active",
    });
    expect(upsertRuntimeBackendResponse).toMatchObject({
      message: "Runtime backend upsert completed.",
      data: {
        backend: {
          backendId: "backend-z",
          displayName: "Backend Z",
        },
      },
    });

    const distributedGraphTool = registeredTools.find(
      (tool) => tool.name === "get-runtime-distributed-task-graph"
    );
    expect(distributedGraphTool).toBeTruthy();
    if (!distributedGraphTool) {
      throw new Error("get-runtime-distributed-task-graph tool not found");
    }
    const distributedGraphResponse = await Promise.resolve(
      distributedGraphTool.execute(
        { taskId: "runtime-1", limit: 64, includeDiagnostics: false },
        null
      )
    );
    expect(distributedTaskGraph).toHaveBeenCalledWith({
      taskId: "runtime-1",
      limit: 64,
      includeDiagnostics: false,
    });
    expect(distributedGraphResponse).toMatchObject({
      ok: true,
      code: expect.any(String),
      message: "Runtime distributed task graph retrieved.",
    });

    const getCapabilitiesTool = registeredTools.find(
      (tool) => tool.name === "get-runtime-capabilities-summary"
    );
    expect(getCapabilitiesTool).toBeTruthy();
    if (!getCapabilitiesTool) {
      throw new Error("get-runtime-capabilities-summary tool not found");
    }
    await Promise.resolve(getCapabilitiesTool.execute({}, null));
    expect(getRuntimeCapabilitiesSummary).toHaveBeenCalledTimes(1);

    const getRuntimePolicyTool = registeredTools.find((tool) => tool.name === "get-runtime-policy");
    expect(getRuntimePolicyTool).toBeTruthy();
    if (!getRuntimePolicyTool) {
      throw new Error("get-runtime-policy tool not found");
    }
    const getRuntimePolicyResponse = await Promise.resolve(getRuntimePolicyTool.execute({}, null));
    expect(getRuntimePolicy).toHaveBeenCalledTimes(1);
    expect(getRuntimePolicyResponse).toMatchObject({
      message: "Runtime policy retrieved.",
      data: {
        policy: {
          mode: "balanced",
        },
      },
    });

    const listRuntimeModelsTool = registeredTools.find(
      (tool) => tool.name === "list-runtime-models"
    );
    expect(listRuntimeModelsTool).toBeTruthy();
    if (!listRuntimeModelsTool) {
      throw new Error("list-runtime-models tool not found");
    }
    const listRuntimeModelsResponse = await Promise.resolve(
      listRuntimeModelsTool.execute({}, null)
    );
    expect(listRuntimeModels).toHaveBeenCalledTimes(1);
    expect(listRuntimeModelsResponse).toMatchObject({
      message: "Runtime models retrieved.",
      data: {
        total: 2,
      },
    });

    const listRuntimeExtensionsTool = registeredTools.find(
      (tool) => tool.name === "list-runtime-extensions"
    );
    expect(listRuntimeExtensionsTool).toBeTruthy();
    if (!listRuntimeExtensionsTool) {
      throw new Error("list-runtime-extensions tool not found");
    }
    const listRuntimeExtensionsResponse = await Promise.resolve(
      listRuntimeExtensionsTool.execute({}, null)
    );
    expect(listRuntimeExtensions).toHaveBeenCalledWith(snapshot.workspaceId);
    expect(listRuntimeExtensionsResponse).toMatchObject({
      message: "Runtime extensions retrieved.",
      data: {
        total: 1,
      },
    });

    const listRuntimePromptsTool = registeredTools.find(
      (tool) => tool.name === "list-runtime-prompts"
    );
    expect(listRuntimePromptsTool).toBeTruthy();
    if (!listRuntimePromptsTool) {
      throw new Error("list-runtime-prompts tool not found");
    }
    const listRuntimePromptsResponse = await Promise.resolve(
      listRuntimePromptsTool.execute({ workspaceId: null }, null)
    );
    expect(listRuntimePrompts).toHaveBeenCalledWith(null);
    expect(listRuntimePromptsResponse).toMatchObject({
      message: "Runtime prompts retrieved.",
      data: {
        workspaceId: null,
        total: 1,
      },
    });

    const listRuntimeMcpServerStatusTool = registeredTools.find(
      (tool) => tool.name === "list-runtime-mcp-server-status"
    );
    expect(listRuntimeMcpServerStatusTool).toBeTruthy();
    if (!listRuntimeMcpServerStatusTool) {
      throw new Error("list-runtime-mcp-server-status tool not found");
    }
    const listRuntimeMcpServerStatusResponse = await Promise.resolve(
      listRuntimeMcpServerStatusTool.execute({}, null)
    );
    expect(listRuntimeMcpServerStatus).toHaveBeenCalledWith({
      workspaceId: snapshot.workspaceId,
      cursor: null,
      limit: null,
    });
    expect(listRuntimeMcpServerStatusResponse).toMatchObject({
      message: "Runtime MCP server status retrieved.",
      data: {
        total: 1,
      },
    });

    const getRuntimeRemoteStatusTool = registeredTools.find(
      (tool) => tool.name === "get-runtime-remote-status"
    );
    expect(getRuntimeRemoteStatusTool).toBeTruthy();
    if (!getRuntimeRemoteStatusTool) {
      throw new Error("get-runtime-remote-status tool not found");
    }
    const getRuntimeRemoteStatusResponse = await Promise.resolve(
      getRuntimeRemoteStatusTool.execute({}, null)
    );
    expect(getRuntimeRemoteStatus).toHaveBeenCalledTimes(1);
    expect(getRuntimeRemoteStatusResponse).toMatchObject({
      message: "Runtime remote status retrieved.",
      data: {
        status: {
          connected: true,
        },
      },
    });

    const exportRuntimeDiagnosticsTool = registeredTools.find(
      (tool) => tool.name === "export-runtime-diagnostics"
    );
    expect(exportRuntimeDiagnosticsTool).toBeTruthy();
    if (!exportRuntimeDiagnosticsTool) {
      throw new Error("export-runtime-diagnostics tool not found");
    }
    const exportRuntimeDiagnosticsResponse = await Promise.resolve(
      exportRuntimeDiagnosticsTool.execute({ redactionLevel: "balanced" }, null)
    );
    expect(runtimeDiagnosticsExportV1).toHaveBeenCalledWith({
      workspaceId: snapshot.workspaceId,
      redactionLevel: "balanced",
    });
    expect(exportRuntimeDiagnosticsResponse).toMatchObject({
      message: "Runtime diagnostics export completed.",
      data: {
        available: true,
      },
    });

    const evaluateRuntimeSecurityPreflightTool = registeredTools.find(
      (tool) => tool.name === "evaluate-runtime-security-preflight"
    );
    expect(evaluateRuntimeSecurityPreflightTool).toBeTruthy();
    if (!evaluateRuntimeSecurityPreflightTool) {
      throw new Error("evaluate-runtime-security-preflight tool not found");
    }
    const evaluateRuntimeSecurityPreflightResponse = await Promise.resolve(
      evaluateRuntimeSecurityPreflightTool.execute(
        {
          toolName: "execute-workspace-command",
          command: "pnpm validate:fast",
          execPolicyRules: ["allow pnpm validate:fast"],
        },
        null
      )
    );
    expect(runtimeSecurityPreflightV1).toHaveBeenCalledWith({
      workspaceId: snapshot.workspaceId,
      toolName: "execute-workspace-command",
      command: "pnpm validate:fast",
      input: null,
      checkPackageAdvisory: undefined,
      checkExecPolicy: undefined,
      execPolicyRules: ["allow pnpm validate:fast"],
    });
    expect(evaluateRuntimeSecurityPreflightResponse).toMatchObject({
      message: "Runtime security preflight evaluated.",
      data: {
        decision: {
          action: "allow",
        },
      },
    });

    const importRuntimeSessionTool = registeredTools.find(
      (tool) => tool.name === "import-runtime-session"
    );
    expect(importRuntimeSessionTool).toBeTruthy();
    if (!importRuntimeSessionTool) {
      throw new Error("import-runtime-session tool not found");
    }
    const importRuntimeSessionResponse = await Promise.resolve(
      importRuntimeSessionTool.execute(
        {
          threadId: "thread-1",
          snapshot: { version: 1 },
        },
        null
      )
    );
    expect(runtimeSessionImportV1).toHaveBeenCalledWith({
      workspaceId: snapshot.workspaceId,
      threadId: "thread-1",
      snapshot: { version: 1 },
    });
    expect(importRuntimeSessionResponse).toMatchObject({
      message: "Runtime session import completed.",
      data: {
        imported: true,
      },
    });

    const deleteRuntimeSessionTool = registeredTools.find(
      (tool) => tool.name === "delete-runtime-session"
    );
    expect(deleteRuntimeSessionTool).toBeTruthy();
    if (!deleteRuntimeSessionTool) {
      throw new Error("delete-runtime-session tool not found");
    }
    const deleteRuntimeSessionResponse = await Promise.resolve(
      deleteRuntimeSessionTool.execute({ threadId: "thread-1" }, null)
    );
    expect(runtimeSessionDeleteV1).toHaveBeenCalledWith({
      workspaceId: snapshot.workspaceId,
      threadId: "thread-1",
    });
    expect(deleteRuntimeSessionResponse).toMatchObject({
      message: "Runtime session delete completed.",
      data: {
        deleted: true,
      },
    });

    const getHealthTool = registeredTools.find((tool) => tool.name === "get-runtime-health");
    expect(getHealthTool).toBeTruthy();
    if (!getHealthTool) {
      throw new Error("get-runtime-health tool not found");
    }
    await Promise.resolve(getHealthTool.execute({}, null));
    expect(getRuntimeHealth).toHaveBeenCalledTimes(1);

    const getTerminalStatusTool = registeredTools.find(
      (tool) => tool.name === "get-runtime-terminal-status"
    );
    expect(getTerminalStatusTool).toBeTruthy();
    if (!getTerminalStatusTool) {
      throw new Error("get-runtime-terminal-status tool not found");
    }
    await Promise.resolve(getTerminalStatusTool.execute({}, null));
    expect(getRuntimeTerminalStatus).toHaveBeenCalledTimes(1);

    const openRuntimeTerminalSessionTool = registeredTools.find(
      (tool) => tool.name === "open-runtime-terminal-session"
    );
    expect(openRuntimeTerminalSessionTool).toBeTruthy();
    if (!openRuntimeTerminalSessionTool) {
      throw new Error("open-runtime-terminal-session tool not found");
    }
    const openRuntimeTerminalSessionResponse = await Promise.resolve(
      openRuntimeTerminalSessionTool.execute({}, null)
    );
    expect(openRuntimeTerminalSession).toHaveBeenCalledWith({
      workspaceId: snapshot.workspaceId,
    });
    expect(openRuntimeTerminalSessionResponse).toMatchObject({
      message: "Runtime terminal session opened.",
      data: {
        session: {
          id: "terminal-session-1",
        },
      },
    });

    const readRuntimeTerminalSessionTool = registeredTools.find(
      (tool) => tool.name === "read-runtime-terminal-session"
    );
    expect(readRuntimeTerminalSessionTool).toBeTruthy();
    if (!readRuntimeTerminalSessionTool) {
      throw new Error("read-runtime-terminal-session tool not found");
    }
    await Promise.resolve(
      readRuntimeTerminalSessionTool.execute({ sessionId: "terminal-session-1" }, null)
    );
    expect(readRuntimeTerminalSession).toHaveBeenCalledWith("terminal-session-1");

    const writeRuntimeTerminalSessionTool = registeredTools.find(
      (tool) => tool.name === "write-runtime-terminal-session"
    );
    expect(writeRuntimeTerminalSessionTool).toBeTruthy();
    if (!writeRuntimeTerminalSessionTool) {
      throw new Error("write-runtime-terminal-session tool not found");
    }
    await Promise.resolve(
      writeRuntimeTerminalSessionTool.execute(
        {
          sessionId: "terminal-session-1",
          input: "pwd\n",
        },
        null
      )
    );
    expect(writeRuntimeTerminalSession).toHaveBeenCalledWith({
      sessionId: "terminal-session-1",
      input: "pwd\n",
    });

    const interruptRuntimeTerminalSessionTool = registeredTools.find(
      (tool) => tool.name === "interrupt-runtime-terminal-session"
    );
    expect(interruptRuntimeTerminalSessionTool).toBeTruthy();
    if (!interruptRuntimeTerminalSessionTool) {
      throw new Error("interrupt-runtime-terminal-session tool not found");
    }
    await Promise.resolve(
      interruptRuntimeTerminalSessionTool.execute({ sessionId: "terminal-session-1" }, null)
    );
    expect(interruptRuntimeTerminalSession).toHaveBeenCalledWith("terminal-session-1");

    const resizeRuntimeTerminalSessionTool = registeredTools.find(
      (tool) => tool.name === "resize-runtime-terminal-session"
    );
    expect(resizeRuntimeTerminalSessionTool).toBeTruthy();
    if (!resizeRuntimeTerminalSessionTool) {
      throw new Error("resize-runtime-terminal-session tool not found");
    }
    await Promise.resolve(
      resizeRuntimeTerminalSessionTool.execute(
        { sessionId: "terminal-session-1", rows: 40, cols: 120 },
        null
      )
    );
    expect(resizeRuntimeTerminalSession).toHaveBeenCalledWith({
      sessionId: "terminal-session-1",
      rows: 40,
      cols: 120,
    });

    const closeRuntimeTerminalSessionTool = registeredTools.find(
      (tool) => tool.name === "close-runtime-terminal-session"
    );
    expect(closeRuntimeTerminalSessionTool).toBeTruthy();
    if (!closeRuntimeTerminalSessionTool) {
      throw new Error("close-runtime-terminal-session tool not found");
    }
    await Promise.resolve(
      closeRuntimeTerminalSessionTool.execute({ sessionId: "terminal-session-1" }, null)
    );
    expect(closeRuntimeTerminalSession).toHaveBeenCalledWith("terminal-session-1");

    const getGitStatusTool = registeredTools.find((tool) => tool.name === "get-runtime-git-status");
    expect(getGitStatusTool).toBeTruthy();
    if (!getGitStatusTool) {
      throw new Error("get-runtime-git-status tool not found");
    }
    const getGitStatusResponse = await Promise.resolve(getGitStatusTool.execute({}, null));
    expect(getGitStatus).toHaveBeenCalledWith(snapshot.workspaceId);
    expect(getGitStatusResponse).toMatchObject({
      ok: true,
      code: expect.any(String),
      message: "Runtime git status retrieved.",
    });

    const getGitDiffsTool = registeredTools.find((tool) => tool.name === "get-runtime-git-diffs");
    expect(getGitDiffsTool).toBeTruthy();
    if (!getGitDiffsTool) {
      throw new Error("get-runtime-git-diffs tool not found");
    }
    await Promise.resolve(
      getGitDiffsTool.execute({ path: "apps/code/src/services/webMcpBridge.ts" }, null)
    );
    expect(getGitDiffs).toHaveBeenCalledWith(snapshot.workspaceId);

    const listGitBranchesTool = registeredTools.find(
      (tool) => tool.name === "list-runtime-git-branches"
    );
    expect(listGitBranchesTool).toBeTruthy();
    if (!listGitBranchesTool) {
      throw new Error("list-runtime-git-branches tool not found");
    }
    await Promise.resolve(listGitBranchesTool.execute({}, null));
    expect(listGitBranches).toHaveBeenCalledWith(snapshot.workspaceId);

    const stageGitFileTool = registeredTools.find((tool) => tool.name === "stage-runtime-git-file");
    expect(stageGitFileTool).toBeTruthy();
    if (!stageGitFileTool) {
      throw new Error("stage-runtime-git-file tool not found");
    }
    await Promise.resolve(
      stageGitFileTool.execute({ path: "apps/code/src/services/webMcpBridge.ts" }, null)
    );
    expect(stageGitFile).toHaveBeenCalledWith(
      snapshot.workspaceId,
      "apps/code/src/services/webMcpBridge.ts"
    );

    const stageGitAllTool = registeredTools.find((tool) => tool.name === "stage-runtime-git-all");
    expect(stageGitAllTool).toBeTruthy();
    if (!stageGitAllTool) {
      throw new Error("stage-runtime-git-all tool not found");
    }
    await Promise.resolve(stageGitAllTool.execute({}, null));
    expect(stageGitAll).toHaveBeenCalledWith(snapshot.workspaceId);

    const unstageGitFileTool = registeredTools.find(
      (tool) => tool.name === "unstage-runtime-git-file"
    );
    expect(unstageGitFileTool).toBeTruthy();
    if (!unstageGitFileTool) {
      throw new Error("unstage-runtime-git-file tool not found");
    }
    await Promise.resolve(
      unstageGitFileTool.execute({ path: "apps/code/src/services/webMcpBridge.ts" }, null)
    );
    expect(unstageGitFile).toHaveBeenCalledWith(
      snapshot.workspaceId,
      "apps/code/src/services/webMcpBridge.ts"
    );

    const revertGitFileTool = registeredTools.find(
      (tool) => tool.name === "revert-runtime-git-file"
    );
    expect(revertGitFileTool).toBeTruthy();
    if (!revertGitFileTool) {
      throw new Error("revert-runtime-git-file tool not found");
    }
    await Promise.resolve(
      revertGitFileTool.execute({ path: "apps/code/src/services/webMcpBridge.ts" }, null)
    );
    expect(revertGitFile).toHaveBeenCalledWith(
      snapshot.workspaceId,
      "apps/code/src/services/webMcpBridge.ts"
    );

    const commitGitTool = registeredTools.find((tool) => tool.name === "commit-runtime-git");
    expect(commitGitTool).toBeTruthy();
    if (!commitGitTool) {
      throw new Error("commit-runtime-git tool not found");
    }
    await Promise.resolve(commitGitTool.execute({ message: "runtime bridge update" }, null));
    expect(commitGit).toHaveBeenCalledWith(snapshot.workspaceId, "runtime bridge update");

    const createBranchTool = registeredTools.find(
      (tool) => tool.name === "create-runtime-git-branch"
    );
    expect(createBranchTool).toBeTruthy();
    if (!createBranchTool) {
      throw new Error("create-runtime-git-branch tool not found");
    }
    await Promise.resolve(createBranchTool.execute({ name: "feature/runtime-tools" }, null));
    expect(createGitBranch).toHaveBeenCalledWith(snapshot.workspaceId, "feature/runtime-tools");

    const checkoutBranchTool = registeredTools.find(
      (tool) => tool.name === "checkout-runtime-git-branch"
    );
    expect(checkoutBranchTool).toBeTruthy();
    if (!checkoutBranchTool) {
      throw new Error("checkout-runtime-git-branch tool not found");
    }
    await Promise.resolve(checkoutBranchTool.execute({ name: "fastcode" }, null));
    expect(checkoutGitBranch).toHaveBeenCalledWith(snapshot.workspaceId, "fastcode");

    const runLiveSkillTool = registeredTools.find((tool) => tool.name === "run-runtime-live-skill");
    expect(runLiveSkillTool).toBeTruthy();
    if (!runLiveSkillTool) {
      throw new Error("run-runtime-live-skill tool not found");
    }
    const runLiveSkillResponse = await Promise.resolve(
      runLiveSkillTool.execute(
        {
          skillId: "core-grep",
          input: "workspaceId",
          options: {
            maxResults: 3,
          },
        },
        null
      )
    );
    expect(runLiveSkill).toHaveBeenCalledWith({
      skillId: "core-grep",
      input: "workspaceId",
      options: {
        maxResults: 3,
        workspaceId: snapshot.workspaceId,
      },
    });
    expect(runLiveSkillResponse).toMatchObject({
      ok: true,
      code: expect.any(String),
      message: "Runtime live skill executed.",
    });
    expect(runLiveSkillResponse).toMatchObject({
      data: {
        toolOutput: {
          truncated: true,
          compactionApplied: true,
          spoolReference: {
            uri: expect.stringContaining(".code-runtime/spool/"),
          },
        },
        result: {
          metadata: {
            compactionApplied: true,
          },
        },
      },
    });
    const liveSkillOutput =
      (
        runLiveSkillResponse as {
          data?: { result?: { output?: string } };
        }
      ).data?.result?.output ?? "";
    expect(typeof liveSkillOutput).toBe("string");
    expect(liveSkillOutput.length).toBe(RUNTIME_TOOL_OUTPUT_MAX_CHARS);
    expect(readRuntimeToolExecutionMetrics().totals.truncatedTotal).toBeGreaterThan(0);

    const runComputerObserveTool = registeredTools.find(
      (tool) => tool.name === "run-runtime-computer-observe"
    );
    expect(runComputerObserveTool).toBeTruthy();
    if (!runComputerObserveTool) {
      throw new Error("run-runtime-computer-observe tool not found");
    }
    const runComputerObserveResponse = await Promise.resolve(
      runComputerObserveTool.execute(
        {
          query: "toolbar status",
          options: {
            maxResults: 5,
            includeViewport: true,
          },
        },
        null
      )
    );
    expect(runLiveSkill).toHaveBeenLastCalledWith({
      skillId: "core-computer-observe",
      input: "toolbar status",
      options: {
        workspaceId: snapshot.workspaceId,
        query: "toolbar status",
        maxResults: 5,
        timeoutMs: null,
        includeViewport: true,
      },
    });
    expect(runComputerObserveResponse).toMatchObject({
      ok: true,
      code: RUNTIME_MESSAGE_CODES.runtime.computerObserve.runCompleted,
      message: "Runtime computer observe completed.",
      data: {
        workspaceId: snapshot.workspaceId,
        result: expect.objectContaining({
          skillId: "core-computer-observe",
        }),
      },
    });

    const postObserveMetricsResponse = await Promise.resolve(
      getToolExecutionMetricsTool.execute({}, null)
    );
    expect(postObserveMetricsResponse).toMatchObject({
      ok: true,
      code: RUNTIME_MESSAGE_CODES.runtime.toolExecution.metricsRetrieved,
      data: expect.objectContaining({
        metrics: expect.objectContaining({
          byTool: expect.any(Object),
        }),
      }),
    });
    const postObserveMetricsByTool = (
      postObserveMetricsResponse as { data?: { metrics?: { byTool?: Record<string, unknown> } } }
    ).data?.metrics?.byTool;
    expect(Object.values(postObserveMetricsByTool ?? {})).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolName: "run-runtime-computer-observe",
          scope: "computer_observe",
          successTotal: expect.any(Number),
        }),
      ])
    );

    const startTool = registeredTools.find((tool) => tool.name === "start-runtime-run");
    expect(startTool).toBeTruthy();
    if (!startTool) {
      throw new Error("start-runtime-run tool not found");
    }
    const startResponse = await Promise.resolve(
      startTool.execute(
        {
          requestId: "request-runtime-1",
          instruction: "inspect the workspace state",
          stepKind: "read",
        },
        null
      )
    );
    expect(startTask).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: snapshot.workspaceId,
        requestId: "request-runtime-1",
        instruction: "inspect the workspace state",
        stepKind: "read",
      })
    );
    expect(startResponse).toMatchObject({
      ok: true,
      code: expect.any(String),
      message: "Runtime agent task started.",
    });
    startTask.mockClear();

    const delegatedResponse = await Promise.resolve(
      startTool.execute(
        {
          instruction: "Please use sub agents to parallelize repository research.",
          scopeProfile: "review",
          allowedSkillIds: "project-search, read_file",
          allowNetwork: false,
          workspaceReadPaths: ["src/runtime", "docs"],
          parentRunId: " parent-runtime-2 ",
        },
        null
      )
    );
    expect(spawnSubAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: snapshot.workspaceId,
        scopeProfile: "review",
        allowedSkillIds: ["core-grep", "core-read"],
        allowNetwork: false,
        workspaceReadPaths: ["src/runtime", "docs"],
        parentRunId: "parent-runtime-2",
      })
    );
    expect(delegatedResponse).toMatchObject({
      ok: true,
      code: expect.any(String),
      message: "Runtime sub-agent session executed.",
      data: {
        delegatedViaSubAgentSession: true,
        allowedSkillResolution: {
          requestedSkillIds: ["project-search", "read_file"],
          resolvedSkillIds: ["core-grep", "core-read"],
          entries: [
            expect.objectContaining({
              requestedSkillId: "project-search",
              resolvedSkillId: "core-grep",
              aliasApplied: true,
              acceptedSkillIds: expect.arrayContaining([
                "core-grep",
                "grep",
                "search",
                "project-search",
              ]),
            }),
            expect.objectContaining({
              requestedSkillId: "read_file",
              resolvedSkillId: "core-read",
              aliasApplied: true,
              acceptedSkillIds: expect.arrayContaining(["core-read", "read_file"]),
            }),
          ],
        },
        sessionHandle: {
          sessionId: "sub-agent-session-1",
          status: "completed",
          checkpointId: "checkpoint-sub-1",
          traceId: "trace-sub-1",
          recovered: true,
        },
      },
    });

    const resumeTool = registeredTools.find((tool) => tool.name === "resume-runtime-run");
    expect(resumeTool).toBeTruthy();
    if (!resumeTool) {
      throw new Error("resume-runtime-run tool not found");
    }
    const resumeResponse = await Promise.resolve(
      resumeTool.execute(
        {
          taskId: "runtime-1",
          reason: "recover after restart",
        },
        null
      )
    );
    expect(resumeTask).toHaveBeenCalledWith({
      taskId: "runtime-1",
      reason: "recover after restart",
    });
    expect(resumeResponse).toMatchObject({
      ok: true,
      code: expect.any(String),
      message: "Runtime task resume submitted.",
    });

    const terminateTool = registeredTools.find((tool) => tool.name === "terminate-runtime-run");
    expect(terminateTool).toBeTruthy();
    if (!terminateTool) {
      throw new Error("terminate-runtime-run tool not found");
    }
    const terminateResponse = await Promise.resolve(
      terminateTool.execute({ taskId: "runtime-1" }, null)
    );
    expect(interruptTask).toHaveBeenCalledWith({
      taskId: "runtime-1",
      reason: "webmcp:terminate-runtime-run",
    });
    expect(terminateResponse).toMatchObject({
      ok: true,
      code: expect.any(String),
      message: "Runtime task termination submitted.",
    });
    expect(getTaskStatus).not.toHaveBeenCalled();
    expect(startTask).not.toHaveBeenCalled();

    const listActionRequiredTool = registeredTools.find(
      (tool) => tool.name === "list-runtime-action-required"
    );
    expect(listActionRequiredTool).toBeTruthy();
    if (!listActionRequiredTool) {
      throw new Error("list-runtime-action-required tool not found");
    }
    const listActionRequiredResponse = await Promise.resolve(
      listActionRequiredTool.execute({ limit: 50 }, null)
    );
    expect(listTasks).toHaveBeenCalledWith({
      workspaceId: snapshot.workspaceId,
      status: "awaiting_approval",
      limit: 50,
    });
    expect(listActionRequiredResponse).toMatchObject({
      ok: true,
      code: RUNTIME_MESSAGE_CODES.runtime.actionRequired.listRetrieved,
      message: "Runtime action-required items retrieved.",
      data: {
        total: 3,
        items: expect.arrayContaining([
          expect.objectContaining({
            requestId: "approval-1",
            source: "runtime-task-approval",
          }),
          expect.objectContaining({
            requestId: 77,
            source: "thread-approval",
          }),
          expect.objectContaining({
            requestId: "user-input-1",
            source: "thread-user-input",
          }),
        ]),
      },
    });

    const getActionRequiredTool = registeredTools.find(
      (tool) => tool.name === "get-runtime-action-required"
    );
    expect(getActionRequiredTool).toBeTruthy();
    if (!getActionRequiredTool) {
      throw new Error("get-runtime-action-required tool not found");
    }
    const getActionRequiredResponse = await Promise.resolve(
      getActionRequiredTool.execute({ requestId: 77 }, null)
    );
    expect(getActionRequiredResponse).toMatchObject({
      ok: true,
      code: RUNTIME_MESSAGE_CODES.runtime.actionRequired.itemRetrieved,
      message: "Runtime action-required item retrieved.",
      data: {
        item: expect.objectContaining({
          requestId: 77,
          source: "thread-approval",
        }),
      },
    });

    const resolveActionRequiredTool = registeredTools.find(
      (tool) => tool.name === "resolve-runtime-action-required"
    );
    expect(resolveActionRequiredTool).toBeTruthy();
    if (!resolveActionRequiredTool) {
      throw new Error("resolve-runtime-action-required tool not found");
    }
    const resolveApprovalResponse = await Promise.resolve(
      resolveActionRequiredTool.execute(
        {
          requestId: "approval-1",
          kind: "approval",
          decision: "approved",
        },
        null
      )
    );
    expect(submitDecision).toHaveBeenCalledWith({
      approvalId: "approval-1",
      decision: "approved",
      reason: null,
    });
    expect(resolveApprovalResponse).toMatchObject({
      ok: true,
      code: RUNTIME_MESSAGE_CODES.runtime.actionRequired.itemResolved,
      message: "Runtime action-required item resolved.",
    });
    expect(actionRequiredSubmitV2).toHaveBeenCalledWith({
      requestId: "approval-1",
      kind: "approval",
      status: "approved",
      reason: null,
    });

    const resolveElicitationResponse = await Promise.resolve(
      resolveActionRequiredTool.execute(
        {
          requestId: "user-input-1",
          kind: "elicitation",
          decision: "submitted",
          answers: {
            q1: {
              answers: ["repo-a"],
            },
          },
        },
        null
      )
    );
    expect(respondToUserInputRequest).toHaveBeenCalledWith(snapshot.workspaceId, "user-input-1", {
      q1: {
        answers: ["repo-a"],
      },
    });
    expect(resolveElicitationResponse).toMatchObject({
      ok: true,
      code: RUNTIME_MESSAGE_CODES.runtime.actionRequired.itemResolved,
      message: "Runtime action-required item resolved.",
    });
    expect(actionRequiredSubmitV2).toHaveBeenCalledWith({
      requestId: "user-input-1",
      kind: "elicitation",
      status: "submitted",
      reason: null,
    });

    const doctorTool = registeredTools.find((tool) => tool.name === "run-runtime-codex-doctor");
    expect(doctorTool).toBeTruthy();
    if (!doctorTool) {
      throw new Error("run-runtime-codex-doctor tool not found");
    }
    const doctorResponse = await Promise.resolve(
      doctorTool.execute(
        {
          codexBin: "codex",
          codexArgs: ["--healthcheck"],
        },
        null
      )
    );
    expect(runRuntimeCodexDoctor).toHaveBeenCalledWith({
      codexBin: "codex",
      codexArgs: ["--healthcheck"],
    });
    expect(doctorResponse).toMatchObject({
      ok: true,
      message: "Runtime codex doctor completed.",
    });

    const updateTool = registeredTools.find((tool) => tool.name === "run-runtime-codex-update");
    expect(updateTool).toBeTruthy();
    if (!updateTool) {
      throw new Error("run-runtime-codex-update tool not found");
    }
    const updateResponse = await Promise.resolve(
      updateTool.execute(
        {
          codexBin: "codex",
          codexArgs: ["--yes"],
        },
        null
      )
    );
    expect(runRuntimeCodexUpdate).toHaveBeenCalledWith({
      codexBin: "codex",
      codexArgs: ["--yes"],
    });
    expect(updateResponse).toMatchObject({
      ok: true,
      message: "Runtime codex update completed.",
    });

    const createRuntimePromptTool = registeredTools.find(
      (tool) => tool.name === "create-runtime-prompt"
    );
    expect(createRuntimePromptTool).toBeTruthy();
    if (!createRuntimePromptTool) {
      throw new Error("create-runtime-prompt tool not found");
    }
    await Promise.resolve(
      createRuntimePromptTool.execute(
        {
          scope: "workspace",
          title: "Created Prompt",
          description: "created description",
          content: "created content",
        },
        null
      )
    );
    expect(createRuntimePrompt).toHaveBeenCalledWith({
      workspaceId: snapshot.workspaceId,
      scope: "workspace",
      title: "Created Prompt",
      description: "created description",
      content: "created content",
    });

    const updateRuntimePromptTool = registeredTools.find(
      (tool) => tool.name === "update-runtime-prompt"
    );
    expect(updateRuntimePromptTool).toBeTruthy();
    if (!updateRuntimePromptTool) {
      throw new Error("update-runtime-prompt tool not found");
    }
    await Promise.resolve(
      updateRuntimePromptTool.execute(
        {
          promptId: "prompt-created-1",
          title: "Updated Prompt",
          description: "updated description",
          content: "updated content",
        },
        null
      )
    );
    expect(updateRuntimePrompt).toHaveBeenCalledWith({
      workspaceId: snapshot.workspaceId,
      promptId: "prompt-created-1",
      title: "Updated Prompt",
      description: "updated description",
      content: "updated content",
    });

    const moveRuntimePromptTool = registeredTools.find(
      (tool) => tool.name === "move-runtime-prompt"
    );
    expect(moveRuntimePromptTool).toBeTruthy();
    if (!moveRuntimePromptTool) {
      throw new Error("move-runtime-prompt tool not found");
    }
    await Promise.resolve(
      moveRuntimePromptTool.execute(
        {
          promptId: "prompt-created-1",
          targetScope: "global",
        },
        null
      )
    );
    expect(moveRuntimePrompt).toHaveBeenCalledWith({
      workspaceId: snapshot.workspaceId,
      promptId: "prompt-created-1",
      targetScope: "global",
    });

    const deleteRuntimePromptTool = registeredTools.find(
      (tool) => tool.name === "delete-runtime-prompt"
    );
    expect(deleteRuntimePromptTool).toBeTruthy();
    if (!deleteRuntimePromptTool) {
      throw new Error("delete-runtime-prompt tool not found");
    }
    await Promise.resolve(
      deleteRuntimePromptTool.execute(
        {
          promptId: "prompt-created-1",
        },
        null
      )
    );
    expect(deleteRuntimePrompt).toHaveBeenCalledWith({
      workspaceId: snapshot.workspaceId,
      promptId: "prompt-created-1",
    });

    const installExtensionTool = registeredTools.find(
      (tool) => tool.name === "install-runtime-extension"
    );
    expect(installExtensionTool).toBeTruthy();
    if (!installExtensionTool) {
      throw new Error("install-runtime-extension tool not found");
    }
    const installExtensionResponse = await Promise.resolve(
      installExtensionTool.execute(
        {
          extensionId: "ext-2",
          name: "Extension Two",
          transport: "builtin",
          enabled: true,
          config: { profile: "default" },
        },
        null
      )
    );
    expect(installRuntimeExtension).toHaveBeenCalledWith({
      workspaceId: snapshot.workspaceId,
      extensionId: "ext-2",
      name: "Extension Two",
      transport: "builtin",
      enabled: true,
      config: { profile: "default" },
    });
    expect(installExtensionResponse).toMatchObject({
      ok: true,
      message: "Runtime extension installed.",
    });

    const removeExtensionTool = registeredTools.find(
      (tool) => tool.name === "remove-runtime-extension"
    );
    expect(removeExtensionTool).toBeTruthy();
    if (!removeExtensionTool) {
      throw new Error("remove-runtime-extension tool not found");
    }
    const removeExtensionResponse = await Promise.resolve(
      removeExtensionTool.execute(
        {
          extensionId: "ext-2",
        },
        null
      )
    );
    expect(removeRuntimeExtension).toHaveBeenCalledWith({
      workspaceId: snapshot.workspaceId,
      extensionId: "ext-2",
    });
    expect(removeExtensionResponse).toMatchObject({
      ok: true,
      message: "Runtime extension removed.",
    });

    const listOauthAccountsTool = registeredTools.find(
      (tool) => tool.name === "list-runtime-oauth-accounts"
    );
    expect(listOauthAccountsTool).toBeTruthy();
    if (!listOauthAccountsTool) {
      throw new Error("list-runtime-oauth-accounts tool not found");
    }
    const listOauthAccountsResponse = await Promise.resolve(
      listOauthAccountsTool.execute(
        {
          provider: "codex",
          usageRefresh: "force",
        },
        null
      )
    );
    expect(listRuntimeOAuthAccounts).toHaveBeenCalledWith("codex", {
      usageRefresh: "force",
    });
    expect(listOauthAccountsResponse).toMatchObject({
      ok: true,
      message: "Runtime OAuth accounts retrieved.",
    });

    const getAccountInfoTool = registeredTools.find(
      (tool) => tool.name === "get-runtime-account-info"
    );
    expect(getAccountInfoTool).toBeTruthy();
    if (!getAccountInfoTool) {
      throw new Error("get-runtime-account-info tool not found");
    }
    await Promise.resolve(getAccountInfoTool.execute({}, null));
    expect(getRuntimeAccountInfo).toHaveBeenCalledWith(snapshot.workspaceId);

    const listOauthPoolsTool = registeredTools.find(
      (tool) => tool.name === "list-runtime-oauth-pools"
    );
    expect(listOauthPoolsTool).toBeTruthy();
    if (!listOauthPoolsTool) {
      throw new Error("list-runtime-oauth-pools tool not found");
    }
    await Promise.resolve(listOauthPoolsTool.execute({ provider: "codex" }, null));
    expect(listRuntimeOAuthPools).toHaveBeenCalledWith("codex");

    const applyOauthPoolTool = registeredTools.find(
      (tool) => tool.name === "apply-runtime-oauth-pool"
    );
    expect(applyOauthPoolTool).toBeTruthy();
    if (!applyOauthPoolTool) {
      throw new Error("apply-runtime-oauth-pool tool not found");
    }
    const applyOauthPoolResponse = await Promise.resolve(
      applyOauthPoolTool.execute(
        {
          pool: {
            poolId: "pool-1",
            provider: "codex",
            name: "Primary Pool",
            strategy: "round_robin",
            stickyMode: "cache_first",
            preferredAccountId: "acc-1",
            enabled: true,
            metadata: {},
          },
          members: [{ accountId: "acc-1", weight: 1 }],
          expectedUpdatedAt: now,
        },
        null
      )
    );
    expect(applyRuntimeOAuthPool).toHaveBeenCalledWith({
      pool: {
        poolId: "pool-1",
        provider: "codex",
        name: "Primary Pool",
        strategy: "round_robin",
        stickyMode: "cache_first",
        preferredAccountId: "acc-1",
        enabled: true,
        metadata: {},
      },
      members: [{ accountId: "acc-1", weight: 1 }],
      expectedUpdatedAt: now,
    });
    expect(applyOauthPoolResponse).toMatchObject({
      ok: true,
      message: "Runtime OAuth pool applied.",
    });

    const removeOauthAccountTool = registeredTools.find(
      (tool) => tool.name === "remove-runtime-oauth-account"
    );
    expect(removeOauthAccountTool).toBeTruthy();
    if (!removeOauthAccountTool) {
      throw new Error("remove-runtime-oauth-account tool not found");
    }
    await Promise.resolve(removeOauthAccountTool.execute({ accountId: "acc-1" }, null));
    expect(removeRuntimeOAuthAccount).toHaveBeenCalledWith("acc-1");

    const selectOauthPoolAccountTool = registeredTools.find(
      (tool) => tool.name === "select-runtime-oauth-pool-account"
    );
    expect(selectOauthPoolAccountTool).toBeTruthy();
    if (!selectOauthPoolAccountTool) {
      throw new Error("select-runtime-oauth-pool-account tool not found");
    }
    await Promise.resolve(
      selectOauthPoolAccountTool.execute(
        {
          poolId: "pool-1",
          modelId: "gpt-5.3-codex",
        },
        null
      )
    );
    expect(selectRuntimeOAuthPoolAccount).toHaveBeenCalledWith({
      poolId: "pool-1",
      modelId: "gpt-5.3-codex",
      sessionId: null,
      workspaceId: null,
    });

    const interruptAllTool = registeredTools.find(
      (tool) => tool.name === "interrupt-runtime-active-tasks"
    );
    expect(interruptAllTool).toBeTruthy();
    if (!interruptAllTool) {
      throw new Error("interrupt-runtime-active-tasks tool not found");
    }
    const interruptAllResponse = await Promise.resolve(interruptAllTool.execute({}, null));
    expect(interruptTask).toHaveBeenCalledWith({
      taskId: "runtime-1",
      reason: "webmcp:interrupt-runtime-active-tasks",
    });
    expect(interruptTask).toHaveBeenCalledWith({
      taskId: "runtime-2",
      reason: "webmcp:interrupt-runtime-active-tasks",
    });
    expect(interruptAllResponse).toMatchObject({
      ok: true,
      code: expect.any(String),
      message: "Active runtime tasks interrupted.",
    });
  });
});
