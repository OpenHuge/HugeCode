// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSharedDefaultModelsState } from "@ku0/code-workspace-client/settings-state";
import type { WorkspaceInfo } from "../../../types";
import { useSettingsDefaultModels } from "./useSettingsDefaultModels";

vi.mock("@ku0/code-workspace-client/settings-state", () => ({
  useSharedDefaultModelsState: vi.fn(() => ({
    models: [],
    isLoading: false,
    error: null,
    connectedWorkspaceCount: 0,
    refresh: vi.fn(),
  })),
}));

const useSharedDefaultModelsStateMock = vi.mocked(useSharedDefaultModelsState);

function workspace(id: string, connected = true): WorkspaceInfo {
  return {
    id,
    name: `Workspace ${id}`,
    path: `/tmp/${id}`,
    connected,
    settings: { sidebarCollapsed: false },
  };
}

describe("useSettingsDefaultModels", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("delegates model loading to the shared workspace client state", () => {
    const projects = [workspace("w1"), workspace("w2", false)];

    renderHook(() => useSettingsDefaultModels(projects, true));

    expect(useSharedDefaultModelsStateMock).toHaveBeenCalledTimes(1);
    expect(useSharedDefaultModelsStateMock.mock.calls[0]?.[0]).toEqual(projects);
    expect(useSharedDefaultModelsStateMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        enabled: true,
        parseModelListResponse: expect.any(Function),
        mapModel: expect.any(Function),
        compareModels: expect.any(Function),
      })
    );
  });
});
