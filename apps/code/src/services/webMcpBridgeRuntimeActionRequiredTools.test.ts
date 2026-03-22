import { describe, expect, it, vi } from "vitest";
import { buildRuntimeActionRequiredTools } from "./webMcpBridgeRuntimeActionRequiredTools";
import { createAgentCommandCenterSnapshot } from "./webMcpBridgeRuntimeTestUtils";

function createHelpers() {
  return {
    buildResponse: (message: string, data: Record<string, unknown>) => ({
      ok: true,
      message,
      data,
    }),
    toNonEmptyString: (value: unknown) =>
      typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
    toPositiveInteger: (value: unknown) =>
      typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : null,
    toStringArray: (value: unknown) =>
      Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === "string")
        : [],
    normalizeRuntimeTaskStatus: vi.fn(),
    normalizeRuntimeStepKind: vi.fn(),
    normalizeRuntimeExecutionMode: vi.fn(),
    normalizeRuntimeAccessMode: vi.fn(),
    normalizeRuntimeReasonEffort: vi.fn(),
    confirmWriteAction: vi.fn(async () => undefined),
  };
}

describe("webMcpBridgeRuntimeActionRequiredTools", () => {
  it("registers action-required tools and aggregates runtime approvals, thread approvals, and user input requests", async () => {
    const actionRequiredGetV2 = vi.fn(async (requestId: string) =>
      requestId === "approval-runtime"
        ? {
            requestId,
            kind: "approval" as const,
            status: "submitted" as const,
            action: "approve runtime task",
            reason: null,
            input: null,
            createdAt: 10,
            decidedAt: null,
            decisionReason: null,
          }
        : requestId === "input-1"
          ? {
              requestId,
              kind: "elicitation" as const,
              status: "submitted" as const,
              action: "collect user input",
              reason: null,
              input: null,
              createdAt: 11,
              decidedAt: null,
              decisionReason: null,
            }
          : null
    );
    const helpers = createHelpers();
    const tools = buildRuntimeActionRequiredTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(async () => [
          {
            taskId: "task-1",
            workspaceId: "ws-1",
            threadId: "thread-runtime",
            title: "runtime review",
            status: "awaiting_approval" as const,
            accessMode: "on-request" as const,
            distributedStatus: null,
            currentStep: 0,
            createdAt: 100,
            updatedAt: 200,
            startedAt: null,
            completedAt: null,
            errorCode: null,
            errorMessage: null,
            pendingApprovalId: "approval-runtime",
          },
        ]),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        actionRequiredGetV2,
      },
      requireUserApproval: true,
      responseRequiredState: {
        approvals: [
          {
            workspace_id: "ws-1",
            request_id: 42,
            method: "workspace/requestApproval/runCommand",
            params: { thread_id: "thread-approval", turn_id: "turn-1", item_id: "item-1" },
          },
        ],
        userInputRequests: [
          {
            workspace_id: "ws-1",
            request_id: "input-1",
            params: {
              thread_id: "thread-input",
              turn_id: "turn-2",
              item_id: "item-2",
              questions: [{ id: "q1", header: "Repo", question: "Pick repo" }],
            },
          },
        ],
      },
      helpers,
    });

    expect(tools.map((tool) => tool.name)).toEqual([
      "list-runtime-action-required",
      "get-runtime-action-required",
      "resolve-runtime-action-required",
    ]);
    expect(tools[0]?.annotations?.readOnlyHint).toBe(true);
    expect(tools[1]?.annotations?.readOnlyHint).toBe(true);

    const listTool = tools.find((tool) => tool.name === "list-runtime-action-required");
    const response = await listTool?.execute({ limit: 10 }, null);

    expect(response).toMatchObject({
      ok: true,
      message: "Runtime action-required items retrieved.",
      data: {
        workspaceId: "ws-1",
        total: 3,
        items: expect.arrayContaining([
          expect.objectContaining({
            requestId: "approval-runtime",
            source: "runtime-task-approval",
            kind: "approval",
            actionRecord: expect.objectContaining({ requestId: "approval-runtime" }),
          }),
          expect.objectContaining({
            requestId: 42,
            source: "thread-approval",
            kind: "approval",
            actionRecord: null,
          }),
          expect.objectContaining({
            requestId: "input-1",
            source: "thread-user-input",
            kind: "elicitation",
            actionRecord: expect.objectContaining({ requestId: "input-1" }),
          }),
        ]),
      },
    });
    expect(actionRequiredGetV2).toHaveBeenCalledWith("approval-runtime");
    expect(actionRequiredGetV2).toHaveBeenCalledWith("input-1");
    expect(actionRequiredGetV2).not.toHaveBeenCalledWith("42");
  });

  it("retrieves numeric live items and string-backed records consistently", async () => {
    const actionRequiredGetV2 = vi.fn(async (requestId: string) =>
      requestId === "archived-1"
        ? {
            requestId,
            kind: "approval" as const,
            status: "approved" as const,
            action: "approve archived task",
            reason: null,
            input: null,
            createdAt: 1,
            decidedAt: 2,
            decisionReason: null,
          }
        : null
    );
    const tools = buildRuntimeActionRequiredTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(async () => []),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        actionRequiredGetV2,
      },
      requireUserApproval: false,
      responseRequiredState: {
        approvals: [
          {
            workspace_id: "ws-1",
            request_id: 7,
            method: "workspace/requestApproval/editFile",
            params: { thread_id: "thread-live" },
          },
        ],
        userInputRequests: [],
      },
      helpers: createHelpers(),
    });

    const getTool = tools.find((tool) => tool.name === "get-runtime-action-required");
    const liveResponse = await getTool?.execute({ requestId: 7 }, null);
    const recordResponse = await getTool?.execute({ requestId: "archived-1" }, null);

    expect(liveResponse).toMatchObject({
      message: "Runtime action-required item retrieved.",
      data: {
        item: expect.objectContaining({
          requestId: 7,
          source: "thread-approval",
          actionRecord: null,
        }),
      },
    });
    expect(recordResponse).toMatchObject({
      message: "Runtime action-required item retrieved.",
      data: {
        item: expect.objectContaining({
          requestId: "archived-1",
          actionRecord: expect.objectContaining({
            requestId: "archived-1",
            status: "approved",
          }),
        }),
      },
    });
  });

  it("dispatches runtime approvals, thread approvals, elicitation submits, and elicitation cancels", async () => {
    const confirmWriteAction = vi.fn(async () => undefined);
    const submitTaskApprovalDecision = vi.fn(async () => ({
      recorded: true,
      approvalId: "approval-runtime",
      taskId: "task-1",
      status: "running" as const,
      message: "recorded",
    }));
    const respondToServerRequest = vi.fn(async () => ({ accepted: true }));
    const respondToUserInputRequest = vi.fn(async () => ({ submitted: true }));
    const respondToServerRequestResult = vi.fn(async () => ({ cancelled: true }));
    const actionRequiredSubmitV2 = vi.fn(async () => "submitted" as const);
    const tools = buildRuntimeActionRequiredTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(async () => [
          {
            taskId: "task-1",
            workspaceId: "ws-1",
            threadId: "thread-runtime",
            title: "runtime review",
            status: "awaiting_approval" as const,
            accessMode: "on-request" as const,
            distributedStatus: null,
            currentStep: 0,
            createdAt: 100,
            updatedAt: 200,
            startedAt: null,
            completedAt: null,
            errorCode: null,
            errorMessage: null,
            pendingApprovalId: "approval-runtime",
          },
        ]),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision,
        actionRequiredGetV2: vi.fn(async () => null),
        actionRequiredSubmitV2,
        respondToServerRequest,
        respondToUserInputRequest,
        respondToServerRequestResult,
      },
      requireUserApproval: true,
      responseRequiredState: {
        approvals: [
          {
            workspace_id: "ws-1",
            request_id: 99,
            method: "workspace/requestApproval/runCommand",
            params: { thread_id: "thread-approval" },
          },
        ],
        userInputRequests: [
          {
            workspace_id: "ws-1",
            request_id: "input-1",
            params: {
              thread_id: "thread-input",
              turn_id: "turn-1",
              item_id: "item-1",
              questions: [{ id: "q1", header: "Repo", question: "Pick repo" }],
            },
          },
        ],
      },
      helpers: {
        ...createHelpers(),
        confirmWriteAction,
      },
    });

    const resolveTool = tools.find((tool) => tool.name === "resolve-runtime-action-required");
    await resolveTool?.execute(
      { requestId: "approval-runtime", kind: "approval", decision: "approved" },
      null
    );
    await resolveTool?.execute({ requestId: 99, kind: "approval", decision: "rejected" }, null);
    await resolveTool?.execute(
      {
        requestId: "input-1",
        kind: "elicitation",
        decision: "submitted",
        answers: { q1: { answers: ["repo-a"] } },
      },
      null
    );
    await resolveTool?.execute(
      { requestId: "input-1", kind: "elicitation", decision: "cancelled" },
      null
    );

    expect(confirmWriteAction).toHaveBeenCalledTimes(4);
    expect(submitTaskApprovalDecision).toHaveBeenCalledWith({
      approvalId: "approval-runtime",
      decision: "approved",
      reason: null,
    });
    expect(respondToServerRequest).toHaveBeenCalledWith("ws-1", 99, "decline");
    expect(respondToUserInputRequest).toHaveBeenCalledWith("ws-1", "input-1", {
      q1: { answers: ["repo-a"] },
    });
    expect(respondToServerRequestResult).toHaveBeenCalledWith("ws-1", "input-1", {});
    expect(actionRequiredSubmitV2).toHaveBeenCalledWith({
      requestId: "approval-runtime",
      kind: "approval",
      status: "approved",
      reason: null,
    });
    expect(actionRequiredSubmitV2).toHaveBeenCalledWith({
      requestId: "input-1",
      kind: "elicitation",
      status: "submitted",
      reason: null,
    });
    expect(actionRequiredSubmitV2).toHaveBeenCalledWith({
      requestId: "input-1",
      kind: "elicitation",
      status: "cancelled",
      reason: null,
    });
  });
});
