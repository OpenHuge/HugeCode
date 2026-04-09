// @vitest-environment jsdom

import { useEffect, useState } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isDesktopHostRuntime } from "../../../application/runtime/ports/desktopHostCore";
import { ask, message } from "../../../application/runtime/ports/desktopHostDialogs";
import { logger } from "../../../application/runtime/ports/logger";
import { detectRuntimeMode } from "../../../application/runtime/ports/runtimeClientMode";
import {
  readPersistedActiveWorkspaceId,
  writePersistedActiveWorkspaceId,
} from "../../../application/runtime/ports/threadSnapshots";
import {
  subscribeScopedRuntimeUpdatedEvents,
  useScopedRuntimeUpdatedEvent,
  type ScopedRuntimeUpdatedEventSnapshot,
} from "../../../application/runtime/ports/runtimeUpdatedEvents";
import {
  isWorkspacePathDir,
  pickWorkspacePaths,
} from "../../../application/runtime/ports/workspaceDialogs";
import { listWorkspaces } from "../../../application/runtime/ports/workspaceCatalog";
import {
  addWorkspace as addWorkspaceService,
  removeWorkspace as removeWorkspaceService,
  renameWorktree,
  renameWorktreeUpstream,
  updateWorkspaceSettings,
} from "../../../application/runtime/ports/workspaceMutations";
import { createRuntimeUpdatedEventFixture } from "../../../test/runtimeUpdatedEventFixtures";
import { createRuntimeUpdatedSubscriptionHarness } from "../../../test/runtimeUpdatedSubscriptionHarness";
import type { AppSettings, WorkspaceInfo } from "../../../types";
import { useWorkspaces } from "./useWorkspaces";
import { clearWorkspaceRouteRestoreSelection } from "./workspaceRoute";

vi.mock("../../../application/runtime/ports/desktopHostCore", () => ({
  isDesktopHostRuntime: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/desktopHostDialogs", () => ({
  ask: vi.fn(),
  message: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/workspaceDialogs", () => ({
  isWorkspacePathDir: vi.fn(),
  pickWorkspacePath: vi.fn(),
  pickWorkspacePaths: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/workspaceCatalog", () => ({
  listWorkspaces: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/workspaceMutations", () => ({
  addClone: vi.fn(),
  addWorkspace: vi.fn(),
  addWorktree: vi.fn(),
  updateWorkspaceCodexBin: vi.fn(),
  updateWorkspaceSettings: vi.fn(),
  removeWorkspace: vi.fn(),
  removeWorktree: vi.fn(),
  renameWorkspace: vi.fn(),
  renameWorktree: vi.fn(),
  renameWorktreeUpstream: vi.fn(),
  connectWorkspace: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/threadSnapshots", () => ({
  readPersistedActiveWorkspaceId: vi.fn(),
  writePersistedActiveWorkspaceId: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/runtimeUpdatedEvents", () => ({
  subscribeScopedRuntimeUpdatedEvents: vi.fn(),
  useScopedRuntimeUpdatedEvent: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../application/runtime/ports/runtimeClientMode", () => ({
  detectRuntimeMode: vi.fn(() => "electron-bridge"),
}));

const runtimeUpdatedHarness = createRuntimeUpdatedSubscriptionHarness();
const EMPTY_RUNTIME_UPDATED_SNAPSHOT: ScopedRuntimeUpdatedEventSnapshot = {
  revision: 0,
  lastEvent: null,
};
let runtimeUpdatedRevisionCounter = 0;

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
  clearWorkspaceRouteRestoreSelection();
  vi.mocked(detectRuntimeMode).mockReturnValue("electron-bridge");
  vi.mocked(isDesktopHostRuntime).mockReturnValue(true);
  vi.mocked(readPersistedActiveWorkspaceId).mockResolvedValue(null);
  vi.mocked(writePersistedActiveWorkspaceId).mockResolvedValue(true);
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
  cleanup();
  clearWorkspaceRouteRestoreSelection();
  vi.useRealTimers();
  vi.resetAllMocks();
});

