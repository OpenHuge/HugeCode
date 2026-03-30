export type ReasonEffort = "low" | "medium" | "high" | "xhigh";

export type AccessMode = "read-only" | "on-request" | "full-access";

export type RuntimeMode = "local" | "remote";

export type ModelProvider =
  | "openai"
  | "anthropic"
  | "claude_code_local"
  | "google"
  | "antigravity"
  | "anti-gravity"
  | "local"
  | "unknown"
  | (string & {});

export type ModelSource =
  | "local-codex"
  | "oauth-account"
  | "workspace-default"
  | "fallback"
  | "acp-backend";

export type ModelPool =
  | "codex"
  | "antigravity"
  | "anti-gravity"
  | "claude"
  | "gemini"
  | "auto"
  | (string & {});

export type ModelCapability = "chat" | "coding" | "reasoning" | "vision";

export type RuntimeCapabilitySupport = "supported" | "unsupported" | "unknown";

export type RuntimeCapabilityMatrix = {
  supportsTools: RuntimeCapabilitySupport;
  supportsReasoningEffort: RuntimeCapabilitySupport;
  supportsVision: RuntimeCapabilitySupport;
  supportsJsonSchema: RuntimeCapabilitySupport;
  maxContextTokens: number | null;
  supportedReasoningEfforts: ReasonEffort[];
};

export type RuntimeModelCapabilityMatrix = RuntimeCapabilityMatrix;

export type RuntimeProviderCapabilityMatrix = RuntimeCapabilityMatrix;

export type WorkspaceSummary = {
  id: string;
  path: string;
  displayName: string;
  connected: boolean;
  defaultModelId: string | null;
};

export type ThreadSummary = {
  id: string;
  workspaceId: string;
  title: string;
  unread: boolean;
  running: boolean;
  createdAt: number;
  updatedAt: number;
  provider: ModelProvider;
  modelId: string | null;
  status?: string | null;
  archived?: boolean;
  lastActivityAt?: number | null;
  agentRole?: string | null;
  agentNickname?: string | null;
};

export type ModelPoolEntry = {
  id: string;
  displayName: string;
  provider: ModelProvider;
  pool: ModelPool;
  source: ModelSource;
  available: boolean;
  supportsReasoning: boolean;
  supportsVision: boolean;
  reasoningEfforts: ReasonEffort[];
  capabilities: ModelCapability[];
  capabilityMatrix?: RuntimeModelCapabilityMatrix | null;
};

export type RemoteStatus = {
  connected: boolean;
  mode: RuntimeMode;
  endpoint: string | null;
  latencyMs: number | null;
};

export type TerminalStatus = {
  state: "ready" | "uninitialized" | "unsupported";
  message: string;
};

export type TerminalSessionSummary = {
  id: string;
  workspaceId: string;
  state: "created" | "exited" | "ioFailed" | "unsupported";
  createdAt: number;
  updatedAt: number;
  lines: string[];
};

export type TerminalOutputEventPayload = {
  sessionId: string;
  workspaceId: string;
  state: TerminalSessionSummary["state"];
  cursor: number;
  chunk: string;
  lines?: string[];
  updatedAt: number;
};

export type SettingsSummary = {
  defaultModelStrategy: "unified-auto-routing";
  remoteEnabled: boolean;
  defaultReasonEffort: ReasonEffort;
  defaultAccessMode: AccessMode;
  maxActiveTurnLanes?: number;
  activeTurnLanes?: number;
};

export type HealthResponse = {
  app: string;
  version: string;
  status: "ok";
};

export type TurnSendAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
};

export type TurnExecutionMode = "runtime" | "local-cli" | "hybrid";
