// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RUNTIME_MESSAGE_CODES } from "@ku0/code-runtime-client/runtimeMessageCodes";
import { readRuntimeCode } from "@ku0/code-runtime-client/runtimeMessageEnvelope";
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
  callWebMcpTool,
  createWebMcpMessage,
  elicitWebMcpInput,
  getWebMcpCapabilities,
  listWebMcpCatalog,
  supportsWebMcp,
  syncWebMcpAgentControl,
  teardownWebMcpAgentControl,
  WEB_MCP_AGENT_CONTROL_TOOL_NAMES,
} from "./webMcpBridge";

type ModelContextStub = {
  provideContext?: (payload: {
    tools?: unknown[];
    resources?: unknown[];
    prompts?: unknown[];
  }) => void | Promise<void>;
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

function setModelContext(stub: ModelContextStub | null, strict: boolean = true) {
  Object.defineProperty(window.navigator, "modelContext", {
    configurable: true,
    value: stub ? (strict ? withStrictCapabilities(stub) : stub) : undefined,
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
  auditLog: [
    {
      id: "audit-1",
      at: Date.now() - 60_000,
      category: "task",
      level: "info",
      message: "Task created",
    },
    {
      id: "audit-2",
      at: Date.now() - 5_000,
      category: "governance",
      level: "warning",
      message: "Paused blocked task",
    },
  ],
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

describe("webMcpBridge", () => {
  it("reports unsupported when navigator.modelContext is unavailable", async () => {
    setModelContext(null);

    expect(supportsWebMcp()).toBe(false);

    const result = await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: true,
      snapshot,
      actions,
    });

    expect(result.supported).toBe(false);
    expect(result.error).toContain("unavailable");
  });

  it("treats provideContext as sufficient support for bridge registration", async () => {
    setModelContext(
      {
        provideContext: () => undefined,
      },
      false
    );

    const capabilities = getWebMcpCapabilities();
    expect(capabilities.supported).toBe(true);
    expect(capabilities.missingRequired).toEqual([]);
    expect(supportsWebMcp()).toBe(true);

    const result = await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: true,
      snapshot,
      actions,
    });

    expect(result.supported).toBe(true);
    expect(result.mode).toBe("provideContext");
    expect(result.error).toBeNull();
  });

  it("reports unsupported when registration APIs are missing", async () => {
    setModelContext(
      {
        registerTool: () => undefined,
      },
      false
    );

    const capabilities = getWebMcpCapabilities();
    expect(capabilities.supported).toBe(false);
    expect(capabilities.missingRequired).toEqual([
      "modelContext.registerResource",
      "modelContext.registerPrompt",
    ]);
    expect(supportsWebMcp()).toBe(false);

    const result = await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: true,
      snapshot,
      actions,
    });

    expect(result.supported).toBe(false);
    expect(result.error).toContain("registration methods");
  });

  it("registers and clears tools via provideContext", async () => {
    const calls: Array<{ tools?: unknown[]; resources?: unknown[]; prompts?: unknown[] }> = [];
    setModelContext({
      provideContext: (payload) => {
        calls.push(payload);
      },
    });

    const enabledResult = await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: true,
      snapshot,
      actions,
    });

    expect(enabledResult.supported).toBe(true);
    expect(enabledResult.mode).toBe("provideContext");
    expect(enabledResult.registeredTools).toBe(WEB_MCP_AGENT_CONTROL_TOOL_NAMES.length);
    expect(enabledResult.registeredResources).toBeGreaterThan(0);
    expect(enabledResult.registeredPrompts).toBeGreaterThan(0);
    expect(calls.at(-1)?.tools).toHaveLength(WEB_MCP_AGENT_CONTROL_TOOL_NAMES.length);
    expect((calls.at(-1)?.resources ?? []).length).toBeGreaterThan(0);
    expect((calls.at(-1)?.prompts ?? []).length).toBeGreaterThan(0);

    const disabledResult = await syncWebMcpAgentControl({
      enabled: false,
      readOnlyMode: false,
      requireUserApproval: true,
      snapshot,
      actions,
    });

    expect(disabledResult.enabled).toBe(false);
    expect(calls.at(-1)?.tools).toHaveLength(0);

    const populatedCall = calls.find((entry) => (entry.tools?.length ?? 0) > 0);
    const hasReadOnlyTool = (
      (populatedCall?.tools ?? []) as Array<{
        annotations?: { readOnlyHint?: boolean };
      }>
    ).some((tool) => tool.annotations?.readOnlyHint === true);
    expect(hasReadOnlyTool).toBe(true);
  });

  it("slims runtime tools for anthropic model contexts before provideContext registration", async () => {
    let registeredTools: Array<{ name: string }> = [];
    let registeredResources: Array<{ name: string }> = [];
    let registeredPrompts: Array<{ name: string }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = (payload.tools ?? []) as Array<{ name: string }>;
        registeredResources = (payload.resources ?? []) as Array<{ name: string }>;
        registeredPrompts = (payload.prompts ?? []) as Array<{ name: string }>;
      },
    });

    const result = await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: true,
      snapshot,
      actions,
      activeModelContext: {
        provider: "anthropic",
        modelId: "claude-sonnet-4-5",
      },
      runtimeControl: {
        listTasks: vi.fn(async () => []),
        getTaskStatus: vi.fn(async () => null),
        startTask: vi.fn(async () => {
          throw new Error("not used");
        }),
        interruptTask: vi.fn(async () => ({
          accepted: true,
          taskId: "runtime-1",
          status: "interrupted" as const,
          message: "interrupted",
        })),
        submitTaskApprovalDecision: vi.fn(async () => ({
          recorded: true,
          approvalId: "approval-1",
          taskId: "runtime-1",
          status: "running" as const,
          message: "recorded",
        })),
      },
    });

    expect(result.toolExposureMode).toBe("slim");
    expect(result.toolExposureReasonCodes).toContain("provider-prefers-slim-tool-catalog");
    expect(registeredTools.some((tool) => tool.name === "read-workspace-file")).toBe(true);
    expect(registeredTools.some((tool) => tool.name === "run-runtime-live-skill")).toBe(true);
    expect(registeredTools.some((tool) => tool.name === "get-runtime-settings")).toBe(false);
    expect(registeredResources.some((resource) => resource.name === "runtime-tool-discovery")).toBe(
      true
    );
    expect(
      registeredPrompts.some((prompt) => prompt.name === "choose-runtime-tooling-strategy")
    ).toBe(true);
  });

  it("keeps the full runtime tool catalog for openai model contexts", async () => {
    let registeredTools: Array<{ name: string }> = [];
    let registeredResources: Array<{ name: string }> = [];
    let registeredPrompts: Array<{ name: string }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = (payload.tools ?? []) as Array<{ name: string }>;
        registeredResources = (payload.resources ?? []) as Array<{ name: string }>;
        registeredPrompts = (payload.prompts ?? []) as Array<{ name: string }>;
      },
    });

    const result = await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: true,
      snapshot,
      actions,
      activeModelContext: {
        provider: "openai",
        modelId: "gpt-5.4",
      },
      runtimeControl: {
        listTasks: vi.fn(async () => []),
        getTaskStatus: vi.fn(async () => null),
        startTask: vi.fn(async () => {
          throw new Error("not used");
        }),
        interruptTask: vi.fn(async () => ({
          accepted: true,
          taskId: "runtime-1",
          status: "interrupted" as const,
          message: "interrupted",
        })),
        submitTaskApprovalDecision: vi.fn(async () => ({
          recorded: true,
          approvalId: "approval-1",
          taskId: "runtime-1",
          status: "running" as const,
          message: "recorded",
        })),
      },
    });

    expect(result.toolExposureMode).toBe("full");
    expect(result.toolExposureReasonCodes).toContain("provider-keeps-full-tool-catalog");
    expect(registeredTools.some((tool) => tool.name === "get-runtime-settings")).toBe(true);
    expect(registeredResources.some((resource) => resource.name === "runtime-tool-discovery")).toBe(
      false
    );
    expect(
      registeredPrompts.some((prompt) => prompt.name === "choose-runtime-tooling-strategy")
    ).toBe(false);
  });

  it("honors an explicit runtime tool exposure profile when syncing WebMCP", async () => {
    let registeredTools: Array<{ name: string }> = [];
    let registeredResources: Array<{ name: string }> = [];
    let registeredPrompts: Array<{ name: string }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = (payload.tools ?? []) as Array<{ name: string }>;
        registeredResources = (payload.resources ?? []) as Array<{ name: string }>;
        registeredPrompts = (payload.prompts ?? []) as Array<{ name: string }>;
      },
    });

    const result = await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: true,
      snapshot,
      actions,
      activeModelContext: {
        provider: "openai",
        modelId: "gpt-5.4",
      },
      toolExposureProfile: "minimal",
      runtimeControl: {
        listTasks: vi.fn(async () => []),
        getTaskStatus: vi.fn(async () => null),
        startTask: vi.fn(async () => {
          throw new Error("not used");
        }),
        interruptTask: vi.fn(async () => ({
          accepted: true,
          taskId: "runtime-1",
          status: "interrupted" as const,
          message: "interrupted",
        })),
        submitTaskApprovalDecision: vi.fn(async () => ({
          recorded: true,
          approvalId: "approval-1",
          taskId: "runtime-1",
          status: "running" as const,
          message: "recorded",
        })),
      },
    });

    expect(result.toolExposureMode).toBe("minimal");
    expect(result.toolExposureReasonCodes).toContain("runtime-prefers-minimal-tool-catalog");
    expect(registeredTools.some((tool) => tool.name === "get-runtime-settings")).toBe(false);
    expect(registeredResources.some((resource) => resource.name === "runtime-tool-discovery")).toBe(
      true
    );
    expect(
      registeredPrompts.some((prompt) => prompt.name === "choose-runtime-tooling-strategy")
    ).toBe(true);
  });

  it("registers runtime sub-agent schemas with advanced session-first fields", async () => {
    let registeredTools: Array<{
      name: string;
      inputSchema?: { properties?: Record<string, unknown> };
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: true,
      snapshot,
      actions,
      runtimeControl: {
        listTasks: vi.fn(async () => []),
        getTaskStatus: vi.fn(async () => null),
        startTask: vi.fn(async () => {
          throw new Error("not used");
        }),
        interruptTask: vi.fn(async () => ({
          accepted: true,
          taskId: "runtime-1",
          status: "interrupted" as const,
          message: "interrupted",
        })),
        submitTaskApprovalDecision: vi.fn(async () => ({
          recorded: true,
          approvalId: "approval-1",
          taskId: "runtime-1",
          status: "running" as const,
          message: "recorded",
        })),
      },
    });

    const spawnTool = registeredTools.find(
      (tool) => tool.name === "spawn-runtime-sub-agent-session"
    );
    const batchTool = registeredTools.find(
      (tool) => tool.name === "orchestrate-runtime-sub-agent-batch"
    );
    const resumeTool = registeredTools.find((tool) => tool.name === "resume-runtime-run");

    expect(spawnTool?.inputSchema?.properties).toMatchObject({
      scopeProfile: { type: "string", enum: ["general", "research", "review"] },
      allowNetwork: { type: "boolean" },
      parentRunId: { type: "string" },
    });
    expect(
      (spawnTool?.inputSchema?.properties as Record<string, { oneOf?: unknown }> | undefined)
        ?.allowedSkillIds
    ).toMatchObject({
      oneOf: [{ type: "array", items: { type: "string" } }, { type: "string" }],
    });
    expect(
      (spawnTool?.inputSchema?.properties as Record<string, { oneOf?: unknown }> | undefined)
        ?.workspaceReadPaths
    ).toMatchObject({
      oneOf: [{ type: "array", items: { type: "string" } }, { type: "string" }],
    });
    expect(batchTool?.inputSchema?.properties).toMatchObject({
      scopeProfile: { type: "string", enum: ["general", "research", "review"] },
      allowNetwork: { type: "boolean" },
      parentRunId: { type: "string" },
    });
    expect(resumeTool?.name).toBe("resume-runtime-run");
  });

  it("only exposes the minimal local command-center toolset", async () => {
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
      readOnlyMode: true,
      requireUserApproval: true,
      snapshot: {
        ...snapshot,
        tasks: [
          ...snapshot.tasks,
          {
            id: "task-2",
            title: "Fix runtime monitor",
            owner: "bob",
            status: "in_progress",
            priority: "high",
            blocked: false,
            dueDate: null,
            notes: "",
            updatedAt: Date.now(),
          },
          {
            id: "task-3",
            title: "Investigate flaky test",
            owner: "",
            status: "in_progress",
            priority: "medium",
            blocked: false,
            dueDate: null,
            notes: "",
            updatedAt: Date.now(),
          },
        ],
      },
      actions,
    });

    expect(registeredTools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["get-project-overview"])
    );
    expect(registeredTools.map((tool) => tool.name)).not.toEqual(
      expect.arrayContaining(["set-user-intent"])
    );
    expect(registeredTools.map((tool) => tool.name)).not.toEqual(
      expect.arrayContaining([
        "list-project-tasks",
        "get-governance-status",
        "get-owner-load-summary",
        "get-agent-audit-log",
        "set-governance-policy",
        "run-governance-cycle",
        "upsert-project-task",
        "move-project-task",
      ])
    );
  });

  it("uses clearContext when available", async () => {
    const clearContext = vi.fn();
    const provideContext = vi.fn();
    setModelContext({
      clearContext,
      provideContext,
    });

    await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: true,
      snapshot,
      actions,
    });

    await syncWebMcpAgentControl({
      enabled: false,
      readOnlyMode: false,
      requireUserApproval: true,
      snapshot,
      actions,
    });

    expect(clearContext).toHaveBeenCalledTimes(2);
    expect(provideContext).toHaveBeenCalledTimes(1);
  });

  it("lists catalog and delegates call/create/elicit methods", async () => {
    const callTool = vi.fn(async () => ({ content: [{ type: "text", text: "tool-ok" }] }));
    const createMessage = vi.fn(async () => ({
      model: "mcp",
      content: { type: "text", text: "msg" },
    }));
    const elicitInput = vi.fn(async () => ({ action: "accept", content: { channel: "stable" } }));
    setModelContext({
      listTools: () => [{ name: "get-project-overview" }],
      listResources: () => [{ uri: "hugecode://workspace/ws-1/overview" }],
      listResourceTemplates: () => [],
      listPrompts: () => [{ name: "summarize-workspace-status" }],
      callTool,
      createMessage,
      elicitInput,
    });

    const catalog = await listWebMcpCatalog();
    expect(catalog.tools).toHaveLength(1);
    expect(catalog.resources).toHaveLength(1);
    expect(catalog.prompts).toHaveLength(1);

    const toolResult = await callWebMcpTool({ name: "get-project-overview", arguments: {} });
    expect(toolResult).toMatchObject({ content: [{ text: "tool-ok" }] });
    expect(callTool).toHaveBeenCalledWith({ name: "get-project-overview", arguments: {} });

    const messageResult = await createWebMcpMessage({
      messages: [{ role: "user", content: { type: "text", text: "hello" } }],
      maxTokens: 16,
    });
    expect(messageResult).toMatchObject({ model: "mcp" });
    expect(createMessage).toHaveBeenCalledTimes(1);

    const elicitResult = await elicitWebMcpInput({
      message: "Need channel",
      requestedSchema: {
        type: "object",
        properties: {
          channel: { type: "string" },
        },
      },
    });
    expect(elicitResult).toMatchObject({ action: "accept" });
    expect(elicitInput).toHaveBeenCalledTimes(1);
  });

  it("blocks createMessage when model payload schema validation fails", async () => {
    const createMessage = vi.fn(async () => ({
      model: "mcp",
      content: { type: "text", text: "msg" },
    }));
    setModelContext({
      createMessage,
    });

    await expect(
      createWebMcpMessage({
        messages: [{ role: "user", content: { type: "text", text: "hello" } }],
      } as unknown as Parameters<typeof createWebMcpMessage>[0])
    ).rejects.toMatchObject({
      code: "INPUT_SCHEMA_VALIDATION_FAILED",
      toolName: "createMessage",
      scope: "createMessage",
      validation: {
        errors: expect.arrayContaining(["Missing required field: maxTokens"]),
      },
    });
    expect(createMessage).not.toHaveBeenCalled();
  });

  it("blocks elicitInput when model payload schema validation fails", async () => {
    const elicitInput = vi.fn(async () => ({ action: "accept" }));
    setModelContext({
      elicitInput,
    });

    await expect(
      elicitWebMcpInput({
        mode: "url",
        message: "Need channel",
        elicitationId: "elicit-1",
      } as unknown as Parameters<typeof elicitWebMcpInput>[0])
    ).rejects.toMatchObject({
      code: "INPUT_SCHEMA_VALIDATION_FAILED",
      toolName: "elicitInput",
      scope: "elicitInput",
      validation: {
        errors: expect.arrayContaining([
          "Invalid field value at : value does not match any allowed schema variant.",
        ]),
      },
    });
    expect(elicitInput).not.toHaveBeenCalled();
  });

  it("allows createMessage extra fields and emits schema warnings", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const createMessage = vi.fn(async () => ({
      model: "mcp",
      content: { type: "text", text: "msg" },
    }));
    setModelContext({
      createMessage,
    });

    await createWebMcpMessage({
      messages: [{ role: "user", content: { type: "text", text: "hello" } }],
      maxTokens: 16,
      unexpected: true,
    } as unknown as Parameters<typeof createWebMcpMessage>[0]);

    expect(createMessage).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("createMessage received unexpected input fields"),
      expect.objectContaining({
        methodName: "createMessage",
        extraFields: ["unexpected"],
      })
    );
    warnSpy.mockRestore();
  });

  it("lists catalog when list methods exist even without registration support", async () => {
    setModelContext(
      {
        listTools: () => [{ name: "get-project-overview" }],
        listResources: () => [{ uri: "hugecode://workspace/ws-1/overview" }],
        listPrompts: () => [{ name: "summarize-workspace-status" }],
      },
      false
    );

    const catalog = await listWebMcpCatalog();
    expect(catalog.tools).toHaveLength(1);
    expect(catalog.resources).toHaveLength(1);
    expect(catalog.prompts).toHaveLength(1);
    expect(catalog.capabilities.supported).toBe(false);
  });

  it("fails catalog listing when required list methods are missing", async () => {
    setModelContext(
      {
        listTools: () => [{ name: "get-project-overview" }],
        listResources: () => [{ uri: "hugecode://workspace/ws-1/overview" }],
      },
      false
    );

    await expect(listWebMcpCatalog()).rejects.toMatchObject({
      code: "METHOD_UNAVAILABLE",
      method: "listTools/listResources/listPrompts",
    });
  });

  it("blocks intent updates when user interaction denies approval", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (
        input: Record<string, unknown>,
        agent: { requestUserInteraction?: unknown }
      ) => unknown;
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
      requireUserApproval: true,
      snapshot,
      actions: { ...actions, setIntentPatch },
    });

    const intentTool = registeredTools.find((tool) => tool.name === "set-user-intent");
    expect(intentTool).toBeTruthy();
    if (!intentTool) {
      throw new Error("set-user-intent tool not found");
    }

    let deniedApprovalError: unknown = null;
    try {
      await Promise.resolve(
        intentTool.execute(
          { objective: "Ship safer control plane" },
          {
            requestUserInteraction: async () => false,
          }
        )
      );
    } catch (error) {
      deniedApprovalError = error;
    }
    expect(deniedApprovalError).toBeInstanceOf(Error);
    expect(readRuntimeCode(deniedApprovalError)).toBe(
      RUNTIME_MESSAGE_CODES.runtime.validation.approvalRejected
    );
    expect((deniedApprovalError as Error).message).toContain("user approval");

    expect(setIntentPatch).not.toHaveBeenCalled();

    const response = await Promise.resolve(
      intentTool.execute(
        { objective: "Ship safer control plane" },
        {
          requestUserInteraction: async () => true,
        }
      )
    );

    expect(setIntentPatch).toHaveBeenCalledWith({ objective: "Ship safer control plane" });
    expect(response).toMatchObject({
      ok: true,
      code: expect.any(String),
      message: "Intent updated.",
    });
  });

  it("fails search-workspace-files when core-grep live skill is unavailable", async () => {
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
      skillId: "core-grep",
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
        listLiveSkills: async () => [
          {
            id: "core-grep",
            name: "Core Grep",
            description: "Search",
            kind: "file_search",
            source: "builtin",
            version: "1.0.0",
            enabled: false,
            supportsNetwork: false,
            tags: ["core", "search"],
          },
        ],
        runLiveSkill: runLiveSkill as NonNullable<
          NonNullable<
            Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]
          >["runLiveSkill"]
        >,
      },
    });

    const searchTool = registeredTools.find((tool) => tool.name === "search-workspace-files");
    expect(searchTool).toBeTruthy();
    if (!searchTool) {
      throw new Error("search-workspace-files tool not found");
    }

    let unavailableSkillError: unknown = null;
    try {
      await Promise.resolve(searchTool.execute({ pattern: "workspaceId" }, null));
    } catch (error) {
      unavailableSkillError = error;
    }
    expect(unavailableSkillError).toBeInstanceOf(Error);
    expect(readRuntimeCode(unavailableSkillError)).toBe(
      RUNTIME_MESSAGE_CODES.runtime.validation.methodUnavailable
    );
    expect((unavailableSkillError as Error).message).toContain(
      "core-grep live skill is unavailable in this runtime."
    );
    expect(runLiveSkill).not.toHaveBeenCalled();
  });

  it("allows search-workspace-files when the runtime catalog exposes only a grep alias", async () => {
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
      runId: "live-skill-run-grep-1",
      skillId: "core-grep",
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
        listLiveSkills: async () => [
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
          },
        ],
        runLiveSkill: runLiveSkill as NonNullable<
          NonNullable<
            Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]
          >["runLiveSkill"]
        >,
      },
    });

    const searchTool = registeredTools.find((tool) => tool.name === "search-workspace-files");
    expect(searchTool).toBeTruthy();
    if (!searchTool) {
      throw new Error("search-workspace-files tool not found");
    }

    await expect(
      Promise.resolve(searchTool.execute({ pattern: "workspaceId" }, null))
    ).resolves.toMatchObject({
      message: "Workspace file search completed.",
    });

    expect(runLiveSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skillId: "core-grep",
        input: "workspaceId",
      })
    );
  });

  it("prefers activation-backed runtime invocations over direct live-skill listing for workspace search availability", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const listRuntimeInvocations = vi.fn(async () => [
      {
        id: "core-grep",
        title: "Core Grep",
        version: "1.0.0",
        kind: "skill",
        bindingStage: "runtime_binding",
        live: true,
        activationState: "active",
        readiness: {
          state: "ready",
          summary: "Plugin is active.",
          detail: "Live contributions are available now.",
        },
        diagnostics: [],
        transitionHistory: [],
        source: {
          activationId: "plugin:core-grep",
          sourceType: "runtime_plugin",
          sourceScope: "runtime",
          sourceRef: "core-grep",
          pluginId: "core-grep",
          packageRef: null,
          overlayId: null,
          sessionId: null,
        },
        metadata: {
          aliases: ["grep", "search"],
          kind: "file_search",
          source: "builtin",
          tags: ["search"],
        },
      },
    ]);
    const listLiveSkills = vi.fn(async () => [
      {
        id: "core-grep",
        name: "Core Grep",
        description: "Search",
        kind: "file_search",
        source: "builtin",
        version: "1.0.0",
        enabled: false,
        supportsNetwork: false,
        tags: ["core", "search"],
      },
    ]);
    const runLiveSkill = vi.fn(async () => ({
      runId: "live-skill-run-grep-activation",
      skillId: "core-grep",
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
        listRuntimeInvocations,
        listLiveSkills,
        runLiveSkill: runLiveSkill as NonNullable<
          NonNullable<
            Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]
          >["runLiveSkill"]
        >,
      },
    });

    const searchTool = registeredTools.find((tool) => tool.name === "search-workspace-files");
    expect(searchTool).toBeTruthy();
    if (!searchTool) {
      throw new Error("search-workspace-files tool not found");
    }

    await expect(
      Promise.resolve(searchTool.execute({ pattern: "workspaceId" }, null))
    ).resolves.toMatchObject({
      message: "Workspace file search completed.",
    });

    expect(listRuntimeInvocations).toHaveBeenCalled();
    expect(runLiveSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skillId: "core-grep",
      })
    );
  });

  it("lists runtime live skills from activation-backed invocation truth with session overlays", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const listRuntimeInvocations = vi.fn(async (input?: { sessionId?: string | null }) => [
      {
        id: "session.review",
        title: "Session Review",
        version: "1.0.0",
        kind: "skill",
        bindingStage: "session_overlay",
        live: true,
        activationState: "active",
        readiness: {
          state: "ready",
          summary: "Overlay is active.",
          detail: "Live contributions are available now.",
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
          aliases: ["session-review"],
          kind: "skill",
          source: "session_overlay",
          tags: ["review"],
        },
      },
    ]);

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
        listRuntimeInvocations,
      },
    });

    const listSkillsTool = registeredTools.find((tool) => tool.name === "list-runtime-live-skills");
    expect(listSkillsTool).toBeTruthy();
    if (!listSkillsTool) {
      throw new Error("list-runtime-live-skills tool not found");
    }

    await expect(
      Promise.resolve(
        listSkillsTool.execute(
          {
            sessionId: "session-1",
            enabled: true,
            canonicalOnly: true,
          },
          null
        )
      )
    ).resolves.toMatchObject({
      message: "Runtime live skills retrieved.",
      data: {
        total: 1,
        skills: [
          expect.objectContaining({
            id: "session.review",
            acceptedSkillIds: expect.arrayContaining(["session.review", "session-review"]),
          }),
        ],
      },
    });

    expect(listRuntimeInvocations).toHaveBeenCalledWith({
      sessionId: "session-1",
      activeOnly: true,
      kind: "skill",
    });
  });

  it("canonicalizes runtime-only live-skill aliases from the runtime catalog", async () => {
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
      runId: "live-skill-run-grep-1",
      skillId: "core-grep",
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
        listLiveSkills: async () => [
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
            aliases: ["core-grep", "grep", "rg", "search", "ripgrep"],
          },
        ],
        runLiveSkill: runLiveSkill as NonNullable<
          NonNullable<
            Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]
          >["runLiveSkill"]
        >,
      },
    });

    const runLiveSkillTool = registeredTools.find((tool) => tool.name === "run-runtime-live-skill");
    expect(runLiveSkillTool).toBeTruthy();
    if (!runLiveSkillTool) {
      throw new Error("run-runtime-live-skill tool not found");
    }

    await expect(
      Promise.resolve(
        runLiveSkillTool.execute(
          {
            skillId: "ripgrep",
            input: "workspaceId",
            provider: "openai",
            modelId: "gpt-5.3-codex",
          },
          null
        )
      )
    ).resolves.toMatchObject({
      message: "Runtime live skill executed.",
      data: {
        skillResolution: {
          requestedSkillId: "ripgrep",
          resolvedSkillId: "core-grep",
          aliasApplied: true,
          acceptedSkillIds: expect.arrayContaining(["core-grep", "grep", "search", "ripgrep"]),
        },
      },
    });

    expect(runLiveSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skillId: "core-grep",
        input: "workspaceId",
        context: {
          provider: "openai",
          modelId: "gpt-5.3-codex",
        },
      })
    );
  });

  it("uses agent metadata fallback for query-network-analysis context and keeps explicit inputs highest priority", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const runLiveSkill = vi.fn(async (request: Record<string, unknown>) => ({
      runId: "live-skill-run-network-analysis-1",
      skillId: String(request.skillId ?? "network-analysis"),
      status: "completed" as const,
      message: "ok",
      output: "network result",
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
        listLiveSkills: async () => [
          {
            id: "network-analysis",
            name: "Network Analysis",
            description: "Network research",
            kind: "network_analysis",
            source: "builtin",
            version: "1.0.0",
            enabled: true,
            supportsNetwork: true,
            tags: ["network", "research"],
          },
        ],
        runLiveSkill: runLiveSkill as NonNullable<
          NonNullable<
            Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]
          >["runLiveSkill"]
        >,
      },
    });

    const queryNetworkAnalysisTool = registeredTools.find(
      (tool) => tool.name === "query-network-analysis"
    );
    expect(queryNetworkAnalysisTool).toBeTruthy();
    if (!queryNetworkAnalysisTool) {
      throw new Error("query-network-analysis tool not found");
    }

    await Promise.resolve(
      queryNetworkAnalysisTool.execute(
        {
          query: "latest runtime updates",
          provider: "openai",
          modelId: "gpt-5.3-codex",
          maxResults: 3,
          maxCharsPerResult: 1200,
          timeoutMs: 8000,
        },
        null
      )
    );
    expect(runLiveSkill).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        skillId: "network-analysis",
        input: "latest runtime updates",
        context: {
          provider: "openai",
          modelId: "gpt-5.3-codex",
        },
      })
    );

    await Promise.resolve(
      queryNetworkAnalysisTool.execute(
        {
          query: "anthropic policy defaults",
          provider: "anthropic",
        },
        null
      )
    );
    expect(runLiveSkill).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        skillId: "network-analysis",
        input: "anthropic policy defaults",
        context: {
          provider: "anthropic",
        },
      })
    );

    await Promise.resolve(
      queryNetworkAnalysisTool.execute(
        {
          query: "baseline behavior",
        },
        {
          context: {
            provider: " google ",
            model_id: " gemini-2.5-pro ",
          },
        }
      )
    );
    expect(runLiveSkill).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        skillId: "network-analysis",
        input: "baseline behavior",
        context: {
          provider: "google",
          modelId: "gemini-2.5-pro",
        },
      })
    );

    await Promise.resolve(
      queryNetworkAnalysisTool.execute(
        {
          query: "explicit takes precedence",
          provider: "openai",
          modelId: "gpt-5.3-codex",
        },
        {
          provider: "anthropic",
          modelId: "claude-3-7-sonnet",
          context: {
            provider: "google",
            modelId: "gemini-2.5-pro",
          },
        }
      )
    );
    expect(runLiveSkill).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        skillId: "network-analysis",
        input: "explicit takes precedence",
        context: {
          provider: "openai",
          modelId: "gpt-5.3-codex",
        },
      })
    );

    await Promise.resolve(
      queryNetworkAnalysisTool.execute(
        {
          query: "no context fallback",
        },
        null
      )
    );
    const lastCall = runLiveSkill.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;
    expect(lastCall).toEqual(
      expect.objectContaining({
        skillId: "network-analysis",
        input: "no context fallback",
      })
    );
    expect(lastCall).not.toHaveProperty("context");
  });

  it("refreshes stale live-skill availability cache before failing search-workspace-files", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    let grepEnabled = false;
    const listLiveSkills = vi.fn(async () => [
      {
        id: "core-grep",
        name: "Core Grep",
        description: "Search",
        kind: "file_search",
        source: "builtin",
        version: "1.0.0",
        enabled: grepEnabled,
        supportsNetwork: false,
        tags: ["core", "search"],
      },
    ]);
    const runLiveSkill = vi.fn(async () => ({
      runId: "live-skill-run-grep-1",
      skillId: "core-grep",
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
        listLiveSkills,
        runLiveSkill: runLiveSkill as NonNullable<
          NonNullable<
            Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]
          >["runLiveSkill"]
        >,
      },
    });

    const searchTool = registeredTools.find((tool) => tool.name === "search-workspace-files");
    expect(searchTool).toBeTruthy();
    if (!searchTool) {
      throw new Error("search-workspace-files tool not found");
    }

    await expect(
      Promise.resolve(searchTool.execute({ pattern: "workspaceId" }, null))
    ).rejects.toThrow("core-grep live skill is unavailable in this runtime.");

    grepEnabled = true;

    await expect(
      Promise.resolve(searchTool.execute({ pattern: "workspaceId" }, null))
    ).resolves.toMatchObject({
      message: "Workspace file search completed.",
    });

    expect(listLiveSkills).toHaveBeenCalledTimes(3);
    expect(runLiveSkill).toHaveBeenCalledTimes(1);
  });

  it("blocks shell tools when instruction asks for sub-agent orchestration", async () => {
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
        listLiveSkills: async () => [
          {
            id: "core-bash",
            name: "Core Bash",
            description: "Execute shell commands",
            kind: "command",
            source: "builtin",
            version: "1.0.0",
            enabled: true,
            supportsNetwork: false,
            tags: ["core", "shell"],
          },
        ],
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
    let blockedCommandError: unknown = null;
    try {
      await Promise.resolve(
        executeCommandTool.execute(
          {
            command: "enable sub agents and continue this task",
          },
          null
        )
      );
    } catch (error) {
      blockedCommandError = error;
    }
    expect(blockedCommandError).toBeInstanceOf(Error);
    expect(readRuntimeCode(blockedCommandError)).toBe(
      RUNTIME_MESSAGE_CODES.runtime.validation.commandRestricted
    );
    expect((blockedCommandError as Error).message).toContain("blocked shell execution");

    const runLiveSkillTool = registeredTools.find((tool) => tool.name === "run-runtime-live-skill");
    expect(runLiveSkillTool).toBeTruthy();
    if (!runLiveSkillTool) {
      throw new Error("run-runtime-live-skill tool not found");
    }
    let blockedSkillError: unknown = null;
    try {
      await Promise.resolve(
        runLiveSkillTool.execute(
          {
            skillId: "core-bash",
            input: "spawn sub agents and run in parallel",
            provider: "anthropic",
            modelId: "claude-3-7-sonnet",
          },
          null
        )
      );
    } catch (error) {
      blockedSkillError = error;
    }
    expect(blockedSkillError).toBeInstanceOf(Error);
    expect(readRuntimeCode(blockedSkillError)).toBe(
      RUNTIME_MESSAGE_CODES.runtime.validation.commandRestricted
    );
    expect((blockedSkillError as Error).message).toContain("blocked shell execution");

    expect(runLiveSkill).not.toHaveBeenCalled();
    const metrics = readRuntimeToolExecutionMetrics();
    expect(metrics.totals.blockedTotal).toBeGreaterThanOrEqual(2);
    expect(Object.values(metrics.byTool)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolName: "execute-workspace-command",
          scope: "runtime",
          blockedTotal: expect.any(Number),
        }),
        expect.objectContaining({
          toolName: "run-runtime-live-skill",
          scope: "runtime",
          blockedTotal: expect.any(Number),
        }),
      ])
    );
  });

  it("rejects command passthrough for run-runtime-computer-observe", async () => {
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
      skillId: "core-computer-observe",
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
        listLiveSkills: async () => [
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
        ],
        runLiveSkill: runLiveSkill as NonNullable<
          NonNullable<
            Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]
          >["runLiveSkill"]
        >,
      },
    });

    const runComputerObserveTool = registeredTools.find(
      (tool) => tool.name === "run-runtime-computer-observe"
    );
    expect(runComputerObserveTool).toBeTruthy();
    if (!runComputerObserveTool) {
      throw new Error("run-runtime-computer-observe tool not found");
    }

    let blockedPassthroughError: unknown = null;
    try {
      await Promise.resolve(
        runComputerObserveTool.execute(
          {
            command: "xdotool getactivewindow",
            query: "window status",
          },
          null
        )
      );
    } catch (error) {
      blockedPassthroughError = error;
    }
    expect(blockedPassthroughError).toBeInstanceOf(Error);
    expect(readRuntimeCode(blockedPassthroughError)).toBe(
      RUNTIME_MESSAGE_CODES.runtime.validation.commandRestricted
    );
    expect((blockedPassthroughError as Error).message).toContain(
      "command passthrough is not supported"
    );
    expect(runLiveSkill).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("uses agent metadata fallback for run-runtime-computer-observe and keeps explicit inputs highest priority", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const runLiveSkill = vi.fn(async (request: Record<string, unknown>) => ({
      runId: "live-skill-run-observe-context-1",
      skillId: String(request.skillId ?? "core-computer-observe"),
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
        listLiveSkills: async () => [
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
        ],
        runLiveSkill: runLiveSkill as NonNullable<
          NonNullable<
            Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]
          >["runLiveSkill"]
        >,
      },
    });

    const runComputerObserveTool = registeredTools.find(
      (tool) => tool.name === "run-runtime-computer-observe"
    );
    expect(runComputerObserveTool).toBeTruthy();
    if (!runComputerObserveTool) {
      throw new Error("run-runtime-computer-observe tool not found");
    }

    await Promise.resolve(
      runComputerObserveTool.execute(
        {
          query: "toolbar status",
        },
        {
          model: {
            provider: "openai",
            id: "gpt-5.3-codex",
          },
        }
      )
    );
    expect(runLiveSkill).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        skillId: "core-computer-observe",
        context: {
          provider: "openai",
          modelId: "gpt-5.3-codex",
        },
      })
    );

    await Promise.resolve(
      runComputerObserveTool.execute(
        {
          query: "notifications panel",
          provider: "anthropic",
          modelId: "claude-3-7-sonnet",
        },
        {
          provider: "openai",
          modelId: "gpt-5.3-codex",
          context: {
            provider: "google",
            modelId: "gemini-2.5-pro",
          },
        }
      )
    );
    expect(runLiveSkill).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        skillId: "core-computer-observe",
        context: {
          provider: "anthropic",
          modelId: "claude-3-7-sonnet",
        },
      })
    );

    await Promise.resolve(
      runComputerObserveTool.execute(
        {
          query: "status bar",
        },
        null
      )
    );
    const thirdCall = runLiveSkill.mock.calls.at(2)?.[0] as Record<string, unknown> | undefined;
    expect(thirdCall).not.toHaveProperty("context");
  });

  it("surfaces blocked computer observe capability negotiation from runtime", async () => {
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
      skillId: "core-computer-observe",
      status: "blocked" as const,
      message: "Computer observe is disabled by runtime policy.",
      output: "",
      network: null,
      artifacts: [],
      metadata: {
        reason: "capability_unavailable",
        errorCode: RUNTIME_MESSAGE_CODES.runtime.validation.requestBlocked,
      },
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
        listLiveSkills: async () => [
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
        ],
        runLiveSkill: runLiveSkill as NonNullable<
          NonNullable<
            Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]
          >["runLiveSkill"]
        >,
      },
    });

    const runComputerObserveTool = registeredTools.find(
      (tool) => tool.name === "run-runtime-computer-observe"
    );
    expect(runComputerObserveTool).toBeTruthy();
    if (!runComputerObserveTool) {
      throw new Error("run-runtime-computer-observe tool not found");
    }

    let blockedError: unknown = null;
    try {
      await Promise.resolve(
        runComputerObserveTool.execute(
          {
            query: "toolbar status",
          },
          null
        )
      );
    } catch (error) {
      blockedError = error;
    }

    expect(runLiveSkill).toHaveBeenCalledTimes(1);
    expect(blockedError).toBeInstanceOf(Error);
    expect(readRuntimeCode(blockedError)).toBe(
      RUNTIME_MESSAGE_CODES.runtime.validation.requestBlocked
    );
    expect((blockedError as Error).message).toContain("disabled by runtime policy");
  });

  it("blocks workspace path traversal before runtime live skill execution", async () => {
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
      skillId: "core-write",
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
          totals: {
            attemptedTotal: 0,
            startedTotal: 0,
            completedTotal: 0,
            successTotal: 0,
            validationFailedTotal: 0,
            runtimeFailedTotal: 0,
            timeoutTotal: 0,
            blockedTotal: 0,
          },
          byTool: {},
          recent: [],
          updatedAt: Date.now(),
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

    const writeTool = registeredTools.find((tool) => tool.name === "write-workspace-file");
    expect(writeTool).toBeTruthy();
    if (!writeTool) {
      throw new Error("write-workspace-file tool not found");
    }

    let traversalError: unknown = null;
    try {
      await Promise.resolve(
        writeTool.execute(
          {
            path: "../secrets.txt",
            content: "unsafe",
          },
          null
        )
      );
    } catch (error) {
      traversalError = error;
    }
    expect(traversalError).toBeInstanceOf(Error);
    expect(readRuntimeCode(traversalError)).toBe(
      RUNTIME_MESSAGE_CODES.runtime.validation.pathOutsideWorkspace
    );
    expect(runLiveSkill).not.toHaveBeenCalled();
  });

  it("blocks dangerous runtime shell commands and oversized write payloads", async () => {
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
          totals: {
            attemptedTotal: 0,
            startedTotal: 0,
            completedTotal: 0,
            successTotal: 0,
            validationFailedTotal: 0,
            runtimeFailedTotal: 0,
            timeoutTotal: 0,
            blockedTotal: 0,
          },
          byTool: {},
          recent: [],
          updatedAt: Date.now(),
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

    const commandTool = registeredTools.find((tool) => tool.name === "execute-workspace-command");
    expect(commandTool).toBeTruthy();
    if (!commandTool) {
      throw new Error("execute-workspace-command tool not found");
    }
    await expect(
      Promise.resolve(commandTool.execute({ command: "rm -rf /" }, null))
    ).rejects.toMatchObject({
      code: RUNTIME_MESSAGE_CODES.runtime.validation.commandRestricted,
    });

    const writeTool = registeredTools.find((tool) => tool.name === "write-workspace-file");
    expect(writeTool).toBeTruthy();
    if (!writeTool) {
      throw new Error("write-workspace-file tool not found");
    }
    const oversizedContent = "x".repeat(512 * 1024 + 32);
    await expect(
      Promise.resolve(
        writeTool.execute(
          {
            path: "notes/oversized.txt",
            content: oversizedContent,
          },
          null
        )
      )
    ).rejects.toMatchObject({
      code: RUNTIME_MESSAGE_CODES.runtime.validation.payloadTooLargeStrict,
    });
    expect(runLiveSkill).not.toHaveBeenCalled();
  });

  it("supports execute-workspace-command dry-run without running live skill", async () => {
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
        listLiveSkills: async () => [
          {
            id: "js_repl",
            name: "JS REPL",
            description: "Execute JavaScript",
            kind: "javascript_repl",
            source: "builtin",
            version: "1.0.0",
            enabled: true,
            supportsNetwork: false,
            tags: ["core", "javascript", "node"],
          },
        ],
        runLiveSkill: runLiveSkill as NonNullable<
          NonNullable<
            Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]
          >["runLiveSkill"]
        >,
      },
    });

    const commandTool = registeredTools.find((tool) => tool.name === "execute-workspace-command");
    expect(commandTool).toBeTruthy();
    if (!commandTool) {
      throw new Error("execute-workspace-command tool not found");
    }

    const response = await Promise.resolve(
      commandTool.execute(
        {
          command: "pnpm test",
          dryRun: true,
        },
        null
      )
    );

    expect(runLiveSkill).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      message: "Workspace command dry-run prepared.",
      data: {
        workspaceId: snapshot.workspaceId,
        result: {
          metadata: {
            dryRun: true,
            command: "pnpm test",
          },
        },
      },
    });
  });

  it("supports workspace write/edit dry-run without running live skills", async () => {
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
      skillId: "core-write",
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

    const writeTool = registeredTools.find((tool) => tool.name === "write-workspace-file");
    expect(writeTool).toBeTruthy();
    if (!writeTool) {
      throw new Error("write-workspace-file tool not found");
    }
    const writeResponse = await Promise.resolve(
      writeTool.execute(
        {
          path: "notes/draft.md",
          content: "hello",
          dryRun: true,
        },
        null
      )
    );
    expect(writeResponse).toMatchObject({
      message: "Workspace file write dry-run prepared.",
      data: {
        workspaceId: snapshot.workspaceId,
        result: {
          metadata: {
            dryRun: true,
            path: "notes/draft.md",
          },
        },
      },
    });

    const editTool = registeredTools.find((tool) => tool.name === "edit-workspace-file");
    expect(editTool).toBeTruthy();
    if (!editTool) {
      throw new Error("edit-workspace-file tool not found");
    }
    const editResponse = await Promise.resolve(
      editTool.execute(
        {
          path: "notes/draft.md",
          find: "hello",
          replace: "hi",
          dryRun: true,
        },
        null
      )
    );
    expect(editResponse).toMatchObject({
      message: "Workspace file edit dry-run prepared.",
      data: {
        workspaceId: snapshot.workspaceId,
        result: {
          metadata: {
            dryRun: true,
            path: "notes/draft.md",
            find: "hello",
          },
        },
      },
    });

    expect(runLiveSkill).not.toHaveBeenCalled();
  });

  it("bypasses approval prompts for workspace dry-run operations", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const onApprovalRequest = vi.fn(async () => false);
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
      requireUserApproval: true,
      onApprovalRequest,
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

    const commandTool = registeredTools.find((tool) => tool.name === "execute-workspace-command");
    expect(commandTool).toBeTruthy();
    if (!commandTool) {
      throw new Error("execute-workspace-command tool not found");
    }
    await expect(
      Promise.resolve(
        commandTool.execute(
          {
            command: "pnpm test",
            dryRun: true,
          },
          null
        )
      )
    ).resolves.toMatchObject({
      message: "Workspace command dry-run prepared.",
    });

    const writeTool = registeredTools.find((tool) => tool.name === "write-workspace-file");
    expect(writeTool).toBeTruthy();
    if (!writeTool) {
      throw new Error("write-workspace-file tool not found");
    }
    await expect(
      Promise.resolve(
        writeTool.execute(
          {
            path: "notes/draft.md",
            content: "hello",
            dryRun: true,
          },
          null
        )
      )
    ).resolves.toMatchObject({
      message: "Workspace file write dry-run prepared.",
    });

    expect(onApprovalRequest).not.toHaveBeenCalled();
    expect(runLiveSkill).not.toHaveBeenCalled();
  });

  it("canonicalizes js_repl live-skill aliases and requires approval", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const onApprovalRequest = vi.fn(async () => true);
    const runLiveSkill = vi.fn(async () => ({
      runId: "live-skill-run-js-repl-1",
      skillId: "core-js-repl",
      status: "completed" as const,
      message: "ok",
      output: "done",
      network: null,
      artifacts: [
        {
          kind: "image" as const,
          mimeType: "image/png",
          dataBase64: "YWJj",
        },
      ],
      metadata: {},
    }));

    await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: true,
      onApprovalRequest,
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

    const runLiveSkillTool = registeredTools.find((tool) => tool.name === "run-runtime-live-skill");
    expect(runLiveSkillTool).toBeTruthy();
    if (!runLiveSkillTool) {
      throw new Error("run-runtime-live-skill tool not found");
    }

    await expect(
      Promise.resolve(
        runLiveSkillTool.execute(
          {
            skillId: "js_repl",
            input: "console.log('ok')",
          },
          null
        )
      )
    ).resolves.toMatchObject({
      message: "Runtime live skill executed.",
      data: {
        result: {
          artifacts: [
            expect.objectContaining({
              kind: "image",
              mimeType: "image/png",
            }),
          ],
        },
        skillResolution: {
          requestedSkillId: "js_repl",
          resolvedSkillId: "core-js-repl",
          aliasApplied: true,
          acceptedSkillIds: expect.arrayContaining(["core-js-repl", "js_repl"]),
        },
      },
    });

    expect(onApprovalRequest).toHaveBeenCalledTimes(1);
    expect(onApprovalRequest).toHaveBeenCalledWith(
      "Run runtime live skill core-js-repl in workspace-one? This approval also covers nested codex.tool(...) calls in that REPL session."
    );
    expect(runLiveSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skillId: "core-js-repl",
        input: "console.log('ok')",
      })
    );
  });

  it("canonicalizes js_repl_reset live-skill aliases without write approval", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const onApprovalRequest = vi.fn(async () => true);
    const runLiveSkill = vi.fn(async () => ({
      runId: "live-skill-run-js-repl-reset-1",
      skillId: "core-js-repl-reset",
      status: "completed" as const,
      message: "reset",
      output: "",
      network: null,
      artifacts: [],
      metadata: {},
    }));

    await syncWebMcpAgentControl({
      enabled: true,
      readOnlyMode: false,
      requireUserApproval: true,
      onApprovalRequest,
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

    const runLiveSkillTool = registeredTools.find((tool) => tool.name === "run-runtime-live-skill");
    expect(runLiveSkillTool).toBeTruthy();
    if (!runLiveSkillTool) {
      throw new Error("run-runtime-live-skill tool not found");
    }

    await expect(
      Promise.resolve(
        runLiveSkillTool.execute(
          {
            skillId: "js_repl_reset",
            input: "",
          },
          null
        )
      )
    ).resolves.toMatchObject({
      message: "Runtime live skill executed.",
    });

    expect(onApprovalRequest).not.toHaveBeenCalled();
    expect(runLiveSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skillId: "core-js-repl-reset",
      })
    );
  });

  it("runs live skills through runtime-discovered aliases from the live-skill catalog", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const runLiveSkill = vi.fn(async (request: Record<string, unknown>) => ({
      runId: "live-skill-run-runtime-alias-1",
      skillId: String(request.skillId ?? "core-grep"),
      status: "completed" as const,
      message: "searched",
      output: "match",
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
        listLiveSkills: async () => [
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
        ],
        runLiveSkill: runLiveSkill as NonNullable<
          NonNullable<
            Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]
          >["runLiveSkill"]
        >,
      },
    });

    const runLiveSkillTool = registeredTools.find((tool) => tool.name === "run-runtime-live-skill");
    expect(runLiveSkillTool).toBeTruthy();
    if (!runLiveSkillTool) {
      throw new Error("run-runtime-live-skill tool not found");
    }

    await expect(
      Promise.resolve(
        runLiveSkillTool.execute(
          {
            skillId: "project-search",
            input: "workspaceId",
          },
          null
        )
      )
    ).resolves.toMatchObject({
      message: "Runtime live skill executed.",
      data: {
        skillResolution: {
          requestedSkillId: "project-search",
          resolvedSkillId: "core-grep",
          aliasApplied: true,
          acceptedSkillIds: expect.arrayContaining(["core-grep", "project-search"]),
        },
      },
    });

    expect(runLiveSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skillId: "core-grep",
        input: "workspaceId",
      })
    );
    const lastCall = runLiveSkill.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;
    expect(lastCall).not.toHaveProperty("context");
  });

  it("uses agent metadata fallback for run-runtime-live-skill and preserves explicit context precedence", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const runLiveSkill = vi.fn(async (request: Record<string, unknown>) => ({
      runId: "live-skill-run-context-forward-1",
      skillId: String(request.skillId ?? "core-grep"),
      status: "completed" as const,
      message: "ok",
      output: "done",
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
        listLiveSkills: async () => [
          {
            id: "research-orchestrator",
            name: "Research Orchestrator",
            description: "Deep research",
            kind: "research",
            source: "builtin",
            version: "1.0.0",
            enabled: true,
            supportsNetwork: true,
            tags: ["research"],
            aliases: ["research"],
          },
          {
            id: "network-analysis",
            name: "Network Analysis",
            description: "Network search",
            kind: "network_analysis",
            source: "builtin",
            version: "1.0.0",
            enabled: true,
            supportsNetwork: true,
            tags: ["network"],
          },
        ],
        runLiveSkill: runLiveSkill as NonNullable<
          NonNullable<
            Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]
          >["runLiveSkill"]
        >,
      },
    });

    const runLiveSkillTool = registeredTools.find((tool) => tool.name === "run-runtime-live-skill");
    expect(runLiveSkillTool).toBeTruthy();
    if (!runLiveSkillTool) {
      throw new Error("run-runtime-live-skill tool not found");
    }

    await Promise.resolve(
      runLiveSkillTool.execute(
        {
          skillId: "research",
          input: "audit runtime policy consistency",
        },
        {
          model: {
            provider: "openai",
            id: "gpt-5.3-codex",
          },
        }
      )
    );
    expect(runLiveSkill).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        skillId: "research-orchestrator",
        context: {
          provider: "openai",
          modelId: "gpt-5.3-codex",
        },
      })
    );

    await Promise.resolve(
      runLiveSkillTool.execute(
        {
          skillId: "network-analysis",
          input: "find fresh runtime announcements",
          provider: "anthropic",
          modelId: "claude-3-7-sonnet",
        },
        {
          provider: "openai",
          modelId: "gpt-5.3-codex",
          context: {
            provider: "google",
            modelId: "gemini-2.5-pro",
          },
        }
      )
    );
    expect(runLiveSkill).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        skillId: "network-analysis",
        context: {
          provider: "anthropic",
          modelId: "claude-3-7-sonnet",
        },
      })
    );
  });

  it("skips runtime guardrail evaluation for dry-run workspace operations", async () => {
    let registeredTools: Array<{
      name: string;
      execute: (input: Record<string, unknown>, agent: unknown) => unknown;
    }> = [];

    setModelContext({
      provideContext: (payload) => {
        registeredTools = payload.tools as typeof registeredTools;
      },
    });

    const evaluateSpy = vi.fn(async () => ({
      allowed: true,
      blockReason: null,
      errorCode: null,
      message: null,
      channelHealth: {
        status: "healthy" as const,
        reason: null,
        lastErrorCode: null,
        updatedAt: Date.now(),
      },
      circuitBreaker: null,
      updatedAt: Date.now(),
    }));
    __setRuntimeToolGuardrailEvaluateOverrideForTests(evaluateSpy);

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

    const commandTool = registeredTools.find((tool) => tool.name === "execute-workspace-command");
    expect(commandTool).toBeTruthy();
    if (!commandTool) {
      throw new Error("execute-workspace-command tool not found");
    }
    await Promise.resolve(
      commandTool.execute(
        {
          command: "pnpm test",
          dryRun: true,
        },
        null
      )
    );

    const writeTool = registeredTools.find((tool) => tool.name === "write-workspace-file");
    expect(writeTool).toBeTruthy();
    if (!writeTool) {
      throw new Error("write-workspace-file tool not found");
    }
    await Promise.resolve(
      writeTool.execute(
        {
          path: "notes/draft.md",
          content: "hello",
          dryRun: true,
        },
        null
      )
    );

    const editTool = registeredTools.find((tool) => tool.name === "edit-workspace-file");
    expect(editTool).toBeTruthy();
    if (!editTool) {
      throw new Error("edit-workspace-file tool not found");
    }
    await Promise.resolve(
      editTool.execute(
        {
          path: "notes/draft.md",
          find: "hello",
          replace: "hi",
          dryRun: true,
        },
        null
      )
    );

    expect(evaluateSpy).toHaveBeenCalledTimes(0);
  });

  it("blocks payloads over reliability gate limit with strict payload-too-large code", async () => {
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
    __setRuntimeToolGuardrailEvaluateOverrideForTests(async (request) => {
      if (request.toolName === "set-user-intent" && request.payloadBytes > 64 * 1024) {
        return {
          allowed: false,
          blockReason: "payload_too_large",
          errorCode: RUNTIME_MESSAGE_CODES.runtime.validation.payloadTooLargeStrict,
          message: "Payload exceeds runtime guardrail size limit.",
          effectivePayloadLimitBytes: 65_536,
          effectiveComputerObserveRateLimitPerMinute: 12,
          channelHealth: {
            status: "healthy",
            reason: null,
            lastErrorCode: null,
            updatedAt: Date.now(),
          },
          circuitBreaker: null,
          updatedAt: Date.now(),
        };
      }
      return {
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
      };
    });

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
      Promise.resolve(
        intentTool.execute(
          {
            managerNotes: "x".repeat(70_000),
          },
          null
        )
      )
    ).rejects.toMatchObject({
      code: RUNTIME_MESSAGE_CODES.runtime.validation.payloadTooLargeStrict,
      message:
        "Payload exceeds runtime guardrail size limit. (effective limits: payload<=65536B, computer_observe<=12/min)",
    });

    expect(setIntentPatch).not.toHaveBeenCalled();
  });

  it("rate-limits runtime computer observe tool by workspace", async () => {
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
      skillId: "core-computer-observe",
      status: "completed" as const,
      message: "ok",
      output: "",
      network: null,
      artifacts: [],
      metadata: {},
    }));
    const workspaceCounters = new Map<string, number>();
    __setRuntimeToolGuardrailEvaluateOverrideForTests(async (request) => {
      if (request.toolName !== "run-runtime-computer-observe") {
        return {
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
        };
      }
      const workspaceId =
        typeof request.workspaceId === "string" && request.workspaceId.trim().length > 0
          ? request.workspaceId
          : "<global>";
      const currentCount = workspaceCounters.get(workspaceId) ?? 0;
      const nextCount = currentCount + 1;
      workspaceCounters.set(workspaceId, nextCount);
      if (nextCount > 12) {
        return {
          allowed: false,
          blockReason: "rate_limited",
          errorCode: RUNTIME_MESSAGE_CODES.runtime.validation.rateLimited,
          message: "Runtime guardrail rate limit exceeded.",
          channelHealth: {
            status: "healthy",
            reason: null,
            lastErrorCode: null,
            updatedAt: Date.now(),
          },
          circuitBreaker: null,
          updatedAt: Date.now(),
        };
      }
      return {
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
      };
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
        listLiveSkills: async () => [
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
        ],
        runLiveSkill: runLiveSkill as NonNullable<
          NonNullable<
            Parameters<typeof syncWebMcpAgentControl>[0]["runtimeControl"]
          >["runLiveSkill"]
        >,
      },
    });

    const runComputerObserveTool = registeredTools.find(
      (tool) => tool.name === "run-runtime-computer-observe"
    );
    expect(runComputerObserveTool).toBeTruthy();
    if (!runComputerObserveTool) {
      throw new Error("run-runtime-computer-observe tool not found");
    }

    for (let index = 0; index < 12; index += 1) {
      await expect(
        Promise.resolve(
          runComputerObserveTool.execute(
            {
              workspaceId: "ws-1",
              query: `probe-${index}`,
            },
            null
          )
        )
      ).resolves.toBeTruthy();
    }

    await expect(
      Promise.resolve(
        runComputerObserveTool.execute(
          {
            workspaceId: "ws-1",
            query: "probe-overflow",
          },
          null
        )
      )
    ).rejects.toMatchObject({
      code: RUNTIME_MESSAGE_CODES.runtime.validation.rateLimited,
    });
    expect(runLiveSkill).toHaveBeenCalledTimes(12);
  });

  it("opens reliability circuit when recent runtime success rate drops below threshold", async () => {
    __setRuntimeToolGuardrailEvaluateOverrideForTests(async (request) => {
      if (request.toolName === "run-runtime-live-skill") {
        return {
          allowed: false,
          blockReason: "circuit_open",
          errorCode: RUNTIME_MESSAGE_CODES.runtime.validation.circuitOpen,
          message: "Runtime guardrail circuit is open.",
          channelHealth: {
            status: "healthy",
            reason: null,
            lastErrorCode: null,
            updatedAt: Date.now(),
          },
          circuitBreaker: {
            scope: "runtime",
            state: "open",
            openedAt: Date.now(),
            openUntil: Date.now() + 600_000,
            halfOpenProbeCount: 0,
            halfOpenSuccessCount: 0,
            updatedAt: Date.now(),
          },
          updatedAt: Date.now(),
        };
      }
      return {
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
      };
    });

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

    const runLiveSkillTool = registeredTools.find((tool) => tool.name === "run-runtime-live-skill");
    expect(runLiveSkillTool).toBeTruthy();
    if (!runLiveSkillTool) {
      throw new Error("run-runtime-live-skill tool not found");
    }

    await expect(
      Promise.resolve(
        runLiveSkillTool.execute(
          {
            skillId: "core-bash",
            input: "echo hello",
          },
          null
        )
      )
    ).rejects.toMatchObject({
      code: RUNTIME_MESSAGE_CODES.runtime.validation.circuitOpen,
    });
    expect(runLiveSkill).not.toHaveBeenCalled();
  });
});
