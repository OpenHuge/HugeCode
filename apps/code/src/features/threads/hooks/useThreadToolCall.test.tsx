// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useThreadToolCall } from "./useThreadToolCall";

const respondToToolCall = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => undefined));

vi.mock("../../../application/runtime/ports/runtimeSessionCommands", () => ({
  useRuntimeSessionCommandsResolver: () => (workspaceId: string) => ({
    respondToToolCall: ({ requestId, response }: Record<string, unknown>) =>
      respondToToolCall(workspaceId, requestId, response),
  }),
}));

describe("useThreadToolCall", () => {
  it("routes tool call responses through runtime session commands", async () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useThreadToolCall({ dispatch }));

    await act(async () => {
      await result.current.handleToolCallSubmit(
        { workspace_id: "ws-1", request_id: 7, tool_name: "search" } as never,
        { success: true, contentItems: [] }
      );
    });

    expect(respondToToolCall).toHaveBeenCalledWith("ws-1", 7, {
      success: true,
      contentItems: [],
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "removeToolCallRequest",
      requestId: 7,
      workspaceId: "ws-1",
    });
  });
});
