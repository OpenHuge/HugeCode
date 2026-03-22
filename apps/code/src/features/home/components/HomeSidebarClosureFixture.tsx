import { createRef, type ComponentProps } from "react";
import { ShellFrame, ShellToolbar, SplitPanel, StatusBadge, Text } from "../../../design-system";
import type { WorkspaceInfo } from "../../../types";
import { Sidebar } from "../../app/components/Sidebar";
import type { ThreadStatusSummary } from "../../threads/utils/threadExecutionState";
import { Home } from "./Home";
import * as styles from "./HomeSidebarClosureFixture.css";

const primaryWorkspace: WorkspaceInfo = {
  id: "workspace-ui-governance",
  name: "Parallel UI",
  path: "/workspaces/parallel-ui",
  connected: true,
  settings: {
    sidebarCollapsed: false,
  },
};

const worktreeWorkspace: WorkspaceInfo = {
  id: "workspace-ui-governance-review",
  name: "Review Worktree",
  path: "/workspaces/parallel-ui-review",
  connected: true,
  parentId: primaryWorkspace.id,
  worktree: {
    branch: "review/ui-governance",
  },
  settings: {
    sidebarCollapsed: false,
  },
};

const workspaces = [primaryWorkspace, worktreeWorkspace];

const sidebarProps: ComponentProps<typeof Sidebar> = {
  workspaces,
  groupedWorkspaces: [
    {
      id: "frontend-systems",
      name: "Frontend Systems",
      workspaces,
    },
  ],
  hasLoadedWorkspaces: true,
  workspaceLoadError: null,
  missionControlProjection: null,
  hasWorkspaceGroups: true,
  deletingWorktreeIds: new Set<string>(),
  newAgentDraftWorkspaceId: null,
  startingDraftThreadWorkspaceId: null,
  threadsByWorkspace: {
    [primaryWorkspace.id]: [
      {
        id: "thread-ui-audit",
        name: "UI governance audit",
        updatedAt: Date.now() - 1000 * 60 * 4,
        lastActivityAt: Date.now() - 1000 * 60 * 4,
        agentRole: "Lead",
      },
      {
        id: "thread-launchpad",
        name: "Launchpad polish sweep",
        updatedAt: Date.now() - 1000 * 60 * 14,
        lastActivityAt: Date.now() - 1000 * 60 * 14,
        agentRole: "Reviewer",
      },
    ],
    [worktreeWorkspace.id]: [
      {
        id: "thread-sidebar-review",
        name: "Sidebar closure signoff",
        updatedAt: Date.now() - 1000 * 60 * 28,
        lastActivityAt: Date.now() - 1000 * 60 * 28,
      },
    ],
  },
  threadParentById: {},
  threadStatusById: {
    "thread-ui-audit": {
      isProcessing: true,
      hasUnread: false,
      isReviewing: false,
      executionState: "running",
      timelineState: null,
    } satisfies ThreadStatusSummary,
    "thread-launchpad": {
      isProcessing: false,
      hasUnread: false,
      isReviewing: true,
      executionState: null,
      timelineState: "reviewReady",
    } satisfies ThreadStatusSummary,
    "thread-sidebar-review": {
      isProcessing: false,
      hasUnread: true,
      isReviewing: false,
      executionState: null,
      timelineState: null,
    } satisfies ThreadStatusSummary,
  },
  threadListLoadingByWorkspace: {},
  threadListPagingByWorkspace: {},
  threadListCursorByWorkspace: {},
  threadListSortKey: "updated_at",
  onSetThreadListSortKey: () => undefined,
  onRefreshAllThreads: () => undefined,
  onSelectHome: () => undefined,
  activeWorkspaceId: primaryWorkspace.id,
  activeThreadId: "thread-ui-audit",
  accountRateLimits: null,
  usageShowRemaining: false,
  accountInfo: null,
  onRefreshCurrentUsage: () => undefined,
  onRefreshAllUsage: () => undefined,
  canRefreshCurrentUsage: true,
  canRefreshAllUsage: true,
  currentUsageRefreshLoading: false,
  allUsageRefreshLoading: false,
  onSwitchAccount: () => undefined,
  onSelectLoggedInCodexAccount: async () => undefined,
  onCancelSwitchAccount: () => undefined,
  accountSwitching: false,
  accountSwitchError: null,
  accountCenter: {
    loading: false,
    error: null,
    codex: {
      defaultPoolName: "Codex Default",
      defaultRouteAccountId: "codex-primary",
      defaultRouteAccountLabel: "codex-primary@example.com",
      connectedAccounts: [],
      defaultRouteBusyAccountId: null,
      reauthenticatingAccountId: null,
    },
    providers: [
      {
        providerId: "codex",
        label: "Codex",
        enabledCount: 1,
        totalCount: 1,
        defaultRouteLabel: "codex-primary@example.com",
        hasInteractiveControls: true,
      },
    ],
    workspaceAccounts: [],
    setCodexDefaultRouteAccount: async () => undefined,
    reauthenticateCodexAccount: async () => undefined,
  },
  onOpenSettings: () => undefined,
  onOpenDebug: () => undefined,
  showDebugButton: false,
  onCollapseSidebar: () => undefined,
  onAddWorkspace: () => undefined,
  onSelectWorkspace: () => undefined,
  onConnectWorkspace: () => undefined,
  onAddAgent: () => undefined,
  onAddWorktreeAgent: () => undefined,
  onAddCloneAgent: () => undefined,
  onToggleWorkspaceCollapse: () => undefined,
  onReorderWorkspace: () => undefined,
  onSelectThread: () => undefined,
  onDeleteThread: () => undefined,
  onSyncThread: () => undefined,
  onOpenMissionTarget: () => undefined,
  pinThread: () => false,
  unpinThread: () => undefined,
  isThreadPinned: () => false,
  getPinTimestamp: () => null,
  onRenameThread: () => undefined,
  onDeleteWorkspace: () => undefined,
  onDeleteWorktree: () => undefined,
  onLoadOlderThreads: () => undefined,
  onReloadWorkspaceThreads: () => undefined,
  workspaceDropTargetRef: createRef<HTMLElement>(),
  isWorkspaceDropActive: false,
  workspaceDropText: "Drop Project Here",
  onWorkspaceDragOver: () => undefined,
  onWorkspaceDragEnter: () => undefined,
  onWorkspaceDragLeave: () => undefined,
  onWorkspaceDrop: () => undefined,
};

