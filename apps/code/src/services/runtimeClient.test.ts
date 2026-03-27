import {
  CODE_RUNTIME_RPC_CONTRACT_VERSION,
  CODE_RUNTIME_RPC_ERROR_CODES,
  CODE_RUNTIME_RPC_FEATURES,
  CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
  computeCodeRuntimeRpcMethodSetHash,
} from "@ku0/code-runtime-host-contract";
import { CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES } from "@ku0/code-runtime-host-contract/codeRuntimeRpcCompat";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
const isTauriMock = vi.fn();
const CANONICAL_WORKSPACES_METHOD = "code_workspaces_list";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}));

function syncTauriBridgeWithMockState() {
  const tauriWindow = window as Window & {
    __TAURI_INTERNALS__?: unknown;
  };
  const implementation = isTauriMock.getMockImplementation();
  if (implementation && implementation() === true) {
    tauriWindow.__TAURI_INTERNALS__ = {
      invoke: invokeMock,
    };
  }
}

async function importRuntimeClientModule() {
  vi.resetModules();
  syncTauriBridgeWithMockState();
  return import("./runtimeClient");
}

function clearTauriMarkers() {
  const tauriWindow = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
    __TAURI_IPC__?: unknown;
  };

  delete tauriWindow.__TAURI__;
  delete tauriWindow.__TAURI_INTERNALS__;
  delete tauriWindow.__TAURI_IPC__;
}

function clearAgentRuntimeMarkers() {
  const runtimeWindow = window as Window & {
    __OPEN_WRAP_AGENT_RUNTIME_RPC__?: unknown;
    __KU_AGENT_RUNTIME_RPC__?: unknown;
    __AGENT_RUNTIME_RPC__?: unknown;
    agentRuntimeRpc?: unknown;
  };

  delete runtimeWindow.__OPEN_WRAP_AGENT_RUNTIME_RPC__;
  delete runtimeWindow.__KU_AGENT_RUNTIME_RPC__;
  delete runtimeWindow.__AGENT_RUNTIME_RPC__;
  delete runtimeWindow.agentRuntimeRpc;
}

const FROZEN_RUNTIME_RPC_CONTRACT_VERSION = CODE_RUNTIME_RPC_CONTRACT_VERSION;
const FROZEN_RUNTIME_RPC_FREEZE_EFFECTIVE_AT = CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT;
const FROZEN_RUNTIME_RPC_REQUIRED_FEATURES = [...CODE_RUNTIME_RPC_FEATURES];
const FROZEN_RUNTIME_RPC_ERROR_CODES = CODE_RUNTIME_RPC_ERROR_CODES;
const FROZEN_RUNTIME_RPC_COMPAT_FIELD_ALIASES = CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES;

function createFrozenCapabilitiesPayload(
  overrides: Partial<{
    freezeEffectiveAt: string;
    methodSetHash: string;
    methods: string[];
    features: string[];
    errorCodes: Record<string, string>;
    compatFieldAliases: Record<string, string>;
  }> = {}
): Record<string, unknown> {
  const methods = overrides.methods ?? [CANONICAL_WORKSPACES_METHOD];
  const methodSetHash = overrides.methodSetHash ?? computeCodeRuntimeRpcMethodSetHash(methods);
  const features = overrides.features ?? [...FROZEN_RUNTIME_RPC_REQUIRED_FEATURES];
  const errorCodes = overrides.errorCodes ?? { ...FROZEN_RUNTIME_RPC_ERROR_CODES };
  const compatFieldAliases = overrides.compatFieldAliases ?? {
    ...FROZEN_RUNTIME_RPC_COMPAT_FIELD_ALIASES,
  };
  return {
    contractVersion: FROZEN_RUNTIME_RPC_CONTRACT_VERSION,
    freezeEffectiveAt: FROZEN_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
    ...overrides,
    methodSetHash,
    methods,
    features,
    errorCodes,
    compatFieldAliases,
  };
}

