import { describe, expect, it, vi } from "vitest";

import { logger } from "./logger";
import {
  listCollaborationModesWithFallback,
  listMcpServerStatusWithFallback,
} from "./runtimeClientCodex";
import type { RuntimeClient } from "./runtimeClientTypes";

describe("runtimeClientCodex", () => {
  it("logs and downgrades invalid collaboration mode payloads", async () => {
    const loggerWarnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const client = {
      collaborationModesListV1: vi.fn().mockResolvedValue({
        data: { invalid: true },
        warnings: null,
      }),
    } as unknown as RuntimeClient;

    const result = await listCollaborationModesWithFallback(client, "ws-1");

    expect(result).toEqual({ data: [], warnings: [] });
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      "[runtimeClientCodex] collaborationModesListV1: response.data is not an array; downgraded to empty list",
      expect.objectContaining({
        data: expect.objectContaining({ invalid: true }),
      })
    );

    loggerWarnSpy.mockRestore();
  });
  it("logs and downgrades invalid MCP status payloads", async () => {
    const loggerWarnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const client = {
      mcpServerStatusListV1: vi.fn().mockResolvedValue({
        data: "invalid",
        nextCursor: "cursor-1",
        warnings: [],
      }),
    } as unknown as RuntimeClient;

    const result = await listMcpServerStatusWithFallback(client, {
      workspaceId: "ws-1",
      cursor: null,
      limit: 10,
    });

    expect(result).toEqual({
      data: [],
      nextCursor: null,
      warnings: ["MCP status schema validation failed; fallback to empty list."],
    });
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      "[runtimeClientCodex] mcpServerStatusListV1: response.data is not an array; downgraded to empty list",
      expect.objectContaining({
        data: "invalid",
        nextCursor: "cursor-1",
      })
    );

    loggerWarnSpy.mockRestore();
  });
});
