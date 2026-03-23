import { describe, expect, it, vi } from "vitest";
import type { RuntimeBrowserDebugRunResponse } from "@ku0/code-runtime-host-contract";
import { buildRuntimeBrowserTools } from "./webMcpBridgeRuntimeBrowserTools";
import { createAgentCommandCenterSnapshot } from "./webMcpBridgeRuntimeTestUtils";

function createSnapshot() {
  return createAgentCommandCenterSnapshot({
    workspaceId: "ws-browser",
    workspaceName: "browser-workspace",
    intent: {
      objective: "debug browser",
    },
    governance: {
      policy: {
        terminateOverdueDays: 7,
      },
    },
  });
}

describe("webMcpBridgeRuntimeBrowserTools", () => {
  it("registers runtime browser adapter tools and forwards inspect requests without approval", async () => {
    const getRuntimeBrowserDebugStatus = vi.fn(async () => ({
      workspaceId: "ws-browser",
      available: true,
      mode: "mcp-playwright",
      status: "ready",
      tools: [{ name: "browser_snapshot", description: "Snapshot", readOnly: true }],
      warnings: [],
    }));
    const runRuntimeBrowserDebug = vi.fn(
      async (): Promise<RuntimeBrowserDebugRunResponse> => ({
        workspaceId: "ws-browser",
        available: true,
        status: "completed",
        mode: "mcp-playwright",
        operation: "inspect",
        message: "Browser inspection completed.",
        toolCalls: [{ toolName: "browser_snapshot", ok: true }],
        contentText: "snapshot text",
        structuredContent: { url: "https://example.com" },
        artifacts: [],
        warnings: [],
      })
    );
    const confirmWriteAction = vi.fn(async () => undefined);
    const tools = buildRuntimeBrowserTools({
      snapshot: createSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        getRuntimeBrowserDebugStatus,
        runRuntimeBrowserDebug,
      },
      requireUserApproval: true,
      helpers: {
        buildResponse: (message, data) => ({ ok: true, message, data }),
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        toStringArray: () => [],
        toPositiveInteger: (value) =>
          typeof value === "number" && Number.isFinite(value) && value > 0
            ? Math.trunc(value)
            : null,
        normalizeRuntimeTaskStatus: () => null,
        normalizeRuntimeStepKind: () => "read",
        normalizeRuntimeExecutionMode: () => "single",
        normalizeRuntimeAccessMode: () => "on-request",
        normalizeRuntimeReasonEffort: () => null,
        confirmWriteAction,
      },
    });

    expect(tools.map((tool) => tool.name)).toEqual([
      "get-runtime-browser-debug-status",
      "inspect-runtime-browser",
      "run-runtime-browser-automation",
      "run-chatgpt-decision-lab",
    ]);

    const statusTool = tools.find((tool) => tool.name === "get-runtime-browser-debug-status");
    const inspectTool = tools.find((tool) => tool.name === "inspect-runtime-browser");
    expect(statusTool?.annotations?.readOnlyHint).toBe(true);
    expect(inspectTool?.annotations?.readOnlyHint).toBe(true);

    const inspectResponse = await inspectTool?.execute(
      {
        prompt: "Inspect current page",
        includeScreenshot: true,
        timeoutMs: 8_000,
      },
      null
    );

    expect(runRuntimeBrowserDebug).toHaveBeenCalledWith({
      workspaceId: "ws-browser",
      operation: "inspect",
      prompt: "Inspect current page",
      includeScreenshot: true,
      timeoutMs: 8_000,
      steps: null,
    });
    expect(confirmWriteAction).not.toHaveBeenCalled();
    expect(inspectResponse).toMatchObject({
      ok: true,
      message: "Runtime browser inspection completed.",
      data: {
        result: expect.objectContaining({
          operation: "inspect",
          contentText: "snapshot text",
        }),
      },
    });
  });

  it("requires approval for browser automation and forwards ordered tool calls", async () => {
    const runRuntimeBrowserDebug = vi.fn(
      async (): Promise<RuntimeBrowserDebugRunResponse> => ({
        workspaceId: "ws-browser",
        available: true,
        status: "completed",
        mode: "mcp-playwright",
        operation: "automation",
        message: "Browser automation completed.",
        toolCalls: [
          { toolName: "browser_navigate", ok: true },
          { toolName: "browser_snapshot", ok: true },
        ],
        contentText: "navigated",
        structuredContent: null,
        artifacts: [
          {
            kind: "image",
            title: "Viewport",
            mimeType: "image/png",
            dataBase64: "abc123",
          },
        ],
        warnings: [],
      })
    );
    const confirmWriteAction = vi.fn(async () => undefined);
    const tools = buildRuntimeBrowserTools({
      snapshot: createSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        getRuntimeBrowserDebugStatus: vi.fn(async () => ({
          workspaceId: "ws-browser",
          available: true,
          mode: "mcp-playwright",
          status: "ready",
          tools: [],
          warnings: [],
        })),
        runRuntimeBrowserDebug,
      },
      requireUserApproval: true,
      onApprovalRequest: vi.fn(async () => true),
      helpers: {
        buildResponse: (message, data) => ({ ok: true, message, data }),
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        toStringArray: () => [],
        toPositiveInteger: (value) =>
          typeof value === "number" && Number.isFinite(value) && value > 0
            ? Math.trunc(value)
            : null,
        normalizeRuntimeTaskStatus: () => null,
        normalizeRuntimeStepKind: () => "read",
        normalizeRuntimeExecutionMode: () => "single",
        normalizeRuntimeAccessMode: () => "on-request",
        normalizeRuntimeReasonEffort: () => null,
        confirmWriteAction,
      },
    });

    const automationTool = tools.find((tool) => tool.name === "run-runtime-browser-automation");
    expect(automationTool?.annotations?.openWorldHint).toBe(true);

    const response = await automationTool?.execute(
      {
        steps: [
          { toolName: "browser_navigate", arguments: { url: "https://example.com" } },
          { toolName: "browser_snapshot", arguments: {} },
        ],
        timeoutMs: 12_000,
      },
      null
    );

    expect(confirmWriteAction).toHaveBeenCalledTimes(1);
    expect(runRuntimeBrowserDebug).toHaveBeenCalledWith({
      workspaceId: "ws-browser",
      operation: "automation",
      prompt: null,
      includeScreenshot: false,
      timeoutMs: 12_000,
      steps: [
        { toolName: "browser_navigate", arguments: { url: "https://example.com" } },
        { toolName: "browser_snapshot", arguments: {} },
      ],
    });
    expect(response).toMatchObject({
      ok: true,
      message: "Runtime browser automation completed.",
      data: {
        result: expect.objectContaining({
          operation: "automation",
          toolCalls: [
            { toolName: "browser_navigate", ok: true },
            { toolName: "browser_snapshot", ok: true },
          ],
        }),
      },
    });
  });

  it("registers the ChatGPT decision-lab tool and forwards structured requests through Chrome DevTools MCP", async () => {
    const runRuntimeBrowserDebug = vi.fn(
      async (): Promise<RuntimeBrowserDebugRunResponse> => ({
        workspaceId: "ws-browser",
        available: true,
        status: "completed",
        mode: "mcp-chrome-devtools",
        operation: "chatgpt_decision_lab",
        message: "ChatGPT decision lab completed.",
        toolCalls: [{ toolName: "evaluate_script", ok: true }],
        contentText: "decision lab raw response",
        structuredContent: null,
        artifacts: [],
        warnings: [],
        decisionLab: {
          recommendedOptionId: "candidate-2",
          recommendedOption: "Stabilize the route before widening scope.",
          alternativeOptionIds: ["candidate-1"],
          decisionMemo: "Candidate 2 preserves route confidence with lower regression risk.",
          confidence: "high",
          assumptions: ["Representative validation remains available."],
          followUpQuestions: ["Should publish work stay out of this iteration?"],
        },
      })
    );
    const confirmWriteAction = vi.fn(async () => undefined);
    const tools = buildRuntimeBrowserTools({
      snapshot: createSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        getRuntimeBrowserDebugStatus: vi.fn(async () => ({
          workspaceId: "ws-browser",
          available: true,
          mode: "mcp-chrome-devtools",
          status: "ready",
          tools: [],
          warnings: [],
        })),
        runRuntimeBrowserDebug,
      },
      requireUserApproval: true,
      onApprovalRequest: vi.fn(async () => true),
      helpers: {
        buildResponse: (message, data) => ({ ok: true, message, data }),
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        toStringArray: (value) =>
          Array.isArray(value)
            ? value.filter((entry): entry is string => typeof entry === "string")
            : [],
        toPositiveInteger: (value) =>
          typeof value === "number" && Number.isFinite(value) && value > 0
            ? Math.trunc(value)
            : null,
        normalizeRuntimeTaskStatus: () => null,
        normalizeRuntimeStepKind: () => "read",
        normalizeRuntimeExecutionMode: () => "single",
        normalizeRuntimeAccessMode: () => "on-request",
        normalizeRuntimeReasonEffort: () => null,
        confirmWriteAction,
      },
    });

    const decisionLabTool = tools.find((tool) => tool.name === "run-chatgpt-decision-lab");
    expect(decisionLabTool?.annotations?.openWorldHint).toBe(true);

    const response = await decisionLabTool?.execute(
      {
        question: "Which route should AutoDrive choose for this iteration?",
        options: [
          {
            id: "candidate-1",
            label: "Advance the primary surface",
            summary: "Move the active waypoint immediately.",
          },
          {
            id: "candidate-2",
            label: "Stabilize the route",
            summary: "Tighten validation and preserve confidence before widening scope.",
          },
        ],
        constraints: ["Do not widen scope", "Keep runtime boundaries intact"],
        timeoutMs: 18_000,
      },
      null
    );

    expect(confirmWriteAction).toHaveBeenCalledTimes(1);
    expect(runRuntimeBrowserDebug).toHaveBeenCalledWith({
      workspaceId: "ws-browser",
      operation: "chatgpt_decision_lab",
      prompt: null,
      includeScreenshot: false,
      timeoutMs: 18_000,
      steps: null,
      decisionLab: {
        question: "Which route should AutoDrive choose for this iteration?",
        options: [
          {
            id: "candidate-1",
            label: "Advance the primary surface",
            summary: "Move the active waypoint immediately.",
          },
          {
            id: "candidate-2",
            label: "Stabilize the route",
            summary: "Tighten validation and preserve confidence before widening scope.",
          },
        ],
        constraints: ["Do not widen scope", "Keep runtime boundaries intact"],
        allowLiveWebResearch: false,
        chatgptUrl: null,
      },
    });
    expect(response).toMatchObject({
      ok: true,
      message: "ChatGPT decision lab completed.",
      data: {
        result: expect.objectContaining({
          operation: "chatgpt_decision_lab",
          decisionLab: expect.objectContaining({
            recommendedOptionId: "candidate-2",
            confidence: "high",
          }),
        }),
      },
    });
  });
});