const worktree: WorkspaceInfo = {
  id: "wt-1",
  name: "feature/old",
  path: "/tmp/wt-1",
  connected: true,
  kind: "worktree",
  parentId: "parent-1",
  worktree: { branch: "feature/old" },
  settings: { sidebarCollapsed: false },
};

const workspaceOne: WorkspaceInfo = {
  id: "ws-1",
  name: "workspace-one",
  path: "/tmp/ws-1",
  connected: true,
  kind: "main",
  parentId: null,
  worktree: null,
  settings: { sidebarCollapsed: false, groupId: null },
};

const workspaceTwo: WorkspaceInfo = {
  id: "ws-2",
  name: "workspace-two",
  path: "/tmp/ws-2",
  connected: true,
  kind: "main",
  parentId: null,
  worktree: null,
  settings: { sidebarCollapsed: false, groupId: null },
};

describe("useWorkspaces.renameWorktree", () => {
  it("optimistically updates and reconciles on success", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const renameWorktreeMock = vi.mocked(renameWorktree);
    listWorkspacesMock.mockResolvedValue([worktree]);

    let resolveRename: (value: WorkspaceInfo) => void = () => undefined;
    const renamePromise = new Promise<WorkspaceInfo>((resolve) => {
      resolveRename = resolve;
    });
    renameWorktreeMock.mockReturnValue(renamePromise);

    const { result } = renderHook(() => useWorkspaces());

    await act(async () => {
      await Promise.resolve();
    });

    let renameCall: Promise<WorkspaceInfo>;
    act(() => {
      renameCall = result.current.renameWorktree("wt-1", "feature/new");
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.workspaces[0].name).toBe("feature/new");
    expect(result.current.workspaces[0].worktree?.branch).toBe("feature/new");

    resolveRename({
      ...worktree,
      name: "feature/new",
      path: "/tmp/wt-1-renamed",
      worktree: { branch: "feature/new" },
    });

    await act(async () => {
      await renameCall;
    });

    expect(result.current.workspaces[0].path).toBe("/tmp/wt-1-renamed");
  });

  it("rolls back optimistic update on failure", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const renameWorktreeMock = vi.mocked(renameWorktree);
    listWorkspacesMock.mockResolvedValue([worktree]);
    let rejectRename: (error: Error) => void = () => undefined;
    const renamePromise = new Promise<WorkspaceInfo>((_, reject) => {
      rejectRename = reject;
    });
    renameWorktreeMock.mockReturnValue(renamePromise);

    const { result } = renderHook(() => useWorkspaces());

    await act(async () => {
      await Promise.resolve();
    });

    let renameCall: Promise<WorkspaceInfo>;
    act(() => {
      renameCall = result.current.renameWorktree("wt-1", "feature/new");
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.workspaces[0].name).toBe("feature/new");

    rejectRename(new Error("rename failed"));

    await act(async () => {
      try {
        await renameCall;
      } catch {
        // Expected rejection.
      }
    });

    expect(result.current.workspaces[0].name).toBe("feature/old");
    expect(result.current.workspaces[0].worktree?.branch).toBe("feature/old");
  });

  it("exposes upstream rename helper", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const renameWorktreeUpstreamMock = vi.mocked(renameWorktreeUpstream);
    listWorkspacesMock.mockResolvedValue([worktree]);
    renameWorktreeUpstreamMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWorkspaces());

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.renameWorktreeUpstream("wt-1", "feature/old", "feature/new");
    });

    expect(renameWorktreeUpstreamMock).toHaveBeenCalledWith("wt-1", "feature/old", "feature/new");
  });
});

