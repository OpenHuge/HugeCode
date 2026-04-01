import type { ModelPool, ModelProvider, RuntimeProviderCapabilityMatrix } from "./foundation.js";
import type {
  HugeCodeCheckpointSummary,
  HugeCodeMissionLinkageSummary,
  HugeCodePublishHandoffReference,
  HugeCodeReviewActionabilitySummary,
  HugeCodeTakeoverBundle,
} from "../hugeCodeMissionControl.js";
import type {
  OAuthProviderId,
  RuntimeProviderExecutionKind,
  RuntimeProviderReadinessKind,
} from "./providersAndAuth.js";
import type {
  RuntimePolicyMode,
  RuntimeToolExecutionChannelHealth,
  RuntimeToolExecutionCircuitBreakerEntry,
  RuntimeToolExecutionMetricsSnapshot,
  RuntimeToolExecutionScope,
  RuntimeToolGuardrailStateSnapshot,
} from "./runtimeLiveSkillsAndTooling.js";
import type {
  RuntimeCompositionBackendCandidate,
  RuntimeCompositionBlockedPlugin,
  RuntimeCompositionPluginSelection,
  RuntimeCompositionResolution,
  RuntimeCompositionResolutionProvenance,
  RuntimeCompositionRouteCandidate,
} from "../runtimeCompositionPlane.js";
import type {
  RuntimeCompositionBackendPolicy,
  RuntimeCompositionConfigLayer,
  RuntimeCompositionObservabilityPolicy,
  RuntimeCompositionPluginSelector,
  RuntimeCompositionProfile,
  RuntimeCompositionProfileScope,
  RuntimeCompositionRoutePolicy,
  RuntimeCompositionTrustPolicy,
} from "../runtimeCompositionProfiles.js";
export type KernelCapabilityKind =
  | "terminal"
  | "job"
  | "backend"
  | "extension"
  | "host"
  | "skill"
  | "policy"
  | "context";

export type KernelCapabilityHealth = "ready" | "attention" | "blocked";

export type KernelPlacement = "local" | "remote";

export type KernelInteractivity = "interactive" | "background";

export type KernelIsolation = "host" | "desktop_sandbox" | "container_sandbox" | "vm";

export type KernelNetworkMode = "default" | "restricted" | "offline";

export type KernelAuthority = "user" | "service" | "delegated";

export type KernelExecutionProfile = {
  placement: KernelPlacement;
  interactivity: KernelInteractivity;
  isolation: KernelIsolation;
  network: KernelNetworkMode;
  authority: KernelAuthority;
};

export type KernelCapabilityContractSurfaceKind =
  | "world"
  | "interface"
  | "procedure_set"
  | "extension"
  | "skill"
  | "manifest"
  | "route";

export type KernelCapabilityContractSurfaceDirection = "import" | "export";

export type KernelCapabilityContractSurface = {
  id: string;
  kind: KernelCapabilityContractSurfaceKind;
  direction: KernelCapabilityContractSurfaceDirection;
  summary?: string | null;
};

export type KernelHostCapabilityMetadata = {
  pluginSource: "wasi_host" | "rpc_host";
  bindingState: "bound" | "declaration_only" | "unbound";
  contractFormat: "wit" | "rpc";
  contractBoundary: string;
  interfaceId?: string | null;
  worldId?: string | null;
  contractSurfaces?: KernelCapabilityContractSurface[] | null;
  summary?: string | null;
  reason?: string | null;
  warnings?: string[] | null;
  hostManaged?: boolean | null;
  semverQualifiedImports?: boolean | null;
  canonicalAbiResources?: boolean | null;
};

export type RuntimeRoutingPluginKind =
  | "provider_family"
  | "backend_placement"
  | "combined_execution";

export type RuntimeRoutingPluginProvenance =
  | "auto"
  | "explicit_route"
  | "model_selection"
  | "backend_preference"
  | "runtime_fallback";

export type RuntimeRoutingPluginReadiness = "ready" | "attention" | "blocked";

