// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRuntimeToolExecutionMetricsForTests } from "./runtimeToolExecutionMetrics";
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

function createRuntimeControlBase() {
  return {
    listTasks: vi.fn(async () => []),
    getTaskStatus: vi.fn(async () => null),
    startTask: vi.fn(async () => {
      throw new Error("not used");
    }),
    interruptTask: vi.fn(async () => ({
      accepted: true,
      taskId: "runtime-1",
      status: "interrupted",
      message: "interrupted",
    })),
    submitTaskApprovalDecision: vi.fn(async () => ({
      recorded: true,
      approvalId: "approval-1",
      taskId: "runtime-1",
      status: "running",
      message: "recorded",
    })),
  };
}

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

describe("webMcpBridge sub-agent session integration", () => {
  it("executes runtime sub-agent session tools with normalized inputs", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const runtimeControlBase = createRuntimeControlBase();
    const spawnedSession = {
      sessionId: "sub-agent-session-1",
      workspaceId: snapshot.workspaceId,
      threadId: "thread-1",
      title: "delegated run",
      status: "running",
      accessMode: "on-request",
      reasonEffort: "xhigh",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      activeTaskId: "runtime-sub-task-1",
      lastTaskId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      closedAt: null,
      errorCode: null,
      errorMessage: null,
      scopeProfile: "research",
      allowedSkillIds: ["core-grep", "core-read"],
      allowNetwork: false,
      workspaceReadPaths: ["src", "docs"],
      parentRunId: "run-parent-1",
      profileDescriptor: null,
      checkpointId: "checkpoint-sub-1",
      traceId: "trace-sub-1",
      recovered: true,
      checkpointState: null,
      approvalEvents: null,
      compactionSummary: null,
      evalTags: ["runtime", "sub-agent"],
    } as const;
    const spawnSubAgentSession = vi.fn(async () => spawnedSession);
    const sendSubAgentInstruction = vi.fn(async () => ({
      session: spawnedSession,
      task: null,
    }));
    const waitSubAgentSession = vi.fn(async () => ({
      session: spawnedSession,
      task: null,
      done: false,
      timedOut: true,
    }));
    const getSubAgentSessionStatus = vi.fn(async (_input: { sessionId: string }) => spawnedSession);
    const interruptSubAgentSession = vi.fn(async () => ({
      accepted: true,
      sessionId: spawnedSession.sessionId,
      taskId: spawnedSession.activeTaskId,
      status: "interrupted",
      message: "interrupted",
    }));
    const closeSubAgentSession = vi.fn(async () => ({
      closed: true,
      sessionId: spawnedSession.sessionId,
      status: "closed",
      message: "closed",
    }));
    const listLiveSkills = vi.fn(async () => [
      {
        id: "core-grep",
        name: "Core Grep",
        description: "Search files",
        kind: "file_search",
        source: "builtin",
        version: "1.0.0",
        enabled: true,
        supportsNetwork: false,
        tags: ["core", "search"],
        aliases: ["core-grep", "grep", "rg", "search", "ripgrep"],
      },
      {
        id: "core-read",
        name: "Core Read",
        description: "Read files",
        kind: "file_read",
        source: "builtin",
        version: "1.0.0",
        enabled: true,
        supportsNetwork: false,
        tags: ["core", "read"],
      },
    ]);

    await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: false,
      snapshot,
      actions,
      runtimeControl: {
        ...runtimeControlBase,
        listLiveSkills,
        spawnSubAgentSession,
        sendSubAgentInstruction,
        waitSubAgentSession,
        getSubAgentSessionStatus,
        interruptSubAgentSession,
        closeSubAgentSession,
      } as unknown as NonNullable<Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]>,
    });

    const spawnTool = registeredTools.find(
      (tool) => tool.name === "spawn-runtime-sub-agent-session"
    );
    expect(spawnTool).toBeTruthy();
    if (!spawnTool) {
      throw new Error("spawn-runtime-sub-agent-session tool not found");
    }
    const spawnResponse = await Promise.resolve(
      spawnTool.execute(
        {
          workspaceId: "   ",
          threadId: " thread-sub-1 ",
          title: "  delegated run  ",
          accessMode: "on-request",
          reasonEffort: "xhigh",
          provider: " openai ",
          modelId: " gpt-5.3-codex ",
          scopeProfile: "research",
          allowedSkillIds: " ripgrep, read_file ",
          allowNetwork: false,
          workspaceReadPaths: [" src ", "docs"],
          parentRunId: " parent-run-1 ",
        },
        null
      )
    );
    expect(spawnSubAgentSession).toHaveBeenCalledWith({
      workspaceId: snapshot.workspaceId,
      threadId: "thread-sub-1",
      title: "delegated run",
      accessMode: "on-request",
      reasonEffort: "xhigh",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      scopeProfile: "research",
      allowedSkillIds: ["core-grep", "core-read"],
      allowNetwork: false,
      workspaceReadPaths: ["src", "docs"],
      parentRunId: "parent-run-1",
    });
    expect(spawnResponse).toMatchObject({
      ok: true,
      data: {
        allowedSkillResolution: {
          requestedSkillIds: ["ripgrep", "read_file"],
          resolvedSkillIds: ["core-grep", "core-read"],
          entries: [
            expect.objectContaining({
              requestedSkillId: "ripgrep",
              resolvedSkillId: "core-grep",
              aliasApplied: true,
              acceptedSkillIds: expect.arrayContaining(["core-grep", "grep", "search", "ripgrep"]),
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
          status: "running",
          checkpointId: "checkpoint-sub-1",
          traceId: "trace-sub-1",
          recovered: true,
        },
      },
    });

    const sendTool = registeredTools.find(
      (tool) => tool.name === "send-runtime-sub-agent-instruction"
    );
    expect(sendTool).toBeTruthy();
    if (!sendTool) {
      throw new Error("send-runtime-sub-agent-instruction tool not found");
    }
    const sendResponse = await Promise.resolve(
      sendTool.execute(
        {
          sessionId: " sub-agent-session-1 ",
          instruction: "  collect logs and summarize  ",
          requestId: "   ",
          requiresApproval: true,
          approvalReason: "  gated action  ",
        },
        null
      )
    );
    expect(sendSubAgentInstruction).toHaveBeenCalledWith({
      sessionId: "sub-agent-session-1",
      instruction: "collect logs and summarize",
      requestId: undefined,
      requiresApproval: true,
      approvalReason: "gated action",
    });
    expect(sendResponse).toMatchObject({
      ok: true,
      data: {
        sessionHandle: {
          sessionId: "sub-agent-session-1",
          status: "running",
        },
      },
    });

    const waitTool = registeredTools.find((tool) => tool.name === "wait-runtime-sub-agent-session");
    expect(waitTool).toBeTruthy();
    if (!waitTool) {
      throw new Error("wait-runtime-sub-agent-session tool not found");
    }
    const waitResponse = await Promise.resolve(
      waitTool.execute(
        {
          sessionId: " sub-agent-session-1 ",
          timeoutMs: 15.9,
          pollIntervalMs: 0,
        },
        null
      )
    );
    expect(waitSubAgentSession).toHaveBeenCalledWith({
      sessionId: "sub-agent-session-1",
      timeoutMs: 15,
      pollIntervalMs: null,
    });
    expect(waitResponse).toMatchObject({
      ok: true,
      data: {
        sessionHandle: {
          sessionId: "sub-agent-session-1",
          status: "running",
        },
      },
    });

    const statusTool = registeredTools.find(
      (tool) => tool.name === "get-runtime-sub-agent-session-status"
    );
    expect(statusTool).toBeTruthy();
    if (!statusTool) {
      throw new Error("get-runtime-sub-agent-session-status tool not found");
    }
    const statusResponse = await Promise.resolve(
      statusTool.execute(
        {
          sessionId: " sub-agent-session-1 ",
        },
        null
      )
    );
    expect(getSubAgentSessionStatus).toHaveBeenCalledWith({
      sessionId: "sub-agent-session-1",
    });
    expect(statusResponse).toMatchObject({
      ok: true,
      data: {
        sessionHandle: {
          sessionId: "sub-agent-session-1",
          status: "running",
          checkpointId: "checkpoint-sub-1",
          traceId: "trace-sub-1",
          recovered: true,
        },
      },
    });

    const interruptSessionTool = registeredTools.find(
      (tool) => tool.name === "interrupt-runtime-sub-agent-session"
    );
    expect(interruptSessionTool).toBeTruthy();
    if (!interruptSessionTool) {
      throw new Error("interrupt-runtime-sub-agent-session tool not found");
    }
    const interruptResponse = await Promise.resolve(
      interruptSessionTool.execute(
        {
          sessionId: " sub-agent-session-1 ",
          reason: "   ",
        },
        null
      )
    );
    expect(interruptSubAgentSession).toHaveBeenCalledWith({
      sessionId: "sub-agent-session-1",
      reason: null,
    });
    expect(interruptResponse).toMatchObject({
      ok: true,
      data: {
        sessionHandle: {
          sessionId: "sub-agent-session-1",
          status: "interrupted",
        },
      },
    });

    const closeSessionTool = registeredTools.find(
      (tool) => tool.name === "close-runtime-sub-agent-session"
    );
    expect(closeSessionTool).toBeTruthy();
    if (!closeSessionTool) {
      throw new Error("close-runtime-sub-agent-session tool not found");
    }
    const closeResponse = await Promise.resolve(
      closeSessionTool.execute(
        {
          sessionId: " sub-agent-session-1 ",
          reason: "  completed  ",
          force: true,
        },
        null
      )
    );
    expect(closeSubAgentSession).toHaveBeenCalledWith({
      sessionId: "sub-agent-session-1",
      reason: "completed",
      force: true,
    });
    expect(closeResponse).toMatchObject({
      ok: true,
      data: {
        sessionHandle: {
          sessionId: "sub-agent-session-1",
          status: "closed",
        },
      },
    });
  });

  it("accepts runtime-discovered allowedSkillIds aliases for sub-agent spawn", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const runtimeControlBase = createRuntimeControlBase();
    const spawnSubAgentSession = vi.fn(async (input: Record<string, unknown>) => ({
      sessionId: "sub-agent-session-runtime-alias",
      workspaceId: snapshot.workspaceId,
      threadId: "thread-runtime-alias",
      title: "runtime alias",
      status: "running",
      accessMode: "read-only",
      reasonEffort: "medium",
      provider: null,
      modelId: null,
      activeTaskId: null,
      lastTaskId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      closedAt: null,
      errorCode: null,
      errorMessage: null,
      scopeProfile: null,
      allowedSkillIds: input.allowedSkillIds,
      allowNetwork: null,
      workspaceReadPaths: null,
      parentRunId: null,
      profileDescriptor: null,
      checkpointId: null,
      traceId: null,
      recovered: null,
      checkpointState: null,
      approvalEvents: null,
      compactionSummary: null,
      evalTags: null,
    }));

    await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: false,
      snapshot,
      actions,
      runtimeControl: {
        ...runtimeControlBase,
        listLiveSkills: vi.fn(async () => [
          {
            id: "core-grep",
            name: "Core Grep",
            description: "Search files",
            kind: "file_search",
            source: "builtin",
            version: "1.0.0",
            enabled: true,
            supportsNetwork: false,
            tags: ["core", "search"],
            aliases: ["project-search"],
          },
        ]),
        spawnSubAgentSession,
      } as unknown as NonNullable<Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]>,
    });

    const spawnTool = registeredTools.find(
      (tool) => tool.name === "spawn-runtime-sub-agent-session"
    );
    expect(spawnTool).toBeTruthy();
    if (!spawnTool) {
      throw new Error("spawn-runtime-sub-agent-session tool not found");
    }

    const response = await Promise.resolve(
      spawnTool.execute(
        {
          allowedSkillIds: ["project-search"],
        },
        null
      )
    );

    expect(spawnSubAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedSkillIds: ["core-grep"],
      })
    );
    expect(response).toMatchObject({
      ok: true,
      data: {
        allowedSkillResolution: {
          requestedSkillIds: ["project-search"],
          resolvedSkillIds: ["core-grep"],
          entries: [
            expect.objectContaining({
              requestedSkillId: "project-search",
              resolvedSkillId: "core-grep",
              aliasApplied: true,
              acceptedSkillIds: expect.arrayContaining(["core-grep", "project-search"]),
            }),
          ],
        },
      },
    });
  });

  it("uses agent metadata fallback for spawn/start provider-model and keeps explicit inputs highest priority", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const runtimeControlBase = createRuntimeControlBase();
    const spawnSubAgentSession = vi.fn(async () => ({
      sessionId: "sub-agent-session-ambient-1",
      workspaceId: snapshot.workspaceId,
      threadId: null,
      title: null,
      status: "running",
      accessMode: "on-request",
      reasonEffort: "medium",
      provider: null,
      modelId: null,
      activeTaskId: null,
      lastTaskId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      closedAt: null,
      errorCode: null,
      errorMessage: null,
      scopeProfile: null,
      allowedSkillIds: null,
      allowNetwork: null,
      workspaceReadPaths: null,
      parentRunId: null,
      profileDescriptor: null,
      checkpointId: null,
      traceId: null,
      recovered: null,
      checkpointState: null,
      approvalEvents: null,
      compactionSummary: null,
      evalTags: null,
    }));
    const startTask = vi.fn(async () => ({
      taskId: "runtime-task-ambient-1",
      workspaceId: snapshot.workspaceId,
      threadId: null,
      title: null,
      status: "queued",
      accessMode: "on-request",
      distributedStatus: null,
      currentStep: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      startedAt: null,
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      pendingApprovalId: null,
    }));

    await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: false,
      snapshot,
      actions,
      runtimeControl: {
        ...runtimeControlBase,
        startTask,
        spawnSubAgentSession,
      } as unknown as NonNullable<Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]>,
    });

    const spawnTool = registeredTools.find(
      (tool) => tool.name === "spawn-runtime-sub-agent-session"
    );
    expect(spawnTool).toBeTruthy();
    if (!spawnTool) {
      throw new Error("spawn-runtime-sub-agent-session tool not found");
    }

    await Promise.resolve(
      spawnTool.execute(
        {
          title: "ambient fallback spawn",
        },
        {
          context: {
            provider: " google ",
            model_id: " gemini-2.5-pro ",
          },
        }
      )
    );
    expect(spawnSubAgentSession).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        provider: "google",
        modelId: "gemini-2.5-pro",
      })
    );

    await Promise.resolve(
      spawnTool.execute(
        {
          title: "explicit should win",
          provider: "anthropic",
          modelId: "claude-3-7-sonnet",
        },
        {
          provider: "openai",
          modelId: "gpt-5.3-codex",
        }
      )
    );
    expect(spawnSubAgentSession).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        provider: "anthropic",
        modelId: "claude-3-7-sonnet",
      })
    );

    const startTool = registeredTools.find((tool) => tool.name === "start-runtime-run");
    expect(startTool).toBeTruthy();
    if (!startTool) {
      throw new Error("start-runtime-run tool not found");
    }

    await Promise.resolve(
      startTool.execute(
        {
          instruction: "inspect workspace status",
        },
        {
          model: {
            provider: "openai",
            id: "gpt-5.3-codex",
          },
        }
      )
    );
    expect(startTask).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        provider: "openai",
        modelId: "gpt-5.3-codex",
      })
    );

    await Promise.resolve(
      startTool.execute(
        {
          instruction: "explicit provider should win",
          provider: "anthropic",
          modelId: "claude-3-7-sonnet",
        },
        {
          context: {
            provider: "openai",
            modelId: "gpt-5.3-codex",
          },
        }
      )
    );
    expect(startTask).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        provider: "anthropic",
        modelId: "claude-3-7-sonnet",
      })
    );
  });

  it("rejects unknown allowedSkillIds before dispatching sub-agent work", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const runtimeControlBase = createRuntimeControlBase();
    const listLiveSkills = vi.fn(async () => [
      {
        id: "grep",
        name: "Core Grep",
        description: "Search files",
        kind: "file_search",
        source: "builtin",
      },
    ]);
    const spawnSubAgentSession = vi.fn(async () => {
      throw new Error("not used");
    });

    await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: false,
      snapshot,
      actions,
      runtimeControl: {
        ...runtimeControlBase,
        listLiveSkills,
        spawnSubAgentSession,
        sendSubAgentInstruction: vi.fn(async () => ({ session: null, task: null })),
        waitSubAgentSession: vi.fn(async () => ({
          session: null,
          task: null,
          done: true,
          timedOut: false,
        })),
      } as unknown as NonNullable<Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]>,
    });

    const spawnTool = registeredTools.find(
      (tool) => tool.name === "spawn-runtime-sub-agent-session"
    );
    expect(spawnTool).toBeTruthy();
    if (!spawnTool) {
      throw new Error("spawn-runtime-sub-agent-session tool not found");
    }
    await expect(
      Promise.resolve(
        spawnTool.execute(
          {
            allowedSkillIds: ["grep", "unknown-skill"],
          },
          null
        )
      )
    ).rejects.toThrow(/unknown allowedSkillIds/i);
    expect(spawnSubAgentSession).not.toHaveBeenCalled();

    const startTool = registeredTools.find((tool) => tool.name === "start-runtime-run");
    expect(startTool).toBeTruthy();
    if (!startTool) {
      throw new Error("start-runtime-run tool not found");
    }
    await expect(
      Promise.resolve(
        startTool.execute(
          {
            instruction: "Please use sub agents to parallelize this research task.",
            allowedSkillIds: ["unknown-skill"],
          },
          null
        )
      )
    ).rejects.toThrow(/unknown allowedSkillIds/i);
    expect(spawnSubAgentSession).not.toHaveBeenCalled();
    expect(listLiveSkills).toHaveBeenCalledTimes(2);
  });

  it("uses catalogSessionId to resolve delegated allowedSkillIds from activation truth", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const runtimeControlBase = createRuntimeControlBase();
    const listRuntimeInvocations = vi.fn(async (input?: { sessionId?: string | null }) => [
      {
        id: "session.review",
        title: "Session Review",
        version: "1.0.0",
        kind: "skill",
        bindingStage: "session_overlay",
        live: true,
        activationState: "degraded",
        readiness: {
          state: "attention",
          summary: "Overlay skill is active with warnings.",
          detail: "The overlay binding is active while refresh catches up.",
        },
        diagnostics: [],
        transitionHistory: [],
        source: {
          activationId: "overlay:session-1:review",
          sourceType: "session_overlay",
          sourceScope: "session_overlay",
          sourceRef: "session.review",
          pluginId: "session.review",
          packageRef: null,
          overlayId: "review",
          sessionId: input?.sessionId ?? null,
        },
        metadata: {
          runtimeSkillId: "session.review",
          aliases: ["review-skill"],
        },
      },
    ]);
    const listLiveSkills = vi.fn(async () => [
      {
        id: "legacy-review",
        name: "Legacy Review",
        description: "legacy",
        kind: "skill",
        source: "builtin",
      },
    ]);
    const spawnSubAgentSession = vi.fn(async () => ({
      sessionId: "sub-agent-session-overlay",
      workspaceId: snapshot.workspaceId,
      threadId: null,
      title: null,
      status: "running",
      accessMode: "on-request",
      reasonEffort: "medium",
      provider: null,
      modelId: null,
      activeTaskId: null,
      lastTaskId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      closedAt: null,
      errorCode: null,
      errorMessage: null,
      scopeProfile: "review",
      allowedSkillIds: ["session.review"],
      allowNetwork: false,
      workspaceReadPaths: null,
      parentRunId: null,
      profileDescriptor: null,
      checkpointId: null,
      traceId: null,
      recovered: false,
      checkpointState: null,
      approvalEvents: null,
      compactionSummary: null,
      evalTags: null,
    }));

    await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: false,
      snapshot,
      actions,
      runtimeControl: {
        ...runtimeControlBase,
        listRuntimeInvocations,
        listLiveSkills,
        spawnSubAgentSession,
        sendSubAgentInstruction: vi.fn(async () => ({ session: null, task: null })),
        waitSubAgentSession: vi.fn(async () => ({
          session: null,
          task: null,
          done: true,
          timedOut: false,
        })),
      } as unknown as NonNullable<Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]>,
    });

    const spawnTool = registeredTools.find(
      (tool) => tool.name === "spawn-runtime-sub-agent-session"
    );
    expect(spawnTool).toBeTruthy();
    if (!spawnTool) {
      throw new Error("spawn-runtime-sub-agent-session tool not found");
    }

    const spawnResponse = await Promise.resolve(
      spawnTool.execute(
        {
          scopeProfile: "review",
          catalogSessionId: "session-1",
          allowedSkillIds: ["review-skill"],
        },
        null
      )
    );

    expect(listRuntimeInvocations).toHaveBeenCalledWith({
      sessionId: "session-1",
      kind: "skill",
    });
    expect(listLiveSkills).not.toHaveBeenCalled();
    expect(spawnSubAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeProfile: "review",
        allowedSkillIds: ["session.review"],
      })
    );
    expect(spawnResponse).toMatchObject({
      ok: true,
      data: {
        allowedSkillResolution: {
          catalogSessionId: "session-1",
          entries: [
            expect.objectContaining({
              resolvedSkillId: "session.review",
              availability: expect.objectContaining({
                invocationId: "session.review",
                live: true,
                activationState: "degraded",
                readiness: expect.objectContaining({
                  state: "attention",
                  summary: "Overlay skill is active with warnings.",
                }),
              }),
            }),
          ],
        },
      },
    });

    const startTool = registeredTools.find((tool) => tool.name === "start-runtime-run");
    expect(startTool).toBeTruthy();
    if (!startTool) {
      throw new Error("start-runtime-run tool not found");
    }

    await Promise.resolve(
      startTool.execute(
        {
          instruction: "Use sub agents to review the overlay behavior.",
          catalogSessionId: "session-1",
          allowedSkillIds: ["review-skill"],
        },
        null
      )
    );

    expect(listRuntimeInvocations).toHaveBeenLastCalledWith({
      sessionId: "session-1",
      kind: "skill",
    });
  });

  it("executes batch runtime sub-agent orchestration and returns per-item results", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const runtimeControlBase = createRuntimeControlBase();
    const spawnedSessions: Array<{
      sessionId: string;
      workspaceId: string;
      threadId: string | null;
      title: string | null;
      status: "running";
      accessMode: "on-request";
      reasonEffort: "high";
      provider: "openai";
      modelId: "gpt-5.3-codex";
      activeTaskId: string | null;
      lastTaskId: string | null;
      createdAt: number;
      updatedAt: number;
      closedAt: number | null;
      errorCode: string | null;
      errorMessage: string | null;
    }> = [];
    const spawnSubAgentSession = vi.fn(
      async (input: { title?: string | null; threadId?: string | null }) => {
        const index = spawnedSessions.length + 1;
        const session = {
          sessionId: `sub-agent-session-${index}`,
          workspaceId: snapshot.workspaceId,
          threadId: input.threadId ?? null,
          title: input.title ?? null,
          status: "running" as const,
          accessMode: "on-request" as const,
          reasonEffort: "high" as const,
          provider: "openai" as const,
          modelId: "gpt-5.3-codex" as const,
          activeTaskId: `runtime-sub-task-${index}`,
          lastTaskId: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          closedAt: null,
          errorCode: null,
          errorMessage: null,
          scopeProfile: "general" as const,
          allowedSkillIds: null,
          allowNetwork: null,
          workspaceReadPaths: null,
          parentRunId: null,
          profileDescriptor: null,
          checkpointId: `checkpoint-sub-${index}`,
          traceId: `trace-sub-${index}`,
          recovered: false,
          checkpointState: null,
          approvalEvents: null,
          compactionSummary: null,
          evalTags: null,
        };
        spawnedSessions.push(session);
        return session;
      }
    );
    const sendSubAgentInstruction = vi.fn(
      async (input: { sessionId: string; instruction: string }) => ({
        session: spawnedSessions.find((session) => session.sessionId === input.sessionId) ?? null,
        task: {
          taskId: `${input.sessionId}-task`,
          workspaceId: snapshot.workspaceId,
          threadId: null,
          title: input.instruction,
          status: "running" as const,
          accessMode: "on-request" as const,
          distributedStatus: null,
          currentStep: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          startedAt: Date.now(),
          completedAt: null,
          errorCode: null,
          errorMessage: null,
          pendingApprovalId: null,
        },
      })
    );
    const waitSubAgentSession = vi.fn(async (input: { sessionId: string }) => ({
      session: spawnedSessions.find((session) => session.sessionId === input.sessionId),
      task: null,
      done: true,
      timedOut: false,
    }));
    const closeSubAgentSession = vi.fn(async (input: { sessionId: string }) => ({
      closed: true,
      sessionId: input.sessionId,
      status: "closed" as const,
      message: "closed",
    }));

    await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: false,
      snapshot,
      actions,
      runtimeControl: {
        ...runtimeControlBase,
        spawnSubAgentSession,
        sendSubAgentInstruction,
        waitSubAgentSession,
        closeSubAgentSession,
      } as unknown as NonNullable<Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]>,
    });

    const batchTool = registeredTools.find(
      (tool) => tool.name === "orchestrate-runtime-sub-agent-batch"
    );
    expect(batchTool).toBeTruthy();
    if (!batchTool) {
      throw new Error("orchestrate-runtime-sub-agent-batch tool not found");
    }

    const response = await Promise.resolve(
      batchTool.execute(
        {
          workspaceId: "   ",
          threadId: " thread-main ",
          executionMode: "parallel",
          tasks: [
            {
              taskKey: "collect-logs",
              title: " collect logs ",
              instruction: " gather runtime logs ",
              requestId: " req-1 ",
            },
            {
              taskKey: "summarize-failures",
              title: " summarize failures ",
              instruction: " summarize failing steps ",
              requestId: " req-2 ",
              waitTimeoutMs: 12.9,
              waitPollIntervalMs: 3.2,
              closeReason: " done ",
            },
          ],
        },
        null
      )
    );

    expect(spawnSubAgentSession).toHaveBeenCalledTimes(2);
    expect(spawnSubAgentSession).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        workspaceId: snapshot.workspaceId,
        threadId: "thread-main",
        title: "collect logs",
      })
    );
    expect(sendSubAgentInstruction).toHaveBeenCalledTimes(2);
    expect(sendSubAgentInstruction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sessionId: "sub-agent-session-1",
        instruction: "gather runtime logs",
        requestId: "req-1",
      })
    );
    expect(waitSubAgentSession).toHaveBeenCalledWith({
      sessionId: "sub-agent-session-2",
      timeoutMs: 12,
      pollIntervalMs: 3,
    });
    expect(closeSubAgentSession).toHaveBeenCalledTimes(2);
    expect(response).toMatchObject({
      ok: true,
      code: expect.any(String),
      message: "Runtime sub-agent batch orchestration completed.",
      data: {
        summary: {
          total: 2,
          succeeded: 2,
          failed: 0,
        },
        results: [
          {
            taskKey: "collect-logs",
            sessionHandle: {
              sessionId: "sub-agent-session-1",
              status: "running",
              checkpointId: "checkpoint-sub-1",
              traceId: "trace-sub-1",
            },
          },
          {
            taskKey: "summarize-failures",
            sessionHandle: {
              sessionId: "sub-agent-session-2",
              status: "running",
              checkpointId: "checkpoint-sub-2",
              traceId: "trace-sub-2",
            },
          },
        ],
      },
    });
  });

  it("routes sub-agent orchestration instructions through runtime sub-agent session flow", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const runtimeControlBase = createRuntimeControlBase();
    const startTask = vi.fn(async () => {
      throw new Error("startTask should not be used for sub-agent orchestration");
    });
    const spawnedSession = {
      sessionId: "sub-agent-session-1",
      workspaceId: snapshot.workspaceId,
      threadId: null,
      title: "sub-agent",
      status: "idle",
      accessMode: "on-request",
      reasonEffort: "high",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      activeTaskId: null,
      lastTaskId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      closedAt: null,
      errorCode: null,
      errorMessage: null,
      scopeProfile: "review",
      allowedSkillIds: ["core-grep"],
      allowNetwork: true,
      workspaceReadPaths: ["src/runtime"],
      parentRunId: "parent-run-99",
      profileDescriptor: null,
      checkpointId: "checkpoint-sub-1",
      traceId: "trace-sub-1",
      recovered: false,
      checkpointState: null,
      approvalEvents: null,
      compactionSummary: null,
      evalTags: null,
    } as const;
    const runningTask = {
      taskId: "runtime-sub-task-1",
      workspaceId: snapshot.workspaceId,
      threadId: null,
      title: "sub-agent task",
      status: "running",
      accessMode: "on-request",
      distributedStatus: null,
      currentStep: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      startedAt: Date.now(),
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      pendingApprovalId: null,
    } as const;
    const completedTask = {
      ...runningTask,
      status: "completed",
      completedAt: Date.now(),
    } as const;
    const spawnSubAgentSession = vi.fn(async () => spawnedSession);
    const sendSubAgentInstruction = vi.fn(async () => ({
      session: spawnedSession,
      task: runningTask,
    }));
    const waitSubAgentSession = vi.fn(async () => ({
      session: {
        ...spawnedSession,
        status: "completed",
        lastTaskId: "runtime-sub-task-1",
      },
      task: completedTask,
      done: true,
      timedOut: false,
    }));
    const closeSubAgentSession = vi.fn(async () => ({
      closed: true,
      sessionId: "sub-agent-session-1",
      status: "closed",
      message: "closed",
    }));

    await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: false,
      snapshot,
      actions,
      runtimeControl: {
        ...runtimeControlBase,
        startTask,
        spawnSubAgentSession,
        sendSubAgentInstruction,
        waitSubAgentSession,
        closeSubAgentSession,
      } as unknown as NonNullable<Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]>,
    });

    const startTool = registeredTools.find((tool) => tool.name === "start-runtime-run");
    expect(startTool).toBeTruthy();
    if (!startTool) {
      throw new Error("start-runtime-run tool not found");
    }

    const response = await Promise.resolve(
      startTool.execute(
        {
          instruction: "Please use sub agents to parallelize this research task.",
          reasonEffort: "high",
          scopeProfile: "review",
          allowedSkillIds: "grep",
          allowNetwork: true,
          workspaceReadPaths: "src/runtime",
          parentRunId: " parent-run-99 ",
        },
        null
      )
    );

    expect(spawnSubAgentSession).toHaveBeenCalledTimes(1);
    expect(spawnSubAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: snapshot.workspaceId,
        scopeProfile: "review",
        allowedSkillIds: ["core-grep"],
        allowNetwork: true,
        workspaceReadPaths: ["src/runtime"],
        parentRunId: "parent-run-99",
      })
    );
    expect(sendSubAgentInstruction).toHaveBeenCalledTimes(1);
    expect(waitSubAgentSession).toHaveBeenCalledTimes(1);
    expect(closeSubAgentSession).toHaveBeenCalledTimes(1);
    expect(startTask).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: true,
      code: expect.any(String),
      message: "Runtime sub-agent session executed.",
      data: {
        delegatedViaSubAgentSession: true,
        sessionHandle: {
          sessionId: "sub-agent-session-1",
          status: "completed",
          checkpointId: "checkpoint-sub-1",
          traceId: "trace-sub-1",
          recovered: false,
        },
      },
    });
  });
});
