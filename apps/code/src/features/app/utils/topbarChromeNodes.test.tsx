// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
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
      showCompactCodexThreadActions: false,
      hasActiveThread: true,
      isActiveWorkspaceConnected: true,
      threadLiveConnectionState: "live",
    });

    expect(result.desktopTopbarLeftNodeWithToggle).toBe(desktopTopbarLeftNode);

    render(result.desktopTopbarLeftNodeWithToggle);

    expect(screen.getByTestId("desktop-header")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show sidebar" })).toBeNull();
  });
});
