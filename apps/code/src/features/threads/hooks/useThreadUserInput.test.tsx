// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useThreadUserInput } from "./useThreadUserInput";

const respondToUserInput = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => undefined));

vi.mock("../../../application/runtime/facades/runtimeSessionCommandFacadeHooks", () => ({
  useRuntimeSessionCommandsResolver: () => (workspaceId: string) => ({
    respondToUserInput: ({ requestId, answers }: Record<string, unknown>) =>
      respondToUserInput(workspaceId, requestId, answers),
  }),
}));

describe("useThreadUserInput", () => {
  it("routes user input responses through runtime session commands", async () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useThreadUserInput({ dispatch }));

    await act(async () => {
      await result.current.handleUserInputSubmit(
        { workspace_id: "ws-1", request_id: 42, prompt: "Confirm?" } as never,
        { answers: { confirm: { answers: ["yes"] } } }
      );
    });

    expect(respondToUserInput).toHaveBeenCalledWith("ws-1", 42, {
      confirm: { answers: ["yes"] },
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "removeUserInputRequest",
      requestId: 42,
      workspaceId: "ws-1",
    });
  });
});