describe("useWorkspaces.updateWorkspaceSettings", () => {
  it("does not throw when multiple updates are queued in the same tick", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const updateWorkspaceSettingsMock = vi.mocked(updateWorkspaceSettings);
    listWorkspacesMock.mockResolvedValue([workspaceOne, workspaceTwo]);
    updateWorkspaceSettingsMock.mockImplementation(async (workspaceId, settings) => {
      const base = workspaceId === workspaceOne.id ? workspaceOne : workspaceTwo;
      return { ...base, settings };
    });

    const { result } = renderHook(() => useWorkspaces());

    await act(async () => {
      await Promise.resolve();
    });

    let updatePromise: Promise<WorkspaceInfo[]>;
    act(() => {
      updatePromise = Promise.all([
        result.current.updateWorkspaceSettings(workspaceOne.id, {
          sidebarCollapsed: true,
        }),
        result.current.updateWorkspaceSettings(workspaceTwo.id, {
          sidebarCollapsed: true,
        }),
      ]);
    });

    await act(async () => {
      await updatePromise;
    });

    expect(updateWorkspaceSettingsMock).toHaveBeenCalledTimes(2);
    expect(
      result.current.workspaces.find((entry) => entry.id === workspaceOne.id)?.settings
        .sidebarCollapsed
    ).toBe(true);
    expect(
      result.current.workspaces.find((entry) => entry.id === workspaceTwo.id)?.settings
        .sidebarCollapsed
    ).toBe(true);
  });

  it("keeps workspace sidebar collapse local in runtime-gateway-web mode", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const updateWorkspaceSettingsMock = vi.mocked(updateWorkspaceSettings);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    listWorkspacesMock.mockResolvedValue([{ ...workspaceOne }]);
    updateWorkspaceSettingsMock.mockRejectedValue(
      new Error("Workspace settings update is only available through the Electron bridge.")
    );

    const { result } = renderHook(() => useWorkspaces());

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.updateWorkspaceSettings(workspaceOne.id, {
        sidebarCollapsed: true,
      });
    });

    expect(
      result.current.workspaces.find((entry) => entry.id === workspaceOne.id)?.settings
        .sidebarCollapsed
    ).toBe(true);

    await act(async () => {
      await result.current.refreshWorkspaces();
    });

    expect(
      result.current.workspaces.find((entry) => entry.id === workspaceOne.id)?.settings
        .sidebarCollapsed
    ).toBe(true);
    expect(updateWorkspaceSettingsMock).not.toHaveBeenCalled();
  });

  it("keeps workspace sort order local in runtime-gateway-web mode", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const updateWorkspaceSettingsMock = vi.mocked(updateWorkspaceSettings);
    vi.mocked(detectRuntimeMode).mockReturnValue("runtime-gateway-web");
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    listWorkspacesMock.mockResolvedValue([{ ...workspaceOne }]);
    updateWorkspaceSettingsMock.mockRejectedValue(
      new Error("Workspace settings update is only available through the Electron bridge.")
    );

    const { result } = renderHook(() => useWorkspaces());

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.updateWorkspaceSettings(workspaceOne.id, {
        sortOrder: 7,
      });
    });

    expect(
      result.current.workspaces.find((entry) => entry.id === workspaceOne.id)?.settings.sortOrder
    ).toBe(7);

    await act(async () => {
      await result.current.refreshWorkspaces();
    });

    expect(
      result.current.workspaces.find((entry) => entry.id === workspaceOne.id)?.settings.sortOrder
    ).toBe(7);
    expect(updateWorkspaceSettingsMock).not.toHaveBeenCalled();
  });
});

describe("useWorkspaces.addWorkspaceFromPath", () => {
  it("adds a workspace and sets it active", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const addWorkspaceMock = vi.mocked(addWorkspaceService);
    listWorkspacesMock.mockResolvedValue([]);
    addWorkspaceMock.mockResolvedValue({
      id: "workspace-1",
      name: "repo",
      path: "/tmp/repo",
      connected: true,
      kind: "main",
      parentId: null,
      worktree: null,
      settings: { sidebarCollapsed: false },
    });

    const { result } = renderHook(() => useWorkspaces());

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.addWorkspaceFromPath("/tmp/repo");
    });

    expect(addWorkspaceMock).toHaveBeenCalledWith("/tmp/repo", null);
    expect(result.current.workspaces).toHaveLength(1);
    expect(result.current.activeWorkspaceId).toBe("workspace-1");
  });

  it("reuses an existing workspace when path matches a file URI variant", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const addWorkspaceMock = vi.mocked(addWorkspaceService);
    listWorkspacesMock.mockResolvedValue([workspaceOne]);

    const { result } = renderHook(() => useWorkspaces());

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.addWorkspaceFromPath("file:///tmp/ws-1/");
    });

    expect(addWorkspaceMock).not.toHaveBeenCalled();
    expect(result.current.workspaces).toHaveLength(1);
    expect(result.current.activeWorkspaceId).toBe(workspaceOne.id);
  });
});

