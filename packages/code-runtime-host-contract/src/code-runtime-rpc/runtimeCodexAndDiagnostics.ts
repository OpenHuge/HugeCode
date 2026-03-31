import type { RuntimeArtifact } from "./runtimeLiveSkillsAndTooling.js";

export type RuntimeCodexExecRunRequest = {
  workspaceId?: string | null;
  prompt: string;
  codexBin?: string | null;
  codexArgs?: string[] | null;
  outputSchema?: Record<string, unknown> | null;
  approvalPolicy?: string | null;
  sandboxMode?: string | null;
};

export type RuntimeCodexExecEventEnvelope = {
  index: number;
  type: string;
  payload: Record<string, unknown>;
  emittedAt?: number | null;
};

export type RuntimeCodexExecRunResponse = {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  events: RuntimeCodexExecEventEnvelope[];
  finalMessage: string | null;
  finalJson: Record<string, unknown> | null;
  warnings: string[];
};

export type RuntimeCodexCloudTasksListRequest = {
  workspaceId?: string | null;
  cursor?: string | null;
  limit?: number | null;
  forceRefetch?: boolean;
};

export type RuntimeCodexCloudTaskSummary = {
  id: string;
  url: string | null;
  title: string | null;
  status: string;
  updatedAt: string | null;
  environmentId: string | null;
  environmentLabel: string | null;
  summary: string | null;
  isReview: boolean;
  attemptTotal: number | null;
};

export type RuntimeCodexCloudTasksListResponse = {
  tasks: RuntimeCodexCloudTaskSummary[];
  cursor: string | null;
  warnings: string[];
};

export type RuntimeCodexConfigPathResponse = {
  path: string | null;
  exists: boolean;
};

export type RuntimeCodexDoctorRequest = {
  codexBin?: string | null;
  codexArgs?: string[] | null;
};

export type RuntimeCodexDoctorResponse = {
  ok: boolean;
  codexBin: string | null;
  version: string | null;
  appServerOk: boolean;
  details: string | null;
  path: string | null;
  nodeOk: boolean;
  nodeVersion: string | null;
  nodeDetails: string | null;
  warnings?: string[];
};

export type RuntimeCodexUpdateRequest = {
  codexBin?: string | null;
  codexArgs?: string[] | null;
};

export type RuntimeCodexUpdateMethod = "brew_formula" | "brew_cask" | "npm" | "unknown";

export type RuntimeCodexUpdateResponse = {
  ok: boolean;
  method: RuntimeCodexUpdateMethod;
  package: string | null;
  beforeVersion: string | null;
  afterVersion: string | null;
  upgraded: boolean;
  output: string | null;
  details: string | null;
  warnings?: string[];
};

export type RuntimeCollaborationModeMask = {
  id: string;
  label: string;
  mode: string;
  model: string;
  reasoningEffort: string | null;
  developerInstructions: string | null;
  value: Record<string, unknown>;
};

export type RuntimeCollaborationModesListResponse = {
  data: RuntimeCollaborationModeMask[];
  warnings: string[];
};

export type RuntimeMcpServerStatusListRequest = {
  workspaceId: string;
  cursor?: string | null;
  limit?: number | null;
};

export type RuntimeMcpServerStatusSummary = {
  id?: string | null;
  name: string;
  status?: string | null;
  authStatus?: string | Record<string, unknown> | null;
  tools?: Record<string, unknown> | null;
  resources?: unknown[];
  resourceTemplates?: unknown[];
  warnings?: string[];
};

export type RuntimeMcpServerStatusListResponse = {
  data: RuntimeMcpServerStatusSummary[];
  nextCursor: string | null;
  warnings: string[];
};

export type RuntimeBrowserDebugMode =
  | "mcp-playwright"
  | "mcp-chrome-devtools"
  | "observe-only"
  | "unavailable"
  | (string & {});

export type RuntimeBrowserDebugAvailabilityStatus =
  | "ready"
  | "degraded"
  | "blocked"
  | "unavailable"
  | (string & {});

export type RuntimeBrowserDebugToolSummary = {
  name: string;
  description?: string | null;
  readOnly?: boolean | null;
  inputSchema?: Record<string, unknown> | null;
};

export type RuntimeBrowserDebugStatusRequest = {
  workspaceId: string;
};

