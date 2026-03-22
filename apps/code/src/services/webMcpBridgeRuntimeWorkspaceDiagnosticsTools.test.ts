import { describe, expect, it, vi } from "vitest";
import type { WorkspaceDiagnosticsListResponse } from "@ku0/code-runtime-host-contract";
import { buildRuntimeWorkspaceDiagnosticsTools } from "./webMcpBridgeRuntimeWorkspaceDiagnosticsTools";
import { createAgentCommandCenterSnapshot } from "./webMcpBridgeRuntimeTestUtils";

function createSnapshot() {
  return createAgentCommandCenterSnapshot({
    workspaceId: "ws-diagnostics",
    workspaceName: "diagnostics-workspace",
    intent: {
      objective: "inspect diagnostics",
    },
    governance: {
      policy: {
        terminateOverdueDays: 7,
      },
    },
  });
}

describe("webMcpBridgeRuntimeWorkspaceDiagnosticsTools", () => {
  it("registers inspect-workspace-diagnostics and forwards structured filters", async () => {
    const listWorkspaceDiagnostics = vi.fn(
      async (): Promise<WorkspaceDiagnosticsListResponse> => ({
        workspaceId: "ws-diagnostics",
        available: true,
        summary: {
          errorCount: 2,
          warningCount: 1,
          infoCount: 0,
          hintCount: 0,
          total: 3,
        },
        items: [
          {
            path: "apps/code/src/main.ts",
            severity: "error",
            message: "Type mismatch",
            source: "tsc",
            code: "TS2322",
            startLine: 1,
            startColumn: 1,
            endLine: 1,
            endColumn: 5,
          },
        ],
        providers: [{ id: "tsc", status: "used", durationMs: 20, message: "Collected" }],
        generatedAtMs: 1_770_000_000_000,
        reason: null,
      })
    );
    const tools = buildRuntimeWorkspaceDiagnosticsTools({
      snapshot: createSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        listWorkspaceDiagnostics,
      },
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
        confirmWriteAction: vi.fn(),
      },
    });

    expect(tools.map((tool) => tool.name)).toEqual(["inspect-workspace-diagnostics"]);

    const response = await tools[0]?.execute(
      {
        paths: ["apps/code/src"],
        severities: "error,warning",
        maxItems: 10,
        includeProviderDetails: false,
      },
      null
    );

    expect(listWorkspaceDiagnostics).toHaveBeenCalledWith({
      workspaceId: "ws-diagnostics",
      paths: ["apps/code/src"],
      severities: ["error", "warning"],
      maxItems: 10,
      includeProviderDetails: false,
    });
    expect(response).toMatchObject({
      ok: true,
      message: "Workspace diagnostics retrieved.",
      data: {
        workspaceId: "ws-diagnostics",
        available: true,
        diagnostics: expect.objectContaining({
          available: true,
          summary: expect.objectContaining({ total: 3 }),
        }),
      },
    });
  });

  it("returns an unavailable payload when runtime diagnostics are unsupported", async () => {
    const tools = buildRuntimeWorkspaceDiagnosticsTools({
      snapshot: createSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
      },
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
        confirmWriteAction: vi.fn(),
      },
    });

    const response = await tools[0]?.execute({}, null);

    expect(response).toMatchObject({
      ok: true,
      message: "Workspace diagnostics are unavailable in the current runtime.",
      data: {
        workspaceId: "ws-diagnostics",
        available: false,
        diagnostics: expect.objectContaining({
          available: false,
          reason: "workspace diagnostics method unavailable",
        }),
      },
    });
  });
});
