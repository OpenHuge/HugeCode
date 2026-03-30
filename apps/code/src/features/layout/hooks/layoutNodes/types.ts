import type { DragEvent, MouseEvent, ReactNode, RefObject } from "react";
import type { RuntimeReviewGetV2Response } from "@ku0/code-runtime-host-contract";
import type { ErrorToast } from "../../../../application/runtime/ports/toasts";
import type { MissionControlProjection } from "../../../../application/runtime/facades/runtimeMissionControlFacade";
import type { RepositoryExecutionContract } from "../../../../application/runtime/facades/runtimeRepositoryExecutionContract";
import type {
  AutoDriveRuntimeAutonomyState,
  AutoDriveRuntimeDecisionTrace,
  AutoDriveRuntimeOutcomeFeedback,
  AutoDriveRuntimeScenarioProfile,
  AutoDriveStopReason,
  AutoDriveWaypointStatus,
} from "../../../../application/runtime/types/autoDrive";
import type {
  AccessMode,
  AccountSnapshot,
  ApprovalRequest,
  CollaborationModeOption,
  ComposerEditorSettings,
  ComposerExecutionMode,
  ComposerModelSelectionMode,
  ConversationItem,
  CustomPromptOption,
  DebugEntry,
  DynamicToolCallRequest,
  DynamicToolCallResponse,
  GitFileStatus,
  GitHubIssue,
  GitHubPullRequest,
  GitHubPullRequestComment,
  GitLogEntry,
  LocalUsageSnapshot,
  ModelOption,
  OpenAppTarget,
  QueuedMessage,
  RateLimitSnapshot,
  RequestUserInputRequest,
  RequestUserInputResponse,
  SkillOption,
  ThreadListSortKey,
  ThreadSummary,
  ThreadTokenUsage,
  TurnPlan,
  WorkspaceInfo,
} from "../../../../types";
import type { WorkspaceLaunchScriptsState } from "../../../app/hooks/useWorkspaceLaunchScripts";
import type { AccountCenterState } from "../../../app/hooks/useAccountCenterState";
import type { BranchSwitcherSelection } from "../../../git/types/branchWorkflow";
import type { CodexSection } from "../../../settings/components/settingsTypes";
import type {
  AtlasDetailLevel,
  AtlasLongTermMemoryDigest,
} from "../../../atlas/utils/atlasContext";
import type { AppTab } from "../../../shell/types/shellRoute";
import type { TerminalSessionState } from "../../../terminal/hooks/useTerminalSession";
import type { TerminalTab } from "../../../terminal/hooks/useTerminalTabs";
import type { ReviewPromptState, ReviewPromptStep } from "../../../threads/hooks/useReviewPrompt";
import type { ThreadStatusSummary } from "../../../threads/utils/threadExecutionState";
import type { PostUpdateNoticeState, UpdateState } from "../../../update/hooks/useUpdater";
import type { MissionNavigationTarget } from "../../../missions/utils/missionControlPresentation";
import type {
  ReviewPackSelectionRequest,
  ReviewPackSelectionState,
  ReviewPackDetailModel,
} from "../../../review/utils/reviewPackSurfaceModel";
import type { ReviewPackDecisionSubmissionState } from "../../../review/hooks/useReviewPackDecisionActions";
import type { MissionInterventionDraft } from "../../../../application/runtime/facades/runtimeTaskInterventionDraftFacade";

export type ThreadActivityStatus = ThreadStatusSummary & {
  processingStartedAt?: number | null;
  lastDurationMs?: number | null;
};

export type GitDiffViewerItem = {
  path: string;
  status: string;
  diff: string;
  scope?: "staged" | "unstaged";
  isImage?: boolean;
  oldImageData?: string | null;
  newImageData?: string | null;
  oldImageMime?: string | null;
  newImageMime?: string | null;
};

export type WorktreeRenameState = {
  name: string;
  error: string | null;
  notice: string | null;
  isSubmitting: boolean;
  isDirty: boolean;
  upstream?: {
    oldBranch: string;
    newBranch: string;
    error: string | null;
    isSubmitting: boolean;
    onConfirm: () => void;
  } | null;
  onFocus: () => void;
  onChange: (value: string) => void;
  onCancel: () => void;
  onCommit: () => void;
};

export type ComposerAccountOption = {
  id: string;
  label: string;
  status: string;
};

