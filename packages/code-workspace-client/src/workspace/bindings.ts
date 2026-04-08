import type { ComponentType, ReactNode } from "react";
import type {
  GitBranchesSnapshot,
  GitChangesSnapshot,
  GitCommitResult,
  GitDiffContent,
  GitLogResponse,
  GitOperationResult,
  HugeCodeMissionControlSnapshot,
  HugeCodeReviewPackSummary,
  KernelProjectionBootstrapRequest,
  KernelProjectionBootstrapResponse,
  KernelProjectionDelta,
  KernelProjectionSubscriptionRequest,
  OAuthAccountSummary,
  OAuthPoolAccountBindRequest,
  OAuthPoolApplyInput,
  OAuthPoolMember,
  OAuthPoolSummary,
  OAuthPrimaryAccountSetInput,
  OAuthPrimaryAccountSummary,
  OAuthProviderId,
  RuntimeCompositionProfile,
  RuntimeCompositionProfileResolveV2Request,
  RuntimeCompositionProfileSummaryV2,
  RuntimeCompositionResolveV2Response,
  RuntimeCompositionSnapshotPublishRequest,
  RuntimeCompositionSnapshotPublishResponse,
  RuntimeRunCancelRequest,
  RuntimeRunCancelV2Response,
  RuntimeRunCheckpointApprovalAck,
  RuntimeRunCheckpointApprovalRequest,
  RuntimeRunInterventionRequest,
  RuntimeRunInterventionV2Response,
  RuntimeRunPrepareV2Request,
  RuntimeRunPrepareV2Response,
  RuntimeRunResumeRequest,
  RuntimeRunResumeV2Response,
  RuntimeRunStartRequest,
  RuntimeRunStartV2Response,
  ThreadSummary,
  WorkspaceFileContent,
  WorkspaceFileSummary,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeCompositionSettingsEntry } from "@ku0/code-platform-interfaces";
import type { BrowserRuntimeConnectionState } from "@ku0/shared/runtimeGatewayBrowser";
import type { SettingsShellFraming } from "../settings-shell/settingsShellTypes";
import type { WorkspaceNavigationAdapter } from "../workspace-shell/workspaceNavigation";

export type WorkspaceClientRuntimeMode = BrowserRuntimeConnectionState;
export type WorkspaceClientSurface = "shared-workspace-client";
export type WorkspaceClientHostPlatform = "desktop" | "web";

export type WorkspaceClientRuntimeUpdatedEvent = {
  scope: string[];
  reason: string;
  eventWorkspaceId: string;
  paramsWorkspaceId: string | null;
};

export type WorkspaceClientRuntimeUpdatedSubscriptionOptions = {
  workspaceId?: string | null | (() => string | null);
  scopes?: readonly string[];
};

export type DiscoveredLocalRuntimeGatewayTarget = {
  host: string;
  port: number;
  httpBaseUrl: string;
  wsBaseUrl: string;
};

export type ManualWebRuntimeGatewayTarget = {
  host: string;
  port: number;
};

export type WorkspaceClientRuntimeGatewayBindings = {
  readRuntimeMode: () => WorkspaceClientRuntimeMode;
  subscribeRuntimeMode: (listener: () => void) => () => void;
  discoverLocalRuntimeGatewayTargets: () => Promise<DiscoveredLocalRuntimeGatewayTarget[]>;
  configureManualWebRuntimeGatewayTarget: (target: ManualWebRuntimeGatewayTarget) => void;
};

export type WorkspaceClientSettingsRecord = Record<string, unknown>;

export type WorkspaceCatalogEntry = {
  id: string;
  name: string;
  connected: boolean;
};

export type WorkspaceClientOAuthLoginResult = {
  authUrl: string;
  immediateSuccess?: boolean;
};

export type WorkspaceClientRuntimeSettingsBindings = {
  getAppSettings: () => Promise<WorkspaceClientSettingsRecord>;
  updateAppSettings: (
    settings: WorkspaceClientSettingsRecord
  ) => Promise<WorkspaceClientSettingsRecord>;
  syncRuntimeGatewayProfileFromAppSettings: (settings: WorkspaceClientSettingsRecord) => void;
};