describe("runtimeClient mode detection", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    isTauriMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    clearTauriMarkers();
    clearAgentRuntimeMarkers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    clearTauriMarkers();
    clearAgentRuntimeMarkers();
  });

  it("routes to tauri client when tauri bridge is available", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockResolvedValue([]);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    expect(runtime.detectRuntimeMode()).toBe("tauri");
    await client.workspaces();
    expect(invokeMock).toHaveBeenCalledWith("code_workspaces_list", {});
    await client.workspacePickDirectory();
    expect(invokeMock).toHaveBeenCalledWith("code_workspace_pick_directory", {});
    await client.providersCatalog();
    expect(invokeMock).toHaveBeenCalledWith("code_providers_catalog", {});

    invokeMock.mockResolvedValueOnce(true);
    await client.interruptTurn({ turnId: "turn-123", reason: "user-stop" });
    expect(invokeMock).toHaveBeenCalledWith(
      "code_turn_interrupt",
      expect.objectContaining({
        payload: expect.objectContaining({ turnId: "turn-123", reason: "user-stop" }),
      })
    );

    invokeMock.mockResolvedValueOnce({
      accepted: true,
      turnId: "turn-123",
      threadId: "thread-123",
      routedProvider: null,
      routedModelId: null,
      routedPool: null,
      routedSource: null,
      message: "ok",
    });
    await client.sendTurn({
      workspaceId: "workspace-123",
      threadId: "thread-123",
      requestId: "request-123",
      content: "Ping",
      contextPrefix: "[ATLAS_CONTEXT v1]\n1. plan: noop\n[/ATLAS_CONTEXT]",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      reasonEffort: "high",
      accessMode: "on-request",
      executionMode: "runtime",
      codexBin: "/opt/codex",
      codexArgs: ["--profile", "personal"],
      queue: false,
      attachments: [],
    });
    expect(invokeMock).toHaveBeenCalledWith(
      "code_turn_send",
      expect.objectContaining({
        payload: expect.objectContaining({
          workspaceId: "workspace-123",
          threadId: "thread-123",
          requestId: "request-123",
          contextPrefix: "[ATLAS_CONTEXT v1]\n1. plan: noop\n[/ATLAS_CONTEXT]",
          provider: "openai",
          modelId: "gpt-5.3-codex",
          reasonEffort: "high",
          accessMode: "on-request",
          executionMode: "runtime",
          codexBin: "/opt/codex",
          codexArgs: ["--profile", "personal"],
        }),
      })
    );

    invokeMock.mockResolvedValueOnce({
      subscriptionId: "sub-123",
      heartbeatIntervalMs: 10_000,
      transportMode: "push",
      contextRevision: 7,
    });
    await client.threadLiveSubscribe("workspace-123", "thread-123");
    expect(invokeMock).toHaveBeenCalledWith(
      "code_thread_live_subscribe",
      expect.objectContaining({
        workspaceId: "workspace-123",
        threadId: "thread-123",
      })
    );

    invokeMock.mockResolvedValueOnce({ ok: true });
    await client.threadLiveUnsubscribe("sub-123");
    expect(invokeMock).toHaveBeenCalledWith(
      "code_thread_live_unsubscribe",
      expect.objectContaining({
        subscriptionId: "sub-123",
      })
    );

    invokeMock.mockResolvedValueOnce(null);
    await client.terminalRead("session-123");
    expect(invokeMock).toHaveBeenCalledWith(
      "code_terminal_read",
      expect.objectContaining({
        sessionId: "session-123",
      })
    );

    invokeMock.mockResolvedValueOnce(true);
    await client.terminalStreamStart("session-123");
    expect(invokeMock).toHaveBeenCalledWith(
      "code_terminal_stream_start",
      expect.objectContaining({
        sessionId: "session-123",
      })
    );

    invokeMock.mockResolvedValueOnce(true);
    await client.terminalStreamStop("session-123");
    expect(invokeMock).toHaveBeenCalledWith(
      "code_terminal_stream_stop",
      expect.objectContaining({
        sessionId: "session-123",
      })
    );

    invokeMock.mockResolvedValueOnce(true);
    await client.terminalInterrupt("session-123");
    expect(invokeMock).toHaveBeenCalledWith(
      "code_terminal_interrupt",
      expect.objectContaining({
        sessionId: "session-123",
      })
    );

    invokeMock.mockResolvedValueOnce(true);
    await client.terminalResize("session-123", 42, 120);
    expect(invokeMock).toHaveBeenCalledWith(
      "code_terminal_resize",
      expect.objectContaining({
        sessionId: "session-123",
        rows: 42,
        cols: 120,
      })
    );

    invokeMock.mockResolvedValueOnce(true);
    await client.terminalInputRaw("session-123", "ls -la\r");
    expect(invokeMock).toHaveBeenCalledWith(
      "code_terminal_input_raw",
      expect.objectContaining({
        sessionId: "session-123",
        input: "ls -la\r",
      })
    );

    invokeMock.mockResolvedValueOnce([]);
    await client.runtimeRunsList({
      workspaceId: "workspace-123",
      status: "running",
      limit: 10,
    });
    expect(invokeMock).toHaveBeenCalledWith(
      "code_runtime_runs_list",
      expect.objectContaining({
        workspaceId: "workspace-123",
        status: "running",
        limit: 10,
      })
    );

    invokeMock.mockResolvedValueOnce({
      preparedAt: 1,
      runIntent: {
        title: "Prepare runtime kernel v2",
        objective: "Verify runtime run prepare",
        summary: "prepared",
        taskSource: null,
        accessMode: "on-request",
        executionMode: "single",
        executionProfileId: null,
        reviewProfileId: null,
        validationPresetId: null,
        preferredBackendIds: [],
        requiredCapabilities: [],
        riskLevel: "low",
        clarified: true,
        missingContext: [],
      },
      contextWorkingSet: {
        summary: "working set",
        workspaceRoot: "/tmp/workspace",
        selectionPolicy: {
          strategy: "balanced",
          tokenBudgetTarget: 1500,
          toolExposureProfile: "slim",
          preferColdFetch: true,
        },
        contextFingerprint: "work-123",
        stablePrefixFingerprint: "stable-123",
        layers: [],
      },
      contextTruth: {
        summary: "manual context",
        canonicalTaskSource: null,
        sources: [],
        executionProfileId: null,
        reviewProfileId: null,
        validationPresetId: null,
        reviewIntent: "execute",
        ownerSummary:
          "Human owner stays accountable; the runtime agent executes the delegated work.",
        sourceMetadata: [],
        consumers: ["run", "review_pack", "takeover", "follow_up"],
      },
      guidanceStack: {
        summary: "none",
        precedence: [],
        layers: [],
      },
      triageSummary: {
        owner: null,
        priority: null,
        riskLevel: "low",
        tags: [],
        dedupeKey: null,
        summary: "Owner unassigned · Risk low",
      },
      delegationContract: {
        summary: "delegate",
        state: "launch_ready",
        humanOwner: "Operator",
        agentExecutor: "Runtime agent",
        accountability:
          "Human owner stays accountable; the runtime agent executes the delegated work.",
        nextOperatorAction: "Launch the run.",
        continueVia: null,
      },
      executionGraph: {
        graphId: "graph-1",
        summary: "graph",
        nodes: [],
      },
      approvalBatches: [],
      validationPlan: {
        required: false,
        summary: "none",
        commands: [],
      },
      reviewFocus: [],
      plan: {
        planVersion: "plan-123",
        summary: "prepared",
        currentMilestoneId: null,
        estimatedDurationMinutes: 5,
        estimatedWorkerRuns: 1,
        parallelismHint: "sequential",
        clarifyingQuestions: [],
        milestones: [],
        validationLanes: [],
        skillPlan: [],
      },
    });
    await client.runtimeRunPrepareV2({
      workspaceId: "workspace-123",
      threadId: "thread-123",
      requestId: "prepare-123",
      accessMode: "on-request",
      executionMode: "single",
      steps: [{ kind: "read", input: "Inspect runtime kernel v2" }],
    });
    expect(invokeMock).toHaveBeenLastCalledWith(
      "code_runtime_run_prepare_v2",
      expect.objectContaining({
        workspaceId: "workspace-123",
        threadId: "thread-123",
        requestId: "prepare-123",
        steps: expect.arrayContaining([
          expect.objectContaining({ kind: "read", input: "Inspect runtime kernel v2" }),
        ]),
      })
    );

    invokeMock.mockResolvedValueOnce({
      run: {
        taskId: "run-123",
        workspaceId: "workspace-123",
        threadId: null,
        requestId: null,
        title: "Runtime v2",
        status: "queued",
        accessMode: "on-request",
        provider: null,
        modelId: null,
        routedProvider: null,
        routedModelId: null,
        routedPool: null,
        routedSource: null,
        currentStep: null,
        createdAt: 1,
        updatedAt: 1,
        startedAt: null,
        completedAt: null,
        errorCode: null,
        errorMessage: null,
        pendingApprovalId: null,
        steps: [],
      },
      missionRun: {
        runId: "run-123",
        workspaceId: "workspace-123",
        threadId: null,
        status: "queued",
        title: "Runtime v2",
        summary: null,
        objective: null,
        createdAt: 1,
        updatedAt: 1,
        lastEventAt: null,
        pendingApprovalId: null,
        activeSubAgentCount: 0,
        reviewStatus: "not_started",
        nextAction: null,
        progressLabel: null,
      },
      reviewPack: null,
    });
    await client.runtimeRunStartV2({
      workspaceId: "workspace-123",
      accessMode: "on-request",
      executionMode: "single",
      approvedPlanVersion: "plan-123",
      steps: [{ kind: "read", input: "Start runtime kernel v2" }],
    });
    expect(invokeMock).toHaveBeenLastCalledWith(
      "code_runtime_run_start_v2",
      expect.objectContaining({
        workspaceId: "workspace-123",
        approvedPlanVersion: "plan-123",
        steps: expect.arrayContaining([
          expect.objectContaining({ kind: "read", input: "Start runtime kernel v2" }),
        ]),
      })
    );

    invokeMock.mockResolvedValueOnce(null);
    await client.runtimeRunSubscribeV2({ runId: "run-123" });
    expect(invokeMock).toHaveBeenLastCalledWith(
      "code_runtime_run_subscribe_v2",
      expect.objectContaining({
        runId: "run-123",
      })
    );

    invokeMock.mockResolvedValueOnce(null);
    await client.runtimeReviewGetV2({ runId: "run-123" });
    expect(invokeMock).toHaveBeenLastCalledWith(
      "code_runtime_review_get_v2",
      expect.objectContaining({
        runId: "run-123",
      })
    );

    invokeMock.mockResolvedValueOnce({
      accepted: true,
      runId: "job-123",
      status: "interrupted",
      message: "cancelled",
    });
    await client.kernelJobCancelV3({ runId: "job-123", reason: "user-stop" });
    expect(invokeMock).toHaveBeenLastCalledWith(
      "code_kernel_job_cancel_v3",
      expect.objectContaining({
        runId: "job-123",
        reason: "user-stop",
      })
    );

    invokeMock.mockResolvedValueOnce({
      registered: true,
      callbackId: "cb-123",
      delivery: { mode: "callback", callbackId: "cb-123" },
      message: null,
    });
    await client.kernelJobCallbackRegisterV3({
      callbackId: "cb-123",
      workspaceId: "workspace-123",
      mode: "callback",
    });
    expect(invokeMock).toHaveBeenLastCalledWith(
      "code_kernel_job_callback_register_v3",
      expect.objectContaining({
        callbackId: "cb-123",
        workspaceId: "workspace-123",
        mode: "callback",
      })
    );

    invokeMock.mockResolvedValueOnce({
      removed: true,
      callbackId: "cb-123",
      message: null,
    });
    await client.kernelJobCallbackRemoveV3({ callbackId: "cb-123" });
    expect(invokeMock).toHaveBeenLastCalledWith(
      "code_kernel_job_callback_remove_v3",
      expect.objectContaining({
        callbackId: "cb-123",
      })
    );

    invokeMock.mockResolvedValueOnce([]);
    await client.cliSessions();
    expect(invokeMock).toHaveBeenCalledWith("code_cli_sessions_list", {});

    invokeMock.mockResolvedValueOnce([]);
    await client.runtimeBackendsList();
    expect(invokeMock).toHaveBeenCalledWith("code_runtime_backends_list", {});

    invokeMock.mockResolvedValueOnce({
      available: true,
      summary: {
        errorCount: 1,
        warningCount: 0,
        infoCount: 0,
        hintCount: 0,
        total: 1,
      },
      items: [],
      providers: [],
      generatedAtMs: 1_770_000_000_000,
      reason: null,
    });
    await client.workspaceDiagnosticsListV1({
      workspaceId: "workspace-123",
      paths: ["apps/code/src"],
      severities: ["error"],
      maxItems: 25,
      includeProviderDetails: true,
    });
    expect(invokeMock).toHaveBeenCalledWith(
      "code_workspace_diagnostics_list_v1",
      expect.objectContaining({
        workspaceId: "workspace-123",
        paths: ["apps/code/src"],
        severities: ["error"],
        maxItems: 25,
        includeProviderDetails: true,
      })
    );

    invokeMock.mockResolvedValueOnce(null);
    await client.distributedTaskGraph({
      taskId: "task-123",
      limit: 96,
      includeDiagnostics: false,
    });
    expect(invokeMock).toHaveBeenCalledWith(
      "code_distributed_task_graph",
      expect.objectContaining({
        taskId: "task-123",
        limit: 96,
        includeDiagnostics: false,
      })
    );

    const metricsSnapshot = {
      totals: {
        completed: 1,
        success: 1,
        validationFailed: 0,
        runtimeFailed: 0,
        timeout: 0,
        blocked: 0,
      },
      byTool: {},
      recent: [],
      updatedAt: 1_770_000_000_000,
      windowSize: 500,
      channelHealth: {
        status: "healthy",
        reason: null,
        lastErrorCode: null,
        updatedAt: 1_770_000_000_000,
      },
      circuitBreakers: [
        { scope: "write", state: "closed", openedAt: null, updatedAt: 1_770_000_000_000 },
        { scope: "runtime", state: "closed", openedAt: null, updatedAt: 1_770_000_000_000 },
        {
          scope: "computer_observe",
          state: "closed",
          openedAt: null,
          updatedAt: 1_770_000_000_000,
        },
      ],
    };

    const guardrailSnapshot = {
      windowSize: 500,
      payloadLimitBytes: 65_536,
      computerObserveRateLimitPerMinute: 12,
      circuitWindowSize: 50,
      circuitMinCompleted: 20,
      circuitOpenMs: 600_000,
      halfOpenMaxProbes: 3,
      halfOpenRequiredSuccesses: 2,
      channelHealth: metricsSnapshot.channelHealth,
      circuitBreakers: metricsSnapshot.circuitBreakers,
      updatedAt: 1_770_000_000_000,
    };

    invokeMock.mockResolvedValueOnce(metricsSnapshot);
    await client.runtimeToolMetricsRead();
    expect(invokeMock).toHaveBeenCalledWith("code_runtime_tool_metrics_read", {});

    invokeMock.mockResolvedValueOnce(metricsSnapshot);
    await client.runtimeToolMetricsRead({
      scope: "runtime",
      toolName: "run-runtime-live-skill",
      sinceMs: 123,
      limit: 20,
    });
    expect(invokeMock).toHaveBeenCalledWith("code_runtime_tool_metrics_read", {
      scope: "runtime",
      toolName: "run-runtime-live-skill",
      sinceMs: 123,
      limit: 20,
    });

    invokeMock.mockResolvedValueOnce(metricsSnapshot);
    await client.runtimeToolMetricsRecord([
      {
        toolName: "run-runtime-live-skill",
        scope: "runtime",
        phase: "completed",
        status: "success",
        at: 1_770_000_000_000,
      },
    ]);
    expect(invokeMock).toHaveBeenCalledWith("code_runtime_tool_metrics_record", {
      events: [
        {
          toolName: "run-runtime-live-skill",
          scope: "runtime",
          phase: "completed",
          status: "success",
          at: 1_770_000_000_000,
        },
      ],
    });

    invokeMock.mockResolvedValueOnce(metricsSnapshot);
    await client.runtimeToolMetricsReset();
    expect(invokeMock).toHaveBeenCalledWith("code_runtime_tool_metrics_reset", {});

    invokeMock.mockResolvedValueOnce({
      allowed: true,
      blockReason: null,
      errorCode: null,
      message: null,
      channelHealth: metricsSnapshot.channelHealth,
      circuitBreaker: metricsSnapshot.circuitBreakers[1],
      updatedAt: 1_770_000_000_000,
    });
    await client.runtimeToolGuardrailEvaluate({
      toolName: "execute-workspace-command",
      scope: "runtime",
      payloadBytes: 120,
      workspaceId: "workspace-123",
    });
    expect(invokeMock).toHaveBeenCalledWith("code_runtime_tool_guardrail_evaluate", {
      toolName: "execute-workspace-command",
      scope: "runtime",
      payloadBytes: 120,
      workspaceId: "workspace-123",
    });

    invokeMock.mockResolvedValueOnce(guardrailSnapshot);
    await client.runtimeToolGuardrailRecordOutcome({
      toolName: "execute-workspace-command",
      scope: "runtime",
      status: "success",
      at: 1_770_000_000_100,
    });
    expect(invokeMock).toHaveBeenCalledWith("code_runtime_tool_guardrail_record_outcome", {
      event: {
        toolName: "execute-workspace-command",
        scope: "runtime",
        status: "success",
        at: 1_770_000_000_100,
      },
    });

    invokeMock.mockResolvedValueOnce(guardrailSnapshot);
    await client.runtimeToolGuardrailRead();
    expect(invokeMock).toHaveBeenCalledWith("code_runtime_tool_guardrail_read", {});
  });

  it("reads runtime capabilities summary for capability gating", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: ["code_workspaces_list", "code_runtime_backends_list"],
          features: [...FROZEN_RUNTIME_RPC_REQUIRED_FEATURES, "multi_backend_pool_v1"],
        });
      }
      return [];
    });

    const runtime = await importRuntimeClientModule();
    const summary = await runtime.readRuntimeCapabilitiesSummary();

    expect(summary.mode).toBe("tauri");
    expect(summary.features).toContain("multi_backend_pool_v1");
    expect(summary.methods).toContain("code_runtime_backends_list");
    expect(summary.error).toBeNull();
  });

  it("routes oauth account pool calls through unified rpc contract", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: [
            "code_oauth_accounts_list",
            "code_oauth_account_upsert",
            "code_oauth_pool_select",
            "code_oauth_pool_account_bind",
            "code_oauth_chatgpt_auth_tokens_refresh",
          ],
        });
      }
      if (method === "code_oauth_accounts_list") {
        return [];
      }
      if (method === "code_oauth_account_upsert") {
        return {
          accountId: "codex-a1",
          provider: "codex",
          status: "enabled",
          disabledReason: null,
          routeConfig: {
            compatBaseUrl: "https://proxy.example.dev/v1",
            proxyId: "proxy-codex-east",
            priority: 7,
            concurrencyLimit: 3,
            schedulable: true,
          },
          routingState: {
            credentialReady: true,
            lastRoutingError: null,
            rateLimitedUntil: null,
            overloadedUntil: null,
            tempUnschedulableUntil: null,
            tempUnschedulableReason: null,
          },
          metadata: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }
      if (method === "code_oauth_pool_account_bind") {
        return {
          poolId: "pool-codex",
          account: {
            accountId: "codex-a1",
            provider: "codex",
            status: "enabled",
            disabledReason: null,
            metadata: {},
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          reason: "manual_binding",
        };
      }
      if (method === "code_oauth_pool_select") {
        return {
          poolId: "pool-codex",
          account: {
            accountId: "codex-a1",
            provider: "codex",
            status: "enabled",
            disabledReason: null,
            metadata: {},
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          reason: "sticky_binding",
        };
      }
      if (method === "code_oauth_chatgpt_auth_tokens_refresh") {
        return {
          accessToken: "chatgpt-access-token-1",
          chatgptAccountId: "chatgpt-account-1",
          chatgptPlanType: "pro",
          sourceAccountId: "codex-a1",
        };
      }
      return true;
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await client.oauthAccounts("codex");
    expect(invokeMock).toHaveBeenCalledWith(
      "code_oauth_accounts_list",
      expect.objectContaining({
        provider: "codex",
      })
    );

    await client.oauthUpsertAccount({
      accountId: "codex-a1",
      provider: "codex",
      routeConfig: {
        compatBaseUrl: "https://proxy.example.dev/v1",
        proxyId: "proxy-codex-east",
        priority: 7,
        concurrencyLimit: 3,
        schedulable: true,
      },
      routingState: {
        credentialReady: true,
        lastRoutingError: null,
        rateLimitedUntil: null,
        overloadedUntil: null,
        tempUnschedulableUntil: null,
        tempUnschedulableReason: null,
      },
    });
    expect(invokeMock).toHaveBeenCalledWith(
      "code_oauth_account_upsert",
      expect.objectContaining({
        accountId: "codex-a1",
        routeConfig: expect.objectContaining({
          compatBaseUrl: "https://proxy.example.dev/v1",
          proxyId: "proxy-codex-east",
        }),
        routingState: expect.objectContaining({
          credentialReady: true,
        }),
      })
    );

    await client.oauthSelectPoolAccount({
      poolId: "pool-codex",
      sessionId: "s-1",
      chatgptWorkspaceId: "org-codex",
      modelId: "gpt-5.3-codex",
    });
    expect(invokeMock).toHaveBeenCalledWith(
      "code_oauth_pool_select",
      expect.objectContaining({
        poolId: "pool-codex",
        sessionId: "s-1",
        chatgptWorkspaceId: "org-codex",
        modelId: "gpt-5.3-codex",
      })
    );
    const oauthSelectPayload = invokeMock.mock.calls.find(
      ([method]) => method === "code_oauth_pool_select"
    )?.[1] as Record<string, unknown> | undefined;
    expect(oauthSelectPayload).not.toHaveProperty("workspaceId");
    expect(oauthSelectPayload).not.toHaveProperty("workspace_id");

    await client.oauthBindPoolAccount({
      poolId: "pool-codex",
      sessionId: "project-ws-1",
      accountId: "codex-a1",
      chatgptWorkspaceId: "org-codex",
    });
    const oauthBindCanonicalPayload = invokeMock.mock.calls.find(
      ([method]) => method === "code_oauth_pool_account_bind"
    )?.[1] as Record<string, unknown> | undefined;
    expect(oauthBindCanonicalPayload).toMatchObject({
      poolId: "pool-codex",
      sessionId: "project-ws-1",
      accountId: "codex-a1",
      chatgptWorkspaceId: "org-codex",
    });
    expect(oauthBindCanonicalPayload).not.toHaveProperty("workspaceId");
    expect(oauthBindCanonicalPayload).not.toHaveProperty("workspace_id");

    await client.oauthChatgptAuthTokensRefresh({
      reason: "unauthorized",
      sessionId: "s-refresh-1",
      previousAccountId: "chatgpt-account-1",
      chatgptWorkspaceId: "org-refresh",
    });
    const oauthRefreshCanonicalPayload = invokeMock.mock.calls.find(
      ([method]) => method === "code_oauth_chatgpt_auth_tokens_refresh"
    )?.[1] as Record<string, unknown> | undefined;
    expect(oauthRefreshCanonicalPayload).toMatchObject({
      reason: "unauthorized",
      sessionId: "s-refresh-1",
      previousAccountId: "chatgpt-account-1",
      chatgptWorkspaceId: "org-refresh",
    });
    expect(oauthRefreshCanonicalPayload).not.toHaveProperty("workspaceId");
    expect(oauthRefreshCanonicalPayload).not.toHaveProperty("workspace_id");
  });

  it("keeps legacy workspace selector aliases when only workspaceId is provided", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: [
            "code_oauth_pool_select",
            "code_oauth_pool_account_bind",
            "code_oauth_chatgpt_auth_tokens_refresh",
          ],
        });
      }
      return null;
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await client.oauthSelectPoolAccount({
      poolId: "pool-legacy",
      sessionId: "s-legacy",
      workspaceId: "org-legacy-only",
    });
    await client.oauthBindPoolAccount({
      poolId: "pool-legacy",
      sessionId: "project-ws-legacy",
      accountId: "legacy-account",
      workspaceId: "org-legacy-only",
    });
    await client.oauthChatgptAuthTokensRefresh({
      reason: "unauthorized",
      sessionId: "s-refresh-legacy",
      previousAccountId: "legacy-account",
      workspaceId: "org-legacy-only",
    });

    const oauthSelectLegacyPayload = invokeMock.mock.calls.find(
      ([method]) => method === "code_oauth_pool_select"
    )?.[1] as Record<string, unknown> | undefined;
    expect(oauthSelectLegacyPayload).toMatchObject({
      chatgptWorkspaceId: "org-legacy-only",
      workspaceId: "org-legacy-only",
    });

    const oauthBindLegacyPayload = invokeMock.mock.calls.find(
      ([method]) => method === "code_oauth_pool_account_bind"
    )?.[1] as Record<string, unknown> | undefined;
    expect(oauthBindLegacyPayload).toMatchObject({
      chatgptWorkspaceId: "org-legacy-only",
      workspaceId: "org-legacy-only",
    });

    const oauthRefreshLegacyPayload = invokeMock.mock.calls.find(
      ([method]) => method === "code_oauth_chatgpt_auth_tokens_refresh"
    )?.[1] as Record<string, unknown> | undefined;
    expect(oauthRefreshLegacyPayload).toMatchObject({
      chatgptWorkspaceId: "org-legacy-only",
      workspaceId: "org-legacy-only",
    });
  });

  it("prefers explicit chatgptWorkspaceId over legacy workspaceId for oauth rpc calls", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: [
            "code_oauth_pool_select",
            "code_oauth_pool_account_bind",
            "code_oauth_chatgpt_auth_tokens_refresh",
          ],
        });
      }
      return null;
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await client.oauthSelectPoolAccount({
      poolId: "pool-codex",
      sessionId: "s-2",
      chatgptWorkspaceId: "org-explicit",
      workspaceId: "org-legacy",
    });
    await client.oauthBindPoolAccount({
      poolId: "pool-codex",
      sessionId: "project-ws-2",
      accountId: "chatgpt-account-2",
      chatgptWorkspaceId: "org-explicit",
      workspaceId: "org-legacy",
    });
    await client.oauthChatgptAuthTokensRefresh({
      reason: "unauthorized",
      sessionId: "s-refresh-2",
      previousAccountId: "chatgpt-account-2",
      chatgptWorkspaceId: "org-explicit",
      workspaceId: "org-legacy",
    });

    const oauthSelectExplicitPayload = invokeMock.mock.calls.find(
      ([method]) => method === "code_oauth_pool_select"
    )?.[1] as Record<string, unknown> | undefined;
    expect(oauthSelectExplicitPayload).toMatchObject({
      chatgptWorkspaceId: "org-explicit",
    });
    expect(oauthSelectExplicitPayload).not.toHaveProperty("workspaceId");
    expect(oauthSelectExplicitPayload).not.toHaveProperty("workspace_id");

    const oauthBindExplicitPayload = invokeMock.mock.calls.find(
      ([method]) => method === "code_oauth_pool_account_bind"
    )?.[1] as Record<string, unknown> | undefined;
    expect(oauthBindExplicitPayload).toMatchObject({
      sessionId: "project-ws-2",
      accountId: "chatgpt-account-2",
      chatgptWorkspaceId: "org-explicit",
    });
    expect(oauthBindExplicitPayload).not.toHaveProperty("workspaceId");
    expect(oauthBindExplicitPayload).not.toHaveProperty("workspace_id");

    const oauthRefreshExplicitPayload = invokeMock.mock.calls.find(
      ([method]) => method === "code_oauth_chatgpt_auth_tokens_refresh"
    )?.[1] as Record<string, unknown> | undefined;
    expect(oauthRefreshExplicitPayload).toMatchObject({
      sessionId: "s-refresh-2",
      chatgptWorkspaceId: "org-explicit",
    });
    expect(oauthRefreshExplicitPayload).not.toHaveProperty("workspaceId");
    expect(oauthRefreshExplicitPayload).not.toHaveProperty("workspace_id");
  });

  it("routes backend pool and distributed graph calls through unified rpc contract", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: [
            "code_runtime_backends_list",
            "code_runtime_backend_upsert",
            "code_runtime_backend_set_state",
            "code_runtime_backend_remove",
            "code_distributed_task_graph",
          ],
        });
      }
      if (method === "code_runtime_backends_list") {
        return [];
      }
      if (method === "code_runtime_backend_upsert") {
        return {
          backendId: "worker-us-east-1a",
          displayName: "US-East Worker",
          capabilities: ["plan", "code"],
          maxConcurrency: 8,
          costTier: "standard",
          latencyClass: "regional",
          rolloutState: "ramping",
          status: "active",
          healthScore: 0.98,
          queueDepth: 0,
          runningTasks: 0,
          createdAt: 1,
          updatedAt: 1,
          lastHeartbeatAt: 1,
        };
      }
      if (method === "code_runtime_backend_set_state") {
        return {
          backendId: "worker-us-east-1a",
          displayName: "US-East Worker",
          capabilities: ["plan", "code"],
          maxConcurrency: 8,
          costTier: "standard",
          latencyClass: "regional",
          rolloutState: "current",
          status: "draining",
          healthScore: 0.98,
          queueDepth: 0,
          runningTasks: 0,
          createdAt: 1,
          updatedAt: 2,
          lastHeartbeatAt: 2,
        };
      }
      if (method === "code_runtime_backend_remove") {
        return true;
      }
      if (method === "code_distributed_task_graph") {
        return {
          taskId: "task-root-1",
          rootTaskId: "task-root-1",
          nodes: [],
          edges: [],
        };
      }
      return [];
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.runtimeBackendsList()).resolves.toEqual([]);
    await expect(
      client.runtimeBackendUpsert({
        backendId: "worker-us-east-1a",
        displayName: "US-East Worker",
        capabilities: ["plan", "code"],
        maxConcurrency: 8,
        costTier: "standard",
        latencyClass: "regional",
        rolloutState: "ramping",
        status: "active",
      })
    ).resolves.toMatchObject({
      backendId: "worker-us-east-1a",
      status: "active",
    });
    await expect(
      client.runtimeBackendSetState({
        backendId: "worker-us-east-1a",
        status: "draining",
        rolloutState: "current",
      })
    ).resolves.toMatchObject({
      backendId: "worker-us-east-1a",
      status: "draining",
      rolloutState: "current",
    });
    await expect(client.runtimeBackendRemove("worker-us-east-1a")).resolves.toBe(true);
    await expect(client.distributedTaskGraph({ taskId: "task-root-1" })).resolves.toEqual({
      taskId: "task-root-1",
      rootTaskId: "task-root-1",
      nodes: [],
      edges: [],
    });

    expect(invokeMock).toHaveBeenCalledWith("code_runtime_backends_list", {});
    expect(invokeMock).toHaveBeenCalledWith(
      "code_runtime_backend_upsert",
      expect.objectContaining({
        backendId: "worker-us-east-1a",
        rolloutState: "ramping",
      })
    );
    expect(invokeMock).toHaveBeenCalledWith(
      "code_runtime_backend_set_state",
      expect.objectContaining({
        backendId: "worker-us-east-1a",
        status: "draining",
      })
    );
    expect(invokeMock).toHaveBeenCalledWith(
      "code_runtime_backend_remove",
      expect.objectContaining({
        backendId: "worker-us-east-1a",
      })
    );
    expect(invokeMock).toHaveBeenCalledWith(
      "code_distributed_task_graph",
      expect.objectContaining({
        taskId: "task-root-1",
      })
    );
  });

  it("invokes kernel v2 rpc methods through the runtime client boundary", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: [
            "code_kernel_capabilities_list_v2",
            "code_kernel_sessions_list_v2",
            "code_kernel_jobs_list_v2",
            "code_kernel_context_snapshot_v2",
            "code_kernel_extensions_list_v2",
            "code_kernel_policies_evaluate_v2",
            "code_kernel_projection_bootstrap_v3",
          ],
        });
      }
      return [];
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await client.kernelCapabilitiesListV2();
    expect(invokeMock).toHaveBeenCalledWith("code_kernel_capabilities_list_v2", {});

    await client.kernelSessionsListV2({ workspaceId: "ws-kernel", kind: "pty" });
    expect(invokeMock).toHaveBeenCalledWith(
      "code_kernel_sessions_list_v2",
      expect.objectContaining({
        workspaceId: "ws-kernel",
        kind: "pty",
      })
    );

    await client.kernelJobsListV2({ workspaceId: "ws-kernel", status: "running" });
    expect(invokeMock).toHaveBeenCalledWith(
      "code_kernel_jobs_list_v2",
      expect.objectContaining({
        workspaceId: "ws-kernel",
        status: "running",
      })
    );

    await client.kernelContextSnapshotV2({
      kind: "thread",
      workspaceId: "ws-kernel",
      threadId: "thread-kernel",
    });
    expect(invokeMock).toHaveBeenCalledWith(
      "code_kernel_context_snapshot_v2",
      expect.objectContaining({
        kind: "thread",
        workspaceId: "ws-kernel",
        threadId: "thread-kernel",
      })
    );

    await client.kernelExtensionsListV2({ workspaceId: "ws-kernel" });
    expect(invokeMock).toHaveBeenCalledWith(
      "code_kernel_extensions_list_v2",
      expect.objectContaining({
        workspaceId: "ws-kernel",
      })
    );

    await client.kernelPoliciesEvaluateV2({
      workspaceId: "ws-kernel",
      toolName: "core-edit",
      scope: "write",
      payloadBytes: 128,
      requiresApproval: true,
      capabilityId: "capability:core-edit",
      mutationKind: "edit",
    });
    expect(invokeMock).toHaveBeenCalledWith(
      "code_kernel_policies_evaluate_v2",
      expect.objectContaining({
        workspaceId: "ws-kernel",
        toolName: "core-edit",
        scope: "write",
        payloadBytes: 128,
        requiresApproval: true,
        capabilityId: "capability:core-edit",
        mutationKind: "edit",
      })
    );

    await client.kernelProjectionBootstrapV3({
      scopes: ["mission_control", "jobs"],
    });
    expect(invokeMock).toHaveBeenCalledWith(
      "code_kernel_projection_bootstrap_v3",
      expect.objectContaining({
        scopes: ["mission_control", "jobs"],
      })
    );
  });

  it("routes oauth pool mutations and rate-limit reports through unified rpc contract", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: [
            "code_oauth_primary_account_get",
            "code_oauth_primary_account_set",
            "code_oauth_pools_list",
            "code_oauth_pool_members_list",
            "code_oauth_pool_upsert",
            "code_oauth_pool_apply",
            "code_oauth_pool_members_replace",
            "code_oauth_pool_remove",
            "code_oauth_account_remove",
            "code_oauth_rate_limit_report",
          ],
        });
      }
      if (method === "code_oauth_pools_list") {
        return [];
      }
      if (method === "code_oauth_primary_account_get") {
        return {
          provider: "codex",
          accountId: "codex-a1",
          account: {
            accountId: "codex-a1",
            provider: "codex",
            externalAccountId: "ext-codex-a1",
            email: "codex-a1@example.com",
            displayName: "Codex A1",
            status: "enabled",
            disabledReason: null,
            routeConfig: null,
            routingState: null,
            chatgptWorkspaces: null,
            defaultChatgptWorkspaceId: null,
            metadata: {},
            createdAt: 1,
            updatedAt: 1,
          },
          defaultPoolId: "pool-codex",
          routeAccountId: "codex-a1",
          inSync: true,
          createdAt: 1,
          updatedAt: 1,
        };
      }
      if (method === "code_oauth_primary_account_set") {
        return {
          provider: "codex",
          accountId: "codex-a1",
          account: {
            accountId: "codex-a1",
            provider: "codex",
            externalAccountId: "ext-codex-a1",
            email: "codex-a1@example.com",
            displayName: "Codex A1",
            status: "enabled",
            disabledReason: null,
            routeConfig: null,
            routingState: null,
            chatgptWorkspaces: null,
            defaultChatgptWorkspaceId: null,
            metadata: {},
            createdAt: 1,
            updatedAt: 1,
          },
          defaultPoolId: "pool-codex",
          routeAccountId: "codex-a1",
          inSync: true,
          createdAt: 1,
          updatedAt: 2,
        };
      }
      if (method === "code_oauth_pool_upsert") {
        return {
          poolId: "pool-codex",
          provider: "codex",
          name: "Codex Pool",
          strategy: "round_robin",
          stickyMode: "cache_first",
          preferredAccountId: "codex-a1",
          enabled: true,
          metadata: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }
      return true;
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await client.oauthPools("codex");
    expect(invokeMock).toHaveBeenCalledWith(
      "code_oauth_pools_list",
      expect.objectContaining({
        provider: "codex",
      })
    );

    await client.oauthPrimaryAccountGet("codex");
    expect(invokeMock).toHaveBeenCalledWith(
      "code_oauth_primary_account_get",
      expect.objectContaining({
        provider: "codex",
      })
    );

    await client.oauthPrimaryAccountSet({
      provider: "codex",
      accountId: "codex-a1",
    });
    expect(invokeMock).toHaveBeenCalledWith(
      "code_oauth_primary_account_set",
      expect.objectContaining({
        provider: "codex",
        accountId: "codex-a1",
      })
    );

    await client.oauthUpsertPool({
      poolId: "pool-codex",
      provider: "codex",
      name: "Codex Pool",
      strategy: "round_robin",
      stickyMode: "cache_first",
      preferredAccountId: "codex-a1",
      enabled: true,
      metadata: {},
    });
    expect(invokeMock).toHaveBeenCalledWith(
      "code_oauth_pool_upsert",
      expect.objectContaining({
        poolId: "pool-codex",
        preferredAccountId: "codex-a1",
        accountId: "codex-a1",
      })
    );

    await client.oauthPoolMembers("pool-codex");
    expect(invokeMock).toHaveBeenCalledWith(
      "code_oauth_pool_members_list",
      expect.objectContaining({
        poolId: "pool-codex",
      })
    );

    await client.oauthApplyPool({
      pool: {
        poolId: "pool-codex",
        provider: "codex",
        name: "Codex Pool",
        strategy: "round_robin",
        stickyMode: "cache_first",
        preferredAccountId: "codex-a1",
        enabled: true,
        metadata: {},
      },
      members: [
        {
          accountId: "codex-a1",
          weight: 2,
          priority: 0,
          position: 0,
          enabled: true,
        },
      ],
      expectedUpdatedAt: 123,
    });
    expect(invokeMock).toHaveBeenCalledWith(
      "code_oauth_pool_apply",
      expect.objectContaining({
        pool: expect.objectContaining({
          poolId: "pool-codex",
          preferredAccountId: "codex-a1",
          accountId: "codex-a1",
        }),
        members: [
          expect.objectContaining({
            accountId: "codex-a1",
          }),
        ],
        expectedUpdatedAt: 123,
      })
    );

    await client.oauthReplacePoolMembers("pool-codex", [
      {
        accountId: "codex-a1",
        weight: 2,
        priority: 0,
        position: 0,
        enabled: true,
      },
    ]);
    expect(invokeMock).toHaveBeenCalledWith(
      "code_oauth_pool_members_replace",
      expect.objectContaining({
        poolId: "pool-codex",
        members: [
          expect.objectContaining({
            accountId: "codex-a1",
          }),
        ],
      })
    );

    await client.oauthReportRateLimit({
      accountId: "codex-a1",
      modelId: "gpt-5.3-codex",
      success: false,
    });
    expect(invokeMock).toHaveBeenCalledWith(
      "code_oauth_rate_limit_report",
      expect.objectContaining({
        accountId: "codex-a1",
        modelId: "gpt-5.3-codex",
        retryAfterSec: null,
        resetAt: null,
        errorCode: null,
        errorMessage: null,
      })
    );

    await client.oauthRemovePool("pool-codex");
    expect(invokeMock).toHaveBeenCalledWith(
      "code_oauth_pool_remove",
      expect.objectContaining({
        poolId: "pool-codex",
      })
    );

    await client.oauthRemoveAccount("codex-a1");
    expect(invokeMock).toHaveBeenCalledWith(
      "code_oauth_account_remove",
      expect.objectContaining({
        accountId: "codex-a1",
      })
    );
  });

  it("bootstraps runtime snapshot through unified rpc contract", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: ["code_bootstrap_snapshot"],
        });
      }
      if (method === "code_bootstrap_snapshot") {
        return {
          health: {
            status: "ok",
            version: "test",
            now: new Date().toISOString(),
            transport: "inprocess",
            mode: "local",
            diagnostics: {},
          },
          settings: { theme: "system" },
          remote: { connected: true },
          terminal: { sessions: [] },
          models: [],
          workspaces: [],
        };
      }
      return {
        health: {
          status: "ok",
          version: "test",
          now: new Date().toISOString(),
          transport: "inprocess",
          mode: "local",
          diagnostics: {},
        },
        settings: { theme: "system" },
        remote: { connected: true },
        terminal: { sessions: [] },
        models: [],
        workspaces: [],
      };
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();
    const bootstrap = await client.bootstrap();

    expect(bootstrap).toEqual(
      expect.objectContaining({
        health: expect.objectContaining({ status: "ok" }),
        settings: expect.any(Object),
        remote: expect.any(Object),
        terminal: expect.any(Object),
        models: expect.any(Array),
        workspaces: expect.any(Array),
      })
    );
    expect(invokeMock).toHaveBeenCalledWith("code_bootstrap_snapshot", {});
  });

  it("rejects oversized network live-skill query before runtime rpc invocation", async () => {
    isTauriMock.mockReturnValue(true);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(
      client.runLiveSkill({
        skillId: "network-analysis",
        input: "",
        options: {
          query: "x".repeat(2_049),
        },
      })
    ).rejects.toThrow("Live skill query must be <= 2048 characters.");

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("allows long non-network live-skill input through runtime rpc", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: ["code_live_skill_execute"],
        });
      }
      if (method === "code_live_skill_execute") {
        return {
          runId: "live-skill-run-2",
          skillId: "core-read",
          status: "completed",
          message: "ok",
          output: "",
          network: null,
          metadata: {},
        };
      }
      return null;
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(
      client.runLiveSkill({
        skillId: "core-read",
        input: "x".repeat(5_000),
      })
    ).resolves.toMatchObject({
      runId: "live-skill-run-2",
      skillId: "core-read",
    });

    expect(invokeMock).toHaveBeenCalledWith(
      "code_live_skill_execute",
      expect.objectContaining({
        skillId: "core-read",
      })
    );
  });

  it("rejects oversized core-bash command before runtime rpc invocation", async () => {
    isTauriMock.mockReturnValue(true);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(
      client.runLiveSkill({
        skillId: "core-bash",
        input: "",
        options: {
          command: "x".repeat(8_193),
        },
      })
    ).rejects.toThrow("command must be <= 8192 characters.");

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("allows bounded core-bash command through runtime rpc", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: ["code_live_skill_execute"],
        });
      }
      if (method === "code_live_skill_execute") {
        return {
          runId: "live-skill-run-shell-1",
          skillId: "core-bash",
          status: "completed",
          message: "ok",
          output: "",
          network: null,
          metadata: {},
        };
      }
      return null;
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(
      client.runLiveSkill({
        skillId: "shell",
        input: "echo ok",
      })
    ).resolves.toMatchObject({
      runId: "live-skill-run-shell-1",
      skillId: "core-bash",
    });

    expect(invokeMock).toHaveBeenCalledWith(
      "code_live_skill_execute",
      expect.objectContaining({
        skillId: "core-bash",
      })
    );
  });

  it("canonicalizes core-js-repl aliases before runtime rpc invocation", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: ["code_live_skill_execute"],
        });
      }
      if (method === "code_live_skill_execute") {
        return {
          runId: "live-skill-run-js-repl-1",
          skillId: "core-js-repl",
          status: "completed",
          message: "ok",
          output: "",
          network: null,
          artifacts: [
            {
              kind: "image",
              mimeType: "image/png",
              dataBase64: "YWJj",
            },
          ],
          metadata: {},
        };
      }
      return null;
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(
      client.runLiveSkill({
        skillId: "js_repl",
        input: "console.log('ok')",
      })
    ).resolves.toMatchObject({
      runId: "live-skill-run-js-repl-1",
      skillId: "core-js-repl",
      artifacts: [
        expect.objectContaining({
          kind: "image",
          mimeType: "image/png",
        }),
      ],
    });

    expect(invokeMock).toHaveBeenCalledWith(
      "code_live_skill_execute",
      expect.objectContaining({
        skillId: "core-js-repl",
      })
    );
  });

  it("canonicalizes core-js-repl-reset aliases before runtime rpc invocation", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: ["code_live_skill_execute"],
        });
      }
      if (method === "code_live_skill_execute") {
        return {
          runId: "live-skill-run-js-repl-reset-1",
          skillId: "core-js-repl-reset",
          status: "completed",
          message: "ok",
          output: "",
          network: null,
          artifacts: [],
          metadata: {},
        };
      }
      return null;
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(
      client.runLiveSkill({
        skillId: "js_repl_reset",
        input: "",
      })
    ).resolves.toMatchObject({
      runId: "live-skill-run-js-repl-reset-1",
      skillId: "core-js-repl-reset",
    });

    expect(invokeMock).toHaveBeenCalledWith(
      "code_live_skill_execute",
      expect.objectContaining({
        skillId: "core-js-repl-reset",
      })
    );
  });

  it("canonicalizes research live-skill aliases before runtime rpc invocation", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: ["code_live_skill_execute"],
        });
      }
      if (method === "code_live_skill_execute") {
        return {
          runId: "live-skill-run-research-1",
          skillId: "research-orchestrator",
          status: "completed",
          message: "ok",
          output: "",
          network: null,
          metadata: {},
        };
      }
      return null;
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(
      client.runLiveSkill({
        skillId: "research",
        input: "query",
      })
    ).resolves.toMatchObject({
      runId: "live-skill-run-research-1",
      skillId: "research-orchestrator",
    });

    expect(invokeMock).toHaveBeenCalledWith(
      "code_live_skill_execute",
      expect.objectContaining({
        skillId: "research-orchestrator",
      })
    );
  });

  it("passes typed live-skill context fields through runtime rpc invocation", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: ["code_live_skill_execute"],
        });
      }
      if (method === "code_live_skill_execute") {
        return {
          runId: "live-skill-run-network-context-1",
          skillId: "network-analysis",
          status: "completed",
          message: "ok",
          output: "",
          network: null,
          metadata: {},
        };
      }
      return null;
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(
      client.runLiveSkill({
        skillId: "network-analysis",
        input: "query",
        context: {
          accessMode: "on-request",
          provider: "anthropic",
          modelId: "claude-3-7-sonnet",
          extraHint: "keep",
        },
      })
    ).resolves.toMatchObject({
      runId: "live-skill-run-network-context-1",
      skillId: "network-analysis",
    });

    expect(invokeMock).toHaveBeenCalledWith(
      "code_live_skill_execute",
      expect.objectContaining({
        skillId: "network-analysis",
        context: expect.objectContaining({
          accessMode: "on-request",
          provider: "anthropic",
          modelId: "claude-3-7-sonnet",
          extraHint: "keep",
        }),
      })
    );
  });

  it("canonicalizes core-tree aliases before runtime rpc invocation", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: ["code_live_skill_execute"],
        });
      }
      if (method === "code_live_skill_execute") {
        return {
          runId: "live-skill-run-tree-1",
          skillId: "core-tree",
          status: "completed",
          message: "ok",
          output: "",
          network: null,
          metadata: {},
        };
      }
      return null;
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(
      client.runLiveSkill({
        skillId: "ls",
        input: ".",
      })
    ).resolves.toMatchObject({
      runId: "live-skill-run-tree-1",
      skillId: "core-tree",
    });

    expect(invokeMock).toHaveBeenCalledWith(
      "code_live_skill_execute",
      expect.objectContaining({
        skillId: "core-tree",
      })
    );
  });

  it("canonicalizes core-grep aliases before runtime rpc invocation", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: ["code_live_skill_execute"],
        });
      }
      if (method === "code_live_skill_execute") {
        return {
          runId: "live-skill-run-grep-1",
          skillId: "core-grep",
          status: "completed",
          message: "ok",
          output: "",
          network: null,
          metadata: {},
        };
      }
      return null;
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(
      client.runLiveSkill({
        skillId: "rg",
        input: "workspaceId",
      })
    ).resolves.toMatchObject({
      runId: "live-skill-run-grep-1",
      skillId: "core-grep",
    });

    expect(invokeMock).toHaveBeenCalledWith(
      "code_live_skill_execute",
      expect.objectContaining({
        skillId: "core-grep",
      })
    );
  });

  it("rejects core-grep request without pattern before runtime rpc invocation", async () => {
    isTauriMock.mockReturnValue(true);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(
      client.runLiveSkill({
        skillId: "core-grep",
        input: "   ",
      })
    ).rejects.toThrow("pattern is required for core-grep.");

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("rejects invalid core-grep mode before runtime rpc invocation", async () => {
    isTauriMock.mockReturnValue(true);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(
      client.runLiveSkill({
        skillId: "core-grep",
        input: "needle",
        options: {
          matchMode: "wildcard" as "literal",
        },
      })
    ).rejects.toThrow("matchMode must be literal or regex.");

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("canonicalizes network live-skill aliases before runtime rpc invocation", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: ["code_live_skill_execute"],
        });
      }
      if (method === "code_live_skill_execute") {
        return {
          runId: "live-skill-run-network-1",
          skillId: "network-analysis",
          status: "completed",
          message: "ok",
          output: "",
          network: null,
          metadata: {},
        };
      }
      return null;
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(
      client.runLiveSkill({
        skillId: "network_analysis",
        input: "query",
      })
    ).resolves.toMatchObject({
      runId: "live-skill-run-network-1",
      skillId: "network-analysis",
    });

    expect(invokeMock).toHaveBeenCalledWith(
      "code_live_skill_execute",
      expect.objectContaining({
        skillId: "network-analysis",
      })
    );
  });

  it("canonicalizes diagnostics live-skill aliases before runtime rpc invocation", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: ["code_live_skill_execute"],
        });
      }
      if (method === "code_live_skill_execute") {
        return {
          runId: "live-skill-run-diagnostics-1",
          skillId: "core-diagnostics",
          status: "completed",
          message: "ok",
          output: "",
          network: null,
          metadata: {},
        };
      }
      return null;
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(
      client.runLiveSkill({
        skillId: "workspace_diagnostics",
        input: "",
      })
    ).resolves.toMatchObject({
      runId: "live-skill-run-diagnostics-1",
      skillId: "core-diagnostics",
    });

    expect(invokeMock).toHaveBeenCalledWith(
      "code_live_skill_execute",
      expect.objectContaining({
        skillId: "core-diagnostics",
      })
    );
  });

  it("canonicalizes computer-observe aliases before runtime rpc invocation", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: ["code_live_skill_execute"],
        });
      }
      if (method === "code_live_skill_execute") {
        return {
          runId: "live-skill-run-computer-observe-1",
          skillId: "core-computer-observe",
          status: "completed",
          message: "ok",
          output: "",
          network: null,
          metadata: {},
        };
      }
      return null;
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(
      client.runLiveSkill({
        skillId: "observe-computer-screen",
        input: "",
      })
    ).resolves.toMatchObject({
      runId: "live-skill-run-computer-observe-1",
      skillId: "core-computer-observe",
    });

    expect(invokeMock).toHaveBeenCalledWith(
      "code_live_skill_execute",
      expect.objectContaining({
        skillId: "core-computer-observe",
      })
    );
  });

  it("does not enable legacy runtime bridge markers outside supported runtimes", async () => {
    isTauriMock.mockReturnValue(false);
    const legacyRpcBridge = vi.fn();
    (
      window as Window & {
        __OPEN_WRAP_AGENT_RUNTIME_RPC__?: typeof legacyRpcBridge;
      }
    ).__OPEN_WRAP_AGENT_RUNTIME_RPC__ = legacyRpcBridge;

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    expect(runtime.detectRuntimeMode()).toBe("unavailable");
    await expect(client.workspaces()).rejects.toMatchObject({
      name: "RuntimeUnavailableError",
    });
    expect(legacyRpcBridge).not.toHaveBeenCalled();
  });

  it("uses explicit unavailable mode by default outside tauri", async () => {
    isTauriMock.mockReturnValue(false);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    expect(runtime.detectRuntimeMode()).toBe("unavailable");
    await expect(client.models()).rejects.toMatchObject({
      name: "RuntimeUnavailableError",
    });
    await expect(
      client.sendTurn({
        workspaceId: "workspace-local",
        threadId: null,
        content: "Ping",
        modelId: null,
        reasonEffort: null,
        accessMode: "on-request",
        executionMode: "runtime",
        queue: false,
        attachments: [],
      })
    ).rejects.toThrow("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT");
  });

  it("ignores legacy demo env when web runtime gateway endpoint is configured", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_DEMO", "1");
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
    isTauriMock.mockReturnValue(false);

    const runtime = await importRuntimeClientModule();

    expect(runtime.detectRuntimeMode()).toBe("runtime-gateway-web");
  });

  it("supports runtime gateway env key for web mode detection", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc_gateway");
    isTauriMock.mockReturnValue(false);

    const runtime = await importRuntimeClientModule();

    expect(runtime.detectRuntimeMode()).toBe("runtime-gateway-web");
  });

  it("does not mis-detect tauri when __TAURI_INTERNALS__ exists without invoke", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
    isTauriMock.mockReturnValue(false);
    (
      window as Window & {
        __TAURI_INTERNALS__?: unknown;
      }
    ).__TAURI_INTERNALS__ = {};

    const runtime = await importRuntimeClientModule();

    expect(runtime.detectRuntimeMode()).toBe("runtime-gateway-web");
  });

  it("detects tauri when __TAURI_INTERNALS__.invoke is available", async () => {
    isTauriMock.mockReturnValue(false);
    (
      window as Window & {
        __TAURI_INTERNALS__?: unknown;
      }
    ).__TAURI_INTERNALS__ = {
      invoke: vi.fn(),
    };

    const runtime = await importRuntimeClientModule();

    expect(runtime.detectRuntimeMode()).toBe("tauri");
  });

  it("ignores legacy demo env when no supported runtime transport is configured", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_DEMO", "1");
    vi.stubEnv("NODE_ENV", "production");
    isTauriMock.mockReturnValue(false);

    const runtime = await importRuntimeClientModule();

    expect(runtime.detectRuntimeMode()).toBe("unavailable");
  });

  it("routes to web runtime when endpoint is configured", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
    isTauriMock.mockReturnValue(false);

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        method?: string;
      };
      if (body.method === "code_workspaces_list") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: [
              {
                id: "workspace-web",
                path: "/tmp/workspace-web",
                displayName: "Web Workspace",
                connected: true,
                defaultModelId: "gpt-5.3-codex",
              },
            ],
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    expect(runtime.detectRuntimeMode()).toBe("runtime-gateway-web");
    await client.workspaces();
    await client.providersCatalog();
    expect(fetchMock).toHaveBeenCalledWith(
      "/__code_runtime_rpc",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("routes to web runtime when runtime gateway endpoint env is configured", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc_gateway");
    isTauriMock.mockReturnValue(false);

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "code_workspaces_list") {
        return new Response(
          JSON.stringify({
            ok: true,
            result: [
              {
                id: "workspace-web-gateway",
                path: "/tmp/workspace-web-gateway",
                displayName: "Web Gateway Workspace",
                connected: true,
                defaultModelId: "gpt-5.3-codex",
              },
            ],
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    expect(runtime.detectRuntimeMode()).toBe("runtime-gateway-web");
    await client.workspaces();
    expect(fetchMock).toHaveBeenCalledWith(
      "/__code_runtime_rpc_gateway",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("returns explicit method_not_found code when web runtime lacks metrics rpc methods", async () => {
    vi.stubEnv("VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT", "/__code_runtime_rpc");
    isTauriMock.mockReturnValue(false);

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "code_runtime_tool_metrics_read") {
        return new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: CODE_RUNTIME_RPC_ERROR_CODES.METHOD_NOT_FOUND,
              message: "Method not found: code_runtime_tool_metrics_read",
            },
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.runtimeToolMetricsRead()).rejects.toMatchObject({
      code: CODE_RUNTIME_RPC_ERROR_CODES.METHOD_NOT_FOUND,
    });
  });

  it("invokes canonical codex oauth login start and cancel rpc methods", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: ["code_oauth_codex_login_start", "code_oauth_codex_login_cancel"],
        });
      }
      if (method === "code_oauth_codex_login_start") {
        return {
          loginId: "login-runtime-1",
          authUrl: "https://auth.openai.com/oauth/authorize?client_id=client-1",
          immediateSuccess: false,
        };
      }
      if (method === "code_oauth_codex_login_cancel") {
        return {
          canceled: true,
          status: "canceled",
        };
      }
      return null;
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient() as Record<
      string,
      (...args: unknown[]) => Promise<unknown>
    >;

    await expect(
      client.oauthCodexLoginStart({
        workspaceId: "workspace-codex-1",
        forceOAuth: true,
      })
    ).resolves.toMatchObject({
      loginId: "login-runtime-1",
      immediateSuccess: false,
    });
    await expect(
      client.oauthCodexLoginCancel({
        workspaceId: "workspace-codex-1",
      })
    ).resolves.toEqual({
      canceled: true,
      status: "canceled",
    });

    expect(invokeMock).toHaveBeenNthCalledWith(2, "code_oauth_codex_login_start", {
      workspaceId: "workspace-codex-1",
      forceOAuth: true,
    });
    expect(invokeMock).toHaveBeenNthCalledWith(3, "code_oauth_codex_login_cancel", {
      workspaceId: "workspace-codex-1",
    });
  });

  it("rejects terminalStatus when runtime returns an invalid state payload", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: [CANONICAL_WORKSPACES_METHOD, "code_terminal_status"],
        });
      }
      if (method === "code_terminal_status") {
        return {
          state: "legacy-ready",
          message: "legacy terminal payload",
        };
      }
      return [];
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.terminalStatus()).rejects.toMatchObject({
      name: "RuntimeTerminalStatePayloadError",
      method: "code_terminal_status",
    });
  });

  it("rejects terminalOpen when runtime returns an invalid session state payload", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockImplementation(async (method: string) => {
      if (method === "code_rpc_capabilities") {
        return createFrozenCapabilitiesPayload({
          methods: [CANONICAL_WORKSPACES_METHOD, "code_terminal_open"],
        });
      }
      if (method === "code_terminal_open") {
        return {
          id: "terminal-legacy",
          workspaceId: "ws-legacy",
          state: "active",
          createdAt: 1,
          updatedAt: 2,
          lines: [],
        };
      }
      return [];
    });

    const runtime = await importRuntimeClientModule();
    const client = runtime.getRuntimeClient();

    await expect(client.terminalOpen("ws-legacy")).rejects.toMatchObject({
      name: "RuntimeTerminalStatePayloadError",
      method: "code_terminal_open",
    });
  });
});
