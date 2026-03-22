// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadRuntimeCollaborationModes } from "../../../application/runtime/ports/runtimeCollaborationModes";
import type { WorkspaceInfo } from "../../../types";
import { useCollaborationModes } from "./useCollaborationModes";

vi.mock("../../../application/runtime/ports/runtimeCollaborationModes", async () => {
  const actual = await vi.importActual<
    typeof import("../../../application/runtime/ports/runtimeCollaborationModes")
  >("../../../application/runtime/ports/runtimeCollaborationModes");
  return {
    ...actual,
    loadRuntimeCollaborationModes: vi.fn(),
  };
});

const workspaceOne: WorkspaceInfo = {
  id: "workspace-1",
  name: "Workspace One",
  path: "/tmp/workspace-one",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const workspaceTwoDisconnected: WorkspaceInfo = {
  id: "workspace-2",
  name: "Workspace Two",
  path: "/tmp/workspace-two",
  connected: false,
  settings: { sidebarCollapsed: false },
};

const workspaceTwoConnected: WorkspaceInfo = {
  ...workspaceTwoDisconnected,
  connected: true,
};

const makeModesResponse = () => [
  {
    id: "plan",
    label: "Plan",
    mode: "plan",
    model: "",
    reasoningEffort: null,
    developerInstructions: null,
    value: { mode: "plan" },
  },
  {
    id: "default",
    label: "Default",
    mode: "default",
    model: "",
    reasoningEffort: null,
    developerInstructions: null,
    value: { mode: "default" },
  },
];

const makeReviewModesResponse = () => [
  makeModesResponse()[0],
  {
    id: "review",
    label: "Review",
    mode: "review",
    model: "",
    reasoningEffort: null,
    developerInstructions: null,
    value: { mode: "review" },
  },
  makeModesResponse()[1],
];

describe("useCollaborationModes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the last selected mode across workspace switches and reconnects", async () => {
    vi.mocked(loadRuntimeCollaborationModes).mockImplementation(async () => makeModesResponse());

    const { result, rerender } = renderHook(
      ({ workspace, enabled }: { workspace: WorkspaceInfo | null; enabled: boolean }) =>
        useCollaborationModes({ activeWorkspace: workspace, enabled }),
      {
        initialProps: { workspace: workspaceOne, enabled: true },
      }
    );

    await waitFor(() => expect(result.current.selectedCollaborationModeId).toBe("default"));

    act(() => {
      result.current.setSelectedCollaborationModeId("plan");
    });
    expect(result.current.selectedCollaborationModeId).toBe("plan");

    rerender({ workspace: workspaceTwoDisconnected, enabled: true });
    expect(result.current.selectedCollaborationModeId).toBe("plan");
    expect(result.current.collaborationModes.map((mode) => mode.id)).toEqual(["plan", "default"]);

    rerender({ workspace: workspaceTwoConnected, enabled: true });

    await waitFor(() => {
      expect(loadRuntimeCollaborationModes).toHaveBeenCalledWith("workspace-2");
      expect(result.current.selectedCollaborationModeId).toBe("plan");
    });
  });

  it("surfaces fallback chat and plan modes when no workspace is connected", async () => {
    const { result, rerender } = renderHook(
      ({ workspace }: { workspace: WorkspaceInfo | null }) =>
        useCollaborationModes({ activeWorkspace: workspace, enabled: true }),
      {
        initialProps: { workspace: null },
      }
    );

    await waitFor(() =>
      expect(result.current.collaborationModes.map((mode) => mode.id)).toEqual(["plan", "default"])
    );
    expect(result.current.selectedCollaborationModeId).toBe("default");

    act(() => {
      result.current.setSelectedCollaborationModeId("plan");
    });
    expect(result.current.selectedCollaborationModeId).toBe("plan");

    rerender({ workspace: workspaceTwoDisconnected });

    expect(result.current.collaborationModes.map((mode) => mode.id)).toEqual(["plan", "default"]);
    expect(result.current.selectedCollaborationModeId).toBe("plan");
  });

  it("resets the selection when the feature is disabled", async () => {
    vi.mocked(loadRuntimeCollaborationModes).mockResolvedValue(makeModesResponse());

    const { result, rerender } = renderHook(
      ({ workspace, enabled }: { workspace: WorkspaceInfo | null; enabled: boolean }) =>
        useCollaborationModes({ activeWorkspace: workspace, enabled }),
      {
        initialProps: { workspace: workspaceOne, enabled: true },
      }
    );

    await waitFor(() => expect(result.current.selectedCollaborationModeId).toBe("default"));

    act(() => {
      result.current.setSelectedCollaborationModeId("plan");
    });
    expect(result.current.selectedCollaborationModeId).toBe("plan");

    rerender({ workspace: workspaceOne, enabled: false });

    expect(result.current.selectedCollaborationModeId).toBeNull();
    expect(result.current.collaborationModes).toEqual([]);
  });

  it("uses the canonical runtime collaboration modes projection", async () => {
    vi.mocked(loadRuntimeCollaborationModes)
      .mockResolvedValueOnce(makeModesResponse())
      .mockResolvedValueOnce(makeModesResponse());

    const { result, rerender } = renderHook(
      ({ workspace }: { workspace: WorkspaceInfo | null }) =>
        useCollaborationModes({ activeWorkspace: workspace, enabled: true }),
      {
        initialProps: { workspace: workspaceOne },
      }
    );

    await waitFor(() =>
      expect(result.current.collaborationModes.map((mode) => mode.id)).toEqual(["plan", "default"])
    );

    rerender({ workspace: { ...workspaceOne, id: "workspace-1b" } });

    await waitFor(() =>
      expect(result.current.collaborationModes.map((mode) => mode.id)).toEqual(["plan", "default"])
    );
  });

  it("falls back to chat and plan modes when collaboration mode loading fails", async () => {
    vi.mocked(loadRuntimeCollaborationModes).mockRejectedValue(new Error("unavailable"));

    const { result } = renderHook(() =>
      useCollaborationModes({ activeWorkspace: workspaceOne, enabled: true })
    );

    await waitFor(() =>
      expect(result.current.collaborationModes.map((mode) => mode.id)).toEqual(["plan", "default"])
    );
    expect(result.current.selectedCollaborationModeId).toBe("default");
  });

  it("resets to the workspace default when selectionKey changes and preferredModeId is null", async () => {
    vi.mocked(loadRuntimeCollaborationModes).mockResolvedValue(makeModesResponse());

    const { result, rerender } = renderHook(
      ({
        workspace,
        enabled,
        preferredModeId,
        selectionKey,
      }: {
        workspace: WorkspaceInfo | null;
        enabled: boolean;
        preferredModeId: string | null;
        selectionKey: string | null;
      }) =>
        useCollaborationModes({
          activeWorkspace: workspace,
          enabled,
          preferredModeId,
          selectionKey,
        }),
      {
        initialProps: {
          workspace: workspaceOne,
          enabled: true,
          preferredModeId: "default" as string | null,
          selectionKey: "thread-a",
        },
      }
    );

    await waitFor(() => expect(result.current.selectedCollaborationModeId).toBe("default"));

    act(() => {
      result.current.setSelectedCollaborationModeId("plan");
    });
    expect(result.current.selectedCollaborationModeId).toBe("plan");

    // Thread switch with no stored override: preferredModeId is null.
    rerender({
      workspace: workspaceOne,
      enabled: true,
      preferredModeId: null,
      selectionKey: "thread-b",
    });

    expect(result.current.selectedCollaborationModeId).toBe("default");
  });

  it("falls back to the workspace default when the preferredModeId is stale", async () => {
    vi.mocked(loadRuntimeCollaborationModes).mockResolvedValue(makeModesResponse());

    const { result, rerender } = renderHook(
      (props: { enabled: boolean; preferredModeId: string | null; selectionKey: string }) =>
        useCollaborationModes({
          activeWorkspace: workspaceOne,
          enabled: props.enabled,
          preferredModeId: props.preferredModeId,
          selectionKey: props.selectionKey,
        }),
      {
        initialProps: {
          enabled: true,
          preferredModeId: "plan",
          selectionKey: "thread-a",
        },
      }
    );

    await waitFor(() => {
      expect(result.current.collaborationModes.length).toBeGreaterThan(0);
    });
    expect(result.current.selectedCollaborationModeId).toBe("plan");

    rerender({
      enabled: true,
      preferredModeId: "stale-mode-id",
      selectionKey: "thread-b",
    });

    await waitFor(() => {
      expect(result.current.selectedCollaborationModeId).toBe("default");
    });
  });

  it("reapplies preferred mode when collaboration is re-enabled on the same thread", async () => {
    vi.mocked(loadRuntimeCollaborationModes).mockResolvedValue(makeModesResponse());

    const { result, rerender } = renderHook(
      (props: { enabled: boolean; preferredModeId: string | null; selectionKey: string }) =>
        useCollaborationModes({
          activeWorkspace: workspaceOne,
          enabled: props.enabled,
          preferredModeId: props.preferredModeId,
          selectionKey: props.selectionKey,
        }),
      {
        initialProps: {
          enabled: true,
          preferredModeId: "plan",
          selectionKey: "thread-a",
        },
      }
    );

    await waitFor(() => {
      expect(result.current.selectedCollaborationModeId).toBe("plan");
    });

    rerender({
      enabled: false,
      preferredModeId: "plan",
      selectionKey: "thread-a",
    });
    expect(result.current.selectedCollaborationModeId).toBeNull();

    rerender({
      enabled: true,
      preferredModeId: "plan",
      selectionKey: "thread-a",
    });

    await waitFor(() => {
      expect(result.current.selectedCollaborationModeId).toBe("plan");
    });
  });

  it("ignores stale mode responses after switching workspaces during an in-flight fetch", async () => {
    let resolveFirst: (value: Awaited<ReturnType<typeof loadRuntimeCollaborationModes>>) => void;
    let resolveSecond: (value: Awaited<ReturnType<typeof loadRuntimeCollaborationModes>>) => void;
    const firstPromise = new Promise<Awaited<ReturnType<typeof loadRuntimeCollaborationModes>>>(
      (resolve) => {
        resolveFirst = resolve;
      }
    );
    const secondPromise = new Promise<Awaited<ReturnType<typeof loadRuntimeCollaborationModes>>>(
      (resolve) => {
        resolveSecond = resolve;
      }
    );

    vi.mocked(loadRuntimeCollaborationModes)
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(secondPromise);

    const { result, rerender } = renderHook(
      ({ workspace }: { workspace: WorkspaceInfo | null }) =>
        useCollaborationModes({ activeWorkspace: workspace, enabled: true }),
      {
        initialProps: { workspace: workspaceOne },
      }
    );

    rerender({ workspace: workspaceTwoConnected });

    await waitFor(() => {
      expect(loadRuntimeCollaborationModes).toHaveBeenCalledWith("workspace-1");
    });

    await act(async () => {
      resolveFirst(makeModesResponse());
      await Promise.resolve();
    });

    expect(result.current.collaborationModes).toEqual([]);

    await waitFor(() => {
      expect(loadRuntimeCollaborationModes).toHaveBeenCalledWith("workspace-2");
    });

    await act(async () => {
      resolveSecond(makeReviewModesResponse());
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.collaborationModes.map((mode) => mode.id)).toEqual([
        "plan",
        "review",
        "default",
      ]);
    });
  });

  it("preserves custom mode ids when a mode mask maps onto the default collaboration flow", async () => {
    vi.mocked(loadRuntimeCollaborationModes).mockResolvedValue([
      {
        id: "plan",
        label: "Plan",
        mode: "plan",
        model: "",
        reasoningEffort: null,
        developerInstructions: null,
        value: { id: "plan", mode: "plan", label: "Plan" },
      },
      {
        id: "pair-programming",
        label: "Pair Programming",
        mode: "default",
        model: "",
        reasoningEffort: null,
        developerInstructions: null,
        value: { id: "pair-programming", mode: "default", label: "Pair Programming" },
      },
    ]);

    const { result } = renderHook(() =>
      useCollaborationModes({ activeWorkspace: workspaceOne, enabled: true })
    );

    await waitFor(() => {
      expect(result.current.collaborationModes.map((mode) => mode.id)).toEqual([
        "plan",
        "pair-programming",
      ]);
    });

    expect(result.current.collaborationModes[1]).toMatchObject({
      id: "pair-programming",
      mode: "default",
      label: "Pair Programming",
    });
    expect(result.current.selectedCollaborationModeId).toBe("pair-programming");
  });
});
