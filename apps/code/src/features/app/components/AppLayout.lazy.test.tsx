// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppLayoutProps } from "./AppLayout";

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
    missionOverviewNode: <div data-testid="mission-overview" />,
    mainHeaderNode: <div data-testid="main-header" />,
    desktopTopbarLeftNode: <div data-testid="desktop-topbar-left" />,
    codexTopbarActionsNode: <div data-testid="codex-topbar-actions" />,
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

describe("AppLayout lazy boundaries", () => {
  afterEach(() => {
    cleanup();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("only initializes the desktop layout module for the default desktop path", async () => {
    const desktopFactory = vi.fn(() => ({
      DesktopLayout: () => <div data-testid="desktop-layout" />,
    }));
    const phoneFactory = vi.fn(() => ({
      PhoneLayout: () => <div data-testid="phone-layout" />,
    }));

    vi.doMock("../../layout/components/DesktopLayout", desktopFactory);
    vi.doMock("../../layout/components/PhoneLayout", phoneFactory);

    const { AppLayout } = await import("./AppLayout");

    render(<AppLayout {...createProps()} />);

    expect(await screen.findByTestId("desktop-layout")).toBeTruthy();
    expect(phoneFactory).not.toHaveBeenCalled();
  });
});
