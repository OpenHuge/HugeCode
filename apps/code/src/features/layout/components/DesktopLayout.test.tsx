// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { type ComponentProps, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getExportedStyleBlock, readRelativeSource } from "../../../test/styleSource";
import { DesktopLayout } from "./DesktopLayout";

type DesktopLayoutProps = ComponentProps<typeof DesktopLayout>;

function createProps(overrides: Partial<DesktopLayoutProps> = {}): DesktopLayoutProps {
  return {
    sidebarNode: <div data-testid="sidebar" />,
    updateToastNode: <div data-testid="update-toast" />,
    approvalToastsNode: <div data-testid="approval-toasts" />,
    errorToastsNode: <div data-testid="error-toasts" />,
    homeNode: <div data-testid="home" />,
    showHome: false,
    showWorkspace: true,
    topbarLeftNode: <header data-testid="main-header" />,
    centerMode: "chat",
    preloadGitDiffs: false,
    splitChatDiffView: false,
    sidebarCollapsed: false,
    onExpandSidebar: vi.fn(),
    rightPanelInterruptNode: <div data-testid="right-panel-interrupt">Interrupt</div>,
    rightPanelDetailsNode: <div data-testid="right-panel-details">Right details</div>,
    hasRightPanelDetailContent: true,
    rightPanelGitNode: <div data-testid="right-panel-git">Right git</div>,
    rightPanelFilesNode: <div data-testid="right-panel-files">Right files</div>,
    rightPanelPromptsNode: <div data-testid="right-panel-prompts">Right prompts</div>,
    messagesNode: <div data-testid="messages" />,
    gitDiffViewerNode: <div data-testid="git-diff-viewer" />,
    planPanelNode: <div data-testid="plan-panel" />,
    composerNode: <div data-testid="composer" />,
    terminalDockNode: <div data-testid="terminal-dock" />,
    debugPanelNode: <div data-testid="debug-panel" />,
    hasActivePlan: false,
    rightPanelCollapsed: false,
    onCollapseRightPanel: vi.fn(),
    onExpandRightPanel: vi.fn(),
    onSidebarResizeStart: vi.fn(),
    onRightPanelResizeStart: vi.fn(),
    onPlanPanelResizeStart: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("DesktopLayout", () => {
  it("surfaces diff as the default top-level rail tab", () => {
    render(
      <DesktopLayout
        {...createProps({
          centerMode: "chat",
          preloadGitDiffs: true,
          hasGitDiffViewerContent: true,
          rightPanelInterruptNode: null,
          rightPanelDetailsNode: null,
          rightPanelPromptsNode: null,
          planPanelNode: null,
        })}
      />
    );

    expect(screen.getByTestId("git-diff-viewer")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Diff" }).getAttribute("aria-selected")).toBe("true");
  });

  it("keeps the four rail tabs visible without auto-opening loading diff content", () => {
    render(
      <DesktopLayout
        {...createProps({
          gitDiffViewerNode: <div data-testid="git-diff-placeholder">Loading diff...</div>,
          hasGitDiffViewerContent: false,
          rightPanelInterruptNode: null,
          rightPanelDetailsNode: null,
          rightPanelPromptsNode: null,
          planPanelNode: null,
        })}
      />
    );

    expect(screen.getByRole("tab", { name: "Diff" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Git" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Files" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Context" })).toBeTruthy();
    expect(screen.getByTestId("right-panel-git")).toBeTruthy();
    expect(screen.queryByTestId("git-diff-placeholder")).toBeNull();
  });

  it("opens the context tab when the shared plan-panel event is dispatched", () => {
    render(
      <DesktopLayout
        {...createProps({
          centerMode: "diff",
          hasActivePlan: true,
          preloadGitDiffs: true,
          hasGitDiffViewerContent: true,
          rightPanelInterruptNode: null,
          rightPanelDetailsNode: null,
          rightPanelPromptsNode: null,
        })}
      />
    );

    expect(screen.getByRole("tab", { name: "Diff" }).getAttribute("aria-selected")).toBe("true");

    act(() => {
      window.dispatchEvent(new Event("hugecode:show-plan-panel"));
    });

    expect(screen.getByRole("tab", { name: "Context" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("plan-panel")).toBeTruthy();
  });

  it("expands the context rail before opening the plan tab when the rail is collapsed", () => {
    const onExpandRightPanel = vi.fn();

    render(
      <DesktopLayout
        {...createProps({
          hasActivePlan: true,
          rightPanelCollapsed: true,
          onExpandRightPanel,
        })}
      />
    );

    act(() => {
      window.dispatchEvent(new Event("hugecode:show-plan-panel"));
    });

    expect(onExpandRightPanel).toHaveBeenCalledTimes(1);
  });

  it("opens the plan context after expanding a collapsed rail from the shared event", () => {
    function Harness() {
      const [rightPanelCollapsed, setRightPanelCollapsed] = useState(true);
      return (
        <DesktopLayout
          {...createProps({
            hasActivePlan: true,
            rightPanelCollapsed,
            onExpandRightPanel: () => setRightPanelCollapsed(false),
          })}
        />
      );
    }

    render(<Harness />);

    act(() => {
      window.dispatchEvent(new Event("hugecode:show-plan-panel"));
    });

    expect(screen.getByRole("tab", { name: "Context" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("plan-panel")).toBeTruthy();
  });

  it("hides the context rail when the right panel is collapsed", () => {
    render(<DesktopLayout {...createProps({ rightPanelCollapsed: true })} />);

    expect(screen.queryByRole("tab", { name: "Git" })).toBeNull();
    expect(screen.queryByTestId("right-panel-git")).toBeNull();
    expect(screen.queryByTestId("plan-panel")).toBeNull();
  });

  it("shows the unified right panel shell when expanded", () => {
    render(
      <DesktopLayout
        {...createProps({
          rightPanelCollapsed: false,
          hasActivePlan: true,
        })}
      />
    );

    expect(screen.getByRole("tab", { name: "Diff" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Git" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Files" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Context" })).toBeTruthy();
  });

  it("keeps the composer outside the topbar actions when the right panel is expanded", () => {
    render(<DesktopLayout {...createProps({ rightPanelCollapsed: false })} />);

    const topbar = screen.getByTestId("main-header");
    expect(topbar.querySelector('[data-testid="composer"]')).toBeNull();
    expect(screen.getByTestId("composer").parentElement).not.toBe(topbar);
  });

  it("renders inspector navigation inside the right panel instead of the topbar", () => {
    render(
      <DesktopLayout
        {...createProps({
          rightPanelCollapsed: false,
          hasActivePlan: true,
        })}
      />
    );

    const topbar = screen.getByTestId("main-header");
    const diffTab = screen.getByRole("tab", { name: "Diff" });

    expect(topbar.contains(diffTab)).toBe(false);
    expect(screen.getByRole("tab", { name: "Git" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Files" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Context" })).toBeTruthy();
  });

  it("renders home without the workspace shell when requested", () => {
    render(
      <DesktopLayout
        {...createProps({
          showHome: true,
          showWorkspace: false,
        })}
      />
    );

    expect(screen.getByTestId("home")).toBeTruthy();
    expect(screen.queryByTestId("main-header")).toBeNull();
    expect(screen.queryByTestId("messages")).toBeNull();
    expect(screen.queryByTestId("composer")).toBeNull();
  });

  it("renders the sidebar expand toggle as a detached workspace overlay when collapsed", () => {
    const onExpandSidebar = vi.fn();

    render(
      <DesktopLayout
        {...createProps({
          sidebarCollapsed: true,
          onExpandSidebar,
        })}
      />
    );

    const toggle = screen.getByRole("button", { name: "Show sidebar" });
    expect(toggle.closest(".main-header")).toBeNull();
    expect(toggle.parentElement?.getAttribute("data-desktop-sidebar-expand")).toBe("true");

    act(() => {
      toggle.click();
    });

    expect(onExpandSidebar).toHaveBeenCalledTimes(1);
  });

  it("renders the right-rail expand toggle as a detached workspace overlay when collapsed", () => {
    const onExpandRightPanel = vi.fn();

    render(
      <DesktopLayout
        {...createProps({
          rightPanelCollapsed: true,
          onExpandRightPanel,
        })}
      />
    );

    const toggle = screen.getByRole("button", { name: "Show context rail" });
    expect(toggle.closest(".main-header")).toBeNull();
    expect(toggle.parentElement?.getAttribute("data-desktop-right-rail-toggle")).toBe("true");

    act(() => {
      toggle.click();
    });

    expect(onExpandRightPanel).toHaveBeenCalledTimes(1);
  });

  it("renders the right-rail collapse toggle as a detached workspace overlay when expanded", () => {
    const onExpandRightPanel = vi.fn();

    render(
      <DesktopLayout
        {...createProps({
          rightPanelCollapsed: false,
          onExpandRightPanel,
        })}
      />
    );

    const toggle = screen.getByRole("button", { name: "Hide context rail" });
    expect(toggle.closest(".main-header")).toBeNull();
    expect(toggle.parentElement?.getAttribute("data-desktop-right-rail-toggle")).toBe("true");
  });

  it("wraps the desktop workspace in a kanna-like inset shell frame", () => {
    const { container } = render(<DesktopLayout {...createProps()} />);

    const shell = container.querySelector('[data-desktop-shell="kanna-frame"]');
    const sidebarPane = container.querySelector('[data-desktop-sidebar-pane="true"]');
    const mainPane = container.querySelector('[data-desktop-main-pane="true"]');

    expect(shell).toBeTruthy();
    expect(sidebarPane).toBeTruthy();
    expect(mainPane).toBeTruthy();
    expect(shell?.contains(sidebarPane as Node)).toBe(true);
    expect(shell?.contains(mainPane as Node)).toBe(true);
  });

  it("gives the right rail its own elevated support-panel surface", () => {
    const source = readRelativeSource(import.meta.dirname, "DesktopLayout.css.ts");
    const rightRailRule = getExportedStyleBlock(source, "rightRail");
    const shellRule = source.slice(
      source.indexOf("const mainShellBase = {"),
      source.indexOf("export const mainShell")
    );

    expect(rightRailRule).toContain(
      'border: "1px solid color-mix(in srgb, var(--ds-panel-border) 72%, transparent)"'
    );
    expect(rightRailRule).toContain('margin: "0 12px 14px 8px"');
    expect(rightRailRule).toContain('backdropFilter: "blur(20px)"');
    expect(rightRailRule).toContain("radial-gradient(circle at top right");
    expect(shellRule).not.toContain("radial-gradient(circle at top right");
  });

  it("allows the sidebar track and resize handle to fully collapse", () => {
    const layoutSource = readRelativeSource(import.meta.dirname, "DesktopLayout.css.ts");
    const shellRule = getExportedStyleBlock(layoutSource, "desktopShell");
    const surfaceSource = readRelativeSource(
      import.meta.dirname,
      "../../app/hooks/useMainAppSurfaceStyles.ts"
    );

    expect(shellRule).toContain("gridTemplateColumns:");
    expect(shellRule).toContain('"minmax(0, var(--sidebar-width, 260px))');
    expect(shellRule).toContain("var(--sidebar-resize-handle-width, 12px)");
    expect(surfaceSource).toContain('"--sidebar-resize-handle-width"');
    expect(surfaceSource).toContain("`${!isPhone && sidebarCollapsed ? 0 : 12}px`");
  });

  it("reserves the topbar row before the lazy workspace header mounts", () => {
    const layoutSource = readRelativeSource(import.meta.dirname, "DesktopLayout.css.ts");
    const shellRule = layoutSource.slice(
      layoutSource.indexOf("const mainShellBase = {"),
      layoutSource.indexOf("export const mainShell")
    );
    const mainSource = readRelativeSource(import.meta.dirname, "../../../styles/main.css.ts");

    expect(shellRule).toContain(
      'gridTemplateRows: "var(--main-topbar-height, 48px) minmax(0, 1fr) auto auto auto"'
    );
    expect(mainSource).toContain(
      '"grid-template-rows": "var(--main-topbar-height, 48px) minmax(0, 1fr) auto auto auto"'
    );
  });
});
