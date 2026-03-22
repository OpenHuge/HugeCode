import type { ThemeMode } from "@ku0/design-system";
import type {
  GitPreparePullRequestThreadInput,
  GitPreparePullRequestThreadResult,
  GitResolvePullRequestInput,
  GitResolvePullRequestResult,
  GitResolvedPullRequest,
  GitWorkflowBranch,
  GitWorkflowStatusResult,
} from "@ku0/code-runtime-host-contract";
import type { DistributedTaskGraphSnapshot } from "./features/plan/types/distributedGraph";

export type WorkspaceSettings = {
  sidebarCollapsed: boolean;
  sortOrder?: number | null;
  groupId?: string | null;
  gitRoot?: string | null;
  codexHome?: string | null;
  codexArgs?: string | null;
  launchScript?: string | null;
  launchScripts?: LaunchScriptEntry[] | null;
  worktreeSetupScript?: string | null;
};

export type LaunchScriptIconId =
  | "play"
  | "build"
  | "debug"
  | "wrench"
  | "terminal"
  | "code"
  | "server"
  | "database"
  | "package"
  | "test"
  | "lint"
  | "dev"
  | "git"
  | "config"
  | "logs";

export type LaunchScriptEntry = {
  id: string;
  script: string;
  icon: LaunchScriptIconId;
  label?: string | null;
};

export type WorkspaceGroup = {
  id: string;
  name: string;
  sortOrder?: number | null;
  copiesFolder?: string | null;
};

export type WorkspaceKind = "main" | "worktree";

export type WorktreeInfo = {
  branch: string;
};

export type WorkspaceInfo = {
  id: string;
  name: string;
  path: string;
  connected: boolean;
  codex_bin?: string | null;
  kind?: WorkspaceKind;
  parentId?: string | null;
  worktree?: WorktreeInfo | null;
  settings: WorkspaceSettings;
};