describe("useWorkspaces.addWorkspace (bulk)", () => {
  it("adds multiple workspaces and activates the first", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const pickWorkspacePathsMock = vi.mocked(pickWorkspacePaths);
    const isWorkspacePathDirMock = vi.mocked(isWorkspacePathDir);
    const addWorkspaceMock = vi.mocked(addWorkspaceService);
    const messageMock = vi.mocked(message);

    listWorkspacesMock.mockResolvedValue([]);
    pickWorkspacePathsMock.mockResolvedValue(["/tmp/ws-1", "/tmp/ws-2"]);
    isWorkspacePathDirMock.mockResolvedValue(true);
    addWorkspaceMock
      .mockResolvedValueOnce({ ...workspaceOne, id: "added-1", path: "/tmp/ws-1" })
      .mockResolvedValueOnce({ ...workspaceTwo, id: "added-2", path: "/tmp/ws-2" });

    const { result } = renderHook(() => useWorkspaces());

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.addWorkspace();
    });

    expect(addWorkspaceMock).toHaveBeenCalledTimes(2);
    expect(addWorkspaceMock).toHaveBeenCalledWith("/tmp/ws-1", null);
    expect(addWorkspaceMock).toHaveBeenCalledWith("/tmp/ws-2", null);
    expect(result.current.workspaces).toHaveLength(2);
    expect(result.current.activeWorkspaceId).toBe("added-1");
    expect(messageMock).not.toHaveBeenCalled();
  });

  it("degrades path validation in web mode and still adds selected workspaces", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const pickWorkspacePathsMock = vi.mocked(pickWorkspacePaths);
    const isWorkspacePathDirMock = vi.mocked(isWorkspacePathDir);
    const addWorkspaceMock = vi.mocked(addWorkspaceService);
    const messageMock = vi.mocked(message);
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);

    listWorkspacesMock.mockResolvedValue([]);
    pickWorkspacePathsMock.mockResolvedValue(["/tmp/ws-web"]);
    addWorkspaceMock.mockResolvedValueOnce({
      ...workspaceOne,
      id: "added-web",
      path: "/tmp/ws-web",
    });

    const { result } = renderHook(() => useWorkspaces());

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.addWorkspace();
    });

    expect(addWorkspaceMock).toHaveBeenCalledWith("/tmp/ws-web", null);
    expect(isWorkspacePathDirMock).not.toHaveBeenCalled();
    expect(result.current.workspaces).toHaveLength(1);
    expect(result.current.activeWorkspaceId).toBe("added-web");
    expect(messageMock).not.toHaveBeenCalled();
  });

  it("shows a summary when some selections are skipped or fail", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const pickWorkspacePathsMock = vi.mocked(pickWorkspacePaths);
    const isWorkspacePathDirMock = vi.mocked(isWorkspacePathDir);
    const addWorkspaceMock = vi.mocked(addWorkspaceService);
    const messageMock = vi.mocked(message);

    listWorkspacesMock.mockResolvedValue([workspaceOne]);
    pickWorkspacePathsMock.mockResolvedValue([workspaceOne.path, workspaceTwo.path]);
    isWorkspacePathDirMock.mockResolvedValue(true);
    addWorkspaceMock.mockResolvedValue(workspaceTwo);

    const { result } = renderHook(() => useWorkspaces());

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.addWorkspace();
    });

    expect(addWorkspaceMock).toHaveBeenCalledTimes(1);
    expect(addWorkspaceMock).toHaveBeenCalledWith(workspaceTwo.path, null);
    expect(messageMock).toHaveBeenCalledTimes(1);
    const [summary, options] = messageMock.mock.calls[0];
    expect(String(summary)).toContain("Skipped 1 already added workspace");
    expect(options).toEqual(
      expect.objectContaining({ title: "Some workspaces were skipped", kind: "warning" })
    );
  });

  it("uses alert fallback on web when showing summary", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const pickWorkspacePathsMock = vi.mocked(pickWorkspacePaths);
    const isWorkspacePathDirMock = vi.mocked(isWorkspacePathDir);
    const addWorkspaceMock = vi.mocked(addWorkspaceService);
    const messageMock = vi.mocked(message);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);

    listWorkspacesMock.mockResolvedValue([workspaceOne]);
    pickWorkspacePathsMock.mockResolvedValue([workspaceOne.path, workspaceTwo.path]);
    isWorkspacePathDirMock.mockResolvedValue(true);
    addWorkspaceMock.mockResolvedValue(workspaceTwo);

    try {
      const { result } = renderHook(() => useWorkspaces());

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        await result.current.addWorkspace();
      });

      expect(messageMock).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy.mock.calls[0]?.[0]).toContain("Some workspaces were skipped");
    } finally {
      alertSpy.mockRestore();
    }
  });
});

