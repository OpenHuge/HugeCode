// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveSkillExecutionResult } from "@ku0/code-runtime-host-contract";
import {
  __resetRuntimeToolGuardrailOverridesForTests,
  __resetRuntimeToolMetricsRecordOverrideForTests,
  __setRuntimeToolGuardrailEvaluateOverrideForTests,
  __setRuntimeToolGuardrailRecordOutcomeOverrideForTests,
  __setRuntimeToolMetricsRecordOverrideForTests,
} from "./runtimeToolExecutionMetricsReporter";

type RuntimeUpdatedListener = (event: { scope: string[]; event: Record<string, unknown> }) => void;

const { runtimeUpdatedListeners, subscribeScopedRuntimeUpdatedEventsMock } = vi.hoisted(() => {
  const listeners = new Set<RuntimeUpdatedListener>();
  return {
    runtimeUpdatedListeners: listeners,
    subscribeScopedRuntimeUpdatedEventsMock: vi.fn(
      (_options: unknown, listener: RuntimeUpdatedListener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      }
    ),
  };
});

vi.mock("../application/runtime/ports/runtimeUpdatedEvents", () => ({
  subscribeScopedRuntimeUpdatedEvents: subscribeScopedRuntimeUpdatedEventsMock,
}));

import type { AgentCommandCenterActions, AgentCommandCenterSnapshot } from "./webMcpBridgeTypes";
import { syncWebMcpAgentControl, teardownWebMcpAgentControl } from "./webMcpBridge";

type ModelContextStub = {
  provideContext?: (payload: {
    tools?: unknown[];
    resources?: unknown[];
    prompts?: unknown[];
  }) => void;
  clearContext?: () => void | Promise<void>;
  registerTool?: (tool: unknown) => void | Promise<void>;
  unregisterTool?: (name: string) => void | Promise<void>;
  listTools?: () => unknown[] | Promise<unknown[]>;
  callTool?: (params: {
    name: string;
    arguments?: Record<string, unknown>;
  }) => unknown | Promise<unknown>;
  registerResource?: (resource: unknown) => void | Promise<void>;
  unregisterResource?: (uri: string) => void | Promise<void>;
  listResources?: () => unknown[] | Promise<unknown[]>;
  listResourceTemplates?: () => unknown[] | Promise<unknown[]>;
  registerPrompt?: (prompt: unknown) => void | Promise<void>;
  unregisterPrompt?: (name: string) => void | Promise<void>;
  listPrompts?: () => unknown[] | Promise<unknown[]>;
  createMessage?: (params: Record<string, unknown>) => unknown | Promise<unknown>;
  elicitInput?: (params: Record<string, unknown>) => unknown | Promise<unknown>;
};

function withStrictCapabilities(stub: ModelContextStub): ModelContextStub {
  return {
    provideContext: stub.provideContext,
    clearContext: stub.clearContext,
    registerTool: stub.registerTool ?? (() => undefined),
    unregisterTool: stub.unregisterTool ?? (() => undefined),
    listTools: stub.listTools ?? (() => []),
    callTool: stub.callTool ?? (() => ({ content: [] })),
    registerResource: stub.registerResource ?? (() => undefined),
    unregisterResource: stub.unregisterResource ?? (() => undefined),
    listResources: stub.listResources ?? (() => []),
    listResourceTemplates: stub.listResourceTemplates ?? (() => []),
    registerPrompt: stub.registerPrompt ?? (() => undefined),
    unregisterPrompt: stub.unregisterPrompt ?? (() => undefined),
    listPrompts: stub.listPrompts ?? (() => []),
    createMessage:
      stub.createMessage ??
      (() => ({ model: "test-model", content: { type: "text", text: "ok" } })),
    elicitInput: stub.elicitInput ?? (() => ({ action: "accept" })),
  };
}

function setModelContext(stub: ModelContextStub | null) {
  Object.defineProperty(window.navigator, "modelContext", {
    configurable: true,
    value: stub ? withStrictCapabilities(stub) : undefined,
  });
}