export type LayoutNodesFieldRegistry = {
  workspaces: WorkspaceInfo[];
  groupedWorkspaces: Array<{
    id: string | null;
    name: string;
    workspaces: WorkspaceInfo[];
  }>;
  hasLoadedWorkspaces: boolean;
  workspaceLoadError?: string | null;
  hasWorkspaceGroups: boolean;
  deletingWorktreeIds: Set<string>;
  newAgentDraftWorkspaceId?: string | null;
  startingDraftThreadWorkspaceId?: string | null;
  threadsByWorkspace: Record<string, ThreadSummary[]>;
  threadParentById: Record<string, string>;
  threadStatusById: Record<string, ThreadActivityStatus>;
  activeTurnIdByThread: Record<string, string | null>;
  turnDiffByThread: Record<string, string>;
  threadResumeLoadingById: Record<string, boolean>;
  threadListLoadingByWorkspace: Record<string, boolean>;
  threadSnapshotsReady: boolean;
  threadListPagingByWorkspace: Record<string, boolean>;
  threadListCursorByWorkspace: Record<string, string | null>;
  threadListSortKey: ThreadListSortKey;
  onSetThreadListSortKey: (sortKey: ThreadListSortKey) => void;
  onRefreshAllThreads: () => void;
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  activeItems: ConversationItem[];
  itemsByThread: Record<string, ConversationItem[]>;
  showPollingFetchStatus?: boolean;
  pollingIntervalMs?: number;
  activeRateLimits: RateLimitSnapshot | null;
  usageShowRemaining: boolean;
  accountInfo: AccountSnapshot | null;
  onRefreshCurrentUsage: () => void;
  onRefreshAllUsage: () => void;
  canRefreshCurrentUsage: boolean;
  canRefreshAllUsage: boolean;
  currentUsageRefreshLoading: boolean;
  allUsageRefreshLoading: boolean;
  onSwitchAccount: () => void;
  onSelectLoggedInCodexAccount: (accountId: string) => Promise<void>;
  onCancelSwitchAccount: () => void;
  accountSwitching: boolean;
  accountSwitchError: string | null;
  accountCenter: AccountCenterState;
  codeBlockCopyUseModifier: boolean;
  showMessageFilePath: boolean;
  showInternalRuntimeDiagnostics: boolean;
  openAppTargets: OpenAppTarget[];
  openAppIconById: Record<string, string>;
  selectedOpenAppId: string;
  onSelectOpenAppId: (id: string) => void;
  approvals: ApprovalRequest[];
  userInputRequests: RequestUserInputRequest[];
  toolCallRequests: DynamicToolCallRequest[];
  handleApprovalDecision: (request: ApprovalRequest, decision: "accept" | "decline") => void;
  handleApprovalRemember: (request: ApprovalRequest, command: string[]) => void;
  handleUserInputSubmit: (
    request: RequestUserInputRequest,
    response: RequestUserInputResponse
  ) => void;
  handleToolCallSubmit: (
    request: DynamicToolCallRequest,
    response: DynamicToolCallResponse
  ) => void;
  onPlanAccept?: () => void;
  onPlanSubmitChanges?: (changes: string) => void;
  onOpenSettings: (section?: CodexSection) => void;
  onConnectLocalRuntimePort?: (target: {
    host: string | null;
    port: number;
  }) => Promise<void> | void;
  onCollapseSidebar?: () => void;
  onExpandSidebar?: () => void;
  sidebarCollapsed: boolean;
  rightPanelCollapsed: boolean;
  onOpenDebug: () => void;
  showDebugButton: boolean;
  onOpenProject: () => void;
  onAddWorkspace: () => void;
  onSelectHome: () => void;
  onSelectWorkspace: (workspaceId: string) => void;
  onConnectWorkspace: (workspace: WorkspaceInfo) => Promise<void>;
  onAddAgent: (workspace: WorkspaceInfo) => Promise<void>;
  onAddWorktreeAgent: (workspace: WorkspaceInfo) => Promise<void>;
  onAddCloneAgent: (workspace: WorkspaceInfo) => Promise<void>;
  onOpenBranchSwitcher: () => void;
  onSelectBranchWorkflowSelection: (selection: BranchSwitcherSelection) => void | Promise<void>;
  onToggleWorkspaceCollapse: (workspaceId: string, collapsed: boolean) => void;
  onReorderWorkspace: (
    sourceWorkspaceId: string,
    targetWorkspaceId: string,
    position: "before" | "after"
  ) => void | Promise<void>;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  onOpenThreadLink: (threadId: string) => void;
  onEditMessage: (item: Extract<ConversationItem, { kind: "message" }>) => void;
  onDeleteThread: (workspaceId: string, threadId: string) => void;
  onSyncThread: (workspaceId: string, threadId: string) => void;
  pinThread: (workspaceId: string, threadId: string) => boolean;
  unpinThread: (workspaceId: string, threadId: string) => void;
  isThreadPinned: (workspaceId: string, threadId: string) => boolean;
  getPinTimestamp: (workspaceId: string, threadId: string) => number | null;
  onRenameThread: (workspaceId: string, threadId: string) => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  onDeleteWorktree: (workspaceId: string) => void;
  onLoadOlderThreads: (workspaceId: string) => void;
  onReloadWorkspaceThreads: (workspaceId: string) => void;
  workspaceDropTargetRef: RefObject<HTMLElement | null>;
  isWorkspaceDropActive: boolean;
  workspaceDropText: string;
  onWorkspaceDragOver: (event: DragEvent<HTMLElement>) => void;
  onWorkspaceDragEnter: (event: DragEvent<HTMLElement>) => void;
  onWorkspaceDragLeave: (event: DragEvent<HTMLElement>) => void;
  onWorkspaceDrop: (event: DragEvent<HTMLElement>) => void;
  updaterState: UpdateState;
  onUpdate: () => void;
  onDismissUpdate: () => void;
  postUpdateNotice: PostUpdateNoticeState;
  onDismissPostUpdateNotice: () => void;
  errorToasts: ErrorToast[];
  onDismissErrorToast: (id: string) => void;
  latestAgentRuns: Array<{
    threadId: string;
    runId: string | null;
    taskId: string | null;
    message: string;
    timestamp: number;
    projectName: string;
    groupName?: string | null;
    workspaceId: string;
    statusLabel: string;
    statusKind: "active" | "review_ready" | "needs_input" | "attention" | "recent_activity";
    source: "runtime_snapshot_v1";
    warningCount: number;
    navigationTarget?: MissionNavigationTarget;
    secondaryLabel?: string | null;
  }>;
  missionControlProjection?: MissionControlProjection | null;
  activeRepositoryExecutionContract?: RepositoryExecutionContract | null;
  missionControlFreshness?: {
    status: "idle" | "loading" | "refreshing" | "ready" | "error";
    isStale: boolean;
    error: string | null;
    lastUpdatedAt: number | null;
  } | null;
  onRefreshMissionControl?: () => void | Promise<void>;
  reviewPackSelection: ReviewPackSelectionState;
  runtimeReviewPack?: RuntimeReviewGetV2Response;
  onOpenReviewPack: (selection: ReviewPackSelectionRequest) => void;
  reviewPackDecisionSubmission?: ReviewPackDecisionSubmissionState | null;
  onSubmitReviewPackDecision?: (input: {
    reviewPackId: string;
    action: ReviewPackDetailModel["decisionActions"][number];
  }) => void | Promise<void>;
  reviewInterventionBackendOptions?: Array<{ value: string; label: string }>;
  reviewInterventionDefaultBackendId?: string | null;
  reviewInterventionLaunchError?: string | null;
  onLaunchReviewInterventionDraft?: (input: {
    workspaceId: string;
    navigationTarget: MissionNavigationTarget | null;
    draft: MissionInterventionDraft;
  }) => void | Promise<void>;
  onRunReviewAgent?: (input: {
    workspaceId: string;
    taskId: string;
    runId: string;
    reviewPackId?: string | null;
  }) => void | Promise<void>;
  onApplyReviewAutofix?: (input: {
    workspaceId: string;
    taskId: string;
    runId: string;
    reviewPackId?: string | null;
    autofixCandidate: {
      id: string;
      summary: string;
      status: "available" | "applied" | "blocked";
    };
  }) => void | Promise<void>;
  isLoadingLatestAgents: boolean;
  localUsageSnapshot: LocalUsageSnapshot | null;
  isLoadingLocalUsage: boolean;
  localUsageError: string | null;
  onRefreshLocalUsage: () => void;
  usageMetric: "tokens" | "time";
  onUsageMetricChange: (metric: "tokens" | "time") => void;
  usageWorkspaceId: string | null;
  usageWorkspaceOptions: Array<{ id: string; label: string }>;
  onUsageWorkspaceChange: (workspaceId: string | null) => void;
  onSelectHomeThread: (workspaceId: string, threadId: string) => void;
  activeWorkspace: WorkspaceInfo | null;
  activeParentWorkspace: WorkspaceInfo | null;
  worktreeLabel: string | null;
  worktreeRename?: WorktreeRenameState;
  isWorktreeWorkspace: boolean;
  branchName: string;
  onRefreshGitStatus: () => void;
  onCopyThread: () => void | Promise<void>;
  onToggleTerminal: () => void;
  showTerminalButton: boolean;
  showWorkspaceTools: boolean;
  launchScript: string | null;
  launchScriptEditorOpen: boolean;
  launchScriptDraft: string;
  launchScriptSaving: boolean;
  launchScriptError: string | null;
  onRunLaunchScript: () => void;
  onOpenLaunchScriptEditor: () => void;
  onCloseLaunchScriptEditor: () => void;
  onLaunchScriptDraftChange: (value: string) => void;
  onSaveLaunchScript: () => void;
  launchScriptsState?: WorkspaceLaunchScriptsState;
  mainHeaderActionsNode?: ReactNode;
  centerMode: "chat" | "diff";
  onExitDiff: () => void;
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  gitPanelMode: "diff" | "log" | "issues" | "prs";
  onGitPanelModeChange: (mode: "diff" | "log" | "issues" | "prs") => void;
  isPhone: boolean;
  gitDiffViewStyle: "split" | "unified";
  gitDiffIgnoreWhitespaceChanges: boolean;
  worktreeApplyLabel: string;
  worktreeApplyTitle: string | null;
  worktreeApplyLoading: boolean;
  worktreeApplyError: string | null;
  worktreeApplySuccess: boolean;
  onApplyWorktreeChanges?: () => void | Promise<void>;
  filePanelMode: "git" | "files" | "atlas" | "prompts";
  onFilePanelModeChange: (mode: "git" | "files" | "atlas" | "prompts") => void;
  atlasDriverOrder?: string[] | null;
  atlasEnabled?: boolean;
  atlasDetailLevel?: AtlasDetailLevel;
  atlasLongTermMemoryDigest?: AtlasLongTermMemoryDigest | null;
  onAtlasDriverOrderChange?: (order: string[]) => void;
  onAtlasEnabledChange?: (enabled: boolean) => void;
  onAtlasDetailLevelChange?: (detailLevel: AtlasDetailLevel) => void;
  fileTreeLoading: boolean;
  gitStatus: {
    branchName: string;
    files: GitFileStatus[];
    stagedFiles: GitFileStatus[];
    unstagedFiles: GitFileStatus[];
    totalAdditions: number;
    totalDeletions: number;
    error: string | null;
  };
  fileStatus: string;
  selectedDiffPath: string | null;
  diffScrollRequestId: number;
  onSelectDiff: (path: string) => void;
  gitLogEntries: GitLogEntry[];
  gitLogTotal: number;
  gitLogAhead: number;
  gitLogBehind: number;
  gitLogAheadEntries: GitLogEntry[];
  gitLogBehindEntries: GitLogEntry[];
  gitLogUpstream: string | null;
  selectedCommitSha: string | null;
  onSelectCommit: (entry: GitLogEntry) => void;
  gitLogError: string | null;
  gitLogLoading: boolean;
  gitIssues: GitHubIssue[];
  gitIssuesTotal: number;
  gitIssuesLoading: boolean;
  gitIssuesError: string | null;
  onStartTaskFromGitHubIssue?: (issue: GitHubIssue) => Promise<void> | void;
  onStartTaskFromGitHubIssueFollowUp?: (issue: GitHubIssue) => Promise<void> | void;
  onDelegateGitHubIssue?: (issue: GitHubIssue) => void | Promise<void>;
  gitPullRequests: GitHubPullRequest[];
  gitPullRequestsTotal: number;
  gitPullRequestsLoading: boolean;
  gitPullRequestsError: string | null;
  onStartTaskFromGitHubPullRequest?: (pullRequest: GitHubPullRequest) => Promise<void> | void;
  onStartTaskFromGitHubPullRequestReviewCommentCommand?: (
    pullRequest: GitHubPullRequest,
    comment: GitHubPullRequestComment
  ) => Promise<void> | void;
  selectedPullRequestNumber: number | null;
  selectedPullRequest: GitHubPullRequest | null;
  selectedPullRequestComments: GitHubPullRequestComment[];
  selectedPullRequestCommentsLoading: boolean;
  selectedPullRequestCommentsError: string | null;
  onSelectPullRequest: (pullRequest: GitHubPullRequest) => void;
  onDelegateGitHubPullRequest?: (pullRequest: GitHubPullRequest) => void | Promise<void>;
  gitRemoteUrl: string | null;
  gitRoot: string | null;
  gitRootCandidates: string[];
  gitRootScanDepth: number;
  gitRootScanLoading: boolean;
  gitRootScanError: string | null;
  gitRootScanHasScanned: boolean;
  onGitRootScanDepthChange: (depth: number) => void;
  onScanGitRoots: () => void;
  onSelectGitRoot: (path: string) => void;
  onClearGitRoot: () => void;
  onPickGitRoot: () => void | Promise<void>;
  onStageGitAll: () => Promise<void>;
  onStageGitFile: (path: string) => Promise<void>;
  onUnstageGitFile: (path: string) => Promise<void>;
  onRevertGitFile: (path: string) => Promise<void>;
  onRevertAllGitChanges: () => Promise<void>;
  diffSource: "local" | "pr" | "commit";
  gitDiffs: GitDiffViewerItem[];
  gitDiffLoading: boolean;
  gitDiffError: string | null;
  onDiffActivePathChange?: (path: string) => void;
  commitMessage: string;
  commitMessageLoading: boolean;
  commitMessageError: string | null;
  onCommitMessageChange: (value: string) => void;
  onGenerateCommitMessage: () => void | Promise<void>;
  onCommit?: () => void | Promise<void>;
  onCommitAndPush?: () => void | Promise<void>;
  onCommitAndSync?: () => void | Promise<void>;
  onPull?: () => void | Promise<void>;
  onFetch?: () => void | Promise<void>;
  onPush?: () => void | Promise<void>;
  onSync?: () => void | Promise<void>;
  commitLoading?: boolean;
  pullLoading?: boolean;
  fetchLoading?: boolean;
  pushLoading?: boolean;
  syncLoading?: boolean;
  commitError?: string | null;
  pullError?: string | null;
  fetchError?: string | null;
  pushError?: string | null;
  syncError?: string | null;
  commitsAhead?: number;
  onSendPrompt: (text: string) => void | Promise<void>;
  onSendPromptToNewAgent: (text: string) => void | Promise<void>;
  onCreatePrompt: (data: {
    scope: "workspace" | "global";
    name: string;
    description?: string | null;
    argumentHint?: string | null;
    content: string;
  }) => void | Promise<void>;
  onUpdatePrompt: (data: {
    path: string;
    name: string;
    description?: string | null;
    argumentHint?: string | null;
    content: string;
  }) => void | Promise<void>;
  onDeletePrompt: (path: string) => void | Promise<void>;
  onMovePrompt: (data: { path: string; scope: "workspace" | "global" }) => void | Promise<void>;
  onRevealWorkspacePrompts: () => void | Promise<void>;
  onRevealGeneralPrompts: () => void | Promise<void>;
  canRevealGeneralPrompts: boolean;
  onSend: (text: string, images: string[]) => void | false | Promise<void | false>;
  onQueue: (text: string, images: string[]) => void | false | Promise<void | false>;
  onSendToWorkspace?: (
    workspaceId: string,
    text: string,
    images: string[]
  ) => void | false | Promise<void | false>;
  onQueueToWorkspace?: (
    workspaceId: string,
    text: string,
    images: string[]
  ) => void | false | Promise<void | false>;
  onStop: () => void;
  canStop: boolean;
  onFileAutocompleteActiveChange?: (active: boolean) => void;
  isReviewing: boolean;
  isProcessing: boolean;
  steerEnabled: boolean;
  reviewPrompt: ReviewPromptState;
  onReviewPromptClose: () => void;
  onReviewPromptShowPreset: () => void;
  onReviewPromptChoosePreset: (preset: Exclude<ReviewPromptStep, "preset"> | "uncommitted") => void;
  highlightedPresetIndex: number;
  onReviewPromptHighlightPreset: (index: number) => void;
  highlightedBranchIndex: number;
  onReviewPromptHighlightBranch: (index: number) => void;
  highlightedCommitIndex: number;
  onReviewPromptHighlightCommit: (index: number) => void;
  onReviewPromptKeyDown: (event: {
    key: string;
    shiftKey?: boolean;
    preventDefault: () => void;
  }) => boolean;
  onReviewPromptSelectBranch: (value: string) => void;
  onReviewPromptSelectBranchAtIndex: (index: number) => void;
  onReviewPromptConfirmBranch: () => Promise<void>;
  onReviewPromptSelectCommit: (sha: string, title: string) => void;
  onReviewPromptSelectCommitAtIndex: (index: number) => void;
  onReviewPromptConfirmCommit: () => Promise<void>;
  onReviewPromptUpdateCustomInstructions: (value: string) => void;
  onReviewPromptConfirmCustom: () => Promise<void>;
  activeTokenUsage: ThreadTokenUsage | null;
  activeQueue: QueuedMessage[];
  queuePausedReason: string | null;
  draftText: string;
  onDraftChange: (next: string) => void;
  activeImages: string[];
  onPickImages: () => void | Promise<void>;
  onAttachImages: (paths: string[]) => void;
  onRemoveImage: (path: string) => void;
  prefillDraft: QueuedMessage | null;
  onPrefillHandled: (id: string) => void;
  insertText: QueuedMessage | null;
  onInsertHandled: (id: string) => void;
  onEditQueued: (item: QueuedMessage) => void;
  onDeleteQueued: (id: string) => void;
  collaborationModes: CollaborationModeOption[];
  selectedCollaborationModeId: string | null;
  onSelectCollaborationMode: (id: string | null) => void;
  composerAccountOptions?: ComposerAccountOption[];
  selectedAccountIds?: string[];
  onSelectAccountIds?: (ids: string[]) => void;
  modelSelectionMode?: ComposerModelSelectionMode;
  selectedProviderId?: string | null;
  onSelectProvider?: (providerId: string) => void;
  onSelectAutoRoute?: (providerId: string | null) => void;
  onSelectModelSelectionMode?: (mode: ComposerModelSelectionMode) => void;
  models: ModelOption[];
  selectedModelId: string | null;
  onSelectModel: (id: string | null) => void;
  reasoningOptions: string[];
  selectedEffort: string | null;
  onSelectEffort: (effort: string | null) => void;
  fastModeEnabled: boolean;
  onToggleFastMode: (enabled: boolean) => void;
  reasoningSupported: boolean;
  accessMode: AccessMode;
  onSelectAccessMode: (mode: AccessMode) => void;
  executionOptions: Array<{ value: ComposerExecutionMode; label: string; disabled?: boolean }>;
  selectedExecutionMode: ComposerExecutionMode;
  onSelectExecutionMode: (mode: ComposerExecutionMode) => void;
  remoteBackendOptions?: Array<{ value: string; label: string }>;
  selectedRemoteBackendId?: string | null;
  onSelectRemoteBackendId?: (backendId: string | null) => void;
  resolvedRemotePlacement?: {
    summary: string;
    detail: string | null;
    tone: "neutral" | "warning";
  } | null;
  autoDrive?: {
    source?: string | null;
    enabled: boolean;
    destination: {
      title: string;
      endState: string;
      doneDefinition: string;
      avoid: string;
      routePreference:
        | "stability_first"
        | "minimal_change"
        | "validation_first"
        | "docs_first"
        | "speed_first";
    };
    budget: {
      maxTokens: number;
      maxIterations: number;
      maxDurationMinutes: number;
      maxFilesPerIteration: number;
      maxNoProgressIterations: number;
      maxValidationFailures: number;
      maxReroutes: number;
    };
    riskPolicy: {
      pauseOnDestructiveChange: boolean;
      pauseOnDependencyChange: boolean;
      pauseOnLowConfidence: boolean;
      pauseOnHumanCheckpoint: boolean;
      allowNetworkAnalysis: boolean;
      allowValidationCommands: boolean;
      minimumConfidence: "low" | "medium" | "high";
    };
    preset: {
      active: "safe_default" | "tight_validation" | "fast_explore" | "custom";
      apply: (key: "safe_default" | "tight_validation" | "fast_explore") => void;
    };
    controls: {
      canStart: boolean;
      canPause: boolean;
      canResume: boolean;
      canStop: boolean;
      busyAction: "starting" | "pausing" | "resuming" | "stopping" | null;
      onStart: () => void | Promise<void>;
      onPause: () => void | Promise<void>;
      onResume: () => void | Promise<void>;
      onStop: () => void | Promise<void>;
    };
    recovering: boolean;
    recoverySummary?: string | null;
    activity: Array<{
      id: string;
      kind: "control" | "status" | "stage" | "waypoint" | "reroute" | "stop";
      title: string;
      detail: string;
      iteration: number | null;
      timestamp: number;
    }>;
    readiness: {
      readyToLaunch: boolean;
      issues: string[];
      warnings: string[];
      checklist: Array<{
        label: string;
        complete: boolean;
      }>;
      setupProgress: number;
    };
    run?: {
      status:
        | "created"
        | "running"
        | "paused"
        | "review_ready"
        | "completed"
        | "cancelled"
        | "stopped"
        | "failed";
      stage: string;
      iteration: number;
      consumedTokensEstimate: number;
      maxTokens: number;
      maxIterations: number;
      startStateSummary: string | null;
      destinationSummary: string;
      routeSummary: string | null;
      currentMilestone: string | null;
      currentWaypointTitle: string | null;
      currentWaypointObjective: string | null;
      currentWaypointArrivalCriteria: string[];
      remainingMilestones: string[];
      offRoute: boolean;
      rerouting: boolean;
      rerouteReason: string | null;
      overallProgress: number;
      waypointCompletion: number;
      stopRisk: "low" | "medium" | "high";
      arrivalConfidence: "low" | "medium" | "high";
      remainingTokens: number | null;
      remainingIterations: number;
      remainingDurationMs: number | null;
      remainingBlockers: string[];
      lastValidationSummary: string | null;
      stopReason: string | null;
      stopReasonCode?: AutoDriveStopReason["code"] | null;
      lastDecision: string | null;
      waypointStatus?: AutoDriveWaypointStatus | null;
      runtimeScenarioProfile?: AutoDriveRuntimeScenarioProfile | null;
      runtimeDecisionTrace?: AutoDriveRuntimeDecisionTrace | null;
      runtimeOutcomeFeedback?: AutoDriveRuntimeOutcomeFeedback | null;
      runtimeAutonomyState?: AutoDriveRuntimeAutonomyState | null;
      latestReroute: {
        mode: "soft" | "hard";
        reason: string;
        trigger: string;
        previousRouteSummary: string | null;
        nextRouteSummary: string | null;
      } | null;
    } | null;
    onToggleEnabled: (enabled: boolean) => void;
    onChangeDestination: (
      key: "title" | "endState" | "doneDefinition" | "avoid" | "routePreference",
      value: string
    ) => void;
    onChangeBudget: (
      key:
        | "maxTokens"
        | "maxIterations"
        | "maxDurationMinutes"
        | "maxFilesPerIteration"
        | "maxNoProgressIterations"
        | "maxValidationFailures"
        | "maxReroutes",
      value: number
    ) => void;
    onChangeRiskPolicy: (
      key:
        | "pauseOnDestructiveChange"
        | "pauseOnDependencyChange"
        | "pauseOnLowConfidence"
        | "pauseOnHumanCheckpoint"
        | "allowNetworkAnalysis"
        | "allowValidationCommands"
        | "minimumConfidence",
      value: boolean | "low" | "medium" | "high"
    ) => void;
  } | null;
  skills: SkillOption[];
  prompts: CustomPromptOption[];
  files: string[];
  onInsertComposerText: (text: string) => void;
  canInsertComposerText: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  composerEditorSettings: ComposerEditorSettings;
  composerEditorExpanded: boolean;
  onToggleComposerEditorExpanded: () => void;
  showComposer: boolean;
  composerSendLabel?: string;
  plan: TurnPlan | null;
  debugEntries: DebugEntry[];
  debugOpen: boolean;
  terminalOpen: boolean;
  terminalTabs: TerminalTab[];
  activeTerminalId: string | null;
  onSelectTerminal: (terminalId: string) => void;
  onNewTerminal: () => void;
  onCloseTerminal: (terminalId: string) => void;
  onClearTerminal?: () => void;
  onRestartTerminal?: () => void;
  onInterruptTerminal?: () => void;
  canClearTerminal?: boolean;
  canRestartTerminal?: boolean;
  canInterruptTerminal?: boolean;
  terminalState: TerminalSessionState | null;
  onClearDebug: () => void;
  onCopyDebug: () => void;
  onResizeDebug: (event: MouseEvent<Element>) => void;
  onResizeTerminal: (event: MouseEvent<Element>) => void;
  onBackFromDiff: () => void;
  onShowSelectedDiff: () => void;
  onGoProjects: () => void;
};

