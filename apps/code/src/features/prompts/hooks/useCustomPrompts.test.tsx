// @vitest-environment jsdom
import { useEffect, useState } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getGlobalPromptsDir, getPromptsList } from "../../../application/runtime/ports/prompts";
import {
  subscribeScopedRuntimeUpdatedEvents,
  type ScopedRuntimeUpdatedEventSnapshot,
  useScopedRuntimeUpdatedEvent,
} from "../../../application/runtime/ports/runtimeUpdatedEvents";
import { createRuntimeUpdatedEventFixture } from "../../../test/runtimeUpdatedEventFixtures";
import { createRuntimeUpdatedSubscriptionHarness } from "../../../test/runtimeUpdatedSubscriptionHarness";
import type { WorkspaceInfo } from "../../../types";
import { useCustomPrompts } from "./useCustomPrompts";

vi.mock("../../../application/runtime/ports/prompts", () => ({
  createPrompt: vi.fn(),
  deletePrompt: vi.fn(),
  getPromptsList: vi.fn(),
  getGlobalPromptsDir: vi.fn(),
  getWorkspacePromptsDir: vi.fn(),
  movePrompt: vi.fn(),
  updatePrompt: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/runtimeUpdatedEvents", () => ({
  subscribeScopedRuntimeUpdatedEvents: vi.fn(),
  useScopedRuntimeUpdatedEvent: vi.fn(),
}));

const getGlobalPromptsDirMock = vi.mocked(getGlobalPromptsDir);
const getPromptsListMock = vi.mocked(getPromptsList);
const runtimeUpdatedHarness = createRuntimeUpdatedSubscriptionHarness();
const EMPTY_RUNTIME_UPDATED_SNAPSHOT: ScopedRuntimeUpdatedEventSnapshot = {
  revision: 0,
  lastEvent: null,
};
let runtimeUpdatedRevisionCounter = 0;

beforeEach(() => {
  runtimeUpdatedHarness.reset();
  runtimeUpdatedRevisionCounter = 0;
  vi.mocked(subscribeScopedRuntimeUpdatedEvents).mockImplementation(
    runtimeUpdatedHarness.subscribeScopedRuntimeUpdatedEvents
  );
  vi.mocked(useScopedRuntimeUpdatedEvent).mockImplementation((options) => {
    const [snapshot, setSnapshot] = useState<ScopedRuntimeUpdatedEventSnapshot>(
      EMPTY_RUNTIME_UPDATED_SNAPSHOT
    );

    useEffect(() => {
      if (options.enabled === false) {
        setSnapshot(EMPTY_RUNTIME_UPDATED_SNAPSHOT);
        return;
      }
      return runtimeUpdatedHarness.subscribeScopedRuntimeUpdatedEvents(options, (event) => {
        runtimeUpdatedRevisionCounter += 1;
        setSnapshot({
          revision: runtimeUpdatedRevisionCounter,
          lastEvent: event,
        });
      });
    }, [options.enabled, options.scopes, options.workspaceId]);

    return snapshot;
  });
});

afterEach(() => {
  vi.resetAllMocks();
});

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "Workspace",
  path: "/tmp/workspace",
  connected: false,
  settings: { sidebarCollapsed: false },
};

const connectedWorkspace: WorkspaceInfo = {
  ...workspace,
  connected: true,
};

const secondaryWorkspace: WorkspaceInfo = {
  id: "ws-2",
  name: "Workspace Two",
  path: "/tmp/workspace-two",
  connected: true,
  settings: { sidebarCollapsed: false },
};

function emitRuntimeUpdated(params: Record<string, unknown>) {
  runtimeUpdatedHarness.emitRuntimeUpdated(
    createRuntimeUpdatedEventFixture({
      paramsWorkspaceId: connectedWorkspace.id,
      revision: typeof params.revision === "string" ? params.revision : undefined,
      scope: Array.isArray(params.scope) ? (params.scope as string[]) : undefined,
      reason: typeof params.reason === "string" ? params.reason : undefined,
    })
  );
}