describe("useWorkspaces.active workspace persistence", () => {
  it("restores the explicit workspace route instead of a different persisted workspace", async () => {
    window.history.replaceState({}, "", `/workspaces/${workspaceOne.id}`);
    vi.mocked(listWorkspaces).mockResolvedValue([workspaceOne, workspaceTwo]);
    vi.mocked(readPersistedActiveWorkspaceId).mockResolvedValue(workspaceTwo.id);

    const { result } = renderHook(() => useWorkspaces());

    await waitFor(() => {
      expect(result.current.activeWorkspaceId).toBe(workspaceOne.id);
      expect(result.current.activeWorkspace?.id).toBe(workspaceOne.id);
      expect(window.location.pathname).toBe(`/workspaces/${workspaceOne.id}`);
    });
  });

  it("resolves a unique workspace-name route to the matching workspace id", async () => {
    window.history.replaceState({}, "", `/workspaces/${workspaceTwo.name}`);
    vi.mocked(listWorkspaces).mockResolvedValue([workspaceOne, workspaceTwo]);

    const { result } = renderHook(() => useWorkspaces());

    await waitFor(() => {
      expect(result.current.activeWorkspaceId).toBe(workspaceTwo.id);
      expect(result.current.activeWorkspace?.id).toBe(workspaceTwo.id);
      expect(window.location.pathname).toBe(`/workspaces/${workspaceTwo.id}`);
    });
  });

  it("keeps route and active workspace aligned when selecting a different workspace", async () => {
    window.history.replaceState({}, "", `/workspaces/${workspaceTwo.id}`);
    vi.mocked(listWorkspaces).mockResolvedValue([workspaceOne, workspaceTwo]);

    const { result } = renderHook(() => useWorkspaces());

    await waitFor(() => {
      expect(result.current.activeWorkspaceId).toBe(workspaceTwo.id);
      expect(result.current.activeWorkspace?.id).toBe(workspaceTwo.id);
    });

    act(() => {
      result.current.setActiveWorkspaceId(workspaceOne.id);
    });

    await waitFor(() => {
      expect(result.current.activeWorkspaceId).toBe(workspaceOne.id);
      expect(result.current.activeWorkspace?.id).toBe(workspaceOne.id);
      expect(window.location.pathname).toBe(`/workspaces/${workspaceOne.id}`);
    });
  });

  it("treats /workspaces as an explicit home route instead of restoring a persisted workspace", async () => {
    window.history.replaceState({}, "", "/workspaces");
    vi.mocked(listWorkspaces).mockResolvedValue([workspaceOne, workspaceTwo]);
    vi.mocked(readPersistedActiveWorkspaceId).mockResolvedValue(workspaceTwo.id);

    const { result } = renderHook(() => useWorkspaces());

    await waitFor(() => {
      expect(result.current.activeWorkspaceId).toBeNull();
      expect(result.current.activeWorkspace).toBeNull();
      expect(result.current.hasWorkspaceRouteSelection).toBe(false);
      expect(window.location.pathname).toBe("/workspaces");
    });
  });

  it("rewrites the desktop root path to /workspaces instead of restoring a persisted workspace", async () => {
    window.history.replaceState({}, "", "/");
    vi.mocked(listWorkspaces).mockResolvedValue([workspaceOne, workspaceTwo]);
    vi.mocked(readPersistedActiveWorkspaceId).mockResolvedValue(workspaceTwo.id);

    const { result } = renderHook(() => useWorkspaces());

    await waitFor(() => {
      expect(result.current.activeWorkspaceId).toBeNull();
      expect(result.current.activeWorkspace).toBeNull();
      expect(result.current.hasWorkspaceRouteSelection).toBe(false);
      expect(window.location.pathname).toBe("/workspaces");
    });
  });

  it("preserves workspace route intent when the runtime goes offline before the workspace can resolve", async () => {
    window.history.replaceState({}, "", `/workspaces/${workspaceOne.id}`);
    vi.mocked(listWorkspaces).mockRejectedValue(new Error("runtime unavailable"));

    const { result } = renderHook(() => useWorkspaces());

    await waitFor(() => {
      expect(result.current.hasLoaded).toBe(true);
      expect(result.current.activeWorkspaceId).toBeNull();
      expect(result.current.activeWorkspace).toBeNull();
      expect(result.current.hasWorkspaceRouteSelection).toBe(true);
      expect(result.current.workspaceLoadError).toBe("runtime unavailable");
      expect(window.location.pathname).toBe(`/workspaces/${workspaceOne.id}`);
    });
  });

  it("restores the last active workspace from native persistence after a reload", async () => {
    window.history.replaceState({}, "", "/legacy-shell");
    vi.mocked(listWorkspaces).mockResolvedValue([workspaceOne, workspaceTwo]);
    vi.mocked(readPersistedActiveWorkspaceId).mockResolvedValue(workspaceTwo.id);

    const { result } = renderHook(() => useWorkspaces());

    await waitFor(() => {
      expect(readPersistedActiveWorkspaceId).toHaveBeenCalledTimes(1);
      expect(result.current.activeWorkspaceId).toBe(workspaceTwo.id);
      expect(result.current.activeWorkspace?.id).toBe(workspaceTwo.id);
    });
  });

  it("restores the last active workspace from app settings after a reload", async () => {
    window.history.replaceState({}, "", "/legacy-shell");
    vi.mocked(listWorkspaces).mockResolvedValue([workspaceOne, workspaceTwo]);

    const { result } = renderHook(() =>
      useWorkspaces({
        appSettings: {
          lastActiveWorkspaceId: workspaceTwo.id,
        } as AppSettings,
      })
    );

    await waitFor(() => {
      expect(result.current.activeWorkspaceId).toBe(workspaceTwo.id);
      expect(result.current.activeWorkspace?.id).toBe(workspaceTwo.id);
    });
  });

  it("waits for app settings hydration before restoring the last active workspace", async () => {
    window.history.replaceState({}, "", "/legacy-shell");
    vi.mocked(listWorkspaces).mockResolvedValue([workspaceOne, workspaceTwo]);

    const { result, rerender } = renderHook(
      ({
        appSettings,
        appSettingsLoading,
      }: {
        appSettings: AppSettings;
        appSettingsLoading: boolean;
      }) =>
        useWorkspaces({
          appSettings,
          appSettingsLoading,
        }),
      {
        initialProps: {
          appSettings: {
            lastActiveWorkspaceId: null,
          } as AppSettings,
          appSettingsLoading: true,
        },
      }
    );

    await waitFor(() => {
      expect(result.current.activeWorkspaceId).toBeNull();
    });

    rerender({
      appSettings: {
        lastActiveWorkspaceId: workspaceTwo.id,
      } as AppSettings,
      appSettingsLoading: false,
    });

    await waitFor(() => {
      expect(result.current.activeWorkspaceId).toBe(workspaceTwo.id);
      expect(result.current.activeWorkspace?.id).toBe(workspaceTwo.id);
    });
  });

  it("waits for the persisted workspace to appear in the runtime list before finalizing restore", async () => {
    window.history.replaceState({}, "", "/legacy-shell");
    vi.mocked(readPersistedActiveWorkspaceId).mockResolvedValue(workspaceTwo.id);
    vi.mocked(listWorkspaces)
      .mockResolvedValueOnce([workspaceOne])
      .mockResolvedValueOnce([workspaceOne, workspaceTwo]);

    const { result } = renderHook(() => useWorkspaces());

    await waitFor(() => {
      expect(result.current.activeWorkspaceId).toBeNull();
      expect(result.current.workspaces.map((workspace) => workspace.id)).toEqual([workspaceOne.id]);
    });

    await act(async () => {
      await result.current.refreshWorkspaces();
    });

    await waitFor(() => {
      expect(result.current.activeWorkspaceId).toBe(workspaceTwo.id);
      expect(result.current.activeWorkspace?.id).toBe(workspaceTwo.id);
    });
  });

  it("does not override an explicit workspace selection when persisted restore resolves late", async () => {
    let resolvePersistedWorkspaceId!: (workspaceId: string | null) => void;
    const persistedWorkspaceIdPromise = new Promise<string | null>((resolve) => {
      resolvePersistedWorkspaceId = resolve;
    });
    vi.mocked(listWorkspaces).mockResolvedValue([workspaceOne, workspaceTwo]);
    vi.mocked(readPersistedActiveWorkspaceId).mockReturnValue(persistedWorkspaceIdPromise);

    const { result } = renderHook(() => useWorkspaces());

    await waitFor(() => {
      expect(result.current.hasLoaded).toBe(true);
      expect(result.current.activeWorkspaceId).toBeNull();
    });

    act(() => {
      result.current.setActiveWorkspaceId(workspaceOne.id);
    });

    resolvePersistedWorkspaceId(workspaceTwo.id);
    await act(async () => {
      await persistedWorkspaceIdPromise;
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.activeWorkspaceId).toBe(workspaceOne.id);
      expect(result.current.activeWorkspace?.id).toBe(workspaceOne.id);
    });
  });

  it("persists an explicit workspace selection even when restore readiness resolves later", async () => {
    let resolvePersistedWorkspaceId!: (workspaceId: string | null) => void;
    const persistedWorkspaceIdPromise = new Promise<string | null>((resolve) => {
      resolvePersistedWorkspaceId = resolve;
    });
    vi.mocked(listWorkspaces).mockResolvedValue([workspaceOne, workspaceTwo]);
    vi.mocked(readPersistedActiveWorkspaceId).mockReturnValue(persistedWorkspaceIdPromise);

    const { result } = renderHook(() => useWorkspaces());

    await waitFor(() => {
      expect(result.current.hasLoaded).toBe(true);
      expect(result.current.activeWorkspaceId).toBeNull();
    });

    act(() => {
      result.current.setActiveWorkspaceId(workspaceOne.id);
    });

    resolvePersistedWorkspaceId(workspaceTwo.id);
    await act(async () => {
      await persistedWorkspaceIdPromise;
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.activeWorkspaceId).toBe(workspaceOne.id);
      expect(writePersistedActiveWorkspaceId).toHaveBeenCalledWith(workspaceOne.id);
    });
  });

  it("mirrors active workspace changes into app settings in desktop-compat mode", async () => {
    vi.mocked(detectRuntimeMode).mockReturnValue("electron-bridge");
    vi.mocked(listWorkspaces).mockResolvedValue([workspaceOne, workspaceTwo]);
    const onUpdateAppSettings = vi.fn(async (next: AppSettings) => next);

    const { result } = renderHook(() =>
      useWorkspaces({
        appSettings: {
          lastActiveWorkspaceId: null,
        } as AppSettings,
        onUpdateAppSettings,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.setActiveWorkspaceId(workspaceTwo.id);
    });

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith({
        lastActiveWorkspaceId: workspaceTwo.id,
      });
    });
  });

  it("persists active workspace changes through native persistence", async () => {
    window.history.replaceState({}, "", `/workspaces/${workspaceOne.id}`);
    vi.mocked(listWorkspaces).mockResolvedValue([workspaceOne, workspaceTwo]);

    const { result } = renderHook(() => useWorkspaces());

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.setActiveWorkspaceId(workspaceTwo.id);
    });

    await waitFor(() => {
      expect(writePersistedActiveWorkspaceId).toHaveBeenCalledWith(workspaceTwo.id);
      expect(window.location.pathname).toBe(`/workspaces/${workspaceTwo.id}`);
    });
  });
});

