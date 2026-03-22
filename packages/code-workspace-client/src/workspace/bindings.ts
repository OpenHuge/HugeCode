import type { ComponentType, ReactNode } from "react";
import type {
  GitBranchesSnapshot,
  GitChangesSnapshot,
  GitCommitResult,
  GitDiffContent,
  GitLogResponse,
  GitOperationResult,
  HugeCodeMissionControlSnapshot,
  HugeCodeMissionControlSummary,
  HugeCodeReviewPackSummary,
  KernelJob,
  KernelJobInterventionRequestV3,
  KernelJobsListRequest,
  KernelJobResumeRequestV3,
  KernelJobStartRequestV3,
  KernelJobSubscribeRequestV3,
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
  RuntimeRunCancelAck,
  RuntimeRunCancelRequest,
  RuntimeRunCheckpointApprovalAck,
  RuntimeRunCheckpointApprovalRequest,
  RuntimeRunInterventionAck,
  RuntimeRunResumeAck,
  ThreadSummary,
  WorkspaceFileContent,
  WorkspaceFileSummary,
} from "@ku0/code-runtime-host-contract";
import type { BrowserRuntimeConnectionState } from "@ku0/shared/runtimeGatewayBrowser";
import type { SettingsShellFraming } from "../settings-shell";
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
  readMissionControlSummary?: (
    activeWorkspaceId: string | null
  ) => Promise<HugeCodeMissionControlSummary>;
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
  startRuntimeJob: (input: KernelJobStartRequestV3) => Promise<KernelJob>;
  cancelRuntimeJob: (input: RuntimeRunCancelRequest) => Promise<RuntimeRunCancelAck>;
  resumeRuntimeJob: (input: KernelJobResumeRequestV3) => Promise<RuntimeRunResumeAck>;
  interveneRuntimeJob: (
    input: KernelJobInterventionRequestV3
  ) => Promise<RuntimeRunInterventionAck>;
  subscribeRuntimeJob: (input: KernelJobSubscribeRequestV3) => Promise<KernelJob | null>;
  listRuntimeJobs: (input: KernelJobsListRequest) => Promise<KernelJob[]>;
  submitRuntimeJobApprovalDecision: (
    input: RuntimeRunCheckpointApprovalRequest
  ) => Promise<RuntimeRunCheckpointApprovalAck>;
};

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

export type WorkspaceClientHostShellBindings = {
  platformHint?: string | null;
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
