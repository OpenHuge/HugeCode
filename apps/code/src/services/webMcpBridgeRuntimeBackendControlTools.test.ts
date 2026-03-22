import { describe, expect, it, vi } from "vitest";
import { buildRuntimeBackendControlTools } from "./webMcpBridgeRuntimeBackendControlTools";
import { createAgentCommandCenterSnapshot } from "./webMcpBridgeRuntimeTestUtils";

describe("webMcpBridgeRuntimeBackendControlTools", () => {
  it("registers backend mutation tools and routes state updates through write confirmation", async () => {
    const confirmWriteAction = vi.fn(async () => undefined);
    const runtimeBackendSetState = vi.fn(async () => ({
      backendId: "backend-a",
      status: "draining",
      rolloutState: "draining",
    }));
    const tools = buildRuntimeBackendControlTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        runtimeBackendSetState,
        runtimeBackendRemove: vi.fn(async () => true),
        runtimeBackendUpsert: vi.fn(async () => ({ backendId: "backend-b" })),
      },
      requireUserApproval: true,
      onApprovalRequest: vi.fn(async () => true),
      helpers: {
        buildResponse: (message, data) => ({ ok: true, message, data }),
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        toPositiveInteger: (value) =>
          typeof value === "number" && Number.isFinite(value) && value > 0
            ? Math.trunc(value)
            : null,
        toStringArray: (value) =>
          Array.isArray(value)
            ? value.filter((entry): entry is string => typeof entry === "string")
            : [],
        confirmWriteAction,
      },
    });

    expect(tools.map((tool) => tool.name)).toEqual([
      "set-runtime-backend-state",
      "remove-runtime-backend",
      "upsert-runtime-backend",
    ]);

    const setStateTool = tools.find((tool) => tool.name === "set-runtime-backend-state");
    const response = await setStateTool?.execute(
      {
        backendId: "backend-a",
        status: "draining",
        rolloutState: "draining",
        force: true,
        reason: "agent:rebalance",
      },
      null
    );

    expect(confirmWriteAction).toHaveBeenCalledTimes(1);
    expect(runtimeBackendSetState).toHaveBeenCalledWith({
      backendId: "backend-a",
      status: "draining",
      rolloutState: "draining",
      force: true,
      reason: "agent:rebalance",
      workspaceId: "ws-1",
    });
    expect(response).toMatchObject({
      ok: true,
      message: "Runtime backend state updated.",
      data: {
        backend: {
          backendId: "backend-a",
          status: "draining",
        },
      },
    });
  });

  it("rejects set-state input when both status and rolloutState are missing", async () => {
    const tools = buildRuntimeBackendControlTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        runtimeBackendSetState: vi.fn(async () => ({})),
        runtimeBackendRemove: vi.fn(async () => true),
        runtimeBackendUpsert: vi.fn(async () => ({})),
      },
      requireUserApproval: true,
      helpers: {
        buildResponse: (message, data) => ({ ok: true, message, data }),
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        toPositiveInteger: (value) =>
          typeof value === "number" && Number.isFinite(value) && value > 0
            ? Math.trunc(value)
            : null,
        toStringArray: (value) =>
          Array.isArray(value)
            ? value.filter((entry): entry is string => typeof entry === "string")
            : [],
        confirmWriteAction: vi.fn(async () => undefined),
      },
    });

    const setStateTool = tools.find((tool) => tool.name === "set-runtime-backend-state");
    await expect(setStateTool?.execute({ backendId: "backend-a" }, null)).rejects.toMatchObject({
      code: "runtime.validation.input.required",
    });
  });

  it("marks remove as destructive and forwards full-spec upsert payloads", async () => {
    const confirmWriteAction = vi.fn(async () => undefined);
    const runtimeBackendRemove = vi.fn(async () => true);
    const runtimeBackendUpsert = vi.fn(async (input) => ({
      ...input,
      healthy: true,
    }));
    const tools = buildRuntimeBackendControlTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        runtimeBackendSetState: vi.fn(async () => ({})),
        runtimeBackendRemove,
        runtimeBackendUpsert,
      },
      requireUserApproval: false,
      onApprovalRequest: vi.fn(async () => true),
      helpers: {
        buildResponse: (message, data) => ({ ok: true, message, data }),
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        toPositiveInteger: (value) =>
          typeof value === "number" && Number.isFinite(value) && value > 0
            ? Math.trunc(value)
            : null,
        toStringArray: (value) =>
          Array.isArray(value)
            ? value.filter((entry): entry is string => typeof entry === "string")
            : [],
        confirmWriteAction,
      },
    });

    const removeTool = tools.find((tool) => tool.name === "remove-runtime-backend");
    expect(removeTool?.annotations?.destructiveHint).toBe(true);
    await removeTool?.execute({ backendId: "backend-a" }, null);
    expect(runtimeBackendRemove).toHaveBeenCalledWith({
      backendId: "backend-a",
      workspaceId: "ws-1",
    });

    const upsertTool = tools.find((tool) => tool.name === "upsert-runtime-backend");
    const upsertResponse = await upsertTool?.execute(
      {
        backendId: "backend-z",
        displayName: "Backend Z",
        capabilities: ["general", "routing"],
        maxConcurrency: 4,
        costTier: "premium",
        latencyClass: "regional",
        rolloutState: "ramping",
        status: "active",
      },
      null
    );

    expect(runtimeBackendUpsert).toHaveBeenCalledWith({
      backendId: "backend-z",
      displayName: "Backend Z",
      capabilities: ["general", "routing"],
      maxConcurrency: 4,
      costTier: "premium",
      latencyClass: "regional",
      rolloutState: "ramping",
      status: "active",
      workspaceId: "ws-1",
    });
    expect(upsertResponse).toMatchObject({
      ok: true,
      message: "Runtime backend upsert completed.",
      data: {
        backend: {
          backendId: "backend-z",
          displayName: "Backend Z",
        },
      },
    });
  });
});