const LAYOUT_SHELL_NODE_KEYS = [
  "workspaces",
  "groupedWorkspaces",
  "hasLoadedWorkspaces",
  "workspaceLoadError",
  "hasWorkspaceGroups",
  "deletingWorktreeIds",
  "newAgentDraftWorkspaceId",
  "startingDraftThreadWorkspaceId",
  "threadsByWorkspace",
  "threadParentById",
  "threadStatusById",
  "activeTurnIdByThread",
  "turnDiffByThread",
  "threadResumeLoadingById",
  "threadListLoadingByWorkspace",
  "threadSnapshotsReady",
  "threadListPagingByWorkspace",
  "threadListCursorByWorkspace",
  "threadListSortKey",
  "onSetThreadListSortKey",
  "onRefreshAllThreads",
  "activeWorkspaceId",
  "activeThreadId",
  "openAppTargets",
  "openAppIconById",
  "selectedOpenAppId",
  "onSelectOpenAppId",
  "onOpenSettings",
  "onCollapseSidebar",
  "onExpandSidebar",
  "sidebarCollapsed",
  "rightPanelCollapsed",
  "onOpenProject",
  "onAddWorkspace",
  "onSelectHome",
  "onSelectWorkspace",
  "onConnectWorkspace",
  "onAddAgent",
  "onAddWorktreeAgent",
  "onAddCloneAgent",
  "onOpenBranchSwitcher",
  "onSelectBranchWorkflowSelection",
  "onToggleWorkspaceCollapse",
  "onReorderWorkspace",
  "onSelectThread",
  "onOpenThreadLink",
  "onEditMessage",
  "onDeleteThread",
  "onSyncThread",
  "pinThread",
  "unpinThread",
  "isThreadPinned",
  "getPinTimestamp",
  "onRenameThread",
  "onDeleteWorkspace",
  "onDeleteWorktree",
  "onLoadOlderThreads",
  "onReloadWorkspaceThreads",
  "workspaceDropTargetRef",
  "isWorkspaceDropActive",
  "workspaceDropText",
  "onWorkspaceDragOver",
  "onWorkspaceDragEnter",
  "onWorkspaceDragLeave",
  "onWorkspaceDrop",
  "activeWorkspace",
  "activeParentWorkspace",
  "worktreeLabel",
  "worktreeRename",
  "isWorktreeWorkspace",
  "branchName",
  "onRefreshGitStatus",
  "onCopyThread",
  "onToggleTerminal",
  "showTerminalButton",
  "showWorkspaceTools",
  "launchScript",
  "launchScriptEditorOpen",
  "launchScriptDraft",
  "launchScriptSaving",
  "launchScriptError",
  "onRunLaunchScript",
  "onOpenLaunchScriptEditor",
  "onCloseLaunchScriptEditor",
  "onLaunchScriptDraftChange",
  "onSaveLaunchScript",
  "launchScriptsState",
  "mainHeaderActionsNode",
  "centerMode",
  "onExitDiff",
  "activeTab",
  "onSelectTab",
  "isPhone",
  "onBackFromDiff",
  "onShowSelectedDiff",
  "onGoProjects",
] as const satisfies readonly (keyof LayoutNodesFieldRegistry)[];

