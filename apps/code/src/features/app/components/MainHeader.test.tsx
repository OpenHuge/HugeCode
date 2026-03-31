/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getApplyGlobalStyleBlock, readRelativeSource } from "../../../test/styleSource";
import type { WorkspaceInfo } from "../../../types";
import { MainHeader } from "./MainHeader";

vi.mock("@desktop-host/opener", () => ({
  revealItemInDir: vi.fn(async () => undefined),
}));

const pushErrorToastMock = vi.hoisted(() => vi.fn());

vi.mock("../../../application/runtime/ports/toasts", () => ({
  pushErrorToast: (...args: unknown[]) => pushErrorToastMock(...args),
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "Project Alpha",
  path: "/tmp/workspace-1",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("MainHeader", () => {
  afterEach(() => {
    cleanup();
    pushErrorToastMock.mockClear();
  });

  it("routes header-surface errors through the shared toast layer instead of inline copy", () => {
    render(
      <MainHeader
        workspace={workspace}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        branchName="main"
        onRefreshGitStatus={() => undefined}
        onToggleTerminal={() => undefined}
        isTerminalOpen={false}
        showTerminalButton={false}
        showWorkspaceTools={false}
        launchScriptError="Script cannot be empty."
        worktreeRename={{
          name: "feature/demo",
          error: "Rename failed.",
          notice: null,
          isSubmitting: false,
          isDirty: false,
          upstream: null,
          onFocus: () => undefined,
          onChange: () => undefined,
          onCancel: () => undefined,
          onCommit: () => undefined,
        }}
      />
    );

    expect(pushErrorToastMock).toHaveBeenCalledWith({
      title: "Couldn’t save action",
      message: "Script cannot be empty.",
    });
    expect(pushErrorToastMock).toHaveBeenCalledWith({
      title: "Couldn’t rename worktree",
      message: "Rename failed.",
    });
    expect(screen.queryByText("Script cannot be empty.")).toBeNull();
    expect(screen.queryByText("Rename failed.")).toBeNull();
  });

  it("keeps the workspace title row free of eyebrow copy", () => {
    render(
      <MainHeader
        workspace={workspace}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        branchName="main"
        onRefreshGitStatus={() => undefined}
        onToggleTerminal={() => undefined}
        isTerminalOpen={false}
        showTerminalButton={false}
        showWorkspaceTools={false}
      />
    );

    const title = screen.getAllByText("Project Alpha")[0];
    expect(title).toBeTruthy();
    expect(title.getAttribute("title")).toBe("Project Alpha\n/tmp/workspace-1");
    const branchButton = screen.getByRole("button", { name: "main" });
    expect(branchButton).toBeTruthy();
    expect(branchButton.getAttribute("data-workspace-chrome")).toBe("pill");
    expect(screen.queryByText(/^Workspace$/)).toBeNull();
    expect(screen.queryByText(/^Connected repo$/i)).toBeNull();
    expect(screen.queryByText("/tmp/workspace-1")).toBeNull();
    expect(document.querySelector(".workspace-separator")).toBeNull();
  });

  it("disables branch menu actions when git branches are unavailable", () => {
    render(
      <MainHeader
        workspace={workspace}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        branchName="No git repo"
        canManageBranches={false}
        onRefreshGitStatus={() => undefined}
        onToggleTerminal={() => undefined}
        isTerminalOpen={false}
        showTerminalButton={false}
        showWorkspaceTools={false}
      />
    );

    const branchButton = screen.getByRole("button", { name: "No git repo" });
    expect((branchButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(branchButton);

    expect(screen.queryByPlaceholderText("Search or create branch")).toBeNull();
  });

  it("renders a compact recent-thread menu when multiple recent threads are available", () => {
    render(
      <MainHeader
        workspace={workspace}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        branchName="main"
        onRefreshGitStatus={() => undefined}
        onToggleTerminal={() => undefined}
        isTerminalOpen={false}
        showTerminalButton={false}
        showWorkspaceTools={false}
        recentThreads={[
          {
            thread: { id: "thread-1", name: "Fix runtime startup", updatedAt: 1 },
            status: "processing",
            isActive: true,
          },
          {
            thread: { id: "thread-2", name: "Polish diff rail", updatedAt: 2 },
            status: "completed",
            isActive: false,
          },
        ]}
        onSelectRecentThread={() => undefined}
      />
    );

    expect(screen.queryByText(/active thread/i)).toBeNull();
    const summaryButton = screen.getByRole("button", { name: "Recent threads" });
    expect(summaryButton.textContent).toContain("Fix runtime startup");
    expect(summaryButton.textContent).toContain("+1");
    expect(screen.queryByRole("menuitem", { name: /Polish diff rail/i })).toBeNull();
  });

  it("moves the workspace path into the workspace title tooltip", () => {
    render(
      <MainHeader
        workspace={workspace}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        branchName="No git repo"
        canManageBranches={false}
        onRefreshGitStatus={() => undefined}
        onToggleTerminal={() => undefined}
        isTerminalOpen={false}
        showTerminalButton={false}
        showWorkspaceTools={false}
      />
    );

    const title = screen.getAllByText("Project Alpha")[0];
    expect(title.getAttribute("title")).toBe("Project Alpha\n/tmp/workspace-1");
    expect(screen.queryByText("/tmp/workspace-1")).toBeNull();
  });

  it("renders the workspace controls inside a kanna-like toolbar surface", () => {
    const { container } = render(
      <MainHeader
        workspace={workspace}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        branchName="main"
        onRefreshGitStatus={() => undefined}
        onToggleTerminal={() => undefined}
        isTerminalOpen={false}
        showTerminalButton={false}
        showWorkspaceTools={false}
      />
    );

    expect(container.querySelector('[data-main-header-surface="kanna-toolbar"]')).toBeTruthy();
    expect(container.querySelector('[data-main-header-identity="true"]')).toBeTruthy();
    expect(container.querySelector('[data-main-header-actions="true"]')).toBeTruthy();
  });

  it("omits the in-header actions container when desktop chrome owns the right-side controls", () => {
    const { container } = render(
      <MainHeader
        workspace={workspace}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={() => undefined}
        branchName="main"
        onRefreshGitStatus={() => undefined}
        onToggleTerminal={() => undefined}
        isTerminalOpen={false}
        showTerminalButton={false}
        showWorkspaceTools={false}
        renderHeaderActions={false}
      />
    );

    expect(container.querySelector('[data-main-header-identity="true"]')).toBeTruthy();
    expect(container.querySelector('[data-main-header-actions="true"]')).toBeNull();
  });

  it("keeps the main header overflow visible so anchored menus are not clipped", () => {
    const mainSource = readRelativeSource(import.meta.dirname, "../../../styles/main.css.ts");
    const topbarSource = readRelativeSource(
      import.meta.dirname,
      "../../../styles/main-topbar-workspace.css.ts"
    );

    expect(getApplyGlobalStyleBlock(mainSource, ".main-header")).toContain('overflow: "visible"');
    expect(getApplyGlobalStyleBlock(mainSource, ".main-header")).toContain(
      "var(--main-header-right-overlay-gutter, 0px)"
    );
    expect(getApplyGlobalStyleBlock(mainSource, ".main-header")).toContain(
      "var(--shell-chrome-inset-top, 10px) - 1px"
    );
    expect(getApplyGlobalStyleBlock(mainSource, ".main-header")).toContain(
      "var(--shell-chrome-row-bottom, 6px) + 3px"
    );
    expect(getApplyGlobalStyleBlock(topbarSource, ".main-header")).toContain('overflow: "visible"');
    expect(getApplyGlobalStyleBlock(topbarSource, ".main-header")).toContain(
      "var(--main-header-right-overlay-gutter, 0px)"
    );
    expect(getApplyGlobalStyleBlock(topbarSource, ".main-header")).toContain(
      "var(--shell-chrome-inset-top, 10px) - 1px"
    );
    expect(getApplyGlobalStyleBlock(topbarSource, ".main-header")).toContain(
      "var(--shell-chrome-row-bottom, 6px) + 3px"
    );
  });

  it("anchors main header actions to the shared shell chrome baseline instead of vertically centering them", () => {
    const mainSource = readRelativeSource(import.meta.dirname, "../../../styles/main.css.ts");

    expect(getApplyGlobalStyleBlock(mainSource, ".main-header-actions")).toContain(
      '"align-self": "flex-start"'
    );
  });

  it("offsets desktop right-side titlebar controls by the expanded rail width", () => {
    const baseSource = readRelativeSource(import.meta.dirname, "../../../styles/base.css.ts");

    expect(getApplyGlobalStyleBlock(baseSource, ".titlebar-controls")).toContain(
      'top: "calc(var(--shell-chrome-inset-top, 10px) + 3px)"'
    );
    expect(getApplyGlobalStyleBlock(baseSource, ".titlebar-toggle-right")).toContain(
      'right: "var(--shell-chrome-inset-x, 16px)"'
    );
    expect(
      getApplyGlobalStyleBlock(
        baseSource,
        ".app:not(.right-panel-collapsed) .titlebar-toggle-right"
      )
    ).toContain("var(--right-panel-width-live, var(--right-panel-width, 360px)) + 12px");
    expect(getApplyGlobalStyleBlock(baseSource, ".titlebar-control-group")).toContain(
      '"justify-content": "flex-end"'
    );
    expect(getApplyGlobalStyleBlock(baseSource, ".titlebar-control-group")).toContain(
      '"flex-wrap": "nowrap"'
    );
  });

  it("keeps the open-app menu icon sizing and spacing on the refined header/menu chrome", () => {
    const source = readRelativeSource(import.meta.dirname, "../../../styles/main.css.ts");
    const openAppMenuSource = readRelativeSource(import.meta.dirname, "OpenAppMenu.css.ts");

    expect(getApplyGlobalStyleBlock(source, ".open-app-label")).toContain('gap: "7px"');
    expect(getApplyGlobalStyleBlock(source, ".open-app-icon")).toContain('width: "18px"');
    expect(getApplyGlobalStyleBlock(source, ".open-app-icon--trigger")).toContain('width: "18px"');
    expect(getApplyGlobalStyleBlock(source, ".open-app-icon--menu")).toContain('width: "18px"');
    expect(getApplyGlobalStyleBlock(source, ".open-app-dropdown")).toContain('gap: "4px"');
    expect(getApplyGlobalStyleBlock(source, ".open-app-dropdown")).toContain(
      '"--ds-select-option-leading-gap": "11px"'
    );
    expect(getApplyGlobalStyleBlock(source, ".open-app-dropdown")).toContain(
      '"--ds-select-option-min-height": "32px"'
    );
    expect(getApplyGlobalStyleBlock(source, ".open-app-dropdown")).toContain(
      '"--ds-select-option-padding": "4px 8px"'
    );
    expect(getApplyGlobalStyleBlock(openAppMenuSource, ".open-app-dropdown")).toContain(
      '"--ds-select-menu-gloss": "none"'
    );
    expect(getApplyGlobalStyleBlock(openAppMenuSource, ".open-app-dropdown")).toContain(
      '"--ds-select-option-hover-shadow": "none"'
    );
    expect(getApplyGlobalStyleBlock(openAppMenuSource, ".open-app-dropdown")).toContain(
      '"--ds-select-option-selected-shadow": "none"'
    );
    expect(getApplyGlobalStyleBlock(source, ".open-app-picker")).toContain(
      '"--ds-select-trigger-leading-gap": "11px"'
    );
  });
});
