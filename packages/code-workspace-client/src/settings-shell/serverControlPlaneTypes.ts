import type { HugeRouterCommercialServiceSnapshot } from "@ku0/code-runtime-host-contract";
import type {
  SettingsRelayAssistantGeneratedConfig,
  SettingsRelayAssistantKind,
} from "./relayAssistant";

export type SettingsServerCompactSelectProps = {
  className: string;
  triggerClassName: string;
  menuClassName: string;
  optionClassName: string;
  triggerDensity: "compact";
};

export type SettingsServerOperabilityState = {
  capabilityEnabled: boolean;
  loading: boolean;
  error: string | null;
  readOnlyReason: string | null;
  unavailableReason: string | null;
};

export function createSettingsServerOperabilityState(
  overrides: Partial<SettingsServerOperabilityState> = {}
): SettingsServerOperabilityState {
  return {
    capabilityEnabled: true,
    loading: false,
    error: null,
    readOnlyReason: null,
    unavailableReason: null,
    ...overrides,
  };
}

export function resolveSettingsServerOperabilityNotice(
  state: SettingsServerOperabilityState
): { tone: "default" | "error"; text: string } | null {
  if (state.error) {
    return {
      tone: "error",
      text: `Error: ${state.error}`,
    };
  }
  if (state.unavailableReason) {
    return {
      tone: "default",
      text: `Unavailable: ${state.unavailableReason}`,
    };
  }
  if (state.readOnlyReason) {
    return {
      tone: "default",
      text: `Read-only: ${state.readOnlyReason}`,
    };
  }
  if (state.loading) {
    return {
      tone: "default",
      text: "Loading runtime state...",
    };
  }
  return null;
}

export function resolveSettingsServerOperabilityBlockedReason(
  state: SettingsServerOperabilityState
): string | null {
  return state.unavailableReason ?? state.readOnlyReason ?? state.error;
}

export type SettingsServerMissionNavigationTarget =
  | {
      kind: "mission";
      workspaceId: string;
      taskId: string;
      runId: string | null;
      reviewPackId: null;
      threadId: null;
      limitation: "thread_unavailable";
    }
  | {
      kind: "review";
      workspaceId: string;
      taskId: string;
      runId: string | null;
      reviewPackId: string;
      limitation: "thread_unavailable";
    };

export type SettingsServerBackendPoolReachability =
  | "reachable"
  | "degraded"
  | "unreachable"
  | "unknown";

export type SettingsServerBackendPoolLeaseStatus =
  | "active"
  | "expiring"
  | "expired"
  | "released"
  | "none";

export type SettingsServerBackendPoolEntry = {
  backendId: string;
  label: string;
  provider?: string | null;
  state: "enabled" | "disabled" | "draining" | "degraded" | "unknown";
  backendKind?: "native" | "acp" | null;
  integrationId?: string | null;
  transport?: "stdio" | "http" | null;
  httpExperimental?: boolean | null;
  origin?: "runtime-native" | "acp-projection" | null;
  healthy?: boolean | null;
  lastError?: string | null;
  lastProbeAt?: number | null;
  queueDepth?: number | null;
  backendClass?: "primary" | "burst" | "specialized" | null;
  specializations?: string[] | null;
  connectivity?: {
    overlay?: "tailscale" | "netbird" | "orbit" | null;
    endpoint?: string | null;
    reachability?: SettingsServerBackendPoolReachability | null;
    reason?: string | null;
  } | null;
  lease?: {
    status: SettingsServerBackendPoolLeaseStatus;
    holderId?: string | null;
    expiresAt?: number | null;
  } | null;
  diagnostics?: {
    summary?: string | null;
    reasons?: string[] | null;
  } | null;
  policy?: {
    trustTier?: "trusted" | "standard" | "isolated" | null;
    dataSensitivity?: "public" | "internal" | "restricted" | null;
    approvalPolicy?: "runtime-default" | "checkpoint-required" | "never-auto-approve" | null;
    allowedToolClasses?: ("read" | "write" | "exec" | "network" | "browser" | "mcp")[] | null;
  } | null;
};

export type SettingsServerBackendPoolSnapshot = {
  backends: SettingsServerBackendPoolEntry[];
  backendsTotal: number;
  backendsHealthy: number;
  backendsDraining: number;
  queueDepth: number | null;
};

export type SettingsServerBackendPoolBootstrapTemplate = {
  backendClass: "primary" | "burst" | "specialized";
  title: string;
  command: string;
  args: string[];
  backendIdExample: string;
  registrationExample: Record<string, unknown>;
  notes: string[];
};

export type SettingsServerBackendPoolBootstrapPreview = {
  generatedAtMs: number;
  runtimeServiceBin: string;
  remoteHost: string;
  remoteTokenConfigured: boolean;
  workspacePath: string | null;
  templates: SettingsServerBackendPoolBootstrapTemplate[];
};

export type SettingsServerBackendPoolDiagnosticReason = {
  code: string;
  severity: "warning" | "error";
  summary: string;
  detail?: string | null;
  retryable: boolean;
};

export type SettingsServerBackendPoolDiagnostics = {
  generatedAtMs: number;
  runtimeServiceBin: string;
  workspacePath: string | null;
  remoteHost: string;
  remoteTokenConfigured: boolean;
  defaultExecutionBackendId: string | null;
  tcpOverlay: "tailscale" | "netbird" | null;
  registrySource: string;
  reasons: SettingsServerBackendPoolDiagnosticReason[];
  warnings: string[];
  tcpDaemon: {
    state: string;
  };
};

