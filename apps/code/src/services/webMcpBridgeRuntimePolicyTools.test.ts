import { describe, expect, it, vi } from "vitest";
import { buildRuntimePolicyTools } from "./webMcpBridgeRuntimePolicyTools";
import { createAgentCommandCenterSnapshot } from "./webMcpBridgeRuntimeTestUtils";

describe("webMcpBridgeRuntimePolicyTools", () => {
  it("registers read-only policy/catalog tools and executes list-runtime-models without approval", async () => {
    const confirmWriteAction = vi.fn(async () => undefined);
    const listRuntimeModels = vi.fn(async () => [
      { id: "gpt-5.3-codex", provider: "openai" },
      { id: "claude-sonnet", provider: "anthropic" },
    ]);
    const tools = buildRuntimePolicyTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        getRuntimePolicy: vi.fn(async () => ({ mode: "balanced", updatedAt: 1 })),
        setRuntimePolicy: vi.fn(async () => ({ mode: "strict", updatedAt: 2 })),
        listRuntimeModels,
        listRuntimeProviderCatalog: vi.fn(async () => []),
        listRuntimeCollaborationModes: vi.fn(async () => ({ data: [], warnings: [] })),
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
        confirmWriteAction,
      },
    });

    expect(tools.map((tool) => tool.name)).toEqual([
      "get-runtime-policy",
      "set-runtime-policy",
      "list-runtime-models",
      "list-runtime-provider-catalog",
      "list-runtime-collaboration-modes",
    ]);

    const listModelsTool = tools.find((tool) => tool.name === "list-runtime-models");
    expect(listModelsTool?.annotations?.readOnlyHint).toBe(true);
    const response = await listModelsTool?.execute({}, null);

    expect(confirmWriteAction).not.toHaveBeenCalled();
    expect(listRuntimeModels).toHaveBeenCalledTimes(1);
    expect(response).toMatchObject({
      ok: true,
      message: "Runtime models retrieved.",
      data: {
        total: 2,
      },
    });
  });

  it("routes set-runtime-policy through write confirmation and runtime control", async () => {
    const confirmWriteAction = vi.fn(async () => undefined);
    const setRuntimePolicy = vi.fn(async (input: { mode: string; actor?: string | null }) => ({
      mode: input.mode,
      updatedAt: 42,
      actor: input.actor ?? null,
    }));
    const tools = buildRuntimePolicyTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        getRuntimePolicy: vi.fn(async () => ({ mode: "balanced", updatedAt: 1 })),
        setRuntimePolicy,
        listRuntimeModels: vi.fn(async () => []),
        listRuntimeProviderCatalog: vi.fn(async () => []),
        listRuntimeCollaborationModes: vi.fn(async () => ({ data: [], warnings: [] })),
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
        confirmWriteAction,
      },
    });

    const setPolicyTool = tools.find((tool) => tool.name === "set-runtime-policy");
    const response = await setPolicyTool?.execute({ mode: "strict", actor: "webmcp" }, null);

    expect(confirmWriteAction).toHaveBeenCalledTimes(1);
    expect(setRuntimePolicy).toHaveBeenCalledWith({ mode: "strict", actor: "webmcp" });
    expect(response).toMatchObject({
      ok: true,
      message: "Runtime policy updated.",
      data: {
        policy: {
          mode: "strict",
        },
      },
    });
  });
});
