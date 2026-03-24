// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildTopbarChromeNodes } from "./topbarChromeNodes";

describe("buildTopbarChromeNodes", () => {
  it("keeps the desktop header node untouched when the sidebar is collapsed", () => {
    const desktopTopbarLeftNode = <header data-testid="desktop-header">Workspace header</header>;

    const result = buildTopbarChromeNodes({
      isCompact: false,
      sidebarToggleProps: {
        isCompact: false,
        sidebarCollapsed: true,
        rightPanelCollapsed: false,
        onCollapseSidebar: vi.fn(),
        onExpandSidebar: vi.fn(),
        onCollapseRightPanel: vi.fn(),
        onExpandRightPanel: vi.fn(),
      },
      desktopTopbarLeftNode,
      desktopTopbarRightNode: <div data-testid="desktop-header-actions">Actions</div>,
      showCompactCodexThreadActions: false,
      hasActiveThread: true,
      isActiveWorkspaceConnected: true,
      threadLiveConnectionState: "live",
    });

    expect(result.desktopTopbarLeftNodeWithToggle).toBe(desktopTopbarLeftNode);

    render(result.desktopTopbarLeftNodeWithToggle);

    expect(screen.getByTestId("desktop-header")).toBeTruthy();
  });

  it("renders titlebar controls and switches the right toggle action in place", () => {
    const baseProps = {
      isCompact: false,
      sidebarToggleProps: {
        isCompact: false,
        sidebarCollapsed: true,
        rightPanelCollapsed: true,
        onCollapseSidebar: vi.fn(),
        onExpandSidebar: vi.fn(),
        onCollapseRightPanel: vi.fn(),
        onExpandRightPanel: vi.fn(),
      },
      desktopTopbarLeftNode: <header data-testid="desktop-header">Workspace header</header>,
      desktopTopbarRightNode: <button type="button">Header action</button>,
      showCompactCodexThreadActions: false,
      hasActiveThread: true,
      isActiveWorkspaceConnected: true,
      threadLiveConnectionState: "live" as const,
    };

    const collapsedResult = buildTopbarChromeNodes(baseProps);
    const { rerender } = render(collapsedResult.titlebarControlsNode);

    expect(screen.getByRole("button", { name: "Show sidebar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show context rail" })).toBeTruthy();
    const rightControls = document.querySelector('[data-titlebar-right-controls="true"]');
    if (!(rightControls instanceof HTMLElement)) {
      throw new Error("Expected shared right control group");
    }
    expect(within(rightControls).getByRole("button", { name: "Header action" })).toBeTruthy();
    expect(within(rightControls).getByRole("button", { name: "Show context rail" })).toBeTruthy();

    const expandedResult = buildTopbarChromeNodes({
      ...baseProps,
      sidebarToggleProps: {
        ...baseProps.sidebarToggleProps,
        sidebarCollapsed: false,
        rightPanelCollapsed: false,
      },
    });

    rerender(expandedResult.titlebarControlsNode);

    expect(screen.queryByRole("button", { name: "Show sidebar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Hide context rail" })).toBeTruthy();
  });
});
