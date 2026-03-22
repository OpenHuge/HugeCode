import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSidebarToggles } from "./useSidebarToggles";

describe("useSidebarToggles", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads persisted flags", () => {
    window.localStorage.setItem("codexmonitor.sidebarCollapsed", "true");
    window.localStorage.setItem("codexmonitor.rightRailCollapsed", "true");

    const { result } = renderHook(() => useSidebarToggles({ isCompact: false }));
    expect(result.current.sidebarCollapsed).toBe(true);
    expect(result.current.rightPanelCollapsed).toBe(true);
  });

  it("falls back to legacy right rail keys and migrates them forward", () => {
    window.localStorage.setItem("codexmonitor.contextRailCollapsed", "true");
    window.localStorage.setItem("codexmonitor.rightPanelCollapsed", "true");

    const { result } = renderHook(() => useSidebarToggles({ isCompact: false }));

    expect(result.current.rightPanelCollapsed).toBe(true);
    expect(window.localStorage.getItem("codexmonitor.rightRailCollapsed")).toBe("true");
    expect(window.localStorage.getItem("codexmonitor.contextRailCollapsed")).toBeNull();
    expect(window.localStorage.getItem("codexmonitor.rightPanelCollapsed")).toBeNull();
  });

  it("falls back safely when localStorage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage denied");
    });

    const { result } = renderHook(() => useSidebarToggles({ isCompact: false }));
    expect(result.current.sidebarCollapsed).toBe(false);
    expect(result.current.rightPanelCollapsed).toBe(false);
  });

  it("defaults the right panel to expanded for fresh desktop sessions", () => {
    const { result } = renderHook(() => useSidebarToggles({ isCompact: false }));

    expect(result.current.sidebarCollapsed).toBe(false);
    expect(result.current.rightPanelCollapsed).toBe(false);
  });

  it("keeps toggle handlers stable across unrelated rerenders", () => {
    const { result, rerender } = renderHook(({ isCompact }) => useSidebarToggles({ isCompact }), {
      initialProps: { isCompact: false },
    });

    const initialCollapseSidebar = result.current.collapseSidebar;
    const initialExpandSidebar = result.current.expandSidebar;
    const initialCollapseRightPanel = result.current.collapseRightPanel;
    const initialExpandRightPanel = result.current.expandRightPanel;

    act(() => {
      result.current.collapseSidebar();
    });

    rerender({ isCompact: false });

    expect(result.current.collapseSidebar).toBe(initialCollapseSidebar);
    expect(result.current.expandSidebar).toBe(initialExpandSidebar);
    expect(result.current.collapseRightPanel).toBe(initialCollapseRightPanel);
    expect(result.current.expandRightPanel).toBe(initialExpandRightPanel);
  });
});