export type AppServerEvent = {
  workspace_id: string;
  message: Record<string, unknown>;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export type ConversationItem =
  | {
      id: string;
      kind: "message";
      role: "user" | "assistant";
      text: string;
      images?: string[];
    }
  | { id: string; kind: "reasoning"; summary: string; content: string }
  | { id: string; kind: "diff"; title: string; diff: string; status?: string }
  | { id: string; kind: "review"; state: "started" | "completed"; text: string }
  | {
      id: string;
      kind: "explore";
      status: "exploring" | "explored";
      entries: { kind: "read" | "search" | "list" | "run"; label: string; detail?: string }[];
    }
  | {
      id: string;
      kind: "tool";
      toolType: string;
      title: string;
      detail: string;
      status?: string;
      output?: string;
      durationMs?: number | null;
      checkpointId?: string | null;
      traceId?: string | null;
      errorClass?: string | null;
      recovered?: boolean | null;
      batchId?: string | null;
      attempt?: number | null;
      changes?: { path: string; kind?: string; diff?: string }[];
    };

export type ThreadSummary = {
  id: string;
  name: string;
  updatedAt: number;
  status?: string | null;
  archived?: boolean;
  lastActivityAt?: number | null;
  agentRole?: string | null;
};

export type ThreadListSortKey = "created_at" | "updated_at";

export type ReviewTarget =
  | { type: "uncommittedChanges" }
  | { type: "baseBranch"; branch: string }
  | { type: "commit"; sha: string; title?: string }
  | { type: "custom"; instructions: string };

export type AccessMode = "read-only" | "on-request" | "full-access";
export type ComposerExecutionMode = "runtime" | "local-cli" | "hybrid";
export type BackendMode = "local" | "remote";
export type RemoteBackendProvider = "tcp" | "orbit";
export type RemoteTcpOverlay = "tailscale" | "netbird";
export type ThemePreference = ThemeMode;
export type PersonalityPreference = "friendly" | "pragmatic";

export type ComposerEditorPreset = "default" | "helpful" | "smart";

export type ComposerEditorSettings = {
  preset: ComposerEditorPreset;
  expandFenceOnSpace: boolean;
  expandFenceOnEnter: boolean;
  fenceLanguageTags: boolean;
  fenceWrapSelection: boolean;
  autoWrapPasteMultiline: boolean;
  autoWrapPasteCodeLike: boolean;
  continueListOnShiftEnter: boolean;
};

export type OpenAppTarget = {
  id: string;
  label: string;
  kind: "app" | "command" | "finder";
  appName?: string | null;
  command?: string | null;
  args: string[];
};

export type WorkspaceAgentControlPersistedState = {
  readOnlyMode?: boolean | null;
  requireUserApproval?: boolean | null;
  webMcpAutoExecuteCalls?: boolean | null;
};

export type RemoteBackendProfile = {
  id: string;
  label: string;
  provider: RemoteBackendProvider;
  tcpOverlay?: RemoteTcpOverlay | null;
  host?: string | null;
  token?: string | null;
  gatewayConfig?: RemoteBackendGatewayConfig | null;
  orbitWsUrl?: string | null;
  orbitAuthUrl?: string | null;
  orbitRunnerName?: string | null;
  orbitUseAccess?: boolean;
  orbitAccessClientId?: string | null;
  orbitAccessClientSecretRef?: string | null;
};

export type RemoteBackendGatewayAuthMode = "none" | "token";

export type RemoteBackendGatewayConfig = {
  httpBaseUrl?: string | null;
  wsBaseUrl?: string | null;
  authMode?: RemoteBackendGatewayAuthMode | null;
  tokenRef?: string | null;
  healthcheckPath?: string | null;
  enabled?: boolean;
};

export type AppSettings = {
  codexBin: string | null;
  codexArgs: string | null;
  backendMode: BackendMode;
  remoteBackendProfiles?: RemoteBackendProfile[];
  defaultRemoteBackendProfileId?: string | null;
  defaultRemoteExecutionBackendId?: string | null;
  orbitAutoStartRunner: boolean;
  keepDaemonRunningAfterAppClose: boolean;
  defaultAccessMode: AccessMode;
  reviewDeliveryMode: "inline" | "detached";
  composerModelShortcut: string | null;
  composerAccessShortcut: string | null;
  composerReasoningShortcut: string | null;
  composerCollaborationShortcut: string | null;
  interruptShortcut: string | null;
  newAgentShortcut: string | null;
  newWorktreeAgentShortcut: string | null;
  newCloneAgentShortcut: string | null;
  archiveThreadShortcut: string | null;
  toggleProjectsSidebarShortcut: string | null;
  toggleGitSidebarShortcut: string | null;
  branchSwitcherShortcut: string | null;
  toggleDebugPanelShortcut: string | null;
  toggleTerminalShortcut: string | null;
  cycleAgentNextShortcut: string | null;
  cycleAgentPrevShortcut: string | null;
  cycleWorkspaceNextShortcut: string | null;
  cycleWorkspacePrevShortcut: string | null;
  lastComposerModelId: string | null;
  lastComposerReasoningEffort: string | null;
  lastComposerFastMode?: boolean | null;
  lastComposerExecutionMode?: ComposerExecutionMode | null;
  uiScale: number;
  theme: ThemePreference;
  usageShowRemaining: boolean;
  showMessageFilePath: boolean;
  showInternalRuntimeDiagnostics: boolean;
  threadTitleAutogenerationEnabled: boolean;
  uiFontFamily: string;
  codeFontFamily: string;
  codeFontSize: number;
  notificationSoundsEnabled: boolean;
  systemNotificationsEnabled: boolean;
  splitChatDiffView: boolean;
  preloadGitDiffs: boolean;
  gitDiffIgnoreWhitespaceChanges: boolean;
  commitMessagePrompt: string;
  experimentalCollabEnabled: boolean;
  collaborationModesEnabled: boolean;
  steerEnabled: boolean;
  unifiedExecEnabled: boolean;
  personality: PersonalityPreference;
  composerEditorPreset: ComposerEditorPreset;
  composerFenceExpandOnSpace: boolean;
  composerFenceExpandOnEnter: boolean;
  composerFenceLanguageTags: boolean;
  composerFenceWrapSelection: boolean;
  composerFenceAutoWrapPasteMultiline: boolean;
  composerFenceAutoWrapPasteCodeLike: boolean;
  composerListContinuation: boolean;
  composerCodeBlockCopyUseModifier: boolean;
  workspaceGroups: WorkspaceGroup[];
  workspaceAgentControlByWorkspaceId?: Record<string, WorkspaceAgentControlPersistedState>;
  openAppTargets: OpenAppTarget[];
  selectedOpenAppId: string;
  lastActiveWorkspaceId?: string | null;
};

export type OrbitConnectTestResult = {
  ok: boolean;
  latencyMs: number | null;
  message: string;
  details?: string | null;
};

export type OrbitDeviceCodeStart = {
  deviceCode: string;
  userCode: string | null;
  verificationUri: string;
  verificationUriComplete: string | null;
  intervalSeconds: number;
  expiresInSeconds: number;
};

export type OrbitSignInStatus = "pending" | "authorized" | "denied" | "expired" | "error";

export type OrbitSignInPollResult = {
  status: OrbitSignInStatus;
  token: string | null;
  message: string | null;
  intervalSeconds: number | null;
};

export type OrbitSignOutResult = {
  success: boolean;
  message: string | null;
};

export type OrbitRunnerState = "stopped" | "running" | "error";

export type OrbitRunnerStatus = {
  state: OrbitRunnerState;
  pid: number | null;
  startedAtMs: number | null;
  lastError: string | null;
  orbitUrl: string | null;
};

export type TcpDaemonState = "stopped" | "running" | "error";

export type TcpDaemonStatus = {
  state: TcpDaemonState;
  pid: number | null;
  startedAtMs: number | null;
  lastError: string | null;
  listenAddr: string | null;
};

export type TailscaleStatus = {
  installed: boolean;
  running: boolean;
  version: string | null;
  dnsName: string | null;
  hostName: string | null;
  tailnetName: string | null;
  ipv4: string[];
  ipv6: string[];
  suggestedRemoteHost: string | null;
  message: string;
};

export type TailscaleDaemonCommandPreview = {
  command: string;
  daemonPath: string;
  args: string[];
  tokenConfigured: boolean;
};

export type NetbirdStatus = {
  installed: boolean;
  running: boolean;
  version: string | null;
  dnsName: string | null;
  hostName: string | null;
  managementUrl: string | null;
  ipv4: string[];
  suggestedRemoteHost: string | null;
  message: string;
};

export type NetbirdDaemonCommandPreview = {
  command: string;
  cliPath: string;
  args: string[];
  tokenConfigured: boolean;
};

export type BackendPoolBootstrapTemplate = {
  backendClass: "primary" | "burst" | "specialized";
  title: string;
  command: string;
  args: string[];
  backendIdExample: string;
  registrationExample: Record<string, unknown>;
  notes: string[];
};

export type BackendPoolBootstrapPreview = {
  generatedAtMs: number;
  runtimeServiceBin: string;
  remoteHost: string;
  remoteTokenConfigured: boolean;
  workspacePath: string | null;
  templates: BackendPoolBootstrapTemplate[];
};

export type BackendPoolDiagnosticSeverity = "warning" | "error";

export type BackendPoolDiagnosticReason = {
  code: string;
  severity: BackendPoolDiagnosticSeverity;
  summary: string;
  detail?: string | null;
  retryable: boolean;
};

export type BackendPoolBackendDiagnosticEntry = {
  backendId: string;
  displayName: string;
  backendClass?: "primary" | "burst" | "specialized" | null;
  backendKind?: string | null;
  status: string;
  rolloutState?: string | null;
  origin?: string | null;
  healthy: boolean;
  availability?: string | null;
  summary: string;
  reasons: BackendPoolDiagnosticReason[];
  connectivityReachability?: string | null;
  connectivityEndpoint?: string | null;
  connectivityReason?: string | null;
  leaseStatus?: string | null;
  lastHeartbeatAt?: number | null;
  heartbeatAgeMs?: number | null;
  operatorActions: string[];
};

export type BackendPoolDiagnostics = {
  generatedAtMs: number;
  runtimeServiceBin: string;
  workspacePath: string | null;
  remoteHost: string;
  remoteTokenConfigured: boolean;
  defaultExecutionBackendId: string | null;
  tcpOverlay: RemoteTcpOverlay | null;
  registrySource: string;
  reasons: BackendPoolDiagnosticReason[];
  backends: BackendPoolBackendDiagnosticEntry[];
  operatorActions: string[];
  tailscale: TailscaleStatus;
  netbird: NetbirdStatus;
  tcpDaemon: TcpDaemonStatus;
  warnings: string[];
};

export type BackendPoolJoinEnvVar = {
  name: string;
  required: boolean;
  valueHint?: string | null;
  description: string;
};

export type BackendPoolOnboardingCheckStatus = "ok" | "warning" | "failed";

export type BackendPoolOnboardingCheck = {
  code: string;
  status: BackendPoolOnboardingCheckStatus;
  summary: string;
  detail?: string | null;
  retryable: boolean;
};

export type BackendPoolNormalizedProfilePatch = {
  provider: RemoteBackendProvider;
  host?: string | null;
  token?: string | null;
  orbitWsUrl?: string | null;
  tcpOverlay?: RemoteTcpOverlay | null;
};

export type BackendPoolPreparedApplyContract = {
  backendClass: "primary" | "burst" | "specialized";
  joinCommand: string;
  joinArgs: string[];
  envContract: BackendPoolJoinEnvVar[];
  registrationPayload: Record<string, unknown>;
  retryAction: string;
  regenerateAction: string;
  revokeAction: string;
  operatorActions: string[];
};

export type BackendPoolOnboardingState = "validated" | "retryable_failure" | "blocked";

export type BackendPoolOnboardingPreflightInput = {
  provider?: RemoteBackendProvider | null;
  remoteHost?: string | null;
  remoteToken?: string | null;
  orbitWsUrl?: string | null;
  backendClass?: "primary" | "burst" | "specialized" | null;
  overlay?: RemoteTcpOverlay | null;
};

export type BackendPoolOnboardingPreflight = {
  generatedAtMs: number;
  ok: boolean;
  safeToPersist: boolean;
  state: BackendPoolOnboardingState;
  checks: BackendPoolOnboardingCheck[];
  warnings: BackendPoolDiagnosticReason[];
  errors: BackendPoolDiagnosticReason[];
  profilePatch?: BackendPoolNormalizedProfilePatch | null;
  applyContract?: BackendPoolPreparedApplyContract | null;
  operatorActions: string[];
};

export type CodexDoctorResult = {
  ok: boolean;
  codexBin: string | null;
  version: string | null;
  appServerOk: boolean;
  details: string | null;
  path: string | null;
  nodeOk: boolean;
  nodeVersion: string | null;
  nodeDetails: string | null;
};

export type CodexUpdateMethod = "brew_formula" | "brew_cask" | "npm" | "unknown";

export type CodexUpdateResult = {
  ok: boolean;
  method: CodexUpdateMethod;
  package: string | null;
  beforeVersion: string | null;
  afterVersion: string | null;
  upgraded: boolean;
  output: string | null;
  details: string | null;
};

export type ApprovalRequest = {
  workspace_id: string;
  request_id: number | string;
  method: string;
  params: Record<string, unknown>;
};

export type RequestUserInputOption = {
  label: string;
  description: string;
};

export type RequestUserInputQuestion = {
  id: string;
  header: string;
  question: string;
  isOther?: boolean;
  isSecret?: boolean;
  options?: RequestUserInputOption[];
};

export type RequestUserInputParams = {
  thread_id: string;
  turn_id: string;
  item_id: string;
  questions: RequestUserInputQuestion[];
};

export type RequestUserInputRequest = {
  workspace_id: string;
  request_id: number | string;
  params: RequestUserInputParams;
};

export type DynamicToolCallOutputContentItem =
  | {
      type: "inputText";
      text: string;
    }
  | {
      type: "inputImage";
      imageUrl: string;
    };

export type DynamicToolCallResponse = {
  contentItems: DynamicToolCallOutputContentItem[];
  success: boolean;
};

export type DynamicToolCallRequestParams = {
  thread_id: string;
  turn_id: string;
  call_id: string;
  tool: string;
  arguments: unknown;
};

export type DynamicToolCallRequest = {
  workspace_id: string;
  request_id: number | string;
  params: DynamicToolCallRequestParams;
};

export type RequestUserInputAnswer = {
  answers: string[];
};

export type RequestUserInputResponse = {
  answers: Record<string, RequestUserInputAnswer>;
};

export type GitFileStatus = {
  path: string;
  status: string;
  additions: number;
  deletions: number;
};

export type GitDiffScope = "staged" | "unstaged";

export type GitFileDiff = {
  path: string;
  diff: string;
  scope?: GitDiffScope;
  oldLines?: string[];
  newLines?: string[];
  isBinary?: boolean;
  isImage?: boolean;
  oldImageData?: string | null;
  newImageData?: string | null;
  oldImageMime?: string | null;
  newImageMime?: string | null;
};

export type GitCommitDiff = {
  path: string;
  status: string;
  diff: string;
  oldLines?: string[];
  newLines?: string[];
  isBinary?: boolean;
  isImage?: boolean;
  oldImageData?: string | null;
  newImageData?: string | null;
  oldImageMime?: string | null;
  newImageMime?: string | null;
};

export type { GitLogEntry, GitLogResponse } from "@ku0/code-runtime-host-contract";

export type GitHubIssue = {
  number: number;
  title: string;
  url: string;
  updatedAt: string;
  body?: string | null;
  author?: GitHubUser | null;
  labels?: string[] | null;
};

export type GitHubIssuesResponse = {
  total: number;
  issues: GitHubIssue[];
};

export type GitHubUser = {
  login: string;
};

export type GitHubPullRequest = {
  number: number;
  title: string;
  url: string;
  updatedAt: string;
  createdAt: string;
  body: string;
  headRefName: string;
  baseRefName: string;
  isDraft: boolean;
  author: GitHubUser | null;
};

export type GitHubPullRequestsResponse = {
  total: number;
  pullRequests: GitHubPullRequest[];
};

export type GitHubPullRequestDiff = {
  path: string;
  status: string;
  diff: string;
};

export type GitHubPullRequestComment = {
  id: number;
  body: string;
  createdAt: string;
  url: string;
  author: GitHubUser | null;
};

export type {
  GitPreparePullRequestThreadInput,
  GitPreparePullRequestThreadResult,
  GitResolvePullRequestInput,
  GitResolvePullRequestResult,
  GitResolvedPullRequest,
  GitWorkflowBranch,
  GitWorkflowStatusResult,
};

export type TokenUsageBreakdown = {
  totalTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
};

export type ThreadTokenUsage = {
  total: TokenUsageBreakdown;
  last: TokenUsageBreakdown;
  modelContextWindow: number | null;
};

export type LocalUsageDay = {
  day: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  agentTimeMs: number;
  agentRuns: number;
};

export type LocalUsageTotals = {
  last7DaysTokens: number;
  last30DaysTokens: number;
  averageDailyTokens: number;
  cacheHitRatePercent: number;
  peakDay: string | null;
  peakDayTokens: number;
};

export type LocalUsageModel = {
  model: string;
  tokens: number;
  sharePercent: number;
};

export type LocalUsageSnapshot = {
  updatedAt: number;
  days: LocalUsageDay[];
  totals: LocalUsageTotals;
  topModels: LocalUsageModel[];
};

export type TurnPlanStepStatus =
  | "pending"
  | "inProgress"
  | "completed"
  | "blocked"
  | "failed"
  | "cancelled";

export type TurnPlanStep = {
  step: string;
  status: TurnPlanStepStatus;
};

export type TurnPlan = {
  turnId: string;
  explanation: string | null;
  steps: TurnPlanStep[];
  distributedGraph?: DistributedTaskGraphSnapshot | null;
};

export type RateLimitWindow = {
  usedPercent: number;
  windowDurationMins: number | null;
  resetsAt: number | null;
};

export type CreditsSnapshot = {
  hasCredits: boolean;
  unlimited: boolean;
  balance: string | null;
};

export type RateLimitSnapshot = {
  primary: RateLimitWindow | null;
  secondary: RateLimitWindow | null;
  credits: CreditsSnapshot | null;
  planType: string | null;
  limitId?: string | null;
  limitName?: string | null;
};

export type AccountSnapshot = {
  type: "chatgpt" | "apikey" | "unknown";
  email: string | null;
  planType: string | null;
  requiresOpenaiAuth: boolean | null;
  provider?: string | null;
  accountId?: string | null;
  externalAccountId?: string | null;
  displayName?: string | null;
  authMode?: string | null;
  localCliManaged?: boolean | null;
};

export type QueuedMessage = {
  id: string;
  text: string;
  createdAt: number;
  images?: string[];
  appMentions?: AppMention[];
};

export type AppMention = {
  name: string;
  path: string;
};

export type ModelOption = {
  id: string;
  model: string;
  displayName: string;
  description: string;
  provider?: string | null;
  pool?: string | null;
  source?: string | null;
  available?: boolean;
  supportedReasoningEfforts: { reasoningEffort: string; description: string }[];
  defaultReasoningEffort: string | null;
  isDefault: boolean;
};

export type CollaborationModeOption = {
  id: string;
  label: string;
  mode: string;
  model: string;
  reasoningEffort: string | null;
  developerInstructions: string | null;
  value: Record<string, unknown>;
};

export type SkillOption = {
  name: string;
  path: string;
  description?: string;
  scope?: "workspace" | "global";
  sourceFamily?: string;
  enabled?: boolean;
  aliases?: string[];
  shadowedBy?: string | null;
};

export type CustomPromptOption = {
  name: string;
  path: string;
  description?: string;
  argumentHint?: string;
  content: string;
  scope?: "workspace" | "global";
};

export type BranchInfo = GitWorkflowBranch & {
  lastCommit: number;
};

export type DebugEntry = {
  id: string;
  timestamp: number;
  source: "client" | "server" | "event" | "stderr" | "error";
  label: string;
  payload?: unknown;
};

export type TerminalStatus = "idle" | "connecting" | "ready" | "error";
