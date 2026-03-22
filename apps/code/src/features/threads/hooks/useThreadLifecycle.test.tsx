// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem, WorkspaceInfo } from "../../../types";
import { useThreadLifecycle } from "./useThreadLifecycle";

let runtimeUpdatedSnapshot = {
  revision: 0,
  lastEvent: null as null | {
    reason: string;
    event: Record<string, unknown>;
  },
};

vi.mock("../../../application/runtime/ports/runtimeUpdatedEvents", () => ({
  useScopedRuntimeUpdatedEvent: vi.fn(() => runtimeUpdatedSnapshot),
}));

const WORKSPACE: WorkspaceInfo = {
  id: "ws-1",
  name: "Workspace",
  path: "/repo",
  connected: true,
  settings: {
    sidebarCollapsed: false,
  },
};

function createHookOptions() {
  const items: ConversationItem[] = [
    { id: "message-1", kind: "message", role: "assistant", text: "Hello" },
  ];

  return {
    activeWorkspace: WORKSPACE,
    activeWorkspaceId: WORKSPACE.id,
    activeThreadId: "thread-1",
    onDebug: vi.fn(),
    threadSortKey: "updated_at" as const,
    state: {
      threadsByWorkspace: {},
      itemsByThread: {},
      threadStatusById: {},
      threadParentById: {},
      activeThreadIdByWorkspace: {},
    },
    dispatch: vi.fn(),
    threadSnapshotsReady: true,
    listThreadSnapshots: vi.fn(() => [
      {
        workspaceId: "ws-1",
        threadId: "thread-1",
        name: "Thread 1",
        updatedAt: 10,
        items,
        lastDurationMs: 123,
      },
    ]),
    getPersistedActiveThreadId: vi.fn(() => "thread-1"),
    persistActiveThreadId: vi.fn(),
    syncThreadSnapshots: vi.fn(),
    loadedThreadsRef: { current: {} },
    itemsByThreadRef: { current: {} },
    detachedReviewStartedNoticeRef: { current: new Set<string>() },
    detachedReviewCompletedNoticeRef: { current: new Set<string>() },
    detachedReviewParentByChildRef: { current: {} },
    detachedReviewLinksByWorkspaceRef: { current: {} },
    recordThreadActivity: vi.fn(),
    safeMessageActivity: vi.fn(),
    updateThreadParent: vi.fn(),
    listThreadsForWorkspace: vi.fn(async () => undefined),
    resumeThreadForWorkspace: vi.fn(async () => null),
  };
}

describe("useThreadLifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeUpdatedSnapshot = {
      revision: 0,
      lastEvent: null,
    };
  });

  it("hydrates snapshot threads and persists active-thread selection", async () => {
    const options = createHookOptions();

    renderHook(() => useThreadLifecycle(options));

    await waitFor(() => {
      expect(options.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "setThreads",
          workspaceId: "ws-1",
        })
      );
    });
    expect(options.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "setThreadItems",
        threadId: "thread-1",
      })
    );
    expect(options.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "setActiveThreadId",
        workspaceId: "ws-1",
        threadId: "thread-1",
      })
    );
  });

  it("refreshes thread state after non-skipped runtime updates", async () => {
    const options = createHookOptions();
    runtimeUpdatedSnapshot = {
      revision: 1,
      lastEvent: {
        reason: "mission_control_refresh",
        event: { id: "event-1" },
      },
    };

    renderHook(() => useThreadLifecycle(options));

    await waitFor(
      () => {
        expect(options.listThreadsForWorkspace).toHaveBeenCalledWith(WORKSPACE, {
          preserveState: true,
        });
      },
      { timeout: 1000 }
    );
  });
});
