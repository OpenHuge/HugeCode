import LayoutTemplate from "lucide-react/dist/esm/icons/layout-template";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Rocket from "lucide-react/dist/esm/icons/rocket";
import ScanSearch from "lucide-react/dist/esm/icons/scan-search";
import Settings from "lucide-react/dist/esm/icons/settings";
import X from "lucide-react/dist/esm/icons/x";
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import type { MissionControlProjection } from "../../../application/runtime/facades/runtimeMissionControlFacade";
import { detectRuntimeMode } from "../../../application/runtime/ports/runtimeClientMode";
import { REVIEW_START_DESKTOP_ONLY_MESSAGE } from "../../../application/runtime/ports/tauriThreads";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import { Button } from "../../../design-system";
import { Card, CardDescription, CardTitle } from "../../../design-system";
import { EmptySurface } from "../../../design-system";
import { Icon } from "../../../design-system";
import { ShellFrame, ShellSection } from "../../../design-system";
import { SectionHeader } from "../../../design-system";
import { Select } from "../../../design-system";
import { StatusBadge } from "../../../design-system";
import type { StatusBadgeTone } from "../../../design-system";
import { Surface } from "../../../design-system";
import { WorkspaceHeaderAction } from "../../../design-system";
import type {
  AccessMode,
  AppMention,
  ApprovalRequest,
  CollaborationModeOption,
  ComposerExecutionMode,
  CustomPromptOption,
  LocalUsageSnapshot,
  ModelOption,
  RequestUserInputRequest,
  SkillOption,
} from "../../../types";
import { joinClassNames } from "../../../utils/classNames";
import { MainHeaderShell } from "../../app/components/MainHeader";
import { Composer } from "../../composer/components/Composer";
import { ComposerSurface } from "../../composer/components/ComposerSurface";
import { ModalShell } from "../../../design-system";
import { PanelSplitToggleIcon } from "../../layout/components/PanelSplitToggleIcon";
import {
  describeMissionRunRouteDetail,
  type MissionControlFreshnessState,
  type MissionNavigationTarget,
} from "../../missions/utils/missionControlPresentation";
import { resolveMissionEntryActionLabel } from "../../missions/utils/missionNavigation";
import "@ku0/code-workspace-client/settings-shell/SettingsModalChrome.global.css";
import type { ReviewPromptState, ReviewPromptStep } from "../../threads/hooks/useReviewPrompt";
import { HomeFrame, HomeListRow } from "./HomeScaffold";
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

type LatestAgentRun = {
  message: string;
  timestamp: number;
  projectName: string;
  groupName?: string | null;
  workspaceId: string;
  threadId: string;
  navigationTarget?: MissionNavigationTarget;
  secondaryLabel?: string | null;
  runId: string | null;
  taskId: string | null;
  statusLabel: string;
  statusKind: "active" | "review_ready" | "needs_input" | "attention" | "recent_activity";
  source: "runtime_snapshot_v1";
  warningCount: number;
  operatorActionLabel?: string | null;
  operatorActionDetail?: string | null;
  operatorActionTarget?: MissionNavigationTarget | null;
};

type UsageMetric = "tokens" | "time";

type UsageWorkspaceOption = {
  id: string;
  label: string;
};

type WorkspaceOption = {
  id: string;
  name: string;
  path?: string;
  connected?: boolean;
};

const launchpadStarters = [
  {
    id: "audit-ui",
    icon: ScanSearch,
    label: "Audit the UI",
    description: "Diagnose friction, tighten hierarchy, and implement the highest-leverage polish.",
    prompt:
      "Audit the current UI/UX of this project, identify the biggest friction points, and implement the highest-leverage improvements to make it feel like a top-tier product.",
  },
  {
    id: "design-surface",
    icon: LayoutTemplate,
    label: "Design a surface",
    description:
      "Create a polished user-facing flow with strong visual hierarchy and responsive behavior.",
    prompt:
      "Design and implement a polished new user-facing surface for this project with strong visual hierarchy, responsive behavior, and production-ready UI details.",
  },
  {
    id: "ship-feature",
    icon: Rocket,
    label: "Ship a feature",
    description: "Plan, build, validate, and finish a meaningful feature end-to-end.",
    prompt:
      "Implement the next high-value user-facing feature for this project, cover the edge cases, and verify the result with targeted tests before signoff.",
  },
] as const;

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
  appMentions?: AppMention[];
};