export type RuntimeBrowserDebugStatusResponse = {
  workspaceId: string;
  available: boolean;
  mode: RuntimeBrowserDebugMode;
  status: RuntimeBrowserDebugAvailabilityStatus;
  packageRoot?: string | null;
  serverName?: string | null;
  tools: RuntimeBrowserDebugToolSummary[];
  warnings: string[];
};

export type RuntimeBrowserDebugToolCall = {
  toolName: string;
  arguments?: Record<string, unknown> | null;
};

export type RuntimeBrowserDebugDecisionLabOption = {
  id: string;
  label: string;
  summary?: string | null;
};

export type RuntimeBrowserDebugDecisionLabRequest = {
  question: string;
  options: RuntimeBrowserDebugDecisionLabOption[];
  constraints?: string[] | null;
  allowLiveWebResearch?: boolean | null;
  chatgptUrl?: string | null;
};

export type RuntimeBrowserDebugDecisionLabResult = {
  recommendedOptionId?: string | null;
  recommendedOption?: string | null;
  alternativeOptionIds?: string[] | null;
  decisionMemo?: string | null;
  confidence?: "low" | "medium" | "high" | null;
  assumptions?: string[] | null;
  followUpQuestions?: string[] | null;
};

export type RuntimeBrowserDebugOperation = "inspect" | "automation" | "chatgpt_decision_lab";

export type RuntimeBrowserDebugRunRequest = {
  workspaceId: string;
  operation: RuntimeBrowserDebugOperation;
  prompt?: string | null;
  includeScreenshot?: boolean | null;
  timeoutMs?: number | null;
  steps?: RuntimeBrowserDebugToolCall[] | null;
  decisionLab?: RuntimeBrowserDebugDecisionLabRequest | null;
};

export type RuntimeBrowserDebugArtifact = RuntimeArtifact;

export type RuntimeBrowserDebugToolCallResult = {
  toolName: string;
  ok: boolean;
  contentText?: string | null;
  structuredContent?: Record<string, unknown> | null;
  artifacts?: RuntimeBrowserDebugArtifact[] | null;
  error?: string | null;
};

export type RuntimeBrowserDebugRunResponse = {
  workspaceId: string;
  available: boolean;
  status: "completed" | "failed" | "blocked";
  mode: RuntimeBrowserDebugMode;
  operation: RuntimeBrowserDebugOperation;
  message: string;
  toolCalls: RuntimeBrowserDebugToolCallResult[];
  contentText?: string | null;
  structuredContent?: Record<string, unknown> | null;
  artifacts: RuntimeBrowserDebugArtifact[];
  warnings: string[];
  decisionLab?: RuntimeBrowserDebugDecisionLabResult | null;
};

export type RuntimeSecurityPreflightRequest = {
  workspaceId?: string | null;
  toolName?: string | null;
  command?: string | null;
  input?: Record<string, unknown> | null;
  checkPackageAdvisory?: boolean;
  checkExecPolicy?: boolean;
  execPolicyRules?: string[] | null;
};

export type RuntimeSecurityPreflightDecision = {
  action: "allow" | "review" | "block";
  reason: string;
  advisories: Array<{
    packageManager: string;
    packageName: string;
    indicator: string;
    severity: string;
  }>;
  execPolicyDecision?: "allow" | "prompt" | "forbidden" | null;
  execPolicyMatchedRules?: Array<{
    matchedPrefix: string[];
    decision: string;
    justification?: string | null;
  }>;
};

export type RuntimeDiagnosticsRedactionLevel = "strict" | "balanced" | "minimal";

export type RuntimeDiagnosticsExportRequest = {
  workspaceId?: string | null;
  redactionLevel?: RuntimeDiagnosticsRedactionLevel;
  includeTaskSummaries?: boolean;
  includeEventTail?: boolean;
  includeZipBase64?: boolean;
};

export type RuntimeDiagnosticsExportResponse = {
  schemaVersion: "runtime-diagnostics-export/v1";
  exportedAt: number;
  source: "runtime-service" | "desktop-host";
  redactionLevel: RuntimeDiagnosticsRedactionLevel;
  filename: string;
  mimeType: "application/zip";
  sizeBytes: number;
  zipBase64: string | null;
  sections: string[];
  warnings: string[];
  redactionStats: {
    redactedKeys: number;
    redactedValues: number;
    hashedPaths: number;
    hashedEmails: number;
    hashedSecrets: number;
  };
};