export type WorkspaceClientRuntimeOauthBindings = {
  listAccounts: (provider?: OAuthProviderId | null) => Promise<OAuthAccountSummary[]>;
  listPools: (provider?: OAuthProviderId | null) => Promise<OAuthPoolSummary[]>;
  listPoolMembers: (poolId: string) => Promise<OAuthPoolMember[]>;
  getPrimaryAccount: (provider: OAuthProviderId) => Promise<OAuthPrimaryAccountSummary | null>;
  setPrimaryAccount: (input: OAuthPrimaryAccountSetInput) => Promise<OAuthPrimaryAccountSummary>;
  applyPool: (input: OAuthPoolApplyInput) => Promise<unknown>;
  bindPoolAccount: (input: OAuthPoolAccountBindRequest) => Promise<unknown>;
  runLogin: (
    workspaceId: string,
    options: { forceOAuth: true }
  ) => Promise<WorkspaceClientOAuthLoginResult>;
  getAccountInfo: (workspaceId: string) => Promise<unknown>;
  getProvidersCatalog: () => Promise<unknown>;
};

export type WorkspaceClientRuntimeModelsBindings = {
  getModelList: (workspaceId: string) => Promise<unknown>;
  getConfigModel: (workspaceId: string, modelId: string) => Promise<unknown>;
};

export type WorkspaceClientRuntimeWorkspaceCatalogBindings = {
  listWorkspaces: () => Promise<WorkspaceCatalogEntry[]>;
};

export type WorkspaceClientRuntimeMissionControlBindings = {
  readMissionControlSnapshot: () => Promise<HugeCodeMissionControlSnapshot>;
};

export type WorkspaceClientRuntimeMissionControlSourceAdapter = {
  readMissionControlSnapshot: () => Promise<HugeCodeMissionControlSnapshot>;
  bootstrapKernelProjection?: (
    request?: KernelProjectionBootstrapRequest
  ) => Promise<KernelProjectionBootstrapResponse>;
  reportMissionControlFallback?: (event: {
    reason: "projection_bootstrap_failed" | "projection_slice_missing";
    error?: unknown;
  }) => void;
};

export type WorkspaceClientRuntimeKernelProjectionBindings = {
  bootstrap: (
    request?: KernelProjectionBootstrapRequest
  ) => Promise<KernelProjectionBootstrapResponse>;
  subscribe: (
    request: KernelProjectionSubscriptionRequest,
    listener: (delta: KernelProjectionDelta) => void
  ) => () => void;
};

export type WorkspaceClientRuntimeUpdatedBindings = {
  subscribeScopedRuntimeUpdatedEvents: (
    options: WorkspaceClientRuntimeUpdatedSubscriptionOptions,
    listener: (event: WorkspaceClientRuntimeUpdatedEvent) => void
  ) => () => void;
};

export type WorkspaceClientRuntimeAgentControlBindings = {
  prepareRuntimeRun: (input: RuntimeRunPrepareV2Request) => Promise<RuntimeRunPrepareV2Response>;
  startRuntimeRun: (input: RuntimeRunStartRequest) => Promise<RuntimeRunStartV2Response>;
  cancelRuntimeRun: (input: RuntimeRunCancelRequest) => Promise<RuntimeRunCancelV2Response>;
  resumeRuntimeRun: (input: RuntimeRunResumeRequest) => Promise<RuntimeRunResumeV2Response>;
  interveneRuntimeRun: (
    input: RuntimeRunInterventionRequest
  ) => Promise<RuntimeRunInterventionV2Response>;
  submitRuntimeJobApprovalDecision: (
    input: RuntimeRunCheckpointApprovalRequest
  ) => Promise<RuntimeRunCheckpointApprovalAck>;
};

/**
 * Compatibility-only thread lifecycle bindings.
 *
 * Keep thread/turn workflows contained here instead of extending them as the
 * default product execution model.
 */
export type WorkspaceClientRuntimeThreadsBindings = {
  listThreads: (input: { workspaceId: string }) => Promise<ThreadSummary[]>;
  createThread: (input: { workspaceId: string; title: string | null }) => Promise<ThreadSummary>;
  resumeThread: (input: { workspaceId: string; threadId: string }) => Promise<ThreadSummary | null>;
  archiveThread: (input: { workspaceId: string; threadId: string }) => Promise<boolean>;
};

export type WorkspaceClientRuntimeGitBindings = {
  listChanges: (input: { workspaceId: string }) => Promise<GitChangesSnapshot>;
  readDiff: (input: {
    workspaceId: string;
    changeId: string;
    offset?: number;
    maxBytes?: number;
  }) => Promise<GitDiffContent | null>;
  listBranches: (input: { workspaceId: string }) => Promise<GitBranchesSnapshot>;
  createBranch: (input: { workspaceId: string; branchName: string }) => Promise<GitOperationResult>;
  checkoutBranch: (input: {
    workspaceId: string;
    branchName: string;
  }) => Promise<GitOperationResult>;
  readLog: (input: { workspaceId: string; limit?: number }) => Promise<GitLogResponse>;
  stageChange: (input: { workspaceId: string; changeId: string }) => Promise<GitOperationResult>;
  stageAll: (input: { workspaceId: string }) => Promise<GitOperationResult>;
  unstageChange: (input: { workspaceId: string; changeId: string }) => Promise<GitOperationResult>;
  revertChange: (input: { workspaceId: string; changeId: string }) => Promise<GitOperationResult>;
  commit: (input: { workspaceId: string; message: string }) => Promise<GitCommitResult>;
};