type HomeSignalCardProps = {
  title: string;
  count: ReactNode;
  message: ReactNode;
  detail?: ReactNode;
  status: string;
  statusTone?: StatusBadgeTone;
  group?: ReactNode;
};

type HomeMissionSignalTileProps = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "success" | "warning" | "accent";
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  testId?: string;
};

function HomeMissionSignalTile({
  label,
  value,
  detail,
  action,
  tone = "neutral",
  onClick,
  disabled = false,
  ariaLabel,
  testId,
}: HomeMissionSignalTileProps) {
  const content = (
    <>
      <div className={styles.missionTileCopy}>
        <span className={styles.missionTileLabel}>{label}</span>
        {detail ? <div className={styles.missionTileDetail}>{detail}</div> : null}
      </div>
      <div className={styles.missionTileTrailing}>
        <span className={styles.missionTileValue} data-tone={tone}>
          {value}
        </span>
        {action ? (
          <div className={styles.missionTileAction} data-tone={tone}>
            {action}
          </div>
        ) : null}
      </div>
    </>
  );

  if (!onClick) {
    return (
      <HomeListRow className={styles.missionTile} data-testid={testId}>
        {content}
      </HomeListRow>
    );
  }

  return (
    <HomeListRow>
      <button
        type="button"
        className={joinClassNames(styles.missionTile, styles.missionTileButton)}
        onClick={onClick}
        disabled={disabled}
        data-tauri-drag-region="false"
        aria-label={ariaLabel}
        data-testid={testId}
      >
        {content}
      </button>
    </HomeListRow>
  );
}

function HomeSignalCard({
  title,
  count,
  message,
  detail = null,
  status,
  statusTone = "default",
  group,
}: HomeSignalCardProps) {
  return (
    <div className={styles.dashboardCard}>
      <div className={styles.dashboardCardMain}>
        <div className={styles.dashboardCardHeading}>
          <div className={styles.dashboardCardTitleRow}>
            <CardTitle className={styles.dashboardCardTitle}>{title}</CardTitle>
            {group ? (
              <StatusBadge
                className={styles.dashboardCardGroup}
                data-home-dashboard-card-group="true"
              >
                {group}
              </StatusBadge>
            ) : null}
          </div>
          <span className={styles.dashboardCardMeta}>{count}</span>
        </div>
        <CardDescription className={styles.dashboardCardMessage}>{message}</CardDescription>
        {detail ? <div className={styles.dashboardCardDetail}>{detail}</div> : null}
      </div>
      <div className={styles.dashboardCardStatusRow}>
        <StatusBadge
          className={styles.dashboardCardStatus}
          tone={statusTone}
          data-home-dashboard-card-status="true"
        >
          {status}
        </StatusBadge>
      </div>
    </div>
  );
}

function HomeSectionEmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Surface className={styles.emptyPanel} padding="md" tone="subtle" depth="card">
      <div className={styles.emptyPanelTitle}>{title}</div>
      <div className={styles.emptyPanelBody}>{body}</div>
    </Surface>
  );
}