const LAYOUT_CONVERSATION_NODE_KEYS = [
  "activeItems",
  "itemsByThread",
  "codeBlockCopyUseModifier",
  "showMessageFilePath",
  "showInternalRuntimeDiagnostics",
  "files",
  "onSendPrompt",
  "onSendPromptToNewAgent",
  "onCreatePrompt",
  "onUpdatePrompt",
  "onDeletePrompt",
  "onMovePrompt",
  "onRevealWorkspacePrompts",
  "onRevealGeneralPrompts",
  "canRevealGeneralPrompts",
  "onSend",
  "onQueue",
  "onSendToWorkspace",
  "onQueueToWorkspace",
  "onStop",
  "canStop",
  "onFileAutocompleteActiveChange",
  "isReviewing",
  "isProcessing",
  "steerEnabled",
  "reviewPrompt",
  "onReviewPromptClose",
  "onReviewPromptShowPreset",
  "onReviewPromptChoosePreset",
  "highlightedPresetIndex",
  "onReviewPromptHighlightPreset",
  "highlightedBranchIndex",
  "onReviewPromptHighlightBranch",
  "highlightedCommitIndex",
  "onReviewPromptHighlightCommit",
  "onReviewPromptKeyDown",
  "onReviewPromptSelectBranch",
  "onReviewPromptSelectBranchAtIndex",
  "onReviewPromptConfirmBranch",
  "onReviewPromptSelectCommit",
  "onReviewPromptSelectCommitAtIndex",
  "onReviewPromptConfirmCommit",
  "onReviewPromptUpdateCustomInstructions",
  "onReviewPromptConfirmCustom",
  "activeTokenUsage",
  "activeQueue",
  "queuePausedReason",
  "draftText",
  "onDraftChange",
  "activeImages",
  "onPickImages",
  "onAttachImages",
  "onRemoveImage",
  "prefillDraft",
  "onPrefillHandled",
  "insertText",
  "onInsertHandled",
  "onEditQueued",
  "onDeleteQueued",
  "collaborationModes",
  "selectedCollaborationModeId",
  "onSelectCollaborationMode",
  "composerAccountOptions",
  "selectedAccountIds",
  "onSelectAccountIds",
  "modelSelectionMode",
  "selectedProviderId",
  "onSelectProvider",
  "onSelectAutoRoute",
  "onSelectModelSelectionMode",
  "models",
  "selectedModelId",
  "onSelectModel",
  "reasoningOptions",
  "selectedEffort",
  "onSelectEffort",
  "fastModeEnabled",
  "onToggleFastMode",
  "reasoningSupported",
  "accessMode",
  "onSelectAccessMode",
  "executionOptions",
  "selectedExecutionMode",
  "onSelectExecutionMode",
  "remoteBackendOptions",
  "selectedRemoteBackendId",
  "onSelectRemoteBackendId",
  "resolvedRemotePlacement",
  "autoDrive",
  "skills",
  "prompts",
  "onInsertComposerText",
  "canInsertComposerText",
  "textareaRef",
  "composerEditorSettings",
  "composerEditorExpanded",
  "onToggleComposerEditorExpanded",
  "showComposer",
  "composerSendLabel",
  "plan",
] as const satisfies readonly (keyof LayoutNodesFieldRegistry)[];

