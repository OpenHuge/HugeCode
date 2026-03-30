export type RuntimeBackendStatus = "active" | "draining" | "disabled";

export type RuntimeBackendRolloutState = "current" | "ramping" | "draining" | "drained";

export type RuntimeBackendClass = "primary" | "burst" | "specialized";

export type RuntimeBackendTrustTier = "trusted" | "standard" | "isolated";

export type RuntimeBackendDataSensitivity = "public" | "internal" | "restricted";

export type RuntimeBackendApprovalPolicy =
  | "runtime-default"
  | "checkpoint-required"
  | "never-auto-approve";

export type RuntimeBackendToolClass = "read" | "write" | "exec" | "network" | "browser" | "mcp";

export type RuntimeBackendPolicyProfile = {
  trustTier: RuntimeBackendTrustTier;
  dataSensitivity: RuntimeBackendDataSensitivity;
  approvalPolicy: RuntimeBackendApprovalPolicy;
  allowedToolClasses: RuntimeBackendToolClass[];
};

export type RuntimeBackendReachability = "reachable" | "degraded" | "unreachable" | "unknown";

export type RuntimeBackendConnectivityMode = "direct" | "overlay" | "gateway";

export type RuntimeBackendOverlay = "tailscale" | "netbird" | "orbit";

export type RuntimeBackendLeaseStatus = "active" | "expiring" | "expired" | "released" | "none";

export type RuntimeBackendConnectivitySummary = {
  mode?: RuntimeBackendConnectivityMode | null;
  overlay?: RuntimeBackendOverlay | null;
  endpoint?: string | null;
  reachability?: RuntimeBackendReachability | null;
  checkedAt?: number | null;
  source?: "runtime" | "overlay" | "operator" | "probe" | null;
  reason?: string | null;
};

export type RuntimeBackendLeaseSummary = {
  status: RuntimeBackendLeaseStatus;
  leaseId?: string | null;
  holderId?: string | null;
  scope?: "backend" | "slot" | "node" | "overlay-session" | null;
  acquiredAt?: number | null;
  expiresAt?: number | null;
  ttlMs?: number | null;
  observedAt?: number | null;
};

export type RuntimeBackendReadinessState =
  | "ready"
  | "attention"
  | "blocked"
  | "unknown"
  | "not_applicable";

export type RuntimeBackendReadinessSummary = {
  state: RuntimeBackendReadinessState;
  summary: string;
  reasons: string[];
  checkedAt?: number | null;
  handshakeState?: "verified" | "missing" | "failed" | "unknown" | null;
  capabilityState?: "verified" | "missing" | "failed" | "unknown" | null;
  authState?: "verified" | "missing" | "failed" | "unknown" | null;
  protocolVersion?: string | null;
  serverName?: string | null;
  serverVersion?: string | null;
};

export type RuntimeBackendOperabilityState = "ready" | "attention" | "blocked";

export type RuntimeBackendOperabilitySummary = {
  state: RuntimeBackendOperabilityState;
  placementEligible: boolean;
  summary: string;
  reasons: string[];
  heartbeatState?: "fresh" | "stale" | "missing" | "unknown" | null;
  heartbeatAgeMs?: number | null;
  reachability?: RuntimeBackendReachability | null;
  leaseStatus?: RuntimeBackendLeaseStatus | null;
  readinessState?: RuntimeBackendReadinessState | null;
  activeTasks?: number | null;
  availableExecutionSlots?: number | null;
};

export type RuntimeBackendDiagnosticsSummary = {
  availability: "available" | "saturated" | "draining" | "disabled" | "degraded" | "unknown";
  summary: string;
  reasons: string[];
  degraded: boolean;
  heartbeatAgeMs?: number | null;
  lastHeartbeatAt?: number | null;
  reachability?: RuntimeBackendReachability | null;
  leaseStatus?: RuntimeBackendLeaseStatus | null;
  readinessState?: RuntimeBackendReadinessState | null;
};

export type AcpIntegrationTransport = "stdio" | "http";

export type AcpIntegrationState = "active" | "draining" | "disabled" | "degraded";

export type AcpStdioTransportConfig = {
  transport: "stdio";
  command: string;
  args?: string[];
  cwd?: string | null;
  env?: Record<string, string> | null;
};

export type AcpHttpTransportConfig = {
  transport: "http";
  endpoint: string;
  experimental?: boolean;
  headers?: Record<string, string> | null;
};

