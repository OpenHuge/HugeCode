// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RUNTIME_MESSAGE_CODES } from "./runtimeMessageCodes";
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
  WebMcpInputSchemaValidationError,
} from "./webMcpBridge";

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

describe("webMcpBridge runtime guardrail integration", () => {
  it("blocks write tool execution when input schema validation fails", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const setIntentPatch = vi.fn(() => snapshot.intent);

    await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: false,
      snapshot,
      actions: {
        ...actions,
        setIntentPatch,
      },
    });

    const intentTool = registeredTools.find((tool) => tool.name === "set-user-intent");
    expect(intentTool).toBeTruthy();
    if (!intentTool) {
      throw new Error("set-user-intent tool not found");
    }

    await expect(
      Promise.resolve(intentTool.execute({ priority: "urgent" }, null))
    ).rejects.toBeInstanceOf(WebMcpInputSchemaValidationError);
    await expect(
      Promise.resolve(intentTool.execute({ priority: "urgent" }, null))
    ).rejects.toMatchObject({
      code: "INPUT_SCHEMA_VALIDATION_FAILED",
      toolName: "set-user-intent",
      scope: "write",
      validation: {
        errors: expect.arrayContaining([
          "Invalid enum value at priority: expected one of low, medium, high, critical, received urgent.",
        ]),
      },
    });
    expect(setIntentPatch).not.toHaveBeenCalled();
    const metrics = readRuntimeToolExecutionMetrics();
    expect(metrics.totals.validationFailedTotal).toBeGreaterThanOrEqual(1);
    expect(Object.values(metrics.byTool)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolName: "set-user-intent",
          scope: "write",
          validationFailedTotal: expect.any(Number),
        }),
      ])
    );
  });

  it("blocks runtime tool execution when input schema validation fails", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const runLiveSkill = vi.fn(async () => ({
      runId: "live-skill-run-1",
      skillId: "core-bash",
      status: "completed" as const,
      message: "ok",
      output: "",
      network: null,
      artifacts: [],
      metadata: {},
    }));

    await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: false,
      snapshot,
      actions,
      runtimeControl: {
        listTasks: async () => [],
        getTaskStatus: async () => null,
        startTask: async () => {
          throw new Error("not used");
        },
        interruptTask: async () => ({
          accepted: true,
          taskId: "runtime-1",
          status: "interrupted",
          message: "interrupted",
        }),
        submitTaskApprovalDecision: async () => ({
          recorded: true,
          approvalId: "approval-1",
          taskId: "runtime-1",
          status: "running",
          message: "recorded",
        }),
        runtimeToolMetricsRead: async () => ({
          ...readRuntimeToolExecutionMetrics(),
          windowSize: 500,
          channelHealth: {
            status: "healthy",
            reason: null,
            lastErrorCode: null,
            updatedAt: Date.now(),
          },
          circuitBreakers: [],
        }),
        runLiveSkill: runLiveSkill as NonNullable<
          NonNullable<
            Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]
          >["runLiveSkill"]
        >,
      },
    });

    const executeCommandTool = registeredTools.find(
      (tool) => tool.name === "execute-workspace-command"
    );
    expect(executeCommandTool).toBeTruthy();
    if (!executeCommandTool) {
      throw new Error("execute-workspace-command tool not found");
    }

    await expect(Promise.resolve(executeCommandTool.execute({}, null))).rejects.toBeInstanceOf(
      WebMcpInputSchemaValidationError
    );
    await expect(Promise.resolve(executeCommandTool.execute({}, null))).rejects.toMatchObject({
      code: "INPUT_SCHEMA_VALIDATION_FAILED",
      toolName: "execute-workspace-command",
      scope: "runtime",
      validation: {
        errors: expect.arrayContaining(["Missing required field: command"]),
      },
    });
    expect(runLiveSkill).not.toHaveBeenCalled();
    const metrics = readRuntimeToolExecutionMetrics();
    expect(metrics.totals.validationFailedTotal).toBeGreaterThanOrEqual(1);
    expect(Object.values(metrics.byTool)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolName: "execute-workspace-command",
          scope: "runtime",
          validationFailedTotal: expect.any(Number),
        }),
      ])
    );
  });

  it("returns INVALID_PARAMS when telemetry traceId is provided without spanId", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const setIntentPatch = vi.fn(() => snapshot.intent);

    await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: false,
      snapshot,
      actions: {
        ...actions,
        setIntentPatch,
      },
    });

    __setRuntimeToolMetricsRecordOverrideForTests(async (events) => {
      const event = events[0];
      if (event?.traceId && !event.spanId) {
        throw Object.assign(new Error("spanId is required when traceId is provided."), {
          code: "INVALID_PARAMS",
        });
      }
      return undefined;
    });

    const intentTool = registeredTools.find((tool) => tool.name === "set-user-intent");
    expect(intentTool).toBeTruthy();
    if (!intentTool) {
      throw new Error("set-user-intent tool not found");
    }

    await expect(
      Promise.resolve(
        intentTool.execute(
          {
            objective: "Update control plane",
            traceId: "trace-1",
          },
          null
        )
      )
    ).rejects.toMatchObject({
      code: "INVALID_PARAMS",
    });
    expect(setIntentPatch).not.toHaveBeenCalled();
  });

  it("blocks write/runtime tools when runtime metrics channel is unavailable", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const setIntentPatch = vi.fn(() => snapshot.intent);
    const runLiveSkill = vi.fn(async () => ({
      runId: "live-skill-run-1",
      skillId: "core-bash",
      status: "completed" as const,
      message: "ok",
      output: "",
      network: null,
      artifacts: [],
      metadata: {},
    }));

    await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: false,
      snapshot,
      actions: {
        ...actions,
        setIntentPatch,
      },
      runtimeControl: {
        listTasks: async () => [],
        getTaskStatus: async () => null,
        startTask: async () => {
          throw new Error("not used");
        },
        interruptTask: async () => ({
          accepted: true,
          taskId: "runtime-1",
          status: "interrupted",
          message: "interrupted",
        }),
        submitTaskApprovalDecision: async () => ({
          recorded: true,
          approvalId: "approval-1",
          taskId: "runtime-1",
          status: "running",
          message: "recorded",
        }),
        runtimeToolMetricsRead: async () => ({
          ...readRuntimeToolExecutionMetrics(),
          windowSize: 500,
          channelHealth: {
            status: "healthy",
            reason: null,
            lastErrorCode: null,
            updatedAt: Date.now(),
          },
          circuitBreakers: [],
        }),
        runLiveSkill: runLiveSkill as NonNullable<
          NonNullable<
            Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]
          >["runLiveSkill"]
        >,
      },
    });

    __setRuntimeToolMetricsRecordOverrideForTests(async () => {
      throw new Error("metrics channel unavailable");
    });

    const intentTool = registeredTools.find((tool) => tool.name === "set-user-intent");
    expect(intentTool).toBeTruthy();
    if (!intentTool) {
      throw new Error("set-user-intent tool not found");
    }

    await expect(
      Promise.resolve(intentTool.execute({ objective: "Tighten runtime safety" }, null))
    ).rejects.toMatchObject({
      code: RUNTIME_MESSAGE_CODES.runtime.validation.metricsUnavailable,
    });
    expect(setIntentPatch).not.toHaveBeenCalled();

    const executeCommandTool = registeredTools.find(
      (tool) => tool.name === "execute-workspace-command"
    );
    expect(executeCommandTool).toBeTruthy();
    if (!executeCommandTool) {
      throw new Error("execute-workspace-command tool not found");
    }

    await expect(
      Promise.resolve(executeCommandTool.execute({ command: "echo hi" }, null))
    ).rejects.toMatchObject({
      code: RUNTIME_MESSAGE_CODES.runtime.validation.metricsUnavailable,
    });
    expect(runLiveSkill).not.toHaveBeenCalled();

    const metricsTool = registeredTools.find(
      (tool) => tool.name === "get-runtime-tool-execution-metrics"
    );
    expect(metricsTool).toBeTruthy();
    if (!metricsTool) {
      throw new Error("get-runtime-tool-execution-metrics tool not found");
    }

    await expect(Promise.resolve(metricsTool.execute({}, null))).resolves.toMatchObject({
      code: RUNTIME_MESSAGE_CODES.runtime.toolExecution.metricsRetrieved,
    });
  });

  it("blocks write/runtime tools when runtime guardrail channel is unavailable", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const runLiveSkill = vi.fn(async () => ({
      runId: "live-skill-run-1",
      skillId: "core-bash",
      status: "completed" as const,
      message: "ok",
      output: "",
      network: null,
      artifacts: [],
      metadata: {},
    }));

    await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: false,
      snapshot,
      actions,
      runtimeControl: {
        listTasks: async () => [],
        getTaskStatus: async () => null,
        startTask: async () => {
          throw new Error("not used");
        },
        interruptTask: async () => ({
          accepted: true,
          taskId: "runtime-1",
          status: "interrupted",
          message: "interrupted",
        }),
        submitTaskApprovalDecision: async () => ({
          recorded: true,
          approvalId: "approval-1",
          taskId: "runtime-1",
          status: "running",
          message: "recorded",
        }),
        runLiveSkill: runLiveSkill as NonNullable<
          NonNullable<
            Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]
          >["runLiveSkill"]
        >,
      },
    });

    __setRuntimeToolGuardrailEvaluateOverrideForTests(async () => {
      throw new Error("guardrail channel unavailable");
    });

    const executeCommandTool = registeredTools.find(
      (tool) => tool.name === "execute-workspace-command"
    );
    expect(executeCommandTool).toBeTruthy();
    if (!executeCommandTool) {
      throw new Error("execute-workspace-command tool not found");
    }

    await expect(
      Promise.resolve(executeCommandTool.execute({ command: "echo hi" }, null))
    ).rejects.toMatchObject({
      code: RUNTIME_MESSAGE_CODES.runtime.validation.metricsUnavailable,
    });
    expect(runLiveSkill).not.toHaveBeenCalled();
  });

  it("classifies runtime timeout and runtime failure outcomes in tool metrics", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const timeoutError = Object.assign(new Error("request timed out"), {
      code: "REQUEST_TIMEOUT",
    });
    const runLiveSkill = vi
      .fn()
      .mockRejectedValueOnce(timeoutError)
      .mockRejectedValueOnce(new Error("runtime exploded"));

    await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: false,
      snapshot,
      actions,
      runtimeControl: {
        listTasks: async () => [],
        getTaskStatus: async () => null,
        startTask: async () => {
          throw new Error("not used");
        },
        interruptTask: async () => ({
          accepted: true,
          taskId: "runtime-1",
          status: "interrupted",
          message: "interrupted",
        }),
        submitTaskApprovalDecision: async () => ({
          recorded: true,
          approvalId: "approval-1",
          taskId: "runtime-1",
          status: "running",
          message: "recorded",
        }),
        runLiveSkill: runLiveSkill as NonNullable<
          NonNullable<
            Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]
          >["runLiveSkill"]
        >,
      },
    });

    const executeCommandTool = registeredTools.find(
      (tool) => tool.name === "execute-workspace-command"
    );
    expect(executeCommandTool).toBeTruthy();
    if (!executeCommandTool) {
      throw new Error("execute-workspace-command tool not found");
    }

    await expect(
      Promise.resolve(executeCommandTool.execute({ command: "echo one" }, null))
    ).rejects.toBeInstanceOf(Error);
    await expect(
      Promise.resolve(executeCommandTool.execute({ command: "echo two" }, null))
    ).rejects.toBeInstanceOf(Error);

    const metrics = readRuntimeToolExecutionMetrics();
    expect(metrics.totals.timeoutTotal).toBeGreaterThanOrEqual(1);
    expect(metrics.totals.runtimeFailedTotal).toBeGreaterThanOrEqual(1);
    expect(Object.values(metrics.byTool)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolName: "execute-workspace-command",
          scope: "runtime",
          timeoutTotal: expect.any(Number),
          runtimeFailedTotal: expect.any(Number),
        }),
      ])
    );
  });

  it("returns runtime tool metrics gate summary with custom threshold", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const runtimeToolMetricsRead = vi.fn(async () => ({
      totals: {
        attemptedTotal: 7,
        startedTotal: 7,
        completedTotal: 7,
        successTotal: 4,
        validationFailedTotal: 1,
        runtimeFailedTotal: 1,
        timeoutTotal: 1,
        blockedTotal: 3,
      },
      byTool: {
        "runtime:execute-workspace-command": {
          toolName: "execute-workspace-command",
          scope: "runtime",
          attemptedTotal: 4,
          startedTotal: 4,
          completedTotal: 4,
          successTotal: 2,
          validationFailedTotal: 1,
          runtimeFailedTotal: 0,
          timeoutTotal: 1,
          blockedTotal: 1,
        },
        "write:write-workspace-file": {
          toolName: "write-workspace-file",
          scope: "write",
          attemptedTotal: 2,
          startedTotal: 2,
          completedTotal: 2,
          successTotal: 1,
          validationFailedTotal: 0,
          runtimeFailedTotal: 1,
          timeoutTotal: 0,
          blockedTotal: 0,
        },
        "computer_observe:run-runtime-computer-observe": {
          toolName: "run-runtime-computer-observe",
          scope: "computer_observe",
          attemptedTotal: 1,
          startedTotal: 1,
          completedTotal: 1,
          successTotal: 1,
          validationFailedTotal: 0,
          runtimeFailedTotal: 0,
          timeoutTotal: 0,
          blockedTotal: 2,
        },
      },
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
        {
          scope: "write",
          state: "closed",
          openedAt: null,
          updatedAt: 1_770_000_000_000,
        },
        {
          scope: "runtime",
          state: "open",
          openedAt: 1_770_000_000_100,
          updatedAt: 1_770_000_000_200,
        },
      ],
    }));
    const runtimeToolGuardrailRead = vi.fn(async () => ({
      payloadLimitBytes: 65_536,
      computerObserveRateLimitPerMinute: 12,
      channelHealth: {
        status: "healthy",
        reason: "guardrail_state_synced",
        lastErrorCode: null,
        updatedAt: 1_770_000_000_300,
      },
      circuitBreakers: [
        {
          scope: "write",
          state: "closed",
          openedAt: null,
          updatedAt: 1_770_000_000_300,
        },
        {
          scope: "runtime",
          state: "half_open",
          openedAt: 1_770_000_000_150,
          updatedAt: 1_770_000_000_310,
        },
      ],
      updatedAt: 1_770_000_000_310,
    }));

    await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: false,
      snapshot,
      actions,
      runtimeControl: {
        listTasks: async () => [],
        getTaskStatus: async () => null,
        startTask: async () => {
          throw new Error("not used");
        },
        interruptTask: async () => ({
          accepted: true,
          taskId: "runtime-1",
          status: "interrupted",
          message: "interrupted",
        }),
        submitTaskApprovalDecision: async () => ({
          recorded: true,
          approvalId: "approval-1",
          taskId: "runtime-1",
          status: "running",
          message: "recorded",
        }),
        runtimeToolMetricsRead,
        runtimeToolGuardrailRead,
      },
    });

    const metricsTool = registeredTools.find(
      (tool) => tool.name === "get-runtime-tool-execution-metrics"
    );
    expect(metricsTool).toBeTruthy();
    if (!metricsTool) {
      throw new Error("get-runtime-tool-execution-metrics tool not found");
    }

    const response = await Promise.resolve(metricsTool.execute({ minSuccessRate: 0.8 }, null));
    expect(runtimeToolMetricsRead).toHaveBeenCalledTimes(1);
    expect(runtimeToolGuardrailRead).toHaveBeenCalledTimes(1);
    expect(response).toMatchObject({
      ok: true,
      code: RUNTIME_MESSAGE_CODES.runtime.toolExecution.metricsRetrieved,
      data: {
        guardrails: {
          channelHealth: {
            status: "healthy",
          },
        },
        metricsSummary: {
          gate: {
            minSuccessRate: 0.8,
            successRate: 4 / 7,
            denominator: 7,
            passed: false,
            blockedTotal: 3,
            windowSize: 500,
            updatedAt: 1_770_000_000_000,
          },
          scopeSuccessRates: [
            {
              scope: "write",
              successRate: 0.5,
              denominator: 2,
              blockedTotal: 0,
            },
            {
              scope: "runtime",
              successRate: 0.5,
              denominator: 4,
              blockedTotal: 1,
            },
            {
              scope: "computer_observe",
              successRate: 1,
              denominator: 1,
              blockedTotal: 2,
            },
          ],
          topFailedTools: [
            {
              scope: "runtime",
              toolName: "execute-workspace-command",
              failedTotal: 2,
              validationFailedTotal: 1,
              runtimeFailedTotal: 0,
              timeoutTotal: 1,
              blockedTotal: 1,
            },
            {
              scope: "write",
              toolName: "write-workspace-file",
              failedTotal: 1,
              validationFailedTotal: 0,
              runtimeFailedTotal: 1,
              timeoutTotal: 0,
              blockedTotal: 0,
            },
            {
              scope: "computer_observe",
              toolName: "run-runtime-computer-observe",
              failedTotal: 0,
              validationFailedTotal: 0,
              runtimeFailedTotal: 0,
              timeoutTotal: 0,
              blockedTotal: 2,
            },
          ],
          channelHealth: {
            status: "healthy",
            source: "guardrails",
          },
          circuitBreakers: expect.arrayContaining([
            expect.objectContaining({
              scope: "runtime",
              state: "half_open",
            }),
          ]),
          topFailedReasons: expect.any(Array),
          effectiveLimitsByProfile: {
            default: {
              payloadLimitBytes: 65_536,
              computerObserveRateLimitPerMinute: 12,
            },
            soloMax: {
              payloadLimitBytes: 262_144,
              computerObserveRateLimitPerMinute: 60,
            },
          },
        },
      },
    });

    const guardrailTool = registeredTools.find(
      (tool) => tool.name === "get-runtime-tool-guardrail-state"
    );
    expect(guardrailTool).toBeTruthy();
    if (!guardrailTool) {
      throw new Error("get-runtime-tool-guardrail-state tool not found");
    }
    const guardrailResponse = await Promise.resolve(guardrailTool.execute({}, null));
    expect(guardrailResponse).toMatchObject({
      ok: true,
      code: RUNTIME_MESSAGE_CODES.runtime.toolExecution.guardrailStateRetrieved,
      data: {
        effectiveLimitsByProfile: {
          default: {
            payloadLimitBytes: 65_536,
            computerObserveRateLimitPerMinute: 12,
          },
          soloMax: {
            payloadLimitBytes: 262_144,
            computerObserveRateLimitPerMinute: 60,
          },
        },
      },
    });
    expect(runtimeToolGuardrailRead).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid minSuccessRate input for runtime metrics diagnostics tool", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: false,
      snapshot,
      actions,
      runtimeControl: {
        listTasks: async () => [],
        getTaskStatus: async () => null,
        startTask: async () => {
          throw new Error("not used");
        },
        interruptTask: async () => ({
          accepted: true,
          taskId: "runtime-1",
          status: "interrupted",
          message: "interrupted",
        }),
        submitTaskApprovalDecision: async () => ({
          recorded: true,
          approvalId: "approval-1",
          taskId: "runtime-1",
          status: "running",
          message: "recorded",
        }),
      },
    });

    const metricsTool = registeredTools.find(
      (tool) => tool.name === "get-runtime-tool-execution-metrics"
    );
    expect(metricsTool).toBeTruthy();
    if (!metricsTool) {
      throw new Error("get-runtime-tool-execution-metrics tool not found");
    }

    await expect(
      Promise.resolve(metricsTool.execute({ minSuccessRate: 2 }, null))
    ).rejects.toMatchObject({
      code: RUNTIME_MESSAGE_CODES.runtime.validation.inputInvalid,
    });
  });

  it("allows runtime tool execution with extra fields and emits warnings", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const runLiveSkill = vi.fn(async () => ({
      runId: "live-skill-run-1",
      skillId: "core-bash",
      status: "completed" as const,
      message: "ok",
      output: "",
      network: null,
      artifacts: [],
      metadata: {},
    }));

    await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: false,
      snapshot,
      actions,
      runtimeControl: {
        listTasks: async () => [],
        getTaskStatus: async () => null,
        startTask: async () => {
          throw new Error("not used");
        },
        interruptTask: async () => ({
          accepted: true,
          taskId: "runtime-1",
          status: "interrupted",
          message: "interrupted",
        }),
        submitTaskApprovalDecision: async () => ({
          recorded: true,
          approvalId: "approval-1",
          taskId: "runtime-1",
          status: "running",
          message: "recorded",
        }),
        runLiveSkill: runLiveSkill as NonNullable<
          NonNullable<
            Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]
          >["runLiveSkill"]
        >,
      },
    });

    const executeCommandTool = registeredTools.find(
      (tool) => tool.name === "execute-workspace-command"
    );
    expect(executeCommandTool).toBeTruthy();
    if (!executeCommandTool) {
      throw new Error("execute-workspace-command tool not found");
    }

    await Promise.resolve(
      executeCommandTool.execute(
        {
          command: "echo hello",
          unexpectedField: true,
        },
        null
      )
    );

    expect(runLiveSkill).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("execute-workspace-command received unexpected input fields"),
      expect.objectContaining({
        toolName: "execute-workspace-command",
        extraFields: ["unexpectedField"],
      })
    );
    warnSpy.mockRestore();
  });
});
