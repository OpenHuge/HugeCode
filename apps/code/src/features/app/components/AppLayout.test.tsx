// @vitest-environment jsdom
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppLayout, type AppLayoutProps } from "./AppLayout";

vi.mock("../../layout/components/DesktopLayout", () => ({
  DesktopLayout: ({
    sidebarNode,
    homeNode,
    showHome,
    showWorkspace,
    messagesNode,
    composerNode,
  }: {
    sidebarNode: ReactNode;
    homeNode: ReactNode;
    showHome: boolean;
    showWorkspace: boolean;
    messagesNode: ReactNode;
    composerNode: ReactNode;
  }) => (
    <div data-testid="desktop-layout">
      {sidebarNode}
      {showHome ? homeNode : null}
      {showWorkspace ? messagesNode : null}
      {showWorkspace ? composerNode : null}
    </div>
  ),
}));

vi.mock("../../layout/components/PhoneLayout", () => ({
  PhoneLayout: () => <div data-testid="phone-layout" />,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

function createProps(overrides: Partial<AppLayoutProps> = {}): AppLayoutProps {
  return {
    isPhone: false,
    showHome: true,
    showGitDetail: false,
    activeTab: "home",
    activeThreadId: null,
    centerMode: "chat",
    preloadGitDiffs: false,
    splitChatDiffView: false,
    hasActivePlan: false,
    sidebarCollapsed: false,
    onExpandSidebar: vi.fn(),
    rightPanelCollapsed: true,
    onCollapseRightPanel: vi.fn(),
    onExpandRightPanel: vi.fn(),
    activeWorkspace: false,
    sidebarNode: <div data-testid="sidebar" />,
    messagesNode: <div data-testid="messages" />,
    composerNode: <div data-testid="composer" />,
    approvalToastsNode: <div data-testid="approval-toasts" />,
    updateToastNode: <div data-testid="update-toast" />,
    errorToastsNode: <div data-testid="error-toasts" />,
    homeNode: <div data-testid="home" />,
    mainHeaderNode: <div data-testid="main-header" />,
    desktopTopbarLeftNode: <div data-testid="desktop-topbar-left" />,
    tabBarNode: <div data-testid="tab-bar" />,
    rightPanelInterruptNode: <div data-testid="right-panel-interrupt" />,
    rightPanelDetailsNode: <div data-testid="right-panel-details" />,
    hasRightPanelDetailContent: true,
    rightPanelGitNode: <div data-testid="right-panel-git" />,
    rightPanelFilesNode: <div data-testid="right-panel-files" />,
    rightPanelPromptsNode: <div data-testid="right-panel-prompts" />,
    gitDiffPanelNode: <div data-testid="git-diff-panel" />,
    gitDiffViewerNode: <div data-testid="git-diff-viewer" />,
    planPanelNode: <div data-testid="plan-panel" />,
    debugPanelNode: <div data-testid="debug-panel" />,
    terminalDockNode: <div data-testid="terminal-dock" />,
    compactEmptyCodexNode: <div data-testid="compact-empty-codex" />,
    compactEmptyGitNode: <div data-testid="compact-empty-git" />,
    compactGitBackNode: <div data-testid="compact-git-back" />,
    onSidebarResizeStart: vi.fn(),
    onRightPanelResizeStart: vi.fn(),
    onPlanPanelResizeStart: vi.fn(),
    ...overrides,
  };
}

describe("AppLayout", () => {
  it("renders home instead of the workspace shell when no desktop workspace is active", async () => {
    render(
      <AppLayout
        {...createProps({
          showHome: true,
          activeWorkspace: false,
        })}
      />
    );

    expect(await screen.findByTestId("sidebar")).toBeTruthy();
    expect(await screen.findByTestId("home")).toBeTruthy();
    expect(screen.queryByTestId("messages")).toBeNull();
    expect(screen.queryByTestId("composer")).toBeNull();
  });
});
