// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { useNewAgentDraft } from "./useNewAgentDraft";

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "Workspace",
  path: "/tmp/ws-1",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("useNewAgentDraft", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears starting state after successful send when no thread activates", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useNewAgentDraft({
        activeWorkspace: workspace,
        activeWorkspaceId: workspace.id,
        activeThreadId: null,
      })
    );

    await act(async () => {
      await result.current.runWithDraftStart(async () => {
        await Promise.resolve();
      });
    });

    expect(result.current.startingDraftThreadWorkspaceId).toBe(workspace.id);

    await act(async () => {
      vi.advanceTimersByTime(4100);
      await Promise.resolve();
    });

    expect(result.current.startingDraftThreadWorkspaceId).toBeNull();
  });

  it("serializes draft-start sends until the new thread activates", async () => {
    vi.useFakeTimers();
    let resolveRunner!: () => void;
    let callCount = 0;
    const runner = vi.fn(() => {
      callCount += 1;
      if (callCount === 1) {
        return new Promise<void>((resolve) => {
          resolveRunner = () => resolve();
        });
      }
      return Promise.resolve();
    });

    const { result, rerender } = renderHook(
      (props: { activeThreadId: string | null }) =>
        useNewAgentDraft({
          activeWorkspace: workspace,
          activeWorkspaceId: workspace.id,
          activeThreadId: props.activeThreadId,
        }),
      {
        initialProps: { activeThreadId: null },
      }
    );

    let firstPromise: Promise<void> | null = null;
    let secondPromise: Promise<void> | null = null;
    act(() => {
      firstPromise = result.current.runWithDraftStart(runner);
      secondPromise = result.current.runWithDraftStart(runner);
    });
    expect(result.current.startingDraftThreadWorkspaceId).toBe(workspace.id);

    await act(async () => {
      await Promise.resolve();
    });
    expect(runner).toHaveBeenCalledTimes(1);
    if (!firstPromise || !secondPromise) {
      throw new Error("Expected concurrent draft-start promises to be initialized.");
    }
    resolveRunner();
    await act(async () => {
      await firstPromise;
    });
    expect(runner).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender({ activeThreadId: "thread-1" });
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    await act(async () => {
      await secondPromise;
    });
    expect(runner).toHaveBeenCalledTimes(2);
  });
});