const LAYOUT_GIT_REVIEW_NODE_KEYS = [
  "missionControlProjection",
  "activeRepositoryExecutionContract",
  "missionControlFreshness",
  "onRefreshMissionControl",
  "reviewPackSelection",
  "runtimeReviewPack",
  "onOpenReviewPack",
  "reviewPackDecisionSubmission",
  "onSubmitReviewPackDecision",
  "reviewInterventionBackendOptions",
  "reviewInterventionDefaultBackendId",
  "reviewInterventionLaunchError",
  "onLaunchReviewInterventionDraft",
  "onRunReviewAgent",
  "onApplyReviewAutofix",
  "fileStatus",
  "gitPanelMode",
  "onGitPanelModeChange",
  "gitDiffViewStyle",
  "gitDiffIgnoreWhitespaceChanges",
  "worktreeApplyLabel",
  "worktreeApplyTitle",
  "worktreeApplyLoading",
  "worktreeApplyError",
  "worktreeApplySuccess",
  "onApplyWorktreeChanges",
  "filePanelMode",
  "onFilePanelModeChange",
  "atlasDriverOrder",
  "atlasEnabled",
  "atlasDetailLevel",
  "atlasLongTermMemoryDigest",
  "onAtlasDriverOrderChange",
  "onAtlasEnabledChange",
  "onAtlasDetailLevelChange",
  "fileTreeLoading",
  "gitStatus",
  "selectedDiffPath",
  "diffScrollRequestId",
  "onSelectDiff",
  "gitLogEntries",
  "gitLogTotal",
  "gitLogAhead",
  "gitLogBehind",
  "gitLogAheadEntries",
  "gitLogBehindEntries",
  "gitLogUpstream",
  "selectedCommitSha",
  "onSelectCommit",
  "gitLogError",
  "gitLogLoading",
  "gitIssues",
  "gitIssuesTotal",
  "gitIssuesLoading",
  "gitIssuesError",
  "onStartTaskFromGitHubIssue",
  "onStartTaskFromGitHubIssueFollowUp",
  "onDelegateGitHubIssue",
  "gitPullRequests",
  "gitPullRequestsTotal",
  "gitPullRequestsLoading",
  "gitPullRequestsError",
  "onStartTaskFromGitHubPullRequest",
  "onStartTaskFromGitHubPullRequestReviewCommentCommand",
  "selectedPullRequestNumber",
  "selectedPullRequest",
  "selectedPullRequestComments",
  "selectedPullRequestCommentsLoading",
  "selectedPullRequestCommentsError",
  "onSelectPullRequest",
  "onDelegateGitHubPullRequest",
  "gitRemoteUrl",
  "gitRoot",
  "gitRootCandidates",
  "gitRootScanDepth",
  "gitRootScanLoading",
  "gitRootScanError",
  "gitRootScanHasScanned",
  "onGitRootScanDepthChange",
  "onScanGitRoots",
  "onSelectGitRoot",
  "onClearGitRoot",
  "onPickGitRoot",
  "onStageGitAll",
  "onStageGitFile",
  "onUnstageGitFile",
  "onRevertGitFile",
  "onRevertAllGitChanges",
  "diffSource",
  "gitDiffs",
  "gitDiffLoading",
  "gitDiffError",
  "onDiffActivePathChange",
  "commitMessage",
  "commitMessageLoading",
  "commitMessageError",
  "onCommitMessageChange",
  "onGenerateCommitMessage",
  "onCommit",
  "onCommitAndPush",
  "onCommitAndSync",
  "onPull",
  "onFetch",
  "onPush",
  "onSync",
  "commitLoading",
  "pullLoading",
  "fetchLoading",
  "pushLoading",
  "syncLoading",
  "commitError",
  "pullError",
  "fetchError",
  "pushError",
  "syncError",
  "commitsAhead",
] as const satisfies readonly (keyof LayoutNodesFieldRegistry)[];