function resolveRunStatusTone(statusKind: LatestAgentRun["statusKind"]): StatusBadgeTone {
  switch (statusKind) {
    case "review_ready":
      return "success";
    case "needs_input":
    case "attention":
      return "warning";
    case "active":
      return "progress";
    case "recent_activity":
    default:
      return "default";
  }
}

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
  onSend?: (
    text: string,
    images: string[],
    appMentions?: AppMention[]
  ) => void | false | Promise<void | false>;
  onQueue?: (
    text: string,
    images: string[],
    appMentions?: AppMention[]
  ) => void | false | Promise<void | false>;
  onSendToWorkspace?: (
    workspaceId: string,
    text: string,
    images: string[],
    appMentions?: AppMention[]
  ) => void | false | Promise<void | false>;
  onQueueToWorkspace?: (
    workspaceId: string,
    text: string,
    images: string[],
    appMentions?: AppMention[]
  ) => void | false | Promise<void | false>;
  workspaces?: WorkspaceOption[];
  activeWorkspaceId?: string | null;
  onSelectWorkspace?: (workspaceId: string) => void;
  steerEnabled?: boolean;
  collaborationModes?: CollaborationModeOption[];
  selectedCollaborationModeId?: string | null;
  onSelectCollaborationMode?: (id: string | null) => void;
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

function formatMissionTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

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
    void Promise.resolve(run(nextSubmit.text, nextSubmit.images, nextSubmit.appMentions)).finally(
      () => {
        setPendingHomeSubmits((current) => {
          if (current[0]?.id === nextSubmit.id) {
            return current.slice(1);
          }
          return current.filter((entry) => entry.id !== nextSubmit.id);
        });
        if (activePendingSubmitRef.current === nextSubmit.id) {
          activePendingSubmitRef.current = null;
        }
      }
    );
  }, [activeWorkspaceId, onQueue, onSend, pendingHomeSubmits]);

  const handleHomeSubmit = (
    mode: "send" | "queue",
    text: string,
    images: string[],
    appMentions?: AppMention[]
  ) => {
    if (isReviewSlashCommand(text) && detectRuntimeMode() !== "tauri") {
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
      void directRun(targetWorkspaceId, text, images, appMentions);
      return;
    }
    const nextSubmit: PendingHomeSubmit = {
      id: `home-submit-${++pendingSubmitSequenceRef.current}`,
      mode,
      workspaceId: targetWorkspaceId,
      text,
      images: [...images],
      appMentions,
    };
    if (activeWorkspaceId !== targetWorkspaceId || pendingHomeSubmits.length > 0) {
      setPendingHomeSubmits((current) => [...current, nextSubmit]);
      if (activeWorkspaceId !== targetWorkspaceId) {
        onSelectWorkspace(targetWorkspaceId);
      }
      return;
    }
    const run = mode === "queue" ? onQueue : onSend;
    void run(text, images, appMentions);
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
                  data-tauri-drag-region="false"
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
              data-tauri-drag-region="false"
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
              <div className={styles.launchpadSetupGrid} data-home-launchpad-setup-grid="true">
                {showWorkspaceSummaryPanel ? (
                  <div
                    className={joinClassNames(
                      styles.launchpadSetupItem,
                      launchpadSetupHasSinglePanel && styles.launchpadSetupItemFullSpan
                    )}
                  >
                    <Surface
                      className={joinClassNames(
                        launchpadStyles.heroMetaPanel,
                        styles.workspaceSummaryPanel
                      )}
                      depth="card"
                      padding="md"
                      tone="elevated"
                      data-testid="home-workspace-summary"
                      data-workspace-summary-scope={workspaceSummaryScope}
                    >
                      <SectionHeader
                        className={launchpadStyles.heroMetaHeader}
                        title={workspaceSummaryTitle}
                        meta={workspaceSummaryMeta}
                        titleClassName={launchpadStyles.heroMetaValue}
                        metaClassName={launchpadStyles.heroMetaEyebrow}
                      />
                      <div className={launchpadStyles.heroMetaBody}>
                        {workspaceSummaryDetail ? (
                          <div className={launchpadStyles.heroMetaDetail}>
                            {workspaceSummaryDetail}
                          </div>
                        ) : null}
                        {resolvedRemotePlacement ? (
                          <div
                            className={`${launchpadStyles.heroPlacement} ${
                              resolvedRemotePlacement.tone === "warning"
                                ? launchpadStyles.heroPlacementWarning
                                : ""
                            }`}
                            data-tone={resolvedRemotePlacement.tone}
                          >
                            <div className={launchpadStyles.heroPlacementValue}>
                              {resolvedRemotePlacement.summary}
                            </div>
                            {workspacePlacementDetail ? (
                              <div className={launchpadStyles.heroPlacementDetail}>
                                {workspacePlacementDetail}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </Surface>
                  </div>
                ) : null}
                {showRuntimeNotice ? (
                  <div
                    className={joinClassNames(
                      styles.launchpadSetupItem,
                      launchpadSetupHasSinglePanel && styles.launchpadSetupItemFullSpan
                    )}
                  >
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
                  </div>
                ) : null}
              </div>
              {!isConnectionEntryState ? (
                <>
                  <div className={styles.missionGrid} data-home-mission-grid="true">
                    <HomeMissionSignalTile
                      label="Awaiting action"
                      value={missionSignals.awaitingActionCount}
                      detail={
                        awaitingActionRun
                          ? (awaitingActionRun.operatorActionDetail ?? awaitingActionRun.message)
                          : undefined
                      }
                      action={
                        awaitingActionRun
                          ? resolveMissionEntryActionLabel({
                              operatorActionLabel: awaitingActionRun.operatorActionLabel,
                              operatorActionTarget: awaitingActionRun.operatorActionTarget ?? null,
                              navigationTarget: awaitingActionRun.navigationTarget ?? null,
                            })
                          : "Clear"
                      }
                      tone={awaitingActionRun ? "warning" : "success"}
                      onClick={() => {
                        if (!awaitingActionRun) {
                          return;
                        }
                        openMissionTarget(awaitingActionRun, { preferOperatorAction: true });
                      }}
                      disabled={!awaitingActionRun}
                      ariaLabel={
                        awaitingActionRun
                          ? "Open the next mission that requires operator action"
                          : "No mission is awaiting operator action"
                      }
                      testId="home-mission-signal-awaiting-action"
                    />
                    <HomeMissionSignalTile
                      label="Review-ready"
                      value={missionSignals.reviewReadyCount}
                      detail={reviewReadyRun ? reviewReadyRun.message : undefined}
                      action={
                        reviewReadyRun
                          ? resolveMissionEntryActionLabel({
                              operatorActionLabel: reviewReadyRun.operatorActionLabel,
                              operatorActionTarget: reviewReadyRun.operatorActionTarget ?? null,
                              navigationTarget: reviewReadyRun.navigationTarget ?? null,
                            })
                          : null
                      }
                      tone={reviewReadyRun ? "success" : "neutral"}
                      onClick={() => {
                        if (reviewReadyRun) {
                          openMissionTarget(reviewReadyRun, { preferOperatorAction: true });
                          return;
                        }
                        if (workspaces.length === 0) {
                          setupAction();
                        }
                      }}
                      disabled={!reviewReadyRun && workspaces.length > 0}
                      ariaLabel={
                        reviewReadyRun
                          ? "Open review-ready mission"
                          : "Review-ready mission pending"
                      }
                      testId="home-mission-signal-review-ready"
                    />
                    <HomeMissionSignalTile
                      label="Routing"
                      value={routingSignal.value}
                      detail={
                        routingSignal.tone === "warning" || routingSignal.tone === "accent"
                          ? routingSignal.detail
                          : undefined
                      }
                      action={routingSignal.action}
                      tone={routingSignal.tone}
                      onClick={() => {
                        if (routingSignal.prefersMissionControl) {
                          const routingRun =
                            reviewReadyRun ?? awaitingActionRun ?? activeRun ?? null;
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
                      ariaLabel={routingSignal.ariaLabel}
                      testId="home-mission-signal-routing"
                    />
                  </div>
                  <div
                    className={launchpadStyles.starterSection}
                    data-testid="home-starter-section"
                    data-home-launchpad-layout="compact-grid"
                  >
                    <div className={launchpadStyles.starterGrid}>
                      {launchpadStarters.map((starter) => (
                        <HomeListRow key={starter.id}>
                          <button
                            type="button"
                            className={launchpadStyles.starterCardButton}
                            onClick={() => setLaunchpadPrompt(starter.prompt)}
                            data-tauri-drag-region="false"
                            data-testid={`home-launchpad-starter-${starter.id}`}
                          >
                            <Card
                              className={launchpadStyles.starterCard}
                              variant="subtle"
                              padding="sm"
                              data-selected={launchpadPrompt === starter.prompt ? "true" : "false"}
                            >
                              <div className={launchpadStyles.starterIcon} aria-hidden>
                                <Icon
                                  icon={starter.icon}
                                  size={18}
                                  className={launchpadStyles.starterIconGlyph}
                                />
                              </div>
                              <div className={launchpadStyles.starterCopy}>
                                <div className={launchpadStyles.starterLabel}>
                                  <CardTitle className={launchpadStyles.starterTitle}>
                                    {starter.label}
                                  </CardTitle>
                                </div>
                              </div>
                            </Card>
                          </button>
                        </HomeListRow>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </ShellSection>
            {!isConnectionEntryState ? (
              <ShellSection
                title="Recent missions"
                depth="panel"
                meta={isLoadingLatestAgents ? "Syncing..." : null}
                className={styles.dashboardSection}
                testId="home-recent-missions"
              >
                {isLoadingLatestAgents && latestAgentRuns.length === 0 ? (
                  <HomeSectionEmptyState
                    title="Syncing missions"
                    body="Recent missions will appear here."
                  />
                ) : latestAgentRuns.length === 0 ? (
                  <EmptySurface
                    title="No recent missions yet."
                    body="Start one from the composer."
                  />
                ) : (
                  <div className={styles.dashboardGrid} data-home-dashboard-grid="true">
                    {latestAgentRuns.map((run) => (
                      <HomeListRow key={run.threadId}>
                        <button
                          type="button"
                          className={styles.dashboardCardButton}
                          aria-label={`Open recent mission ${run.message}`}
                          onClick={() => openMissionTarget(run)}
                          data-tauri-drag-region="false"
                          data-testid={`home-recent-mission-${run.threadId}`}
                        >
                          <HomeSignalCard
                            title={run.projectName}
                            group={run.groupName}
                            count={formatMissionTimestamp(run.timestamp)}
                            message={run.message}
                            detail={describeMissionRunRouteDetail(
                              missionControlProjection,
                              run.runId
                            )}
                            status={
                              run.secondaryLabel
                                ? `${run.statusLabel} | ${run.secondaryLabel}`
                                : run.statusLabel
                            }
                            statusTone={resolveRunStatusTone(run.statusKind)}
                          />
                        </button>
                      </HomeListRow>
                    ))}
                  </div>
                )}
              </ShellSection>
            ) : null}
          </ShellFrame>
        </div>
        <ComposerSurface
          surface="home"
          className={joinClassNames(styles.composerDock, launchpadStyles.composer)}
          data-tauri-drag-region="false"
          data-home-dock="true"
          data-home-composer-dock="true"
        >
          <Composer
            variant="home"
            onSend={(text, images, appMentions) =>
              handleHomeSubmit("send", text, images, appMentions)
            }
            onQueue={(text, images, appMentions) =>
              handleHomeSubmit("queue", text, images, appMentions)
            }
            onStop={() => undefined}
            canStop={false}
            disabled={false}
            isProcessing={false}
            steerEnabled={steerEnabled}
            collaborationModes={collaborationModes}
            selectedCollaborationModeId={selectedCollaborationModeId}
            onSelectCollaborationMode={onSelectCollaborationMode}
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
