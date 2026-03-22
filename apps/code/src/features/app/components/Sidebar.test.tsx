// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef, type ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getApplyGlobalStyleBlock, readRelativeSource } from "../../../test/styleSource";
import { Sidebar } from "./Sidebar";

afterEach(() => {
  if (vi.isFakeTimers()) {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  }
  cleanup();
});

const baseProps: ComponentProps<typeof Sidebar> = {
  workspaces: [],
  groupedWorkspaces: [],
  hasLoadedWorkspaces: true,
  workspaceLoadError: null,
  hasWorkspaceGroups: false,
  deletingWorktreeIds: new Set<string>(),
  threadsByWorkspace: {},
  threadParentById: {},
  threadStatusById: {},
  threadListLoadingByWorkspace: {},
  threadListPagingByWorkspace: {},
  threadListCursorByWorkspace: {},
  threadListSortKey: "updated_at" as const,
  onSetThreadListSortKey: vi.fn(),
  onRefreshAllThreads: vi.fn(),
  activeWorkspaceId: null,
  activeThreadId: null,
  accountRateLimits: null,
  usageShowRemaining: false,
  accountInfo: null,
  onRefreshCurrentUsage: vi.fn(),
  onRefreshAllUsage: vi.fn(),
  canRefreshCurrentUsage: true,
  canRefreshAllUsage: true,
  currentUsageRefreshLoading: false,
  allUsageRefreshLoading: false,
  onSwitchAccount: vi.fn(),
  onSelectLoggedInCodexAccount: vi.fn(),
  onCancelSwitchAccount: vi.fn(),
  accountSwitching: false,
  accountSwitchError: null,
  accountCenter: {
    loading: false,
    error: null,
    codex: {
      defaultPoolName: "Codex Default",
      defaultRouteAccountId: "codex-a1",
      defaultRouteAccountLabel: "codex-a1@example.com",
      connectedAccounts: [],
      defaultRouteBusyAccountId: null,
      reauthenticatingAccountId: null,
    },
    providers: [
      {
        providerId: "codex",
        label: "Codex",
        enabledCount: 0,
        totalCount: 0,
        defaultRouteLabel: "No default route account",
        hasInteractiveControls: true,
      },
    ],
    workspaceAccounts: [],
    setCodexDefaultRouteAccount: vi.fn(),
    reauthenticateCodexAccount: vi.fn(),
  },
  onOpenSettings: vi.fn(),
  onOpenDebug: vi.fn(),
  showDebugButton: false,
  onSelectHome: vi.fn(),
  onAddWorkspace: vi.fn(),
  onSelectWorkspace: vi.fn(),
  onConnectWorkspace: vi.fn(),
  onAddAgent: vi.fn(),
  onAddWorktreeAgent: vi.fn(),
  onAddCloneAgent: vi.fn(),
  onToggleWorkspaceCollapse: vi.fn(),
  onReorderWorkspace: vi.fn(),
  onSelectThread: vi.fn(),
  onDeleteThread: vi.fn(),
  onSyncThread: vi.fn(),
  pinThread: vi.fn(() => false),
  unpinThread: vi.fn(),
  isThreadPinned: vi.fn(() => false),
  getPinTimestamp: vi.fn(() => null),
  onRenameThread: vi.fn(),
  onDeleteWorkspace: vi.fn(),
  onDeleteWorktree: vi.fn(),
  onLoadOlderThreads: vi.fn(),
  onReloadWorkspaceThreads: vi.fn(),
  workspaceDropTargetRef: createRef<HTMLElement>(),
  isWorkspaceDropActive: false,
  workspaceDropText: "Drop Project Here",
  onWorkspaceDragOver: vi.fn(),
  onWorkspaceDragEnter: vi.fn(),
  onWorkspaceDragLeave: vi.fn(),
  onWorkspaceDrop: vi.fn(),
};

function createDataTransfer(): DataTransfer {
  const store = new Map<string, string>();
  return {
    dropEffect: "none",
    effectAllowed: "all",
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: [],
    clearData: (format?: string) => {
      if (format) {
        store.delete(format);
        return;
      }
      store.clear();
    },
    getData: (format: string) => store.get(format) ?? "",
    setData: (format: string, data: string) => {
      store.set(format, data);
    },
    setDragImage: () => undefined,
  } as DataTransfer;
}