export type SettingsAutomationScheduleStatus = "active" | "paused" | "running" | "blocked";

export type SettingsAutomationScheduleAction = "pause" | "resume" | "run-now" | "cancel-run";

export type SettingsAutomationScheduleSummary = {
  id: string;
  name: string;
  prompt: string;
  workspaceId: string | null;
  cadenceLabel: string;
  status: SettingsAutomationScheduleStatus;
  nextRunAtMs: number | null;
  lastRunAtMs: number | null;
  lastOutcomeLabel: string | null;
  backendId: string | null;
  backendLabel: string | null;
  reviewProfileId: string | null;
  reviewProfileLabel: string | null;
  validationPresetId: string | null;
  validationPresetLabel: string | null;
  triggerSourceLabel: string | null;
  blockingReason: string | null;
  safeFollowUp: boolean | null;
  autonomyProfile: string | null;
  sourceScope: string | null;
  wakePolicy: string | null;
  researchPolicy: string | null;
  queueBudget: number | null;
  currentTaskId: string | null;
  currentTaskStatus: string | null;
  currentRunId: string | null;
  lastTriggeredTaskId: string | null;
  lastTriggeredTaskStatus: string | null;
  lastTriggeredRunId: string | null;
  reviewPackId: string | null;
  reviewActionabilityState: string | null;
};

export type SettingsAutomationScheduleDraft = {
  name: string;
  prompt: string;
  workspaceId: string;
  cadence: string;
  backendId: string;
  reviewProfileId: string;
  validationPresetId: string;
  enabled: boolean;
  autonomyProfile: string;
  sourceScope: string;
  wakePolicy: string;
  researchPolicy: string;
  queueBudget: string;
  safeFollowUp: boolean;
};

export type SettingsAutomationScheduleActionAvailability = {
  createEnabled?: boolean;
  updateEnabled?: boolean;
  runNowEnabled?: boolean;
  cancelRunEnabled?: boolean;
};

export type SettingsHugeRouterCommercialSurface = {
  snapshot: HugeRouterCommercialServiceSnapshot | null;
  operability?: SettingsServerOperabilityState;
  onConnect?: () => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
  onOpenPlans?: () => void | Promise<void>;
  onOpenOrders?: () => void | Promise<void>;
  onIssueRouteToken?: () => void | Promise<void>;
};

export type SettingsRelayAssistantSurface = {
  defaultKind?: SettingsRelayAssistantKind;
  onApplyConfig?: (config: SettingsRelayAssistantGeneratedConfig) => void | Promise<void>;
};

export type SettingsServerControlPlaneSectionProps = {
  isMobileSimplified?: boolean;
  remoteExecutionBackendOptions: Array<{ id: string; label: string }>;
  defaultRemoteExecutionBackendId: string | null;
  onSetDefaultExecutionBackend: (backendId: string | null) => Promise<void> | void;
  workspaceOptions: Array<{ id: string; label: string }>;
  hugeRouterCommercial?: SettingsHugeRouterCommercialSurface | null;
  relayAssistant?: SettingsRelayAssistantSurface | null;
  backendPoolVisible: boolean;
  backendPool: SettingsServerBackendPoolSnapshot | null;
  backendPoolLoading?: boolean;
  backendPoolError?: string | null;
  backendPoolReadOnlyReason?: string | null;
  backendPoolStateActionsEnabled?: boolean;
  backendPoolRemoveEnabled?: boolean;
  backendPoolUpsertEnabled?: boolean;
  backendPoolProbeEnabled?: boolean;
  backendPoolEditEnabled?: boolean;
  backendPoolBootstrapPreview?: SettingsServerBackendPoolBootstrapPreview | null;
  backendPoolBootstrapPreviewError?: string | null;
  backendPoolDiagnostics?: SettingsServerBackendPoolDiagnostics | null;
  backendPoolDiagnosticsError?: string | null;
  onRefreshBackendPool?: () => void;
  onBackendPoolAction?: (request: {
    backendId: string;
    action: "drain" | "disable" | "enable" | "remove";
  }) => Promise<void>;
  onBackendPoolUpsert?: () => void | Promise<void>;
  onNativeBackendEdit?: (backendId: string) => void;
  onAcpBackendUpsert?: () => void | Promise<void>;
  onAcpBackendEdit?: (backendId: string) => void;
  onAcpBackendProbe?: (backendId: string) => Promise<void>;
  automationSchedules?: SettingsAutomationScheduleSummary[];
  automationSchedulesOperability?: SettingsServerOperabilityState;
  automationScheduleActionAvailability?: SettingsAutomationScheduleActionAvailability;
  onRefreshAutomationSchedules?: () => void | Promise<void>;
  onCreateAutomationSchedule?: (draft: SettingsAutomationScheduleDraft) => void | Promise<void>;
  onUpdateAutomationSchedule?: (
    scheduleId: string,
    draft: SettingsAutomationScheduleDraft
  ) => void | Promise<void>;
  onAutomationScheduleAction?: (request: {
    scheduleId: string;
    action: SettingsAutomationScheduleAction;
  }) => void | Promise<void>;
  onOpenMissionTarget?: (target: SettingsServerMissionNavigationTarget) => void | Promise<void>;
};