describe("useCustomPrompts", () => {
  it("returns null when no workspace is selected", async () => {
    const { result } = renderHook(() => useCustomPrompts({ activeWorkspace: null }));

    let path: string | null = "unset";
    await act(async () => {
      path = await result.current.getGlobalPromptsDir();
    });

    expect(path).toBeNull();
    expect(getGlobalPromptsDirMock).not.toHaveBeenCalled();
  });

  it("requests the global prompts dir when a workspace is selected", async () => {
    getGlobalPromptsDirMock.mockResolvedValue("/tmp/.codex/prompts");
    const { result } = renderHook(() => useCustomPrompts({ activeWorkspace: workspace }));

    let path: string | null = null;
    await act(async () => {
      path = await result.current.getGlobalPromptsDir();
    });

    expect(getGlobalPromptsDirMock).toHaveBeenCalledWith("ws-1");
    expect(path).toBe("/tmp/.codex/prompts");
  });

  it("refreshes the latest workspace prompts after switching workspaces mid-fetch", async () => {
    let resolveFirst: (value: {
      result: { prompts: Array<{ name: string; path: string }> };
    }) => void;
    let resolveSecond: (value: {
      result: { prompts: Array<{ name: string; path: string }> };
    }) => void;
    const firstPromise = new Promise<{
      result: { prompts: Array<{ name: string; path: string }> };
    }>((resolve) => {
      resolveFirst = resolve;
    });
    const secondPromise = new Promise<{
      result: { prompts: Array<{ name: string; path: string }> };
    }>((resolve) => {
      resolveSecond = resolve;
    });

    getPromptsListMock.mockReturnValueOnce(firstPromise).mockReturnValueOnce(secondPromise);

    const { result, rerender } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo | null }) =>
        useCustomPrompts({ activeWorkspace }),
      { initialProps: { activeWorkspace: connectedWorkspace } }
    );

    rerender({ activeWorkspace: secondaryWorkspace });

    await waitFor(() => {
      expect(getPromptsListMock).toHaveBeenCalledWith("ws-1");
    });

    act(() => {
      resolveFirst({
        result: { prompts: [{ name: "first", path: "/first.md" }] },
      });
    });

    await waitFor(() => {
      expect(getPromptsListMock).toHaveBeenCalledWith("ws-2");
    });

    act(() => {
      resolveSecond({
        result: { prompts: [{ name: "second", path: "/second.md" }] },
      });
    });

    await waitFor(() => {
      expect(result.current.prompts.map((prompt) => prompt.name)).toEqual(["second"]);
    });
  });

  it("refreshes prompts when runtime.updated includes prompts scope", async () => {
    getPromptsListMock
      .mockResolvedValueOnce({ result: { prompts: [{ name: "first", path: "/first.md" }] } })
      .mockResolvedValueOnce({ result: { prompts: [{ name: "second", path: "/second.md" }] } });

    const { result } = renderHook(() => useCustomPrompts({ activeWorkspace: connectedWorkspace }));

    await waitFor(() => {
      expect(getPromptsListMock).toHaveBeenCalledTimes(1);
      expect(result.current.prompts.map((prompt) => prompt.name)).toEqual(["first"]);
    });

    act(() => {
      emitRuntimeUpdated({
        revision: "101",
        scope: ["prompts", "bootstrap"],
        reason: "code_prompt_library_update",
      });
    });

    await waitFor(() => {
      expect(getPromptsListMock).toHaveBeenCalledTimes(2);
      expect(result.current.prompts.map((prompt) => prompt.name)).toEqual(["second"]);
    });
  });

  it("ignores runtime.updated scopes unrelated to prompts refresh", async () => {
    getPromptsListMock.mockResolvedValueOnce({
      result: { prompts: [{ name: "first", path: "/first.md" }] },
    });

    const { result } = renderHook(() => useCustomPrompts({ activeWorkspace: connectedWorkspace }));

    await waitFor(() => {
      expect(getPromptsListMock).toHaveBeenCalledTimes(1);
      expect(result.current.prompts.map((prompt) => prompt.name)).toEqual(["first"]);
    });

    act(() => {
      emitRuntimeUpdated({
        revision: "102",
        scope: ["oauth"],
        reason: "code_oauth_pool_upsert",
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getPromptsListMock).toHaveBeenCalledTimes(1);
  });
});