const LAYOUT_RUNTIME_NODE_KEYS = [
  "showPollingFetchStatus",
  "pollingIntervalMs",
  "activeRateLimits",
  "usageShowRemaining",
  "accountInfo",
  "onRefreshCurrentUsage",
  "onRefreshAllUsage",
  "canRefreshCurrentUsage",
  "canRefreshAllUsage",
  "currentUsageRefreshLoading",
  "allUsageRefreshLoading",
  "onSwitchAccount",
  "onSelectLoggedInCodexAccount",
  "onCancelSwitchAccount",
  "accountSwitching",
  "accountSwitchError",
  "accountCenter",
  "approvals",
  "userInputRequests",
  "toolCallRequests",
  "handleApprovalDecision",
  "handleApprovalRemember",
  "handleUserInputSubmit",
  "handleToolCallSubmit",
  "onPlanAccept",
  "onPlanSubmitChanges",
  "onConnectLocalRuntimePort",
  "onOpenDebug",
  "showDebugButton",
  "updaterState",
  "onUpdate",
  "onDismissUpdate",
  "postUpdateNotice",
  "onDismissPostUpdateNotice",
  "errorToasts",
  "onDismissErrorToast",
  "latestAgentRuns",
  "isLoadingLatestAgents",
  "localUsageSnapshot",
  "isLoadingLocalUsage",
  "localUsageError",
  "onRefreshLocalUsage",
  "usageMetric",
  "onUsageMetricChange",
  "usageWorkspaceId",
  "usageWorkspaceOptions",
  "onUsageWorkspaceChange",
  "onSelectHomeThread",
  "debugEntries",
  "debugOpen",
  "terminalOpen",
  "terminalTabs",
  "activeTerminalId",
  "onSelectTerminal",
  "onNewTerminal",
  "onCloseTerminal",
  "onClearTerminal",
  "onRestartTerminal",
  "onInterruptTerminal",
  "canClearTerminal",
  "canRestartTerminal",
  "canInterruptTerminal",
  "terminalState",
  "onClearDebug",
  "onCopyDebug",
  "onResizeDebug",
  "onResizeTerminal",
] as const satisfies readonly (keyof LayoutNodesFieldRegistry)[];