export type RuntimeRoutingPluginMetadata = {
  routeKind: RuntimeRoutingPluginKind;
  routeValue: string;
  readiness: RuntimeRoutingPluginReadiness;
  launchAllowed: boolean;
  detail?: string | null;
  blockingReason?: string | null;
  recommendedAction?: string | null;
  fallbackDetail?: string | null;
  providerId?: ModelProvider | null;
  providerLabel?: string | null;
  oauthProviderId?: OAuthProviderId | null;
  pool?: ModelPool | null;
  defaultModelId?: string | null;
  provenance?: RuntimeRoutingPluginProvenance | null;
  preferredBackendIds?: string[] | null;
  resolvedBackendId?: string | null;
  readinessKind?: RuntimeProviderReadinessKind | null;
  readinessMessage?: string | null;
  executionKind?: RuntimeProviderExecutionKind | null;
  capabilityMatrix?: RuntimeProviderCapabilityMatrix | null;
  providerAvailable?: boolean | null;
  accountsTotal?: number | null;
  enabledAccountCount?: number | null;
  credentialReadyAccountCount?: number | null;
  poolsTotal?: number | null;
  enabledPoolCount?: number | null;
  poolRoutingReady?: boolean | null;
};

export type RuntimePluginPackageTransport =
  | "mcp_remote"
  | "wasi_component"
  | "a2a_remote"
  | "runtime_extension"
  | "host_bridge"
  | "repo_manifest";

export type RuntimePluginVerificationStatus =
  | "verified"
  | "unsigned"
  | "attestation_missing"
  | "failed"
  | "dev_override"
  | "runtime_managed"
  | "unknown";

export type RuntimePluginTrustDecisionStatus =
  | "verified"
  | "blocked"
  | "dev_override"
  | "runtime_managed"
  | "unknown";

export type RuntimePluginCompatibilityStatus = "compatible" | "incompatible" | "unknown";

export type RuntimePluginAttestation = {
  kind: "signature" | "provenance" | "transparency_log" | "manifest" | (string & {});
  source: string;
  identity?: string | null;
  verified?: boolean | null;
  summary?: string | null;
};

export type RuntimePluginCompatibility = {
  status: RuntimePluginCompatibilityStatus;
  minimumHostContractVersion?: string | null;
  supportedRuntimeProtocolVersions?: string[] | null;
  supportedCapabilityKeys?: string[] | null;
  optionalTransportFeatures?: string[] | null;
  blockers?: string[] | null;
};

export type RuntimePluginTrustDecision = {
  status: RuntimePluginTrustDecisionStatus;
  verificationStatus: RuntimePluginVerificationStatus;
  publisher?: string | null;
  attestationSource?: string | null;
  blockedReason?: string | null;
  packageRef?: string | null;
  pluginId?: string | null;
};

export type RuntimePluginPackageManifest = {
  packageId: string;
  version: string;
  publisher?: string | null;
  transport: RuntimePluginPackageTransport;
  entry: {
    pluginId: string;
    displayName?: string | null;
    summary?: string | null;
    interfaceId?: string | null;
  };
  contractSurfaces: KernelCapabilityContractSurface[];
  compatibility?: RuntimePluginCompatibility | null;
  dependencies?: string[] | null;
  permissions?: string[] | null;
  defaultConfig?: Record<string, unknown> | null;
  attestations?: RuntimePluginAttestation[] | null;
};

export type RuntimeRegistryPackageDescriptorSource = "catalog" | "installed" | "runtime_managed";

export type RuntimeRegistryPackageDescriptor = {
  packageRef: string;
  packageId: string;
  version: string;
  publisher?: string | null;
  summary?: string | null;
  transport: RuntimePluginPackageTransport;
  source: RuntimeRegistryPackageDescriptorSource;
  installed: boolean;
  installedPluginId?: string | null;
  manifest: RuntimePluginPackageManifest;
  compatibility: RuntimePluginCompatibility;
  trust: RuntimePluginTrustDecision;
};

export type {
  RuntimeCompositionBackendCandidate,
  RuntimeCompositionBlockedPlugin,
  RuntimeCompositionPluginSelection,
  RuntimeCompositionResolution,
  RuntimeCompositionResolutionProvenance,
  RuntimeCompositionRouteCandidate,
} from "../runtimeCompositionPlane.js";
export type {
  RuntimeCompositionBackendPolicy,
  RuntimeCompositionConfigLayer,
  RuntimeCompositionObservabilityPolicy,
  RuntimeCompositionPluginSelectorAction,
  RuntimeCompositionPluginSelector,
  RuntimeCompositionProfile,
  RuntimeCompositionProfileScope,
  RuntimeCompositionRoutePolicy,
  RuntimeCompositionTrustPolicy,
} from "../runtimeCompositionProfiles.js";

