import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePanelVisibility } from "./usePanelVisibility";

describe("usePanelVisibility", () => {
  it("toggles debug open state on desktop", () => {
    const setDebugOpen = vi.fn();
    const setActiveTab = vi.fn();
    const { result } = renderHook(() =>
      usePanelVisibility({
        isCompact: false,
        activeWorkspaceId: "workspace-1",
        activeTab: "missions",
        setActiveTab,
        setDebugOpen,
      })
    );

    act(() => {
      result.current.onToggleDebug();
    });

    expect(setDebugOpen).toHaveBeenCalledTimes(1);
    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it("toggles between settings and previous tab on compact layout", () => {
    const setDebugOpen = vi.fn();
    const setActiveTab = vi.fn();
    const { result, rerender } = renderHook(
      ({ activeTab }) =>
        usePanelVisibility({
          isCompact: true,
          activeWorkspaceId: "workspace-1",
          activeTab,
          setActiveTab,
          setDebugOpen,
        }),
      { initialProps: { activeTab: "review" as const } }
    );

    act(() => {
      result.current.onToggleDebug();
    });
    expect(setActiveTab).toHaveBeenCalledWith("settings");

    rerender({ activeTab: "settings" as const });
    act(() => {
      result.current.onToggleDebug();
    });
    expect(setActiveTab).toHaveBeenCalledWith("review");
    expect(setDebugOpen).not.toHaveBeenCalled();
  });
});
