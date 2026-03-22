// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PhoneLayout } from "./PhoneLayout";

describe("PhoneLayout", () => {
  it("renders the missions composer outside the compact panel", () => {
    const { container, getByTestId } = render(
      <PhoneLayout
        approvalToastsNode={<div data-testid="approval-toasts" />}
        updateToastNode={<div data-testid="update-toast" />}
        errorToastsNode={<div data-testid="error-toast" />}
        tabBarNode={<div data-testid="tab-bar" />}
        homeNode={<div data-testid="home" />}
        sidebarNode={<div data-testid="sidebar" />}
        missionOverviewNode={<div data-testid="mission-overview" />}
        activeTab="missions"
        activeWorkspace
        activeThreadId="thread-1"
        showGitDetail={false}
        compactEmptyCodexNode={<div data-testid="empty-codex" />}
        compactEmptyGitNode={<div data-testid="empty-git" />}
        compactGitBackNode={<div data-testid="git-back" />}
        topbarLeftNode={<div data-testid="topbar-left" />}
        messagesNode={<div data-testid="messages" />}
        composerNode={<div data-testid="composer" className="composer" />}
        gitDiffPanelNode={<div data-testid="git-diff-panel" />}
        gitDiffViewerNode={<div data-testid="git-diff-viewer" />}
        debugPanelNode={<div data-testid="debug-panel" />}
      />
    );

    const compactPanel = container.querySelector(".compact-panel");
    expect(compactPanel).toBeTruthy();
    expect(compactPanel?.querySelector('[data-testid="composer"]')).toBeNull();
    expect(getByTestId("composer").parentElement?.classList.contains("compact-shell")).toBe(true);
  });

  it("hides the mission overview when a mission thread is active on phone", () => {
    const { queryByTestId } = render(
      <PhoneLayout
        approvalToastsNode={<div data-testid="approval-toasts" />}
        updateToastNode={<div data-testid="update-toast" />}
        errorToastsNode={<div data-testid="error-toast" />}
        tabBarNode={<div data-testid="tab-bar" />}
        homeNode={<div data-testid="home" />}
        sidebarNode={<div data-testid="sidebar" />}
        missionOverviewNode={<div data-testid="mission-overview" />}
        activeTab="missions"
        activeWorkspace
        activeThreadId="thread-1"
        showGitDetail={false}
        compactEmptyCodexNode={<div data-testid="empty-codex" />}
        compactEmptyGitNode={<div data-testid="empty-git" />}
        compactGitBackNode={<div data-testid="git-back" />}
        topbarLeftNode={<div data-testid="topbar-left" />}
        messagesNode={<div data-testid="messages" />}
        composerNode={<div data-testid="composer" className="composer" />}
        gitDiffPanelNode={<div data-testid="git-diff-panel" />}
        gitDiffViewerNode={<div data-testid="git-diff-viewer" />}
        debugPanelNode={<div data-testid="debug-panel" />}
      />
    );

    expect(queryByTestId("mission-overview")).toBeNull();
  });
});