export type LayoutShellNodesInput = Pick<
  LayoutNodesFieldRegistry,
  (typeof LAYOUT_SHELL_NODE_KEYS)[number]
>;

export type LayoutConversationNodesInput = Pick<
  LayoutNodesFieldRegistry,
  (typeof LAYOUT_CONVERSATION_NODE_KEYS)[number]
>;

export type LayoutGitReviewNodesInput = Pick<
  LayoutNodesFieldRegistry,
  (typeof LAYOUT_GIT_REVIEW_NODE_KEYS)[number]
>;

export type LayoutRuntimeNodesInput = Pick<
  LayoutNodesFieldRegistry,
  (typeof LAYOUT_RUNTIME_NODE_KEYS)[number]
>;

export type LayoutNodesOptions = {
  shell: LayoutShellNodesInput;
  conversation: LayoutConversationNodesInput;
  gitReview: LayoutGitReviewNodesInput;
  runtime: LayoutRuntimeNodesInput;
};

function pickLayoutNodeFields<TKey extends keyof LayoutNodesFieldRegistry>(
  fields: LayoutNodesFieldRegistry,
  keys: readonly TKey[]
): Pick<LayoutNodesFieldRegistry, TKey> {
  const picked = {} as Pick<LayoutNodesFieldRegistry, TKey>;
  for (const key of keys) {
    picked[key] = fields[key];
  }
  return picked;
}