const snapshot: AgentCommandCenterSnapshot = {
  workspaceId: "ws-live-skills",
  workspaceName: "workspace-live-skills",
  intent: {
    objective: "Keep live skill catalogs fresh",
    constraints: "",
    successCriteria: "",
    deadline: null,
    priority: "high",
    managerNotes: "",
  },
  tasks: [],
  governance: {
    policy: {
      autoEnabled: false,
      intervalMinutes: 5,
      pauseBlockedInProgress: true,
      reassignUnowned: true,
      terminateOverdueDays: 5,
      ownerPool: [],
    },
    lastCycle: null,
  },
  auditLog: [],
  updatedAt: 0,
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
    ownerPool: [],
    notes: [],
  }),
  upsertTask: () => snapshot.tasks[0] ?? nullTask(),
  moveTask: () => null,
  pauseTask: () => null,
  resumeTask: () => null,
  terminateTask: () => null,
  rebalanceTasks: () => ({ updatedCount: 0, owners: [] }),
  assignTask: () => null,
  removeTask: () => false,
  clearCompleted: () => 0,
};

function nullTask() {
  return {
    id: "task-1",
    title: "task",
    owner: "",
    status: "backlog" as const,
    priority: "medium" as const,
    blocked: false,
    dueDate: null,
    notes: "",
  };
}

describe("webMcpBridge live-skill cache invalidation", () => {
  beforeEach(() => {
    subscribeScopedRuntimeUpdatedEventsMock.mockClear();
    runtimeUpdatedListeners.clear();
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
  });

  afterEach(async () => {
    __resetRuntimeToolGuardrailOverridesForTests();
    __resetRuntimeToolMetricsRecordOverrideForTests();
    await teardownWebMcpAgentControl();
    setModelContext(null);
  });

  it("invalidates cached live skills after runtime.updated bootstrap/skills events", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];
    let liveSkills = [
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
        aliases: ["core-grep", "grep", "rg", "search"],
      },
    ];
    const runLiveSkill = vi.fn(
      async (): Promise<LiveSkillExecutionResult> => ({
        runId: "live-skill-run-1",
        skillId: "core-grep",
        status: "completed" as const,
        message: "ok",
        output: "done",
        network: null,
        artifacts: [],
        metadata: {},
      })
    );

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
          taskId: "task-1",
          status: "interrupted",
          message: "interrupted",
        }),
        submitTaskApprovalDecision: async () => ({
          recorded: true,
          approvalId: "approval-1",
          taskId: "task-1",
          status: "running",
          message: "recorded",
        }),
        listLiveSkills: async () => liveSkills,
        runLiveSkill,
      },
    });

    expect(subscribeScopedRuntimeUpdatedEventsMock).toHaveBeenCalledWith(
      {
        workspaceId: snapshot.workspaceId,
        scopes: ["bootstrap", "skills"],
      },
      expect.any(Function)
    );

    const searchTool = registeredTools.find((tool) => tool.name === "search-workspace-files");
    if (!searchTool) {
      throw new Error("search-workspace-files tool not found");
    }

    await expect(
      Promise.resolve(searchTool.execute({ pattern: "needle" }, null))
    ).resolves.toMatchObject({
      message: "Workspace file search completed.",
    });
    expect(runLiveSkill).toHaveBeenCalledTimes(1);

    liveSkills = [
      {
        ...liveSkills[0],
        enabled: false,
      },
    ];

    await expect(
      Promise.resolve(searchTool.execute({ pattern: "needle" }, null))
    ).resolves.toMatchObject({
      message: "Workspace file search completed.",
    });
    expect(runLiveSkill).toHaveBeenCalledTimes(2);

    for (const listener of runtimeUpdatedListeners) {
      listener({
        scope: ["skills"],
        event: { method: "runtime/updated" },
      });
    }

    await expect(Promise.resolve(searchTool.execute({ pattern: "needle" }, null))).rejects.toThrow(
      "core-grep live skill is unavailable in this runtime."
    );
    expect(runLiveSkill).toHaveBeenCalledTimes(2);
  });
});