describe("Sidebar", () => {
  it("does not show the empty-state workspace button before workspaces finish loading", () => {
    render(<Sidebar {...baseProps} hasLoadedWorkspaces={false} />);

    expect(screen.queryByTestId("sidebar-empty-state-action")).toBeNull();
  });

  it("starts workspace picker from the empty-state card", () => {
    const onAddWorkspace = vi.fn();
    render(<Sidebar {...baseProps} onAddWorkspace={onAddWorkspace} />);

    const addWorkspaceButton = screen.getByTestId("sidebar-empty-state-action");
    fireEvent.click(addWorkspaceButton);

    expect(onAddWorkspace).toHaveBeenCalledTimes(1);
  });

  it("keeps search, add, and organize controls visible in the header", () => {
    const onCollapseSidebar = vi.fn();
    const onSelectHome = vi.fn();
    const { container } = render(
      <Sidebar {...baseProps} onCollapseSidebar={onCollapseSidebar} onSelectHome={onSelectHome} />
    );

    expect(screen.getByRole("button", { name: "Go to Home" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "New project" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Toggle search" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sort threads" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide sidebar" })).toBeTruthy();
    expect(screen.queryByText("Threads")).toBeNull();
    expect(container.querySelector('[data-sidebar-frame="true"]')).toBeTruthy();
    expect(container.querySelector('[data-sidebar-header="true"]')).toBeTruthy();
    expect(container.querySelector('[data-sidebar-footer="true"]')).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Hide sidebar" }));
    expect(onCollapseSidebar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Go to Home" }));
    expect(onSelectHome).toHaveBeenCalledTimes(1);
  });

  it("renders the sidebar inside a kanna-like inset card shell", () => {
    const { container } = render(<Sidebar {...baseProps} />);

    const sidebarFrame = container.querySelector('[data-sidebar-surface="kanna-card"]');
    const sidebarHeader = container.querySelector('[data-sidebar-header-surface="kanna-card"]');
    const sidebarFooter = container.querySelector('[data-sidebar-footer-surface="kanna-card"]');

    expect(sidebarFrame).toBeTruthy();
    expect(sidebarHeader).toBeTruthy();
    expect(sidebarFooter).toBeTruthy();
  });

  it("keeps the header actions as a plain layout row without an outer capsule shell", () => {
    const source = readRelativeSource(import.meta.dirname, "../../../styles/sidebar-shell.css.ts");
    const headerActionsRule = getApplyGlobalStyleBlock(source, ".sidebar-header-actions");

    expect(headerActionsRule).toContain('display: "inline-flex"');
    expect(headerActionsRule).toContain('gap: "6px"');
    expect(headerActionsRule).toContain('"margin-left": "auto"');
    expect(headerActionsRule).not.toContain("shell-chrome-toolbar-border");
    expect(headerActionsRule).not.toContain("shell-chrome-toolbar-bg");
    expect(headerActionsRule).not.toContain("shell-chrome-toolbar-shadow");
    expect(headerActionsRule).not.toContain('"border-radius": "999px"');
  });

  it("keeps the sidebar toggle icon on the same 16px grid as the header chrome", () => {
    const source = readRelativeSource(import.meta.dirname, "../../../styles/sidebar-shell.css.ts");
    const toggleIconRule = getApplyGlobalStyleBlock(
      source,
      ".sidebar-action [data-panel-split-side]"
    );

    expect(toggleIconRule).toContain('width: "16px"');
    expect(toggleIconRule).toContain('height: "16px"');
    expect(toggleIconRule).toContain('flex: "0 0 auto"');
  });

  it("gives the sidebar sort menu a calmer premium row rhythm", () => {
    const source = readRelativeSource(import.meta.dirname, "../../../styles/sidebar-shell.css.ts");
    const filterMenuRule = getApplyGlobalStyleBlock(source, ".sidebar-filter-menu");
    const filterDividerRule = getApplyGlobalStyleBlock(source, ".sidebar-filter-menu-divider");

    expect(filterMenuRule).toContain('padding: "8px"');
    expect(filterMenuRule).toContain('"border-radius": "14px"');
    expect(filterMenuRule).toContain('gap: "4px"');
    expect(source).toContain('"--ds-popover-item-radius": "10px"');
    expect(source).toContain('"--ds-popover-item-padding-block": "10px"');
    expect(source).toContain('"--ds-popover-item-padding-inline": "12px"');
    expect(source).toContain('"--ds-popover-item-hit-area": "40px"');
    expect(source).toContain('"--ds-popover-item-gap": "11px"');

    expect(filterDividerRule).toContain('margin: "4px 10px"');
  });

  it("keeps the sidebar scaffold inset aligned with the main header row", () => {
    const scaffoldSource = readRelativeSource(import.meta.dirname, "SidebarScaffold.css.ts");
    const shellSource = readRelativeSource(
      import.meta.dirname,
      "../../../styles/sidebar-shell.css.ts"
    );

    expect(scaffoldSource).toContain(
      'paddingTop: "calc(var(--shell-chrome-inset-top, 10px) + 3px)"'
    );
    expect(scaffoldSource).toContain('gap: "8px"');
    expect(scaffoldSource).toContain('display: "flex"');
    expect(scaffoldSource).toContain('flexDirection: "column"');
    expect(scaffoldSource).toContain('boxSizing: "border-box"');
    expect(scaffoldSource).toContain('marginTop: "auto"');
    expect(shellSource).toContain(`applyGlobalStyle('[data-sidebar-frame="true"].sidebar', {`);
    expect(shellSource).toContain('paddingTop: "calc(var(--shell-chrome-inset-top, 10px) + 3px)"');
    expect(shellSource).toContain('gap: "8px"');
    expect(shellSource).toContain('"margin-bottom": "0"');
    expect(shellSource).toContain('display: "none"');
    expect(shellSource).toContain(
      `applyGlobalStyle('[data-sidebar-surface="kanna-card"].sidebar', {`
    );
    expect(shellSource).toContain('padding: "12px 10px 10px"');
    expect(shellSource).toContain('borderRadius: "24px"');
    expect(shellSource).toContain('"margin-top": "0"');
  });

  it("keeps the sidebar footer embedded while upgrading it to a calmer kanna-like footer zone", () => {
    const footerSource = readRelativeSource(import.meta.dirname, "SidebarSurface.global.css.ts");
    const userNavSource = readRelativeSource(import.meta.dirname, "SidebarUserNav.css.ts");

    expect(footerSource).toContain('applyGlobalStyle(".sidebar-footer", {');
    expect(footerSource).toContain('padding: "4px 0 0"');
    expect(footerSource).toContain('"border-radius": "0"');
    expect(footerSource).toContain('border: "0"');
    expect(footerSource).toContain(
      `applyGlobalStyle('[data-sidebar-footer-surface="kanna-card"]', {`
    );
    expect(footerSource).toContain('padding: "4px 0 0"');
    expect(footerSource).toContain('border: "0"');
    expect(footerSource).toContain('background: "transparent"');
    expect(footerSource).not.toContain('"border-top":');

    expect(userNavSource).toContain('marginLeft: "0"');
    expect(userNavSource).toContain('marginRight: "0"');
    expect(userNavSource).toContain('marginBottom: "2px"');
    expect(userNavSource).toContain('padding: "9px 10px"');
    expect(userNavSource).toContain('borderRadius: "12px"');
    expect(userNavSource).toContain('width: "100%"');
    expect(userNavSource).not.toContain("linear-gradient(180deg");
    expect(userNavSource).toContain('left: "8px"');
    expect(userNavSource).toContain(
      'width: "min(calc(var(--sidebar-width, 260px) + 16px), 324px)"'
    );
    expect(userNavSource).toContain('maxWidth: "calc(100vw - 16px)"');
    expect(userNavSource).toContain("export const menu = style({");
    expect(userNavSource).toContain('width: "100%"');
    expect(userNavSource).toContain('boxShadow: "none"');
    expect(userNavSource).toContain('backdropFilter: "none"');
  });

  it("keeps sidebar thread skeletons calm and row-aligned", () => {
    const footerSource = readRelativeSource(import.meta.dirname, "SidebarSurface.global.css.ts");

    expect(footerSource).toContain('applyGlobalStyle(".thread-loading", {');
    expect(footerSource).toContain('gap: "6px"');
    expect(footerSource).toContain('padding: "6px 2px 4px"');
    expect(footerSource).toContain('applyGlobalStyle(".thread-skeleton", {');
    expect(footerSource).toContain('height: "9px"');
    expect(footerSource).toContain('"border-radius": "7px"');
    expect(footerSource).toContain('"background-size": "180% 100%"');
    expect(footerSource).toContain('animation: "shimmer 1.6s var(--ease-smooth) infinite"');
    expect(footerSource).toContain('opacity: "0.9"');
  });

  it("keeps sidebar thread rows on the tighter shell radius scale", () => {
    const shellSource = readRelativeSource(
      import.meta.dirname,
      "../../../styles/sidebar-shell.css.ts"
    );
    const surfaceSource = readRelativeSource(import.meta.dirname, "SidebarSurface.global.css.ts");
    const threadRowRule = getApplyGlobalStyleBlock(surfaceSource, ".thread-row");

    expect(shellSource).toContain('"--sidebar-thread-row-radius": "8px"');
    expect(threadRowRule).toContain('"border-radius": "var(--sidebar-thread-row-radius, 8px)"');
  });

  it("anchors workspace add actions on a dedicated trailing rail", () => {
    const source = readRelativeSource(
      import.meta.dirname,
      "../../../styles/sidebar-workspace-list.css.ts"
    );
    const workspaceActionsRule = getApplyGlobalStyleBlock(source, ".workspace-row-actions");

    expect(source).toContain('padding: "3px 6px 3px 8px"');
    expect(workspaceActionsRule).toContain('"justify-content": "flex-end"');
    expect(workspaceActionsRule).toContain('width: "42px"');
  });

  it("toggles the workspace thread list from the workspace row", () => {
    const workspace = {
      id: "ws-1",
      name: "Alpha Workspace",
      path: "/tmp/workspace",
      connected: true,
      settings: { sidebarCollapsed: false },
    };
    const onToggleWorkspaceCollapse = vi.fn();

    render(
      <Sidebar
        {...baseProps}
        workspaces={[workspace]}
        groupedWorkspaces={[{ id: null, name: "Workspaces", workspaces: [workspace] }]}
        threadsByWorkspace={{
          "ws-1": [{ id: "thread-1", name: "Thread One", updatedAt: 1000 }],
        }}
        activeWorkspaceId="ws-1"
        onToggleWorkspaceCollapse={onToggleWorkspaceCollapse}
      />
    );

    fireEvent.click(screen.getByRole("treeitem", { name: /alpha workspace/i }));

    expect(onToggleWorkspaceCollapse).toHaveBeenCalledWith("ws-1", true);
    expect(screen.queryByRole("button", { name: "Hide agents" })).toBeNull();
    expect(
      screen
        .getByRole("treeitem", { name: /alpha workspace/i })
        .closest("[data-sidebar-row='true']")
    ).toBeTruthy();
  });

  it("keeps workspace collapse chrome on low-cost state changes instead of grid row animations", () => {
    const source = readRelativeSource(
      import.meta.dirname,
      "../../../styles/sidebar-workspace-list.css.ts"
    );

    expect(source).not.toContain('"grid-template-rows var(--duration-normal) var(--ease-smooth)');
    expect(source).not.toContain('transform: "translateY(-4px)"');
  });

  it("renders workspace thread containers without grid-row expansion shells", () => {
    const source = readRelativeSource(
      import.meta.dirname,
      "../../../styles/sidebar-workspace-list.css.ts"
    );
    const workspaceContentRule = getApplyGlobalStyleBlock(source, ".workspace-card-content");

    expect(workspaceContentRule).not.toContain('display: "grid"');
    expect(workspaceContentRule).not.toContain('"grid-template-rows": "1fr"');
  });

  it("uses a lightweight reveal animation for expanded workspace threads", () => {
    const source = readRelativeSource(
      import.meta.dirname,
      "../../../styles/sidebar-workspace-list.css.ts"
    );

    expect(source).toContain('globalKeyframes("workspace-thread-reveal"');
    expect(source).toContain('animation: "workspace-thread-reveal');
  });

  it("aligns workspace add actions to the same trailing rail as thread timestamps", () => {
    const source = readRelativeSource(
      import.meta.dirname,
      "../../../styles/sidebar-workspace-list.css.ts"
    );
    const workspaceActionsRule = getApplyGlobalStyleBlock(source, ".workspace-row-actions");

    expect(workspaceActionsRule).toContain('"justify-content": "flex-end"');
    expect(workspaceActionsRule).toContain('width: "42px"');
    expect(workspaceActionsRule).toContain('"min-width": "42px"');
    expect(workspaceActionsRule).not.toContain('"margin-right": "-4px"');
  });

  it("creates a new agent directly from the workspace add button", () => {
    const workspace = {
      id: "ws-1",
      name: "Alpha Workspace",
      path: "/tmp/workspace",
      connected: true,
      settings: { sidebarCollapsed: false },
    };
    const onAddAgent = vi.fn();

    render(
      <Sidebar
        {...baseProps}
        workspaces={[workspace]}
        groupedWorkspaces={[{ id: null, name: "Workspaces", workspaces: [workspace] }]}
        onAddAgent={onAddAgent}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "New agent" }));
    expect(onAddAgent).toHaveBeenCalledWith(workspace);
    expect(screen.queryByRole("button", { name: "New worktree agent" })).toBeNull();
  });

  it("shows workspace row add actions from the inline menu on right click", () => {
    const workspace = {
      id: "ws-1",
      name: "Alpha Workspace",
      path: "/tmp/workspace",
      connected: true,
      settings: { sidebarCollapsed: false },
    };
    const onAddAgent = vi.fn();
    const onAddWorktreeAgent = vi.fn();

    render(
      <Sidebar
        {...baseProps}
        workspaces={[workspace]}
        groupedWorkspaces={[{ id: null, name: "Workspaces", workspaces: [workspace] }]}
        onAddAgent={onAddAgent}
        onAddWorktreeAgent={onAddWorktreeAgent}
      />
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "New agent" }));
    expect(onAddAgent).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "New worktree agent" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "New worktree agent" }));
    expect(onAddWorktreeAgent).toHaveBeenCalledWith(workspace);
    expect(screen.queryByRole("button", { name: "New worktree agent" })).toBeNull();
  });

  it("renders pinned workspace threads in both the workspace card and pinned section", () => {
    const workspace = {
      id: "ws-1",
      name: "Alpha Workspace",
      path: "/tmp/workspace",
      connected: true,
      settings: { sidebarCollapsed: false },
    };
    const { container } = render(
      <Sidebar
        {...baseProps}
        workspaces={[workspace]}
        groupedWorkspaces={[{ id: null, name: "Workspaces", workspaces: [workspace] }]}
        threadsByWorkspace={{
          "ws-1": [{ id: "thread-1", name: "Pinned Thread", updatedAt: 1000 }],
        }}
        isThreadPinned={vi.fn((_workspaceId: string, threadId: string) => threadId === "thread-1")}
        getPinTimestamp={vi.fn((_workspaceId: string, threadId: string) =>
          threadId === "thread-1" ? 1 : null
        )}
        activeWorkspaceId="ws-1"
        activeThreadId="thread-1"
      />
    );

    const workspaceCard = container.querySelector(
      '.workspace-card[data-workspace-id="ws-1"]'
    ) as HTMLElement | null;
    expect(workspaceCard).toBeTruthy();
    if (!workspaceCard) {
      throw new Error("Missing workspace card");
    }

    expect(within(workspaceCard).getByTitle("Pinned Thread")).toBeTruthy();
    expect(workspaceCard.getAttribute("data-sidebar-section")).toBe("workspace");

    const pinnedSection = screen
      .getByText("Pinned")
      .closest(".pinned-section") as HTMLElement | null;
    expect(pinnedSection).toBeTruthy();
    if (!pinnedSection) {
      throw new Error("Missing pinned section");
    }

    expect(within(pinnedSection).getByTitle("Pinned Thread")).toBeTruthy();
  });

  it("routes runtime-unavailable empty state to settings", () => {
    const onOpenSettings = vi.fn();
    render(
      <Sidebar
        {...baseProps}
        onOpenSettings={onOpenSettings}
        workspaceLoadError="Code runtime is unavailable for list workspaces."
      />
    );

    const card = screen.getByTestId("sidebar-empty-state");
    const button = screen.getByTestId("sidebar-empty-state-action");
    const headerAction = screen.getByRole("button", { name: "Open runtime settings" });
    expect(card.getAttribute("data-state")).toBe("runtime");

    fireEvent.click(button);
    fireEvent.click(headerAction);
    expect(onOpenSettings).toHaveBeenCalledTimes(2);
  });

  it("renders working, approval, input, plan, and completed states in thread rows", () => {
    const workspace = {
      id: "ws-1",
      name: "Alpha Workspace",
      path: "/tmp/workspace",
      connected: true,
      settings: { sidebarCollapsed: false },
    };

    render(
      <Sidebar
        {...baseProps}
        workspaces={[workspace]}
        groupedWorkspaces={[{ id: null, name: "Workspaces", workspaces: [workspace] }]}
        threadsByWorkspace={{
          "ws-1": [
            { id: "thread-working", name: "Working thread", updatedAt: 1000 },
            { id: "thread-approval", name: "Approval thread", updatedAt: 900 },
            { id: "thread-input", name: "Input thread", updatedAt: 800 },
            { id: "thread-plan", name: "Plan thread", updatedAt: 700 },
            { id: "thread-done", name: "Done thread", updatedAt: 600 },
          ],
        }}
        threadStatusById={{
          "thread-working": {
            isProcessing: true,
            hasUnread: false,
            isReviewing: false,
          },
          "thread-approval": {
            isProcessing: false,
            hasUnread: false,
            isReviewing: false,
            timelineState: "awaitingApproval",
          },
          "thread-input": {
            isProcessing: false,
            hasUnread: false,
            isReviewing: false,
            timelineState: "awaitingInput",
          },
          "thread-plan": {
            isProcessing: false,
            hasUnread: false,
            isReviewing: false,
            timelineState: "planReady",
          },
          "thread-done": {
            isProcessing: false,
            hasUnread: false,
            isReviewing: false,
            timelineState: "completed",
          },
        }}
        activeWorkspaceId="ws-1"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Show 2 more" }));
    expect(screen.getByTitle("Working thread").getAttribute("data-thread-state")).toBe(
      "processing"
    );
    expect(screen.getByTitle("Approval thread").getAttribute("data-thread-state")).toBe(
      "awaitingApproval"
    );
    expect(screen.getByTitle("Input thread").getAttribute("data-thread-state")).toBe(
      "awaitingInput"
    );
    expect(screen.getByTitle("Plan thread").getAttribute("data-thread-state")).toBe("planReady");
    expect(screen.getByTitle("Done thread").getAttribute("data-thread-state")).toBe("completed");
  });

  it("shows runtime-governed route detail for a mission thread", () => {
    const workspace = {
      id: "ws-1",
      name: "Alpha Workspace",
      path: "/tmp/workspace",
      connected: true,
      settings: { sidebarCollapsed: false },
    };

    render(
      <Sidebar
        {...baseProps}
        workspaces={[workspace]}
        groupedWorkspaces={[{ id: null, name: "Workspaces", workspaces: [workspace] }]}
        threadsByWorkspace={{
          "ws-1": [{ id: "thread-1", name: "Pinned Thread", updatedAt: 1000 }],
        }}
        activeWorkspaceId="ws-1"
        missionControlProjection={{
          source: "runtime_snapshot_v1",
          generatedAt: 1,
          workspaces: [
            {
              id: "ws-1",
              name: "Alpha Workspace",
              rootPath: "/tmp/workspace",
              connected: true,
              defaultProfileId: null,
            },
          ],
          tasks: [
            {
              id: "thread-1",
              workspaceId: "ws-1",
              title: "Pinned Thread",
              objective: "Pinned Thread",
              origin: {
                kind: "thread",
                threadId: "thread-1",
                runId: "run-1",
                requestId: null,
              },
              mode: "delegate",
              modeSource: "execution_profile",
              status: "review_ready",
              createdAt: 1,
              updatedAt: 1000,
              currentRunId: null,
              latestRunId: "run-1",
              latestRunState: "review_ready",
              nextAction: null,
            },
          ],
          runs: [
            {
              id: "run-1",
              taskId: "thread-1",
              workspaceId: "ws-1",
              state: "review_ready",
              title: "Pinned Thread",
              summary: "Validation passed and review is ready.",
              startedAt: 1,
              finishedAt: 1000,
              updatedAt: 1000,
              currentStepIndex: 0,
              warnings: [],
              validations: [],
              artifacts: [],
              reviewPackId: "review-pack:run-1",
              routing: {
                backendId: "backend-review-a",
                provider: "openai",
                providerLabel: "OpenAI",
                pool: "codex",
                routeLabel: "Workspace default backend",
                routeHint: "Resolved from workspace default backend.",
                health: "ready",
                enabledAccountCount: 1,
                readyAccountCount: 1,
                enabledPoolCount: 1,
              },
              placement: {
                resolvedBackendId: "backend-review-a",
                requestedBackendIds: [],
                resolutionSource: "workspace_default",
                lifecycleState: "confirmed",
                readiness: "ready",
                healthSummary: "placement_ready",
                attentionReasons: [],
                summary:
                  "Runtime confirmed workspace-default placement on backend backend-review-a.",
                rationale:
                  "No explicit backend preference was recorded, so runtime used the default workspace backend.",
                tcpOverlay: "tailscale",
              },
              governance: {
                state: "awaiting_review",
                label: "Awaiting review decision",
                summary: "Accept or reject this result from the review surface.",
                blocking: true,
                suggestedAction: "review_result",
                availableActions: ["review_result", "accept_result", "reject_result"],
              },
            },
          ],
          reviewPacks: [
            {
              id: "review-pack:run-1",
              runId: "run-1",
              taskId: "thread-1",
              workspaceId: "ws-1",
              summary: "Validation passed and review is ready.",
              reviewStatus: "ready",
              evidenceState: "confirmed",
              validationOutcome: "passed",
              warningCount: 0,
              warnings: [],
              validations: [],
              artifacts: [],
              checksPerformed: [],
              recommendedNextAction: "Review the result",
              createdAt: 1000,
            },
          ],
        }}
      />
    );

    expect(screen.getByText("Review ready")).toBeTruthy();
    expect(screen.getByText("Workspace default backend · backend-review-a")).toBeTruthy();
  });

  it("renders a mission queue entry for a runtime-managed mission and opens its operator target", () => {
    const workspace = {
      id: "ws-1",
      name: "Alpha Workspace",
      path: "/tmp/workspace",
      connected: true,
      settings: { sidebarCollapsed: false },
    };
    const onOpenMissionTarget = vi.fn();

    render(
      <Sidebar
        {...baseProps}
        onOpenMissionTarget={onOpenMissionTarget}
        workspaces={[workspace]}
        groupedWorkspaces={[{ id: null, name: "Workspaces", workspaces: [workspace] }]}
        missionControlProjection={{
          source: "runtime_snapshot_v1",
          generatedAt: 1,
          workspaces: [
            {
              id: "ws-1",
              name: "Alpha Workspace",
              rootPath: "/tmp/workspace",
              connected: true,
              defaultProfileId: null,
            },
          ],
          tasks: [
            {
              id: "mission-task-1",
              workspaceId: "ws-1",
              title: "Publish release notes",
              objective: "Prepare the publish handoff",
              origin: {
                kind: "run",
                threadId: null,
                runId: "run-1",
                requestId: null,
              },
              mode: "delegate",
              modeSource: "execution_profile",
              status: "review_ready",
              createdAt: 1,
              updatedAt: 1000,
              currentRunId: null,
              latestRunId: "run-1",
              latestRunState: "review_ready",
              nextAction: null,
            },
          ],
          runs: [
            {
              id: "run-1",
              taskId: "mission-task-1",
              workspaceId: "ws-1",
              state: "review_ready",
              title: "Publish release notes",
              summary: "Validation passed and review is ready.",
              startedAt: 1,
              finishedAt: 1000,
              updatedAt: 1000,
              currentStepIndex: 0,
              warnings: [],
              validations: [],
              artifacts: [],
              reviewPackId: "review-pack:run-1",
              routing: {
                backendId: "backend-review-a",
                provider: "openai",
                providerLabel: "OpenAI",
                pool: "codex",
                routeLabel: "Workspace default backend",
                routeHint: "Resolved from workspace default backend.",
                health: "ready",
                enabledAccountCount: 1,
                readyAccountCount: 1,
                enabledPoolCount: 1,
              },
              placement: {
                resolvedBackendId: "backend-review-a",
                requestedBackendIds: [],
                resolutionSource: "workspace_default",
                lifecycleState: "confirmed",
                readiness: "ready",
                healthSummary: "placement_ready",
                attentionReasons: [],
                summary:
                  "Runtime confirmed workspace-default placement on backend backend-review-a.",
                rationale:
                  "No explicit backend preference was recorded, so runtime used the default workspace backend.",
                tcpOverlay: "tailscale",
              },
              governance: {
                state: "awaiting_review",
                label: "Awaiting review decision",
                summary: "Accept or reject this result from the review surface.",
                blocking: true,
                suggestedAction: "review_result",
                availableActions: ["review_result", "accept_result", "reject_result"],
              },
            },
          ],
          reviewPacks: [
            {
              id: "review-pack:run-1",
              runId: "run-1",
              taskId: "mission-task-1",
              workspaceId: "ws-1",
              summary: "Validation passed and review is ready.",
              reviewStatus: "ready",
              evidenceState: "confirmed",
              validationOutcome: "passed",
              warningCount: 0,
              warnings: [],
              validations: [],
              artifacts: [],
              checksPerformed: [],
              recommendedNextAction: "Review the result",
              createdAt: 1000,
            },
          ],
        }}
      />
    );

    expect(screen.getByTestId("sidebar-mission-queue")).toBeTruthy();
    expect(screen.getByText("Mission queue")).toBeTruthy();
    expect(screen.getByText("Publish release notes")).toBeTruthy();
    expect(screen.getByText("Open review")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /publish release notes/i }));

    expect(onOpenMissionTarget).toHaveBeenCalledWith({
      kind: "review",
      workspaceId: "ws-1",
      taskId: "mission-task-1",
      runId: "run-1",
      reviewPackId: "review-pack:run-1",
      limitation: "thread_unavailable",
    });
  });

  it("reorders projects from the sidebar when a workspace is dropped onto another one", () => {
    const onReorderWorkspace = vi.fn();
    const alphaWorkspace = {
      id: "ws-1",
      name: "Alpha Workspace",
      path: "/tmp/alpha",
      connected: true,
      settings: { sidebarCollapsed: false, sortOrder: 0 },
    };
    const betaWorkspace = {
      id: "ws-2",
      name: "Beta Workspace",
      path: "/tmp/beta",
      connected: true,
      settings: { sidebarCollapsed: false, sortOrder: 1 },
    };

    render(
      <Sidebar
        {...baseProps}
        onReorderWorkspace={onReorderWorkspace}
        workspaces={[alphaWorkspace, betaWorkspace]}
        groupedWorkspaces={[
          { id: null, name: "Workspaces", workspaces: [alphaWorkspace, betaWorkspace] },
        ]}
      />
    );

    const dataTransfer = createDataTransfer();
    const alphaRow = screen
      .getByText("Alpha Workspace")
      .closest('[data-sidebar-row="true"]') as HTMLElement;
    const betaRow = screen
      .getByText("Beta Workspace")
      .closest('[data-sidebar-row="true"]') as HTMLElement;

    Object.defineProperty(betaRow, "getBoundingClientRect", {
      value: () =>
        ({
          top: 100,
          height: 40,
          left: 0,
          right: 200,
          bottom: 140,
          width: 200,
          x: 0,
          y: 100,
          toJSON: () => ({}),
        }) satisfies DOMRect,
    });

    fireEvent.dragStart(alphaRow, { dataTransfer });
    fireEvent.dragOver(betaRow, { dataTransfer, clientY: 99 });
    fireEvent.drop(betaRow, { dataTransfer, clientY: 99 });

    expect(onReorderWorkspace).toHaveBeenCalledWith("ws-1", "ws-2", "after");
  });

  it("supports dropping a workspace into the first slot in a group", () => {
    const onReorderWorkspace = vi.fn();
    const alphaWorkspace = {
      id: "ws-1",
      name: "Alpha Workspace",
      path: "/tmp/alpha",
      connected: true,
      settings: { sidebarCollapsed: false, sortOrder: 0 },
    };
    const betaWorkspace = {
      id: "ws-2",
      name: "Beta Workspace",
      path: "/tmp/beta",
      connected: true,
      settings: { sidebarCollapsed: false, sortOrder: 1 },
    };

    render(
      <Sidebar
        {...baseProps}
        onReorderWorkspace={onReorderWorkspace}
        workspaces={[alphaWorkspace, betaWorkspace]}
        groupedWorkspaces={[
          { id: null, name: "Workspaces", workspaces: [alphaWorkspace, betaWorkspace] },
        ]}
      />
    );

    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(
      screen.getByText("Beta Workspace").closest('[data-sidebar-row="true"]') as HTMLElement,
      {
        dataTransfer,
      }
    );
    fireEvent.dragOver(screen.getByTestId("workspace-drop-slot-ws-1-before"), { dataTransfer });
    fireEvent.drop(screen.getByTestId("workspace-drop-slot-ws-1-before"), { dataTransfer });

    expect(onReorderWorkspace).toHaveBeenCalledWith("ws-2", "ws-1", "before");
  });

  it("supports dropping a workspace into the last slot in a group", () => {
    const onReorderWorkspace = vi.fn();
    const alphaWorkspace = {
      id: "ws-1",
      name: "Alpha Workspace",
      path: "/tmp/alpha",
      connected: true,
      settings: { sidebarCollapsed: false, sortOrder: 0 },
    };
    const betaWorkspace = {
      id: "ws-2",
      name: "Beta Workspace",
      path: "/tmp/beta",
      connected: true,
      settings: { sidebarCollapsed: false, sortOrder: 1 },
    };

    render(
      <Sidebar
        {...baseProps}
        onReorderWorkspace={onReorderWorkspace}
        workspaces={[alphaWorkspace, betaWorkspace]}
        groupedWorkspaces={[
          { id: null, name: "Workspaces", workspaces: [alphaWorkspace, betaWorkspace] },
        ]}
      />
    );

    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(
      screen.getByText("Alpha Workspace").closest('[data-sidebar-row="true"]') as HTMLElement,
      {
        dataTransfer,
      }
    );
    fireEvent.dragOver(screen.getByTestId("workspace-drop-slot-ws-2-after"), { dataTransfer });
    fireEvent.drop(screen.getByTestId("workspace-drop-slot-ws-2-after"), { dataTransfer });

    expect(onReorderWorkspace).toHaveBeenCalledWith("ws-1", "ws-2", "after");
  });

  it("shows workspace drag feedback while reordering", () => {
    const alphaWorkspace = {
      id: "ws-1",
      name: "Alpha Workspace",
      path: "/tmp/alpha",
      connected: true,
      settings: { sidebarCollapsed: false, sortOrder: 0 },
    };
    const betaWorkspace = {
      id: "ws-2",
      name: "Beta Workspace",
      path: "/tmp/beta",
      connected: true,
      settings: { sidebarCollapsed: false, sortOrder: 1 },
    };

    const { container } = render(
      <Sidebar
        {...baseProps}
        workspaces={[alphaWorkspace, betaWorkspace]}
        groupedWorkspaces={[
          { id: null, name: "Workspaces", workspaces: [alphaWorkspace, betaWorkspace] },
        ]}
      />
    );

    const dataTransfer = createDataTransfer();
    const alphaRow = screen
      .getByText("Alpha Workspace")
      .closest('[data-sidebar-row="true"]') as HTMLElement;
    const betaRow = screen
      .getByText("Beta Workspace")
      .closest('[data-sidebar-row="true"]') as HTMLElement;

    Object.defineProperty(betaRow, "getBoundingClientRect", {
      value: () =>
        ({
          top: 100,
          height: 40,
          left: 0,
          right: 200,
          bottom: 140,
          width: 200,
          x: 0,
          y: 100,
          toJSON: () => ({}),
        }) satisfies DOMRect,
    });

    fireEvent.dragStart(alphaRow, { dataTransfer });
    expect(alphaRow.className).toContain("is-dragging");
    expect(
      container.querySelector(".workspace-list")?.getAttribute("data-workspace-dragging")
    ).toBe("true");

    fireEvent.dragOver(betaRow, { dataTransfer, clientY: 99 });
    expect(betaRow.closest('[data-drop-position="after"]')).toBeTruthy();

    fireEvent.dragEnd(alphaRow, { dataTransfer });
    expect(alphaRow.className.includes("is-dragging")).toBe(false);
    expect(
      container.querySelector(".workspace-list")?.getAttribute("data-workspace-dragging")
    ).toBeNull();
  });

  it("clears the active drop indicator when the drag leaves a workspace target", () => {
    const alphaWorkspace = {
      id: "ws-1",
      name: "Alpha Workspace",
      path: "/tmp/alpha",
      connected: true,
      settings: { sidebarCollapsed: false, sortOrder: 0 },
    };
    const betaWorkspace = {
      id: "ws-2",
      name: "Beta Workspace",
      path: "/tmp/beta",
      connected: true,
      settings: { sidebarCollapsed: false, sortOrder: 1 },
    };

    render(
      <Sidebar
        {...baseProps}
        workspaces={[alphaWorkspace, betaWorkspace]}
        groupedWorkspaces={[
          { id: null, name: "Workspaces", workspaces: [alphaWorkspace, betaWorkspace] },
        ]}
      />
    );

    const dataTransfer = createDataTransfer();
    const alphaRow = screen
      .getByText("Alpha Workspace")
      .closest('[data-sidebar-row="true"]') as HTMLElement;
    const betaRow = screen
      .getByText("Beta Workspace")
      .closest('[data-sidebar-row="true"]') as HTMLElement;

    Object.defineProperty(betaRow, "getBoundingClientRect", {
      value: () =>
        ({
          top: 100,
          height: 40,
          left: 0,
          right: 200,
          bottom: 140,
          width: 200,
          x: 0,
          y: 100,
          toJSON: () => ({}),
        }) satisfies DOMRect,
    });

    fireEvent.dragStart(alphaRow, { dataTransfer });
    fireEvent.dragOver(betaRow, { dataTransfer, clientY: 99 });
    expect(betaRow.closest('[data-drop-position="after"]')).toBeTruthy();

    fireEvent.dragLeave(betaRow, { dataTransfer });
    expect(betaRow.closest("[data-drop-position]")).toBeNull();
  });

  it("keeps workspace actions clickable while whole-row dragging is enabled", () => {
    const alphaWorkspace = {
      id: "ws-1",
      name: "Alpha Workspace",
      path: "/tmp/alpha",
      connected: true,
      settings: { sidebarCollapsed: false, sortOrder: 0 },
    };

    const { container } = render(
      <Sidebar
        {...baseProps}
        workspaces={[alphaWorkspace]}
        groupedWorkspaces={[{ id: null, name: "Workspaces", workspaces: [alphaWorkspace] }]}
      />
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "New agent" }));

    expect(screen.getByText("New agent")).toBeTruthy();
    expect(
      container.querySelector(".workspace-list")?.getAttribute("data-workspace-dragging")
    ).toBeNull();
  });

  it("does not start workspace reordering while sidebar search is active", () => {
    vi.useFakeTimers();

    const alphaWorkspace = {
      id: "ws-1",
      name: "Alpha Workspace",
      path: "/tmp/alpha",
      connected: true,
      settings: { sidebarCollapsed: false, sortOrder: 0 },
    };
    const betaWorkspace = {
      id: "ws-2",
      name: "Beta Workspace",
      path: "/tmp/beta",
      connected: true,
      settings: { sidebarCollapsed: false, sortOrder: 1 },
    };

    const { container } = render(
      <Sidebar
        {...baseProps}
        workspaces={[alphaWorkspace, betaWorkspace]}
        groupedWorkspaces={[
          { id: null, name: "Workspaces", workspaces: [alphaWorkspace, betaWorkspace] },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle search" }));
    const input = screen.getByLabelText("Search projects and threads");
    act(() => {
      fireEvent.change(input, { target: { value: "Alpha" } });
      vi.runOnlyPendingTimers();
    });

    expect(container.querySelector('.workspace-row[draggable="true"]')).toBeNull();
  });

  it("toggles the search bar from the header icon", () => {
    vi.useFakeTimers();
    render(<Sidebar {...baseProps} />);

    const toggleButton = screen.getByRole("button", { name: "Toggle search" });
    expect(screen.queryByLabelText("Search projects and threads")).toBeNull();

    act(() => {
      fireEvent.click(toggleButton);
    });
    const input = screen.getByLabelText("Search projects and threads") as HTMLInputElement;
    expect(input).toBeTruthy();

    act(() => {
      fireEvent.change(input, { target: { value: "alpha" } });
      vi.runOnlyPendingTimers();
    });
    expect(input.value).toBe("alpha");

    act(() => {
      fireEvent.click(toggleButton);
      vi.runOnlyPendingTimers();
    });
    expect(screen.queryByLabelText("Search projects and threads")).toBeNull();

    act(() => {
      fireEvent.click(toggleButton);
      vi.runOnlyPendingTimers();
    });
    const reopened = screen.getByLabelText("Search projects and threads") as HTMLInputElement;
    expect(reopened.value).toBe("");
  });

  it("shows matching thread chains inside a collapsed workspace search result", () => {
    vi.useFakeTimers();

    render(
      <Sidebar
        {...baseProps}
        workspaces={[
          {
            id: "ws-1",
            name: "Alpha Workspace",
            path: "/tmp/workspace",
            connected: true,
            settings: { sidebarCollapsed: true },
          },
        ]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Workspaces",
            workspaces: [
              {
                id: "ws-1",
                name: "Alpha Workspace",
                path: "/tmp/workspace",
                connected: true,
                settings: { sidebarCollapsed: true },
              },
            ],
          },
        ]}
        threadsByWorkspace={{
          "ws-1": [
            { id: "root-1", name: "Planning Root", updatedAt: 1000 },
            { id: "child-1", name: "Deploy Fix", updatedAt: 900 },
            { id: "child-2", name: "Sibling Thread", updatedAt: 800 },
            { id: "root-2", name: "Other Root", updatedAt: 700 },
          ],
        }}
        threadParentById={{
          "child-1": "root-1",
          "child-2": "root-1",
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle search" }));
    const input = screen.getByLabelText("Search projects and threads");

    act(() => {
      fireEvent.change(input, { target: { value: "deploy" } });
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByText("Alpha Workspace")).toBeTruthy();
    expect(screen.getByTitle("Planning Root")).toBeTruthy();
    expect(screen.getByTitle("Deploy Fix")).toBeTruthy();
    expect(screen.getAllByText("Deploy")[0]?.className ?? "").toContain("workspace-name-match");
    expect(screen.queryByText("Sibling Thread")).toBeNull();
    expect(screen.queryByText("Other Root")).toBeNull();
    expect(screen.queryByRole("button", { name: "Load older..." })).toBeNull();
  });

  it("shows thread-aware empty state copy when search has no matches", () => {
    vi.useFakeTimers();

    render(
      <Sidebar
        {...baseProps}
        workspaces={[
          {
            id: "ws-1",
            name: "Alpha Workspace",
            path: "/tmp/workspace",
            connected: true,
            settings: { sidebarCollapsed: false },
          },
        ]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Workspaces",
            workspaces: [
              {
                id: "ws-1",
                name: "Alpha Workspace",
                path: "/tmp/workspace",
                connected: true,
                settings: { sidebarCollapsed: false },
              },
            ],
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle search" }));
    const input = screen.getByLabelText("Search projects and threads");

    act(() => {
      fireEvent.change(input, { target: { value: "missing-thread" } });
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByTestId("sidebar-search-empty-state")).toBeTruthy();
  });

  it("opens thread sort menu from the header filter button", () => {
    const onSetThreadListSortKey = vi.fn();
    render(
      <Sidebar
        {...baseProps}
        threadListSortKey="updated_at"
        onSetThreadListSortKey={onSetThreadListSortKey}
      />
    );

    const button = screen.getByRole("button", { name: "Sort threads" });
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(button);
    expect(screen.getByRole("menu", { name: "Organize threads" })).toBeTruthy();
    const option = screen.getByRole("menuitemradio", { name: "Created" });
    fireEvent.click(option);

    expect(onSetThreadListSortKey).toHaveBeenCalledWith("created_at");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("refreshes all workspace threads from the organize menu", () => {
    const onRefreshAllThreads = vi.fn();
    render(
      <Sidebar
        {...baseProps}
        workspaces={[
          {
            id: "ws-1",
            name: "Workspace",
            path: "/tmp/workspace",
            connected: true,
            settings: { sidebarCollapsed: false },
          },
        ]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Workspaces",
            workspaces: [
              {
                id: "ws-1",
                name: "Workspace",
                path: "/tmp/workspace",
                connected: true,
                settings: { sidebarCollapsed: false },
              },
            ],
          },
        ]}
        onRefreshAllThreads={onRefreshAllThreads}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sort threads" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh all workspace threads" }));
    expect(onRefreshAllThreads).toHaveBeenCalledTimes(1);
  });

  it("opens settings from the user menu", () => {
    vi.useFakeTimers();
    const onOpenSettings = vi.fn();
    render(<Sidebar {...baseProps} onOpenSettings={onOpenSettings} />);

    fireEvent.click(screen.getByRole("button", { name: "User menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    act(() => {
      vi.runAllTimers();
    });
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("opens settings once for a primary mouse click sequence from user menu", () => {
    vi.useFakeTimers();
    const onOpenSettings = vi.fn();
    render(<Sidebar {...baseProps} onOpenSettings={onOpenSettings} />);

    fireEvent.click(screen.getByRole("button", { name: "User menu" }));
    const settingsButton = screen.getByRole("button", { name: "Open settings" });
    fireEvent.mouseDown(settingsButton, { button: 0 });
    fireEvent.click(settingsButton, { detail: 1 });
    act(() => {
      vi.runAllTimers();
    });

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("shows account management and logged-in account switching actions in the user menu", async () => {
    vi.useFakeTimers();
    const onSwitchAccount = vi.fn();
    const onSelectLoggedInCodexAccount = vi.fn().mockResolvedValue(undefined);
    const onOpenSettings = vi.fn();
    render(
      <Sidebar
        {...baseProps}
        onSwitchAccount={onSwitchAccount}
        onSelectLoggedInCodexAccount={onSelectLoggedInCodexAccount}
        onOpenSettings={onOpenSettings}
        accountCenter={{
          ...baseProps.accountCenter,
          codex: {
            ...baseProps.accountCenter.codex,
            connectedAccounts: [
              {
                accountId: "codex-a1",
                label: "user@example.com",
                status: "enabled",
                isDefaultRoute: true,
                canReauthenticate: true,
                updatedAtLabel: "Updated just now",
              },
              {
                accountId: "codex-a2",
                label: "other@example.com",
                status: "enabled",
                isDefaultRoute: false,
                canReauthenticate: true,
                updatedAtLabel: "Updated just now",
              },
            ],
          },
          setCodexDefaultRouteAccount: vi.fn(),
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "User menu" }));

    expect(screen.getByRole("button", { name: "Manage Accounts & Billing" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Manage Accounts & Billing" }));
    act(() => {
      vi.runAllTimers();
    });
    expect(onOpenSettings).toHaveBeenCalledWith("codex");

    fireEvent.click(screen.getByRole("button", { name: "User menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Switch Codex account" }));
    expect(screen.getByText("Choose from logged-in Codex accounts")).toBeTruthy();
    expect(
      screen.getByText(
        "Project workspace routing is separate from ChatGPT workspace membership. Manage ChatGPT workspaces in Accounts & Billing."
      )
    ).toBeTruthy();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Use logged-in Codex account other@example.com" })
      );
    });
    expect(onSelectLoggedInCodexAccount).toHaveBeenCalledWith("codex-a2");
    expect(onSwitchAccount).not.toHaveBeenCalled();
  });

  it("opens debug once for a primary mouse click sequence", () => {
    vi.useFakeTimers();
    const onOpenDebug = vi.fn();
    render(<Sidebar {...baseProps} showDebugButton onOpenDebug={onOpenDebug} />);

    fireEvent.click(screen.getByRole("button", { name: "User menu" }));
    const debugButton = screen.getByRole("button", { name: "Open debug log" });
    fireEvent.mouseDown(debugButton, { button: 0 });
    fireEvent.click(debugButton, { detail: 1 });
    act(() => {
      vi.runAllTimers();
    });

    expect(onOpenDebug).toHaveBeenCalledTimes(1);
  });

  it("disables refresh in the organize menu while workspace threads are refreshing", () => {
    render(
      <Sidebar
        {...baseProps}
        workspaces={[
          {
            id: "ws-1",
            name: "Workspace",
            path: "/tmp/workspace",
            connected: true,
            settings: { sidebarCollapsed: false },
          },
        ]}
        groupedWorkspaces={[
          {
            id: null,
            name: "Workspaces",
            workspaces: [
              {
                id: "ws-1",
                name: "Workspace",
                path: "/tmp/workspace",
                connected: true,
                settings: { sidebarCollapsed: false },
              },
            ],
          },
        ]}
        threadListLoadingByWorkspace={{ "ws-1": true }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sort threads" }));
    const refreshButton = screen.getByRole("button", { name: "Refresh all workspace threads" });
    expect(refreshButton).toHaveProperty("disabled", true);
    const icon = refreshButton.querySelector("svg");
    expect(icon?.getAttribute("class") ?? "").toContain("spinning");
  });

  it("shows a top New Agent draft row and selects workspace when clicked", () => {
    const onSelectWorkspace = vi.fn();
    const props = {
      ...baseProps,
      workspaces: [
        {
          id: "ws-1",
          name: "Workspace",
          path: "/tmp/workspace",
          connected: true,
          settings: { sidebarCollapsed: false },
        },
      ],
      groupedWorkspaces: [
        {
          id: null,
          name: "Workspaces",
          workspaces: [
            {
              id: "ws-1",
              name: "Workspace",
              path: "/tmp/workspace",
              connected: true,
              settings: { sidebarCollapsed: false },
            },
          ],
        },
      ],
      newAgentDraftWorkspaceId: "ws-1",
      activeWorkspaceId: "ws-1",
      activeThreadId: null,
      onSelectWorkspace,
    };

    render(<Sidebar {...props} />);

    const draftRow = screen
      .getAllByRole("button", { name: /new agent/i })
      .find((element) => element.className.includes("thread-row-draft"));
    expect(draftRow).toBeTruthy();
    if (!draftRow) {
      throw new Error("Expected New Agent draft row");
    }
    expect(draftRow.className).toContain("thread-row-draft");
    expect(draftRow.className).toContain("active");

    fireEvent.click(draftRow);
    expect(onSelectWorkspace).toHaveBeenCalledWith("ws-1");
  });

  it("does not render a flex spacer between the workspace list and user nav", () => {
    const { container } = render(<Sidebar {...baseProps} />);

    expect(container.querySelector(".sidebar-body")).toBeTruthy();
    expect(container.querySelector(".sidebar-user-nav")).toBeTruthy();
    expect(container.querySelector(".sidebar-footer-spacer")).toBeNull();
    expect(container.querySelector('[data-sidebar-body="true"]')).toBeTruthy();
    expect(container.querySelector('[data-sidebar-footer="true"] .sidebar-user-nav')).toBeTruthy();
  });
});
