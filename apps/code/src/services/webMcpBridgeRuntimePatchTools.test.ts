import { describe, expect, it, vi } from "vitest";
import { buildRuntimePatchTools } from "./webMcpBridgeRuntimePatchTools";
import { createAgentCommandCenterSnapshot } from "./webMcpBridgeRuntimeTestUtils";

function createSnapshot() {
  return createAgentCommandCenterSnapshot({
    workspaceId: "ws-patch",
    workspaceName: "patch-workspace",
    intent: {
      objective: "apply patch",
    },
    governance: {
      policy: {
        terminateOverdueDays: 7,
      },
    },
  });
}

describe("webMcpBridgeRuntimePatchTools", () => {
  it("registers apply-workspace-patch and forwards dry-run without approval", async () => {
    const applyWorkspacePatch = vi.fn(async () => ({
      workspaceId: "ws-patch",
      ok: true,
      applied: false,
      dryRun: true,
      files: ["src/example.ts"],
      stdout: "",
      stderr: "",
      error: null,
    }));
    const confirmWriteAction = vi.fn(async () => undefined);
    const tools = buildRuntimePatchTools({
      snapshot: createSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        applyWorkspacePatch,
      },
      requireUserApproval: true,
      helpers: {
        buildResponse: (message, data) => ({ ok: true, message, data }),
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        toStringArray: () => [],
        toPositiveInteger: () => null,
        normalizeRuntimeTaskStatus: () => null,
        normalizeRuntimeStepKind: () => "read",
        normalizeRuntimeExecutionMode: () => "single",
        normalizeRuntimeAccessMode: () => "on-request",
        normalizeRuntimeReasonEffort: () => null,
        confirmWriteAction,
      },
    });

    expect(tools.map((tool) => tool.name)).toEqual(["apply-workspace-patch"]);

    const tool = tools[0];
    const response = await tool?.execute(
      {
        diff: "diff --git a/src/example.ts b/src/example.ts\n",
        dryRun: true,
      },
      null
    );

    expect(confirmWriteAction).not.toHaveBeenCalled();
    expect(applyWorkspacePatch).toHaveBeenCalledWith({
      workspaceId: "ws-patch",
      diff: "diff --git a/src/example.ts b/src/example.ts\n",
      dryRun: true,
    });
    expect(response).toMatchObject({
      ok: true,
      message: "Workspace patch dry-run completed.",
      data: {
        result: expect.objectContaining({
          dryRun: true,
          applied: false,
        }),
      },
    });
  });

  it("requires approval before applying a patch", async () => {
    const applyWorkspacePatch = vi.fn(async () => ({
      workspaceId: "ws-patch",
      ok: true,
      applied: true,
      dryRun: false,
      files: ["src/example.ts"],
      stdout: "",
      stderr: "",
      error: null,
    }));
    const confirmWriteAction = vi.fn(async () => undefined);
    const tools = buildRuntimePatchTools({
      snapshot: createSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        applyWorkspacePatch,
      },
      requireUserApproval: true,
      helpers: {
        buildResponse: (message, data) => ({ ok: true, message, data }),
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        toStringArray: () => [],
        toPositiveInteger: () => null,
        normalizeRuntimeTaskStatus: () => null,
        normalizeRuntimeStepKind: () => "read",
        normalizeRuntimeExecutionMode: () => "single",
        normalizeRuntimeAccessMode: () => "on-request",
        normalizeRuntimeReasonEffort: () => null,
        confirmWriteAction,
      },
    });

    const tool = tools[0];
    const response = await tool?.execute(
      {
        diff: "diff --git a/src/example.ts b/src/example.ts\n",
      },
      null
    );

    expect(confirmWriteAction).toHaveBeenCalledTimes(1);
    expect(applyWorkspacePatch).toHaveBeenCalledWith({
      workspaceId: "ws-patch",
      diff: "diff --git a/src/example.ts b/src/example.ts\n",
      dryRun: false,
    });
    expect(response).toMatchObject({
      ok: true,
      message: "Workspace patch applied.",
      data: {
        result: expect.objectContaining({
          applied: true,
          dryRun: false,
        }),
      },
    });
  });
});