export type AcpIntegrationTransportConfig = AcpStdioTransportConfig | AcpHttpTransportConfig;

export type AcpIntegrationSummary = {
  integrationId: string;
  backendId: string;
  displayName: string;
  state: AcpIntegrationState;
  transport: AcpIntegrationTransport;
  transportConfig: AcpIntegrationTransportConfig;
  healthy: boolean;
  lastError?: string | null;
  lastProbeAt?: number | null;
  protocolVersion?: string | null;
  serverName?: string | null;
  serverVersion?: string | null;
  configOptions?: Record<string, unknown> | null;
  capabilities: string[];
  maxConcurrency: number;
  costTier: string;
  latencyClass: string;
  backendClass?: RuntimeBackendClass | null;
  specializations?: string[] | null;
  connectivity?: RuntimeBackendConnectivitySummary | null;
  lease?: RuntimeBackendLeaseSummary | null;
  readiness?: RuntimeBackendReadinessSummary | null;
  createdAt: number;
  updatedAt: number;
};

export type AcpIntegrationUpsertInput = {
  integrationId: string;
  displayName: string;
  transportConfig: AcpIntegrationTransportConfig;
  state?: AcpIntegrationState;
  capabilities: string[];
  maxConcurrency: number;
  costTier: string;
  latencyClass: string;
  backendId?: string | null;
  backendClass?: RuntimeBackendClass | null;
  specializations?: string[] | null;
  connectivity?: RuntimeBackendConnectivitySummary | null;
  lease?: RuntimeBackendLeaseSummary | null;
};

export type AcpIntegrationSetStateRequest = {
  integrationId: string;
  state: AcpIntegrationState;
  reason?: string | null;
};

export type AcpIntegrationProbeRequest = {
  integrationId: string;
  force?: boolean;
};

export type RuntimeBackendSummary = {
  backendId: string;
  displayName: string;
  capabilities: string[];
  maxConcurrency: number;
  costTier: string;
  latencyClass: string;
  rolloutState: RuntimeBackendRolloutState;
  status: RuntimeBackendStatus;
  healthy: boolean;
  healthScore: number;
  failures: number;
  queueDepth: number;
  runningTasks: number;
  createdAt: number;
  updatedAt: number;
  lastHeartbeatAt: number;
  heartbeatIntervalMs?: number | null;
  backendClass?: RuntimeBackendClass | null;
  specializations?: string[] | null;
  connectivity?: RuntimeBackendConnectivitySummary | null;
  lease?: RuntimeBackendLeaseSummary | null;
  readiness?: RuntimeBackendReadinessSummary | null;
  operability?: RuntimeBackendOperabilitySummary | null;
  diagnostics?: RuntimeBackendDiagnosticsSummary | null;
  policy?: RuntimeBackendPolicyProfile | null;
  backendKind?: "native" | "acp" | null;
  integrationId?: string | null;
  transport?: AcpIntegrationTransport | null;
  origin?: "runtime-native" | "acp-projection" | null;
  contract?: {
    kind: "native" | "acp";
    origin: "runtime-native" | "acp-projection";
    transport: AcpIntegrationTransport | null;
    capabilityCount: number;
    health: RuntimeBackendStatus;
    rolloutState: RuntimeBackendRolloutState;
    backendClass?: RuntimeBackendClass | null;
    reachability?: RuntimeBackendReachability | null;
    leaseStatus?: RuntimeBackendLeaseStatus | null;
    readinessState?: RuntimeBackendReadinessState | null;
  } | null;
};

export type RuntimeBackendUpsertInput = {
  backendId: string;
  displayName: string;
  capabilities: string[];
  maxConcurrency: number;
  costTier: string;
  latencyClass: string;
  rolloutState: RuntimeBackendRolloutState;
  status: RuntimeBackendStatus;
  healthScore?: number;
  failures?: number;
  queueDepth?: number;
  runningTasks?: number;
  lastHeartbeatAt?: number;
  heartbeatIntervalMs?: number | null;
  backendClass?: RuntimeBackendClass | null;
  specializations?: string[] | null;
  connectivity?: RuntimeBackendConnectivitySummary | null;
  lease?: RuntimeBackendLeaseSummary | null;
  policy?: RuntimeBackendPolicyProfile | null;
};

export type RuntimeBackendSetStateRequest = {
  backendId: string;
  status?: RuntimeBackendStatus;
  rolloutState?: RuntimeBackendRolloutState;
  force?: boolean;
  reason?: string | null;
};