describe("useWorkspaces.removeWorkspace", () => {
  it("uses confirm fallback on web instead of desktop runtime ask", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const askMock = vi.mocked(ask);
    const removeWorkspaceMock = vi.mocked(removeWorkspaceService);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.mocked(isDesktopHostRuntime).mockReturnValue(false);
    listWorkspacesMock.mockResolvedValue([workspaceOne]);
    removeWorkspaceMock.mockResolvedValue(undefined);

    try {
      const { result } = renderHook(() => useWorkspaces());

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        await result.current.removeWorkspace(workspaceOne.id);
      });

      expect(askMock).not.toHaveBeenCalled();
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(confirmSpy.mock.calls[0]?.[0]).toContain(`"${workspaceOne.name}"`);
      expect(removeWorkspaceMock).not.toHaveBeenCalled();
    } finally {
      confirmSpy.mockRestore();
    }
  });
});

describe("useWorkspaces.refreshWorkspaces logging", () => {
  it("uses a controlled runtime-unavailable state without logging in plain web mode", async () => {
    vi.mocked(detectRuntimeMode).mockReturnValue("unavailable");
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const loggerErrorMock = vi.mocked(logger.error);

    const { result } = renderHook(() => useWorkspaces());

    await waitFor(() => {
      expect(result.current.hasLoaded).toBe(true);
    });

    expect(listWorkspacesMock).not.toHaveBeenCalled();
    expect(loggerErrorMock).not.toHaveBeenCalled();
    expect(result.current.workspaces).toEqual([]);
    expect(result.current.workspaceLoadError).toContain(
      "Code runtime is unavailable for list workspaces."
    );
  });

  it("throttles repeated workspace load errors and summarizes suppressed logs", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-13T00:00:00.000Z"));

    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const loggerWarnMock = vi.mocked(logger.warn);
    const loggerErrorMock = vi.mocked(logger.error);
    listWorkspacesMock.mockRejectedValue(new Error("runtime unavailable"));

    const { result } = renderHook(() => useWorkspaces());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.workspaceLoadError).toBe("runtime unavailable");
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refreshWorkspaces();
      await result.current.refreshWorkspaces();
    });

    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
    expect(loggerWarnMock).not.toHaveBeenCalled();

    vi.setSystemTime(new Date("2026-02-13T00:00:16.000Z"));
    await act(async () => {
      await result.current.refreshWorkspaces();
    });

    expect(loggerWarnMock).toHaveBeenCalledWith(
      "[workspaces] Suppressed 2 repeated workspace load errors: runtime unavailable"
    );
    expect(loggerErrorMock).toHaveBeenCalledTimes(2);
    expect(loggerErrorMock).toHaveBeenNthCalledWith(
      2,
      "Failed to load workspaces: runtime unavailable"
    );
    expect(result.current.workspaceLoadError).toBe("runtime unavailable");
  });
});

