import { describe, expect, it, vi } from "vitest";
import { buildRuntimeDiscoveryTools } from "./webMcpBridgeRuntimeDiscoveryTools";
import { createAgentCommandCenterSnapshot } from "./webMcpBridgeRuntimeTestUtils";

describe("webMcpBridgeRuntimeDiscoveryTools", () => {
  it("registers read-only discovery tools for MCP status", async () => {
    const tools = buildRuntimeDiscoveryTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        listRuntimeMcpServerStatus: vi.fn(async () => ({
          data: [],
          nextCursor: null,
          warnings: [],
        })),
      },
      helpers: {
        buildResponse: (message, data) => ({ ok: true, message, data }),
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        toPositiveInteger: (value) =>
          typeof value === "number" && Number.isFinite(value) && value > 0
            ? Math.trunc(value)
            : null,
      },
    });

    expect(tools.map((tool) => tool.name)).toEqual(["list-runtime-mcp-server-status"]);
  });

  it("returns stable empty results for list-runtime-mcp-server-status", async () => {
    const listRuntimeMcpServerStatus = vi.fn(async () => ({
      data: [],
      nextCursor: null,
      warnings: ["Runtime MCP status not available."],
    }));
    const tools = buildRuntimeDiscoveryTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        listRuntimeMcpServerStatus,
      },
      helpers: {
        buildResponse: (message, data) => ({ ok: true, message, data }),
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        toPositiveInteger: (value) =>
          typeof value === "number" && Number.isFinite(value) && value > 0
            ? Math.trunc(value)
            : null,
      },
    });

    const listStatusTool = tools.find((tool) => tool.name === "list-runtime-mcp-server-status");
    expect(listStatusTool?.annotations?.readOnlyHint).toBe(true);
    const response = await listStatusTool?.execute({}, null);

    expect(listRuntimeMcpServerStatus).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      cursor: null,
      limit: null,
    });
    expect(response).toMatchObject({
      ok: true,
      message: "Runtime MCP server status retrieved.",
      data: {
        total: 0,
        servers: [],
        nextCursor: null,
        warnings: ["Runtime MCP status not available."],
      },
    });
  });
});
