import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Settings from "lucide-react/dist/esm/icons/settings";
import X from "lucide-react/dist/esm/icons/x";
import {
  type ComponentProps,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import type { MissionControlProjection } from "../../../application/runtime/facades/runtimeMissionControlFacade";
import { REVIEW_START_DESKTOP_ONLY_MESSAGE } from "../../../application/runtime/ports/threads";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import { Button } from "../../../design-system";
import { Icon } from "../../../design-system";
import { ShellFrame, ShellSection } from "../../../design-system";
import { Select } from "../../../design-system";
import { StatusBadge } from "../../../design-system";
import { WorkspaceHeaderAction } from "../../../design-system";
import type {
  AccessMode,
  ApprovalRequest,
  CollaborationModeOption,
  ComposerExecutionMode,
  ComposerModelSelectionMode,
  CustomPromptOption,
  LocalUsageSnapshot,
  ModelOption,
  RequestUserInputRequest,
  SkillOption,
  WorkspaceInfo,
} from "../../../types";
import { joinClassNames } from "../../../utils/classNames";
import { MainHeaderShell } from "../../app/components/MainHeaderShell";
import { Composer } from "../../composer/components/Composer";
import { ComposerSurface } from "../../composer/components/ComposerSurface";
import { ModalShell } from "../../../design-system";
import { PanelSplitToggleIcon } from "../../layout/components/PanelSplitToggleIcon";
import {
  type MissionControlFreshnessState,
  type MissionNavigationTarget,
} from "@ku0/code-application/runtimeMissionControlSurfaceModel";
import { resolveMissionEntryActionLabel } from "../../missions/utils/missionNavigation";
import "@ku0/code-workspace-client/settings-shell/SettingsModalChrome.global.css";
import type { ReviewPromptState, ReviewPromptStep } from "../../threads/hooks/useReviewPrompt";
import { HomeFrame } from "./HomeScaffold";
import { HomeMissionLaunchpadSection } from "./HomeMissionLaunchpadSection";
import { HomeRecentMissionsSection } from "./HomeRecentMissionsSection";
import * as launchpadStyles from "./HomeLaunchpad.styles.css";
import * as styles from "./Home.styles.css";
import * as homeThreadControlStyles from "./HomeThreadControls.css";
import { resolveHomeRoutingSignal } from "./homeMissionSignals";
import { HomeRuntimeNotice } from "./HomeRuntimeNotice";
import { DEFAULT_LOCAL_RUNTIME_PORT, parseRuntimeConnectionDraft } from "./homeRuntimeConnection";
import {
  buildHomeMissionSignalsViewModel,
  buildHomeRuntimeNoticeViewModel,
  buildHomeWorkspaceRoutingViewModel,
  isActionRequiredHomeMission,
  isActiveHomeMission,
  isReviewReadyHomeMission,
} from "./homeViewModel";
import { markFeatureVisible } from "../../shared/featurePerformance";
import type { LatestAgentRun } from "./homeTypes";

type UsageMetric = "tokens" | "time";

type UsageWorkspaceOption = {
  id: string;
  label: string;
};

type WorkspaceOption = {
  id: WorkspaceInfo["id"];
  name: WorkspaceInfo["name"];
} & Partial<Omit<WorkspaceInfo, "id" | "name">>;

const LazyWorkspaceHomeAgentControl = lazy(async () => {
  const module = await import("../../workspaces/components/WorkspaceHomeAgentControl");
  return { default: module.WorkspaceHomeAgentControl };
});

function isReviewSlashCommand(text: string) {
  return /^\/review\b/i.test(text.trim());
}

type PendingHomeSubmit = {
  id: string;
  mode: "send" | "queue";
  workspaceId: string;
  text: string;
  images: string[];
};

type HomeProps = {
  onOpenProject: () => void;
  onOpenSettings?: () => void;
  onConnectLocalRuntimePort?: (target: {
    host: string | null;
    port: number;
  }) => void | Promise<void>;
  latestAgentRuns: LatestAgentRun[];
  missionControlProjection?: MissionControlProjection | null;
  missionControlFreshness?: MissionControlFreshnessState | null;
  isLoadingLatestAgents: boolean;
  localUsageSnapshot: LocalUsageSnapshot | null;
  isLoadingLocalUsage: boolean;
  localUsageError: string | null;
  workspaceLoadError?: string | null;
  onRefreshLocalUsage: () => void;
  onRefreshMissionControl?: () => void;
  usageMetric: UsageMetric;
  onUsageMetricChange: (metric: UsageMetric) => void;
  usageWorkspaceId: string | null;
  usageWorkspaceOptions: UsageWorkspaceOption[];
  onUsageWorkspaceChange: (workspaceId: string | null) => void;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  onOpenMissionTarget?: (target: MissionNavigationTarget) => void;
  onOpenReviewMission?: (
    workspaceId: string,
    taskId: string,
    runId?: string | null,
    reviewPackId?: string | null
  ) => void;
  onSend?: (text: string, images: string[]) => void | false | Promise<void | false>;
  onQueue?: (text: string, images: string[]) => void | false | Promise<void | false>;
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
  workspaces?: WorkspaceOption[];
  activeWorkspaceId?: string | null;
  onSelectWorkspace?: (workspaceId: string) => void;
  steerEnabled?: boolean;
  collaborationModes?: CollaborationModeOption[];
  selectedCollaborationModeId?: string | null;
  onSelectCollaborationMode?: (id: string | null) => void;
  modelSelectionMode?: ComposerModelSelectionMode;
  selectedProviderId?: string | null;
  onSelectProvider?: (providerId: string) => void;
  onSelectAutoRoute?: (providerId: string | null) => void;
  onSelectModelSelectionMode?: (mode: ComposerModelSelectionMode) => void;
  models?: ModelOption[];
  selectedModelId?: string | null;
  onSelectModel?: (id: string) => void;
  reasoningOptions?: string[];
  selectedEffort?: string | null;
  onSelectEffort?: (effort: string) => void;
  fastModeEnabled?: boolean;
  onToggleFastMode?: (enabled: boolean) => void;
  reasoningSupported?: boolean;
  accessMode?: AccessMode;
  onSelectAccessMode?: (mode: AccessMode) => void;
  executionOptions?: Array<{ value: ComposerExecutionMode; label: string; disabled?: boolean }>;
  selectedExecutionMode?: ComposerExecutionMode;
  onSelectExecutionMode?: (mode: ComposerExecutionMode) => void;
  remoteBackendOptions?: Array<{ value: string; label: string }>;
  selectedRemoteBackendId?: string | null;
  onSelectRemoteBackendId?: (backendId: string | null) => void;
  resolvedRemotePlacement?: {
    summary: string;
    detail: string | null;
    tone: "neutral" | "warning";
  } | null;
  autoDrive?: ComponentProps<typeof Composer>["autoDrive"];
  skills?: SkillOption[];
  prompts?: CustomPromptOption[];
  files?: string[];
  reviewPrompt?: ReviewPromptState;
  onReviewPromptClose?: () => void;
  onReviewPromptShowPreset?: () => void;
  onReviewPromptChoosePreset?: (
    preset: Exclude<ReviewPromptStep, "preset"> | "uncommitted"
  ) => void;
  highlightedPresetIndex?: number;
  onReviewPromptHighlightPreset?: (index: number) => void;
  highlightedBranchIndex?: number;
  onReviewPromptHighlightBranch?: (index: number) => void;
  highlightedCommitIndex?: number;
  onReviewPromptHighlightCommit?: (index: number) => void;
  onReviewPromptKeyDown?: (event: {
    key: string;
    shiftKey?: boolean;
    preventDefault: () => void;
  }) => boolean;
  onReviewPromptSelectBranch?: (value: string) => void;
  onReviewPromptSelectBranchAtIndex?: (index: number) => void;
  onReviewPromptConfirmBranch?: () => Promise<void>;
  onReviewPromptSelectCommit?: (sha: string, title: string) => void;
  onReviewPromptSelectCommitAtIndex?: (index: number) => void;
  onReviewPromptConfirmCommit?: () => Promise<void>;
  onReviewPromptUpdateCustomInstructions?: (value: string) => void;
  onReviewPromptConfirmCustom?: () => Promise<void>;
  approvals?: ApprovalRequest[];
  userInputRequests?: RequestUserInputRequest[];
  sidebarCollapsed?: boolean;
  onExpandSidebar?: () => void;
};

export function Home({
  onOpenProject,
  onOpenSettings = () => undefined,
  onConnectLocalRuntimePort,
  latestAgentRuns,
  missionControlProjection = null,
  missionControlFreshness = null,
  isLoadingLatestAgents,
  workspaceLoadError = null,
  onRefreshMissionControl,
  onSelectThread,
  onOpenMissionTarget,
  onOpenReviewMission,
  onSend = () => undefined,
  onQueue = () => undefined,
  onSendToWorkspace,
  onQueueToWorkspace,
  workspaces = [],
  activeWorkspaceId = null,
  onSelectWorkspace = () => undefined,
  steerEnabled = true,
  collaborationModes = [],
  selectedCollaborationModeId = null,
  onSelectCollaborationMode = () => undefined,
  modelSelectionMode = "manual",
  selectedProviderId = null,
  onSelectProvider = () => undefined,
  onSelectAutoRoute = () => undefined,
  onSelectModelSelectionMode = () => undefined,
  models = [],
  selectedModelId = null,
  onSelectModel = () => undefined,
  reasoningOptions = [],
  selectedEffort = null,
  onSelectEffort = () => undefined,
  fastModeEnabled = false,
  onToggleFastMode,
  reasoningSupported = true,
  accessMode = "full-access",
  onSelectAccessMode = () => undefined,
  executionOptions = [{ value: "runtime", label: "Runtime" }],
  selectedExecutionMode = "runtime",
  onSelectExecutionMode = () => undefined,
  remoteBackendOptions = [],
  selectedRemoteBackendId = null,
  onSelectRemoteBackendId,
  resolvedRemotePlacement = null,
  autoDrive = null,
  skills = [],
  prompts = [],
  files = [],
  reviewPrompt = null,
  onReviewPromptClose,
  onReviewPromptShowPreset,
  onReviewPromptChoosePreset,
  highlightedPresetIndex,
  onReviewPromptHighlightPreset,
  highlightedBranchIndex,
  onReviewPromptHighlightBranch,
  highlightedCommitIndex,
  onReviewPromptHighlightCommit,
  onReviewPromptKeyDown,
  onReviewPromptSelectBranch,
  onReviewPromptSelectBranchAtIndex,
  onReviewPromptConfirmBranch,
  onReviewPromptSelectCommit,
  onReviewPromptSelectCommitAtIndex,
  onReviewPromptConfirmCommit,
  onReviewPromptUpdateCustomInstructions,
  onReviewPromptConfirmCustom,
  approvals = [],
  userInputRequests = [],
  sidebarCollapsed = false,
  onExpandSidebar,
}: HomeProps) {
  useEffect(() => {
    markFeatureVisible("home");
  }, []);

  const activeModelContext = models.find((model) => model.id === selectedModelId) ?? null;
  const [launchpadPrompt, setLaunchpadPrompt] = useState("");
  const [isAgentSettingsOpen, setIsAgentSettingsOpen] = useState(false);
  const [runtimeTargetDraft, setRuntimeTargetDraft] = useState("8788");
  const [localRuntimeConnectError, setLocalRuntimeConnectError] = useState<string | null>(null);
  const [isConnectingLocalRuntime, setIsConnectingLocalRuntime] = useState(false);
  const [pendingHomeSubmits, setPendingHomeSubmits] = useState<PendingHomeSubmit[]>([]);
  const [pendingWorkspaceSelectionId, setPendingWorkspaceSelectionId] = useState<string | null>(
    null
  );
  const activePendingSubmitRef = useRef<string | null>(null);
  const autoLocalRuntimeConnectAttemptedRef = useRef(false);
  const pendingSubmitSequenceRef = useRef(0);
  const { missionSignals, missionControlStatus, missionControlSignals } =
    buildHomeMissionSignalsViewModel({
      latestAgentRuns,
      missionControlProjection,
      missionControlFreshness,
      approvals,
      userInputRequests,
    });
  const routingAttentionCount = missionControlSignals?.routingAttentionCount ?? 0;
  const routingBlockedCount = missionControlSignals?.routingBlockedCount ?? 0;
  const awaitingActionRun = latestAgentRuns.find(isActionRequiredHomeMission) ?? null;
  const reviewReadyRun = latestAgentRuns.find(isReviewReadyHomeMission) ?? null;
  const activeRun = latestAgentRuns.find(isActiveHomeMission) ?? null;
  const routingSignal = resolveHomeRoutingSignal({
    routingAttentionCount,
    routingBlockedCount,
    hasActiveRun: Boolean(activeRun),
    hasWorkspaces: workspaces.length > 0,
  });
  const canConnectLocalRuntime = typeof onConnectLocalRuntimePort === "function";
  const {
    workspaceSelectOptions,
    activeWorkspace,
    defaultWorkspaceId,
    displayedWorkspaceId,
    workspaceSummaryScope,
    runtimeUnavailable,
    showLocalRuntimeEntry,
    setupActionKind,
    workspacePlaceholder,
    settingsButtonLabel,
    workspaceSummaryTitle,
    workspaceSummaryMeta,
    workspaceSummaryDetail,
  } = buildHomeWorkspaceRoutingViewModel({
    workspaces,
    activeWorkspaceId,
    pendingWorkspaceSelectionId,
    workspaceLoadError,
    canConnectLocalRuntime,
  });
  const workspacePlacementDetail =
    resolvedRemotePlacement?.detail &&
    resolvedRemotePlacement.detail !== resolvedRemotePlacement.summary
      ? resolvedRemotePlacement.detail
      : null;
  const showWorkspaceSummaryPanel =
    workspaceSummaryScope !== "unconfigured" ||
    workspaceSummaryDetail !== null ||
    resolvedRemotePlacement !== null;
  const {
    showRuntimeNotice,
    runtimeNoticeState,
    runtimeNoticeTitle,
    runtimeNoticeTone,
    runtimeNoticeBody,
  } = buildHomeRuntimeNoticeViewModel({
    workspaces,
    workspaceLoadError,
    runtimeUnavailable,
    showLocalRuntimeEntry,
  });
  const launchpadSetupHasSinglePanel =
    Number(showWorkspaceSummaryPanel) + Number(showRuntimeNotice) === 1;
  const isConnectionEntryState = showRuntimeNotice;
  const setupAction = setupActionKind === "settings" ? onOpenSettings : onOpenProject;
  const handlePrimaryEntryAction = () => {
    if (activeWorkspace) {
      setIsAgentSettingsOpen(true);
      return;
    }
    onOpenProject();
  };

  const openMissionTarget = (
    run: LatestAgentRun | null,
    options?: {
      preferOperatorAction?: boolean;
    }
  ) => {
    if (!run) {
      return;
    }
    const target =
      options?.preferOperatorAction === true
        ? (run.operatorActionTarget ?? run.navigationTarget)
        : run.navigationTarget;
    if (target && target.kind !== "thread") {
      if (onOpenMissionTarget) {
        onOpenMissionTarget(target);
        return;
      }
      onOpenReviewMission?.(target.workspaceId, target.taskId, target.runId, target.reviewPackId);
      return;
    }
    onSelectThread(run.workspaceId, run.threadId);
  };
  const parsedRuntimeTarget = parseRuntimeConnectionDraft(runtimeTargetDraft);
  const runtimeEndpointPreview =
    "error" in parsedRuntimeTarget
      ? `http://localhost / 127.0.0.1:${runtimeTargetDraft.trim() || DEFAULT_LOCAL_RUNTIME_PORT}/rpc`
      : parsedRuntimeTarget.preview;

  const connectLocalRuntimeTarget = async (host: string | null, port: number) => {
    if (!onConnectLocalRuntimePort) {
      setLocalRuntimeConnectError("Local runtime port connection is unavailable in this build.");
      return false;
    }

    setLocalRuntimeConnectError(null);
    setIsConnectingLocalRuntime(true);
    try {
      await onConnectLocalRuntimePort({ host, port });
      return true;
    } catch (error) {
      setLocalRuntimeConnectError(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setIsConnectingLocalRuntime(false);
    }
  };

  useEffect(() => {
    if (activeWorkspace) {
      return;
    }
    setIsAgentSettingsOpen(false);
  }, [activeWorkspace]);

  useEffect(() => {
    if (autoLocalRuntimeConnectAttemptedRef.current) {
      return;
    }
    if (!showLocalRuntimeEntry || workspaces.length > 0) {
      return;
    }
    if (
      typeof window !== "undefined" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      return;
    }
    const parsedTarget = parseRuntimeConnectionDraft(runtimeTargetDraft);
    if ("error" in parsedTarget) {
      return;
    }
    if (parsedTarget.host !== null || parsedTarget.port !== DEFAULT_LOCAL_RUNTIME_PORT) {
      return;
    }

    autoLocalRuntimeConnectAttemptedRef.current = true;
    void connectLocalRuntimeTarget(null, DEFAULT_LOCAL_RUNTIME_PORT);
  }, [runtimeTargetDraft, showLocalRuntimeEntry, workspaces.length]);

  useEffect(() => {
    if (!pendingWorkspaceSelectionId) {
      return;
    }
    if (!workspaces.some((workspace) => workspace.id === pendingWorkspaceSelectionId)) {
      setPendingWorkspaceSelectionId(null);
      return;
    }
    if (activeWorkspaceId === pendingWorkspaceSelectionId) {
      setPendingWorkspaceSelectionId(null);
    }
  }, [activeWorkspaceId, pendingWorkspaceSelectionId, workspaces]);

  useEffect(() => {
    if (!isAgentSettingsOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      setIsAgentSettingsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAgentSettingsOpen]);

  useLayoutEffect(() => {
    const nextSubmit = pendingHomeSubmits[0] ?? null;
    if (!nextSubmit) {
      activePendingSubmitRef.current = null;
      return;
    }
    if (activeWorkspaceId !== nextSubmit.workspaceId) {
      return;
    }
    if (activePendingSubmitRef.current === nextSubmit.id) {
      return;
    }
    activePendingSubmitRef.current = nextSubmit.id;
    const run = nextSubmit.mode === "queue" ? onQueue : onSend;
    void Promise.resolve(run(nextSubmit.text, nextSubmit.images)).finally(() => {
      setPendingHomeSubmits((current) => {
        if (current[0]?.id === nextSubmit.id) {
          return current.slice(1);
        }
        return current.filter((entry) => entry.id !== nextSubmit.id);
      });
      if (activePendingSubmitRef.current === nextSubmit.id) {
        activePendingSubmitRef.current = null;
      }
    });
  }, [activeWorkspaceId, onQueue, onSend, pendingHomeSubmits]);

  const handleHomeSubmit = (mode: "send" | "queue", text: string, images: string[]) => {
    if (isReviewSlashCommand(text) && true) {
      pushErrorToast({
        title: "Desktop review only",
        message: REVIEW_START_DESKTOP_ONLY_MESSAGE,
      });
      return false;
    }
    const targetWorkspaceId = displayedWorkspaceId ?? defaultWorkspaceId;
    if (!targetWorkspaceId) {
      setupAction();
      return;
    }
    const directRun =
      mode === "queue"
        ? (onQueueToWorkspace ?? onSendToWorkspace ?? null)
        : (onSendToWorkspace ?? null);
    if (activeWorkspaceId !== targetWorkspaceId && directRun) {
      onSelectWorkspace(targetWorkspaceId);
      void directRun(targetWorkspaceId, text, images);
      return;
    }
    const nextSubmit: PendingHomeSubmit = {
      id: `home-submit-${++pendingSubmitSequenceRef.current}`,
      mode,
      workspaceId: targetWorkspaceId,
      text,
      images: [...images],
    };
    if (activeWorkspaceId !== targetWorkspaceId || pendingHomeSubmits.length > 0) {
      setPendingHomeSubmits((current) => [...current, nextSubmit]);
      if (activeWorkspaceId !== targetWorkspaceId) {
        onSelectWorkspace(targetWorkspaceId);
      }
      return;
    }
    const run = mode === "queue" ? onQueue : onSend;
    void run(text, images);
  };

  const handleSelectHomeWorkspace = (workspaceId: string) => {
    setPendingWorkspaceSelectionId(workspaceId);
    onSelectWorkspace(workspaceId);
  };

  const handleConnectRuntime = async () => {
    const parsedTarget = parseRuntimeConnectionDraft(runtimeTargetDraft);
    if ("error" in parsedTarget) {
      setLocalRuntimeConnectError(parsedTarget.error);
      return;
    }
    await connectLocalRuntimeTarget(parsedTarget.host, parsedTarget.port);
  };

  return (
    <div className={styles.root} data-home-page="true">
      <MainHeaderShell
        className={styles.homeHeader}
        leadingNode={
          sidebarCollapsed ? (
            <div className={homeThreadControlStyles.leading} data-home-thread-leading="true">
              {onExpandSidebar ? (
                <WorkspaceHeaderAction
                  onClick={onExpandSidebar}
                  data-desktop-drag-region="false"
                  data-testid="home-sidebar-toggle"
                  aria-label="Show threads sidebar"
                  title="Show threads sidebar"
                  segment="icon"
                  className="sidebar-toggle-button"
                  icon={<PanelSplitToggleIcon side="left" title="Show threads sidebar" />}
                />
              ) : null}
              <Select
                ariaLabel="Select workspace"
                className={homeThreadControlStyles.workspaceSelect}
                triggerClassName={homeThreadControlStyles.workspaceSelectTrigger}
                menuClassName={homeThreadControlStyles.workspaceSelectMenu}
                optionClassName={homeThreadControlStyles.workspaceSelectOption}
                options={workspaceSelectOptions}
                value={displayedWorkspaceId}
                onValueChange={handleSelectHomeWorkspace}
                placeholder={workspacePlaceholder}
                disabled={workspaces.length === 0}
              />
            </div>
          ) : undefined
        }
        actionsNode={
          activeWorkspace || workspaceLoadError ? (
            <WorkspaceHeaderAction
              onClick={() => {
                if (activeWorkspace) {
                  setIsAgentSettingsOpen(true);
                  return;
                }
                onOpenSettings();
              }}
              data-desktop-drag-region="false"
              data-testid="home-settings-trigger"
              aria-label={settingsButtonLabel}
              title={settingsButtonLabel}
              segment="icon"
              className="home-thread-agent-settings-button"
              icon={<Icon icon={Settings} size={16} />}
            />
          ) : null
        }
      />
      <HomeFrame className={styles.content} data-home-content="true">
        <div className={styles.scrollArea} data-home-scroll-area="true">
          <ShellFrame className={styles.dashboardWidgets} data-home-dashboard-widgets="true">
            <ShellSection
              title={
                <span className={styles.missionSectionTitle}>
                  {isConnectionEntryState ? "Connect runtime" : "Start a mission"}
                </span>
              }
              depth="panel"
              meta={
                !isConnectionEntryState && missionControlStatus ? (
                  <span className={styles.missionSectionStatus} data-home-mission-status="true">
                    <span className={styles.missionSectionStatusLabel}>Mission control</span>
                    <StatusBadge
                      tone={missionControlStatus.tone}
                      className={styles.missionSectionStatusBadge}
                    >
                      {missionControlStatus.label}
                    </StatusBadge>
                  </span>
                ) : null
              }
              className={styles.dashboardSection}
              actions={
                <div
                  className={joinClassNames(
                    launchpadStyles.heroStatusActions,
                    styles.missionSectionActions
                  )}
                >
                  {!isConnectionEntryState ? (
                    <Button variant="secondary" size="sm" onClick={handlePrimaryEntryAction}>
                      {activeWorkspace ? "Open agent center" : "Browse workspaces"}
                    </Button>
                  ) : null}
                  {!isConnectionEntryState && onRefreshMissionControl ? (
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() => {
                        void onRefreshMissionControl();
                      }}
                      aria-label="Refresh mission control"
                    >
                      <Icon icon={RefreshCw} size={14} aria-hidden />
                      Refresh
                    </Button>
                  ) : null}
                </div>
              }
              testId="home-mission-launchpad"
            >
              <HomeMissionLaunchpadSection
                isConnectionEntryState={isConnectionEntryState}
                showWorkspaceSummaryPanel={showWorkspaceSummaryPanel}
                showRuntimeNotice={showRuntimeNotice}
                launchpadSetupHasSinglePanel={launchpadSetupHasSinglePanel}
                workspaceSummaryScope={workspaceSummaryScope}
                workspaceSummaryTitle={workspaceSummaryTitle}
                workspaceSummaryMeta={workspaceSummaryMeta}
                workspaceSummaryDetail={workspaceSummaryDetail}
                resolvedRemotePlacement={resolvedRemotePlacement}
                workspacePlacementDetail={workspacePlacementDetail}
                runtimeNotice={
                  <HomeRuntimeNotice
                    state={runtimeNoticeState}
                    title={runtimeNoticeTitle}
                    tone={runtimeNoticeTone}
                    body={runtimeNoticeBody}
                    showLocalRuntimeEntry={showLocalRuntimeEntry}
                    runtimeTargetDraft={runtimeTargetDraft}
                    runtimeEndpointPreview={runtimeEndpointPreview}
                    localRuntimeConnectError={localRuntimeConnectError}
                    isConnectingLocalRuntime={isConnectingLocalRuntime}
                    onRuntimeTargetDraftChange={(value) => {
                      setRuntimeTargetDraft(value);
                      if (localRuntimeConnectError) {
                        setLocalRuntimeConnectError(null);
                      }
                    }}
                    onConnectRuntime={handleConnectRuntime}
                  />
                }
                awaitingActionCount={missionSignals.awaitingActionCount}
                awaitingActionDetail={
                  awaitingActionRun
                    ? (awaitingActionRun.operatorActionDetail ?? awaitingActionRun.message)
                    : undefined
                }
                awaitingAction={
                  awaitingActionRun
                    ? resolveMissionEntryActionLabel({
                        operatorActionLabel: awaitingActionRun.operatorActionLabel,
                        operatorActionTarget: awaitingActionRun.operatorActionTarget ?? null,
                        navigationTarget: awaitingActionRun.navigationTarget ?? null,
                      })
                    : "Clear"
                }
                onAwaitingActionClick={() => {
                  if (!awaitingActionRun) {
                    return;
                  }
                  openMissionTarget(awaitingActionRun, { preferOperatorAction: true });
                }}
                awaitingActionDisabled={!awaitingActionRun}
                awaitingActionAriaLabel={
                  awaitingActionRun
                    ? "Open the next mission that requires operator action"
                    : "No mission is awaiting operator action"
                }
                reviewReadyCount={missionSignals.reviewReadyCount}
                reviewReadyDetail={reviewReadyRun ? reviewReadyRun.message : undefined}
                reviewReadyAction={
                  reviewReadyRun
                    ? resolveMissionEntryActionLabel({
                        operatorActionLabel: reviewReadyRun.operatorActionLabel,
                        operatorActionTarget: reviewReadyRun.operatorActionTarget ?? null,
                        navigationTarget: reviewReadyRun.navigationTarget ?? null,
                      })
                    : null
                }
                onReviewReadyClick={() => {
                  if (reviewReadyRun) {
                    openMissionTarget(reviewReadyRun, { preferOperatorAction: true });
                    return;
                  }
                  if (workspaces.length === 0) {
                    setupAction();
                  }
                }}
                reviewReadyDisabled={!reviewReadyRun && workspaces.length > 0}
                reviewReadyAriaLabel={
                  reviewReadyRun ? "Open review-ready mission" : "Review-ready mission pending"
                }
                routingValue={routingSignal.value}
                routingDetail={
                  routingSignal.tone === "warning" || routingSignal.tone === "accent"
                    ? routingSignal.detail
                    : undefined
                }
                routingAction={routingSignal.action}
                routingTone={routingSignal.tone}
                onRoutingClick={() => {
                  if (routingSignal.prefersMissionControl) {
                    const routingRun = reviewReadyRun ?? awaitingActionRun ?? activeRun ?? null;
                    const routingTarget =
                      routingRun &&
                      (routingRun.operatorActionTarget ?? routingRun.navigationTarget);
                    if (routingTarget && onOpenMissionTarget) {
                      onOpenMissionTarget(routingTarget);
                      return;
                    }
                    onOpenSettings();
                    return;
                  }
                  if (activeRun) {
                    openMissionTarget(activeRun, { preferOperatorAction: true });
                    return;
                  }
                  onOpenSettings();
                }}
                routingAriaLabel={routingSignal.ariaLabel}
                onSetLaunchpadPrompt={setLaunchpadPrompt}
                launchpadPrompt={launchpadPrompt}
              />
            </ShellSection>
            {!isConnectionEntryState ? (
              <ShellSection
                title="Recent missions"
                depth="panel"
                meta={isLoadingLatestAgents ? "Syncing..." : null}
                className={styles.dashboardSection}
                testId="home-recent-missions"
              >
                <HomeRecentMissionsSection
                  isLoadingLatestAgents={isLoadingLatestAgents}
                  latestAgentRuns={latestAgentRuns}
                  missionControlProjection={missionControlProjection}
                  onOpenMission={(run) => openMissionTarget(run)}
                />
              </ShellSection>
            ) : null}
          </ShellFrame>
        </div>
        <ComposerSurface
          surface="home"
          className={joinClassNames(styles.composerDock, launchpadStyles.composer)}
          data-desktop-drag-region="false"
          data-home-dock="true"
          data-home-composer-dock="true"
        >
          <Composer
            variant="home"
            onSend={(text, images) => handleHomeSubmit("send", text, images)}
            onQueue={(text, images) => handleHomeSubmit("queue", text, images)}
            onStop={() => undefined}
            canStop={false}
            disabled={false}
            isProcessing={false}
            steerEnabled={steerEnabled}
            collaborationModes={collaborationModes}
            selectedCollaborationModeId={selectedCollaborationModeId}
            onSelectCollaborationMode={onSelectCollaborationMode}
            modelSelectionMode={modelSelectionMode}
            selectedProviderId={selectedProviderId}
            onSelectProvider={onSelectProvider}
            onSelectAutoRoute={onSelectAutoRoute}
            onSelectModelSelectionMode={onSelectModelSelectionMode}
            models={models}
            selectedModelId={selectedModelId}
            onSelectModel={onSelectModel}
            reasoningOptions={reasoningOptions}
            selectedEffort={selectedEffort}
            onSelectEffort={onSelectEffort}
            fastModeEnabled={fastModeEnabled}
            onToggleFastMode={onToggleFastMode}
            reasoningSupported={reasoningSupported}
            accessMode={accessMode}
            onSelectAccessMode={onSelectAccessMode}
            executionOptions={executionOptions}
            selectedExecutionMode={selectedExecutionMode}
            onSelectExecutionMode={onSelectExecutionMode}
            remoteBackendOptions={remoteBackendOptions}
            selectedRemoteBackendId={selectedRemoteBackendId}
            onSelectRemoteBackendId={onSelectRemoteBackendId}
            autoDrive={autoDrive}
            skills={skills}
            prompts={prompts}
            files={files}
            reviewPrompt={reviewPrompt}
            onReviewPromptClose={onReviewPromptClose}
            onReviewPromptShowPreset={onReviewPromptShowPreset}
            onReviewPromptChoosePreset={onReviewPromptChoosePreset}
            highlightedPresetIndex={highlightedPresetIndex}
            onReviewPromptHighlightPreset={onReviewPromptHighlightPreset}
            highlightedBranchIndex={highlightedBranchIndex}
            onReviewPromptHighlightBranch={onReviewPromptHighlightBranch}
            highlightedCommitIndex={highlightedCommitIndex}
            onReviewPromptHighlightCommit={onReviewPromptHighlightCommit}
            onReviewPromptKeyDown={onReviewPromptKeyDown}
            onReviewPromptSelectBranch={onReviewPromptSelectBranch}
            onReviewPromptSelectBranchAtIndex={onReviewPromptSelectBranchAtIndex}
            onReviewPromptConfirmBranch={onReviewPromptConfirmBranch}
            onReviewPromptSelectCommit={onReviewPromptSelectCommit}
            onReviewPromptSelectCommitAtIndex={onReviewPromptSelectCommitAtIndex}
            onReviewPromptConfirmCommit={onReviewPromptConfirmCommit}
            onReviewPromptUpdateCustomInstructions={onReviewPromptUpdateCustomInstructions}
            onReviewPromptConfirmCustom={onReviewPromptConfirmCustom}
            sendLabel="Send"
            draftText={launchpadPrompt}
            onDraftChange={setLaunchpadPrompt}
          />
        </ComposerSurface>
      </HomeFrame>
      {isAgentSettingsOpen && activeWorkspace ? (
        <ModalShell
          className="settings-overlay settings-overlay--chatgpt"
          cardClassName="settings-window settings-window--chatgpt"
          onBackdropClick={() => setIsAgentSettingsOpen(false)}
          ariaLabelledBy="workspace-home-agent-settings-title"
        >
          <div data-testid="home-agent-settings-dialog">
            <div className="settings-titlebar">
              <div className="settings-title" id="workspace-home-agent-settings-title">
                Agent Command Center
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="settings-close"
                onClick={() => setIsAgentSettingsOpen(false)}
                aria-label="Close agent command center"
              >
                <X aria-hidden />
              </Button>
            </div>
            <div className="settings-content">
              <Suspense fallback={null}>
                <LazyWorkspaceHomeAgentControl
                  workspace={activeWorkspace}
                  activeModelContext={
                    activeModelContext
                      ? {
                          provider: activeModelContext.provider ?? null,
                          modelId: activeModelContext.model ?? null,
                        }
                      : undefined
                  }
                  approvals={approvals}
                  userInputRequests={userInputRequests}
                />
              </Suspense>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
