// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDebugPanelViewModelBuilderParams } from "../test/debugPanelHookFixtures";
import { createDebugPanelViewModel } from "./debugPanelViewModel";
import { useDebugPanelViewModel } from "./useDebugPanelViewModel";
import { useDebugPanelViewModelInputs } from "./useDebugPanelViewModelInputs";

vi.mock("./debugPanelViewModel", async () => {
  const actual =
    await vi.importActual<typeof import("./debugPanelViewModel")>("./debugPanelViewModel");

  return {
    ...actual,
    createDebugPanelViewModel: vi.fn(actual.createDebugPanelViewModel),
  };
});

vi.mock("./useDebugPanelViewModelInputs", () => ({
  useDebugPanelViewModelInputs: vi.fn(),
}));

const createDebugPanelViewModelMock = vi.mocked(createDebugPanelViewModel);
const useDebugPanelViewModelInputsMock = vi.mocked(useDebugPanelViewModelInputs);

describe("useDebugPanelViewModel", () => {
  beforeEach(() => {
    useDebugPanelViewModelInputsMock.mockReturnValue(createDebugPanelViewModelBuilderParams());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("delegates builder input collection and final assembly", () => {
    const builderParams = createDebugPanelViewModelBuilderParams();

    useDebugPanelViewModelInputsMock.mockReturnValue(builderParams);

    const { result } = renderHook(() =>
      useDebugPanelViewModel({
        entries: builderParams.entries,
        isOpen: builderParams.isOpen,
        workspaceId: builderParams.workspaceId,
        onClear: builderParams.onClear,
        onCopy: builderParams.onCopy,
        onResizeStart: builderParams.onResizeStart,
        variant: builderParams.variant,
      })
    );

    expect(useDebugPanelViewModelInputsMock).toHaveBeenCalledWith({
      entries: builderParams.entries,
      isOpen: builderParams.isOpen,
      workspaceId: builderParams.workspaceId,
      onClear: builderParams.onClear,
      onCopy: builderParams.onCopy,
      onResizeStart: builderParams.onResizeStart,
      variant: builderParams.variant,
    });
    expect(createDebugPanelViewModelMock).toHaveBeenCalledWith(builderParams);
    expect(result.current).toEqual(createDebugPanelViewModelMock.mock.results.at(-1)?.value);
  });
});