const homeProps: ComponentProps<typeof Home> = {
  onOpenProject: () => undefined,
  onOpenSettings: () => undefined,
  latestAgentRuns: [
    {
      message: "Audit the UI",
      timestamp: Date.now() - 1000 * 60 * 4,
      projectName: "Parallel UI",
      groupName: "Frontend Systems",
      workspaceId: primaryWorkspace.id,
      threadId: "thread-ui-audit",
      runId: "run-ui-audit",
      taskId: "task-ui-audit",
      statusLabel: "Running",
      statusKind: "active",
      source: "runtime_snapshot_v1",
      warningCount: 0,
    },
    {
      message: "Prepare sidebar signoff",
      timestamp: Date.now() - 1000 * 60 * 15,
      projectName: "Parallel UI",
      groupName: "Frontend Systems",
      workspaceId: worktreeWorkspace.id,
      threadId: "thread-sidebar-review",
      runId: "run-sidebar-review",
      taskId: "task-sidebar-review",
      statusLabel: "Review ready",
      statusKind: "review_ready",
      source: "runtime_snapshot_v1",
      warningCount: 0,
    },
  ],
  missionControlProjection: null,
  missionControlFreshness: null,
  isLoadingLatestAgents: false,
  workspaceLoadError: null,
  onRefreshMissionControl: () => undefined,
  onSelectThread: () => undefined,
  onOpenMissionTarget: () => undefined,
  onOpenReviewMission: () => undefined,
  onSend: async () => undefined,
  onQueue: async () => undefined,
  onSendToWorkspace: async () => undefined,
  onQueueToWorkspace: async () => undefined,
  workspaces: workspaces.map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    path: workspace.path,
    connected: workspace.connected,
  })),
  activeWorkspaceId: primaryWorkspace.id,
  onSelectWorkspace: () => undefined,
  localUsageSnapshot: null,
  isLoadingLocalUsage: false,
  localUsageError: null,
  onRefreshLocalUsage: () => undefined,
  usageMetric: "tokens",
  onUsageMetricChange: () => undefined,
  usageWorkspaceId: null,
  usageWorkspaceOptions: [],
  onUsageWorkspaceChange: () => undefined,
  approvals: [],
  userInputRequests: [],
  sidebarCollapsed: false,
  onExpandSidebar: () => undefined,
};

export function HomeSidebarClosureFixture() {
  return (
    <main className={styles.page} data-visual-fixture="home-sidebar-closure">
      <ShellFrame className={styles.shell} tone="elevated" padding="lg">
        <ShellToolbar
          leading={<Text tone="muted">Home Sidebar Closure</Text>}
          trailing={<StatusBadge tone="progress">Workspace grammar</StatusBadge>}
        >
          <Text weight="semibold">Real sidebar shell paired with the home launchpad surface</Text>
        </ShellToolbar>

        <SplitPanel
          className={styles.split}
          leading={
            <div className={styles.pane}>
              <Sidebar {...sidebarProps} />
            </div>
          }
          trailing={
            <div className={`${styles.pane} ${styles.homePane}`}>
              <Home {...homeProps} />
            </div>
          }
        />
      </ShellFrame>
    </main>
  );
}