export type KernelCapabilityDescriptor = {
  id: string;
  name: string;
  kind: KernelCapabilityKind;
  enabled: boolean;
  health: KernelCapabilityHealth;
  executionProfile: KernelExecutionProfile;
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

export type KernelContinuation = {
  checkpointId?: string | null;
  resumeSupported: boolean;
  recovered: boolean;
  reviewActionability?: Record<string, unknown> | null;
  takeover?: Record<string, unknown> | null;
  missionLinkage?: Record<string, unknown> | null;
  publishHandoff?: Record<string, unknown> | null;
  summary?: string | null;
};

export type KernelSessionKind = "pty";

export type KernelSession = {
  id: string;
  kind: KernelSessionKind;
  workspaceId: string | null;
  state: string;
  createdAt: number;
  updatedAt: number;
  executionProfile: KernelExecutionProfile;
  lines?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

export type KernelJob = {
  id: string;
  workspaceId: string;
  threadId?: string | null;
  title?: string | null;
  status: string;
  provider?: ModelProvider | null;
  modelId?: string | null;
  backendId?: string | null;
  preferredBackendIds?: string[] | null;
  executionProfile: KernelExecutionProfile;
  createdAt: number;
  updatedAt: number;
  startedAt?: number | null;
  completedAt?: number | null;
  continuation: KernelContinuation;
  metadata?: Record<string, unknown> | null;
};

export type KernelContextScope =
  | { kind: "global" }
  | { kind: "workspace"; workspaceId: string }
  | { kind: "thread"; workspaceId: string; threadId: string }
  | { kind: "task"; taskId: string }
  | { kind: "run"; runId: string }
  | { kind: "skills"; workspaceId?: string | null };

export type KernelContextSlice = {
  scope: KernelContextScope;
  revision: number;
  snapshot: Record<string, unknown>;
  latestEvent?: Record<string, unknown> | null;
  sources?: string[] | null;
};

export type KernelExtensionBundle = {
  id: string;
  name: string;
  enabled: boolean;
  transport: RuntimeExtensionTransport;
  workspaceId: string | null;
  toolCount: number;
  resourceCount: number;
  surfaces: string[];
  installedAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown> | null;
};

export type KernelPolicyDecision = {
  decision: "allow" | "ask" | "deny";
  reason: string;
  policyMode: RuntimePolicyMode;
  evaluatedAt: number;
  channelHealth?: RuntimeToolExecutionChannelHealth | null;
  circuitBreaker?: RuntimeToolExecutionCircuitBreakerEntry | null;
  metadata?: Record<string, unknown> | null;
};

export type KernelProjectionScope =
  | "mission_control"
  | "jobs"
  | "sessions"
  | "capabilities"
  | "extensions"
  | "continuity"
  | "diagnostics";

export type KernelProjectionSlices = Partial<Record<KernelProjectionScope, unknown>>;

export type KernelCapabilitiesSlice = KernelCapabilityDescriptor[];

export type KernelContinuitySummary = {
  recoverableRunCount: number;
  reviewBlockedCount: number;
  itemCount: number;
};

export type KernelContinuityItem = {
  taskId: string;
  runId: string;
  checkpoint?: HugeCodeCheckpointSummary | null;
  missionLinkage?: HugeCodeMissionLinkageSummary | null;
  reviewActionability?: HugeCodeReviewActionabilitySummary | null;
  publishHandoff?: HugeCodePublishHandoffReference | null;
  takeoverBundle?: HugeCodeTakeoverBundle | null;
};

export type KernelContinuitySlice = {
  summary: KernelContinuitySummary;
  items: KernelContinuityItem[];
};

export type KernelDiagnosticsSlice = {
  revision: number;
  latestEvent?: unknown | null;
  runtime: unknown;
  toolMetrics: RuntimeToolExecutionMetricsSnapshot;
  toolGuardrails: RuntimeToolGuardrailStateSnapshot;
};

export type KernelProjectionBootstrapRequest = {
  scopes?: KernelProjectionScope[] | null;
};

export type KernelProjectionBootstrapResponse = {
  revision: number;
  sliceRevisions: Partial<Record<KernelProjectionScope, number>>;
  slices: KernelProjectionSlices;
};

export type KernelProjectionSubscriberConfig = {
  maxBufferDepth?: number | null;
};

export type KernelProjectionOpType = "replace" | "upsert" | "remove" | "patch" | "resync_required";

export type KernelProjectionOp = {
  type: KernelProjectionOpType;
  scope: KernelProjectionScope;
  key?: string | null;
  value?: unknown;
  patch?: Record<string, unknown> | null;
  revision?: number | null;
  reason?: string | null;
};

export type KernelProjectionDelta = {
  revision: number;
  scopes: KernelProjectionScope[];
  ops: KernelProjectionOp[];
};

export type KernelProjectionSubscriptionRequest = {
  scopes?: KernelProjectionScope[] | null;
  lastRevision?: number | null;
  subscriberConfig?: KernelProjectionSubscriberConfig | null;
};

export type KernelProjectionSubscriptionAck = {
  ok: true;
  revision: number;
  scopes: KernelProjectionScope[];
  transport: "ws" | "desktop-host-event" | "fallback-runtime-updated";
};

export type KernelSessionsListRequest = {
  workspaceId?: string | null;
  kind?: KernelSessionKind | null;
};

export type KernelJobsListRequest = {
  workspaceId?: string | null;
  status?: string | null;
};

export type KernelContextSnapshotRequest = KernelContextScope;

export type KernelExtensionsListRequest = {
  workspaceId?: string | null;
};

export type RuntimeExtensionCatalogListRequest = {
  workspaceId?: string | null;
  kinds?: RuntimeExtensionKind[] | null;
  includeDisabled?: boolean | null;
};

export type RuntimeExtensionGetRequest = {
  workspaceId?: string | null;
  extensionId: string;
};

export type RuntimeExtensionRegistrySourceKind =
  | "workspace"
  | "private-registry"
  | "public-registry"
  | (string & {});

export type RuntimeExtensionKind =
  | "instruction"
  | "mcp"
  | "host"
  | "provider"
  | "bundle"
  | (string & {});

export type RuntimeExtensionDistribution =
  | "bundled"
  | "workspace"
  | "private-registry"
  | "public-registry"
  | (string & {});

export type RuntimeExtensionLifecycleState =
  | "discovered"
  | "installed"
  | "enabled"
  | "degraded"
  | "blocked"
  | "updating"
  | "removed"
  | (string & {});

export type KernelPoliciesEvaluateRequest = {
  toolName?: string | null;
  scope?: RuntimeToolExecutionScope | null;
  workspaceId?: string | null;
  payloadBytes?: number | null;
  requiresApproval?: boolean | null;
  mutationKind?: string | null;
};

export type RuntimeExtensionTransport =
  | "builtin"
  | "repo-manifest"
  | "mcp-stdio"
  | "mcp-http"
  | "host-native"
  | "openai-compatible"
  | "frontend"
  | (string & {});

export type RuntimeExtensionUiAppDescriptor = {
  appId: string;
  title: string;
  route: string;
  description?: string | null;
  icon?: string | null;
};

export type RuntimeExtensionRegistrySource = {
  sourceId: string;
  displayName: string;
  kind: RuntimeExtensionRegistrySourceKind;
  url?: string | null;
  public: boolean;
  installSupported: boolean;
  searchSupported: boolean;
};

export type RuntimeExtensionRecord = {
  extensionId: string;
  version: string;
  displayName: string;
  publisher: string;
  summary: string;
  kind: RuntimeExtensionKind;
  distribution: RuntimeExtensionDistribution;
  name: string;
  transport: RuntimeExtensionTransport;
  lifecycleState: RuntimeExtensionLifecycleState;
  enabled: boolean;
  workspaceId: string | null;
  capabilities: string[];
  permissions: string[];
  uiApps: RuntimeExtensionUiAppDescriptor[];
  provenance: Record<string, unknown>;
  config: Record<string, unknown>;
  installedAt: number;
  updatedAt: number;
};

export type RuntimeExtensionSpec = RuntimeExtensionRecord;

export type RuntimeExtensionToolSummary = {
  extensionId: string;
  toolName: string;
  description: string;
  inputSchema: Record<string, unknown> | null;
  readOnly: boolean;
};

export type RuntimeExtensionInstallRequest = {
  workspaceId?: string | null;
  extensionId: string;
  version?: string | null;
  displayName?: string | null;
  publisher?: string | null;
  summary?: string | null;
  kind?: RuntimeExtensionKind | null;
  distribution?: RuntimeExtensionDistribution | null;
  name?: string | null;
  transport: RuntimeExtensionTransport;
  enabled?: boolean;
  capabilities?: string[] | null;
  permissions?: string[] | null;
  uiApps?: RuntimeExtensionUiAppDescriptor[] | null;
  provenance?: Record<string, unknown> | null;
  config?: Record<string, unknown> | null;
};

export type RuntimeExtensionRemoveRequest = {
  workspaceId?: string | null;
  extensionId: string;
};

export type RuntimeExtensionUpdateRequest = {
  workspaceId?: string | null;
  extensionId: string;
  version?: string | null;
  displayName?: string | null;
  publisher?: string | null;
  summary?: string | null;
  kind?: RuntimeExtensionKind | null;
  distribution?: RuntimeExtensionDistribution | null;
  transport?: RuntimeExtensionTransport | null;
  enabled?: boolean | null;
  capabilities?: string[] | null;
  permissions?: string[] | null;
  uiApps?: RuntimeExtensionUiAppDescriptor[] | null;
  provenance?: Record<string, unknown> | null;
  config?: Record<string, unknown> | null;
};

export type RuntimeExtensionSetStateRequest = {
  workspaceId?: string | null;
  extensionId: string;
  enabled: boolean;
};

export type RuntimeExtensionToolsListRequest = {
  workspaceId?: string | null;
  extensionId: string;
};

export type RuntimeExtensionResourceReadRequest = {
  workspaceId?: string | null;
  extensionId: string;
  resourceId: string;
};

export type RuntimeExtensionResourceReadResponse = {
  extensionId: string;
  resourceId: string;
  contentType: string;
  content: string;
  metadata: Record<string, unknown> | null;
};

export type RuntimeExtensionsConfigResponse = {
  extensions: RuntimeExtensionRecord[];
  warnings: string[];
  registrySources?: RuntimeExtensionRegistrySource[];
};

export type RuntimeExtensionRegistrySearchRequest = {
  workspaceId?: string | null;
  query?: string | null;
  kinds?: RuntimeExtensionKind[] | null;
  sourceIds?: string[] | null;
};

export type RuntimeExtensionRegistrySearchResponse = {
  query: string;
  results: RuntimeExtensionRecord[];
  sources: RuntimeExtensionRegistrySource[];
};

export type RuntimeExtensionPermissionsEvaluateRequest = {
  workspaceId?: string | null;
  extensionId: string;
};

export type RuntimeExtensionPermissionsEvaluateResponse = {
  extensionId: string;
  permissions: string[];
  decision: "allow" | "ask" | "deny";
  warnings: string[];
};

export type RuntimeExtensionHealthReadRequest = {
  workspaceId?: string | null;
  extensionId: string;
};

export type RuntimeExtensionHealthReadResponse = {
  extensionId: string;
  lifecycleState: RuntimeExtensionLifecycleState;
  healthy: boolean;
  warnings: string[];
  checkedAt: number;
};

export type RuntimeSessionExportRequest = {
  workspaceId: string;
  threadId: string;
  includeAgentTasks?: boolean;
};

export type RuntimeSessionExportResponse = {
  schemaVersion: string;
  exportedAt: number;
  workspaceId: string;
  threadId: string;
  snapshot: Record<string, unknown>;
};

export type RuntimeSessionImportRequest = {
  workspaceId: string;
  snapshot: Record<string, unknown>;
  threadId?: string | null;
};

export type RuntimeSessionImportResponse = {
  schemaVersion: string;
  workspaceId: string;
  threadId: string;
  imported: boolean;
  warnings: string[];
};

export type RuntimeSessionDeleteRequest = {
  workspaceId: string;
  threadId: string;
};

export type RuntimeThreadSnapshotsGetRequest = {};

export type RuntimeThreadSnapshotsGetResponse = {
  snapshots: Record<string, Record<string, unknown>>;
  updatedAt: number | null;
};

export type RuntimeThreadSnapshotsSetRequest = {
  snapshots: Record<string, Record<string, unknown>>;
};

export type RuntimeThreadSnapshotsSetResponse = {
  snapshotCount: number;
  updatedAt: number;
};