describe("useWorkspaces runtime-updated refresh", () => {
  it("refreshes workspaces when runtime/updated includes workspaces scope", async () => {
    vi.useFakeTimers();
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    listWorkspacesMock
      .mockResolvedValueOnce([workspaceOne])
      .mockResolvedValueOnce([workspaceOne, workspaceTwo]);

    const { result } = renderHook(() => useWorkspaces());

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.workspaces).toHaveLength(1);

    act(() => {
      runtimeUpdatedHarness.emitRuntimeUpdated(
        createRuntimeUpdatedEventFixture({
          scope: ["workspaces", "bootstrap"],
          reason: "code_workspace_create",
          revision: "21",
        })
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(listWorkspacesMock).toHaveBeenCalledTimes(2);
    expect(result.current.workspaces).toHaveLength(2);
    expect(vi.mocked(useScopedRuntimeUpdatedEvent)).toHaveBeenCalled();
  });

  it("ignores resync runtime/updated reasons for workspace refresh", async () => {
    vi.useFakeTimers();
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    listWorkspacesMock.mockResolvedValue([workspaceOne]);

    renderHook(() => useWorkspaces());

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      runtimeUpdatedHarness.emitRuntimeUpdated(
        createRuntimeUpdatedEventFixture({
          scope: ["workspaces"],
          reason: "stream_reconnected",
          revision: "22",
        })
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(listWorkspacesMock).toHaveBeenCalledTimes(1);
  });
});
