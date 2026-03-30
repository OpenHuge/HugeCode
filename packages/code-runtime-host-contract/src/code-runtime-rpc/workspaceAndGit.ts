import type {
  HealthResponse,
  ModelPoolEntry,
  RemoteStatus,
  SettingsSummary,
  WorkspaceSummary,
  TerminalStatus,
} from "./foundation.js";
import type { CodeRuntimeRpcError, CodeRuntimeRpcMethod } from "./rpcCore.js";

export type ThreadCreateRequest = {
  workspaceId: string;
  title: string | null;
};

export type RuntimeBootstrapSnapshot = {
  health: HealthResponse | null;
  settings: SettingsSummary | null;
  remote: RemoteStatus | null;
  terminal: TerminalStatus | null;
  models: ModelPoolEntry[];
  workspaces: WorkspaceSummary[];
};

export type RuntimeRpcBatchItemRequest = {
  method: CodeRuntimeRpcMethod;
  params?: Record<string, unknown> | null;
};

export type RuntimeRpcBatchRequest = {
  requests: RuntimeRpcBatchItemRequest[];
};

export type RuntimeRpcBatchItemResponse =
  | {
      method: CodeRuntimeRpcMethod;
      ok: true;
      result: unknown;
      error?: never;
    }
  | {
      method: CodeRuntimeRpcMethod;
      ok: false;
      error: CodeRuntimeRpcError;
      result?: never;
    };

export type RuntimeRpcBatchResponse = {
  responses: RuntimeRpcBatchItemResponse[];
};

export type WorkspaceFileSummary = {
  id: string;
  path: string;
  summary: string;
};

export type WorkspaceFileContent = {
  id: string;
  path: string;
  summary: string;
  content: string;
};

export type RuntimeTextFileScope = "workspace" | "global";

export type RuntimeTextFileKind = "agents" | "config";

export type RuntimeTextFileResponse = {
  exists: boolean;
  content: string;
  truncated: boolean;
};

export type WorkspaceDiagnosticSeverity = "error" | "warning" | "info" | "hint";

export type WorkspaceDiagnosticsProviderId = "native" | "cargo-check" | "oxlint" | "tsc";

export type WorkspaceDiagnosticsProviderStatusKind = "used" | "skipped" | "failed" | "unavailable";

export type WorkspaceDiagnosticsListRequest = {
  workspaceId: string;
  paths?: string[] | null;
  severities?: WorkspaceDiagnosticSeverity[] | null;
  maxItems?: number | null;
  includeProviderDetails?: boolean;
};

export type WorkspaceDiagnosticsProviderStatus = {
  id: WorkspaceDiagnosticsProviderId;
  status: WorkspaceDiagnosticsProviderStatusKind;
  durationMs?: number | null;
  message?: string | null;
};

export type WorkspaceDiagnostic = {
  path: string;
  severity: WorkspaceDiagnosticSeverity;
  message: string;
  source: string;
  code?: string | null;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export type WorkspaceDiagnosticsSummary = {
  errorCount: number;
  warningCount: number;
  infoCount: number;
  hintCount: number;
  total: number;
};

export type WorkspaceDiagnosticsListResponse = {
  workspaceId: string;
  available: boolean;
  summary: WorkspaceDiagnosticsSummary;
  items: WorkspaceDiagnostic[];
  providers: WorkspaceDiagnosticsProviderStatus[];
  generatedAtMs: number;
  reason?: string | null;
};

export type WorkspacePatchApplyRequest = {
  workspaceId: string;
  diff: string;
  dryRun?: boolean | null;
};

export type WorkspacePatchApplyResponse = {
  workspaceId: string;
  ok: boolean;
  applied: boolean;
  dryRun: boolean;
  files: string[];
  stdout: string;
  stderr: string;
  error: string | null;
};

export type GitChangeSummary = {
  id: string;
  path: string;
  status: string;
  summary: string;
};

export type GitChangesSnapshot = {
  staged: GitChangeSummary[];
  unstaged: GitChangeSummary[];
};

export type GitDiffContent = {
  id: string;
  diff: string;
  hasMore?: boolean;
  nextOffset?: number | null;
};

export type GitBranchSummary = {
  name: string;
  lastUsedAt: number;
};

export type GitBranchesSnapshot = {
  currentBranch: string | null;
  branches: GitBranchSummary[];
};

export type GitWorkflowStatusResult = {
  branch: string | null;
  hasWorkingTreeChanges: boolean;
  hasUpstream: boolean;
  aheadCount: number;
  behindCount: number;
  activeWorktreePath: string | null;
};

export type GitWorkflowBranch = {
  name: string;
  current: boolean;
  isDefault: boolean;
  isRemote: boolean;
  remoteName: string | null;
  worktreePath: string | null;
};

export type GitResolvedPullRequest = {
  number: number;
  title: string;
  url: string;
  baseBranch: string;
  headBranch: string;
};

export type GitResolvePullRequestInput = {
  workspaceId: string;
  reference: string;
};

export type GitResolvePullRequestResult = {
  pullRequest: GitResolvedPullRequest;
};

export type GitPreparePullRequestThreadInput = {
  workspaceId: string;
  reference: string;
  mode: "local" | "worktree";
};

export type GitPreparePullRequestThreadResult = {
  branch: string;
  worktreePath: string | null;
};

export type GitLogEntry = {
  sha: string;
  summary: string;
  author: string;
  timestamp: number;
};

export type GitLogResponse = {
  total: number;
  entries: GitLogEntry[];
  ahead: number;
  behind: number;
  aheadEntries: GitLogEntry[];
  behindEntries: GitLogEntry[];
  upstream: string | null;
};

export type GitOperationResult = {
  ok: boolean;
  error: string | null;
};

export type GitCommitResult = {
  committed: boolean;
  committedCount: number;
  error: string | null;
};
