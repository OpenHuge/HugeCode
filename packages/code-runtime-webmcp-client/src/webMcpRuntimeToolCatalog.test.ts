import { describe, expect, it, vi } from "vitest";
import {
  buildRuntimeTaskCatalogTools,
  wrapRuntimeComputerObserveTool,
} from "./webMcpRuntimeToolCatalog";

describe("webMcpRuntimeToolCatalog", () => {
  it("builds shared runtime task catalog tools", async () => {
    const tools = buildRuntimeTaskCatalogTools({
      snapshot: { workspaceId: "workspace-1", workspaceName: "Workspace 1" } as never,
      runtimeControl: {
        listTasks: vi.fn(async () => [{ taskId: "task-1", status: "running" }]),
        getTaskStatus: vi.fn(async (taskId: string) => ({ taskId, status: "running" })),
      } as never,
      resolveWorkspaceId: () => "workspace-1",
      helpers: {
        buildResponse: (_message, data) => data,
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        toPositiveInteger: (value) => (typeof value === "number" ? Math.floor(value) : null),
        normalizeRuntimeTaskStatus: (value) =>
          value === "running" || value === "queued" ? (value as "running" | "queued") : null,
      },
    });

    const listResponse = await tools[0]?.execute({}, null);
    const statusResponse = await tools[1]?.execute({ taskId: "task-1" }, null);

    expect(listResponse).toMatchObject({
      workspaceId: "workspace-1",
      total: 1,
      statusSummary: { running: 1 },
    });
    expect(statusResponse).toMatchObject({
      workspaceId: "workspace-1",
      task: { taskId: "task-1", status: "running" },
    });
  });

  it("converts blocked computer observe responses into runtime errors", async () => {
    const tool = wrapRuntimeComputerObserveTool({
      name: "run-runtime-computer-observe",
      description: "observe",
      inputSchema: {},
      execute: async () => ({
        data: {
          result: {
            status: "blocked",
            message: "Blocked by policy.",
            metadata: { errorCode: "request_blocked" },
          },
        },
      }),
    });

    await expect(tool.execute({}, null)).rejects.toThrow("Blocked by policy.");
  });
});