export function createLayoutNodesOptions(fields: LayoutNodesFieldRegistry): LayoutNodesOptions {
  return {
    shell: pickLayoutNodeFields(fields, LAYOUT_SHELL_NODE_KEYS),
    conversation: pickLayoutNodeFields(fields, LAYOUT_CONVERSATION_NODE_KEYS),
    gitReview: pickLayoutNodeFields(fields, LAYOUT_GIT_REVIEW_NODE_KEYS),
    runtime: pickLayoutNodeFields(fields, LAYOUT_RUNTIME_NODE_KEYS),
  };
}

export function flattenLayoutNodesOptions(options: LayoutNodesOptions): LayoutNodesFieldRegistry {
  return {
    ...options.shell,
    ...options.conversation,
    ...options.gitReview,
    ...options.runtime,
  };
}

export type LayoutNodesResult = {
  sidebarNode: ReactNode;
  messagesNode: ReactNode;
  composerNode: ReactNode;
  approvalToastsNode: ReactNode;
  updateToastNode: ReactNode;
  errorToastsNode: ReactNode;
  homeNode: ReactNode;
  missionOverviewNode?: ReactNode;
  mainHeaderNode: ReactNode;
  desktopTopbarLeftNode: ReactNode;
  desktopTopbarRightNode: ReactNode;
  tabBarNode: ReactNode;
  rightPanelInterruptNode: ReactNode;
  rightPanelDetailsNode: ReactNode;
  hasRightPanelDetailContent: boolean;
  gitDiffPanelNode: ReactNode;
  gitDiffViewerNode: ReactNode;
  hasGitDiffViewerContent?: boolean;
  rightPanelGitNode: ReactNode;
  rightPanelFilesNode: ReactNode;
  rightPanelPromptsNode: ReactNode;
  planPanelNode: ReactNode;
  debugPanelNode: ReactNode;
  terminalDockNode: ReactNode;
  compactEmptyCodexNode: ReactNode;
  compactEmptyGitNode: ReactNode;
  compactGitBackNode: ReactNode;
};