export type WorkspaceClientRuntimeWorkspaceFilesBindings = {
  listWorkspaceFileEntries: (input: { workspaceId: string }) => Promise<WorkspaceFileSummary[]>;
  readWorkspaceFile: (input: {
    workspaceId: string;
    fileId: string;
  }) => Promise<WorkspaceFileContent | null>;
};

export type WorkspaceClientRuntimeReviewBindings = {
  listReviewPacks: () => Promise<HugeCodeReviewPackSummary[]>;
};

export type WorkspaceClientRuntimeCompositionBindings = {
  listProfilesV2: (workspaceId: string) => Promise<RuntimeCompositionProfileSummaryV2[]>;
  getProfileV2: (
    workspaceId: string,
    profileId: string
  ) => Promise<RuntimeCompositionProfile | null>;
  resolveV2: (
    input: RuntimeCompositionProfileResolveV2Request
  ) => Promise<RuntimeCompositionResolveV2Response>;
  publishSnapshotV1: (
    input: RuntimeCompositionSnapshotPublishRequest
  ) => Promise<RuntimeCompositionSnapshotPublishResponse>;
  getSettings: (workspaceId: string) => Promise<RuntimeCompositionSettingsEntry>;
  updateSettings: (
    workspaceId: string,
    settings: RuntimeCompositionSettingsEntry
  ) => Promise<RuntimeCompositionSettingsEntry>;
};

export type WorkspaceClientRuntimeBindings = {
  surface: WorkspaceClientSurface;
  settings: WorkspaceClientRuntimeSettingsBindings;
  oauth: WorkspaceClientRuntimeOauthBindings;
  models: WorkspaceClientRuntimeModelsBindings;
  workspaceCatalog: WorkspaceClientRuntimeWorkspaceCatalogBindings;
  missionControl: WorkspaceClientRuntimeMissionControlBindings;
  kernelProjection?: WorkspaceClientRuntimeKernelProjectionBindings;
  runtimeUpdated?: WorkspaceClientRuntimeUpdatedBindings;
  agentControl: WorkspaceClientRuntimeAgentControlBindings;
  threads: WorkspaceClientRuntimeThreadsBindings;
  git: WorkspaceClientRuntimeGitBindings;
  workspaceFiles: WorkspaceClientRuntimeWorkspaceFilesBindings;
  review: WorkspaceClientRuntimeReviewBindings;
  composition?: WorkspaceClientRuntimeCompositionBindings;
};

export type WorkspaceClientHostNotificationBindings = {
  testSound: () => void;
  testSystemNotification: () => void;
};

export type WorkspaceClientHostIntentBindings = {
  openOauthAuthorizationUrl: (url: string, popup: Window | null) => Promise<void>;
  createOauthPopupWindow: () => Window | null;
  waitForOauthBinding: (workspaceId: string, baselineUpdatedAt: number) => Promise<boolean>;
};

export type WorkspaceClientHostStartupStatus = {
  tone: "ready" | "attention" | "blocked";
  label: string;
  detail: string;
};

export type WorkspaceClientHostShellBindings = {
  platformHint?: string | null;
  readStartupStatus?: () => Promise<WorkspaceClientHostStartupStatus | null>;
};

export type WorkspaceClientHostBindings = {
  platform: WorkspaceClientHostPlatform;
  intents: WorkspaceClientHostIntentBindings;
  notifications: WorkspaceClientHostNotificationBindings;
  shell: WorkspaceClientHostShellBindings;
};

export type PlatformUiBindings = {
  WorkspaceRuntimeShell: ComponentType;
  WorkspaceApp: ComponentType;
  renderWorkspaceHost: (children: ReactNode) => ReactNode;
  settingsShellFraming: SettingsShellFraming;
};

export type WorkspaceClientBindings = {
  navigation: WorkspaceNavigationAdapter;
  runtimeGateway: WorkspaceClientRuntimeGatewayBindings;
  runtime: WorkspaceClientRuntimeBindings;
  host: WorkspaceClientHostBindings;
  platformUi: PlatformUiBindings;
};

export type WorkspaceClientStore = {
  bindings: WorkspaceClientBindings;
};

export function createWorkspaceClientStore(
  bindings: WorkspaceClientBindings
): WorkspaceClientStore {
  return { bindings };
}
