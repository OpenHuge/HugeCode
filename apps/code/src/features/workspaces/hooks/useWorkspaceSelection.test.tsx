// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { useWorkspaceSelection } from "./useWorkspaceSelection";

const workspaceOne: WorkspaceInfo = {
  id: "ws-1",
  name: "Workspace One",
  path: "/tmp/ws-1",
  connected: true,
  settings: {
    sidebarCollapsed: false,
  },
};

const workspaceTwo: WorkspaceInfo = {
  id: "ws-2",
  name: "Workspace Two",
  path: "/tmp/ws-2",
  connected: true,
  settings: {
    sidebarCollapsed: false,
  },
};

function createOptions(
  overrides: Partial<Parameters<typeof useWorkspaceSelection>[0]> = {}
): Parameters<typeof useWorkspaceSelection>[0] {
  return {
    workspaces: [workspaceOne, workspaceTwo],
    isCompact: false,
    activeTab: "codex",
    activeWorkspaceId: null,
    setActiveTab: vi.fn(),
    setActiveWorkspaceId: vi.fn(),
    collapseRightPanel: vi.fn(),
    updateWorkspaceSettings: vi.fn().mockResolvedValue(workspaceOne),
    setCenterMode: vi.fn(),
    setSelectedDiffPath: vi.fn(),
    ...overrides,
  };
}

describe("useWorkspaceSelection", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("delegates the selected workspace change through the active workspace setter", () => {
    const options = createOptions({
      activeWorkspaceId: workspaceOne.id,
    });

    const { result } = renderHook(() => useWorkspaceSelection(options));

    act(() => {
      result.current.selectWorkspace(workspaceTwo.id);
    });

    expect(options.setActiveWorkspaceId).toHaveBeenCalledWith(workspaceTwo.id);
  });

  it("collapses the right panel when selecting a workspace from home", () => {
    const options = createOptions();

    const { result } = renderHook(() => useWorkspaceSelection(options));

    act(() => {
      result.current.selectWorkspace(workspaceOne.id);
    });

    expect(options.collapseRightPanel).toHaveBeenCalledTimes(1);
    expect(options.setActiveWorkspaceId).toHaveBeenCalledWith(workspaceOne.id);
  });

  it("navigates from home into the codex surface when selecting a workspace on desktop", () => {
    const options = createOptions({
      activeTab: "home",
    });

    const { result } = renderHook(() => useWorkspaceSelection(options));

    act(() => {
      result.current.selectWorkspace(workspaceOne.id);
    });

    expect(options.setActiveWorkspaceId).toHaveBeenCalledWith(workspaceOne.id);
    expect(options.setActiveTab).toHaveBeenCalledWith("codex");
  });

  it("navigates into missions when selecting a workspace in compact mode", () => {
    const options = createOptions({
      isCompact: true,
      activeTab: "home",
    });

    const { result } = renderHook(() => useWorkspaceSelection(options));

    act(() => {
      result.current.selectWorkspace(workspaceOne.id);
    });

    expect(options.setActiveWorkspaceId).toHaveBeenCalledWith(workspaceOne.id);
    expect(options.setActiveTab).toHaveBeenCalledWith("missions");
  });

  it("does not collapse the right panel when switching between workspaces", () => {
    const options = createOptions({
      activeWorkspaceId: workspaceOne.id,
    });

    const { result } = renderHook(() => useWorkspaceSelection(options));

    act(() => {
      result.current.selectWorkspace(workspaceTwo.id);
    });

    expect(options.collapseRightPanel).not.toHaveBeenCalled();
    expect(options.setActiveWorkspaceId).toHaveBeenCalledWith(workspaceTwo.id);
  });

  it("expands a persisted collapsed sidebar on the selected workspace", () => {
    const collapsedWorkspace: WorkspaceInfo = {
      ...workspaceOne,
      settings: {
        sidebarCollapsed: true,
      },
    };
    const updateWorkspaceSettings = vi.fn().mockResolvedValue(collapsedWorkspace);
    const options = createOptions({
      workspaces: [collapsedWorkspace, workspaceTwo],
      updateWorkspaceSettings,
    });

    const { result } = renderHook(() => useWorkspaceSelection(options));

    act(() => {
      result.current.selectWorkspace(collapsedWorkspace.id);
    });

    expect(updateWorkspaceSettings).toHaveBeenCalledWith(collapsedWorkspace.id, {
      sidebarCollapsed: false,
    });
  });

  it("delegates the home selection through the active workspace setter", () => {
    const options = createOptions({
      activeWorkspaceId: workspaceOne.id,
    });

    const { result } = renderHook(() => useWorkspaceSelection(options));

    act(() => {
      result.current.selectHome();
    });

    expect(options.setActiveWorkspaceId).toHaveBeenCalledWith(null);
  });
});
