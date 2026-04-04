import type { ModelProvider } from "./code-runtime-rpc/foundation.js";
import type {
  KernelCapabilityContractSurface,
  RuntimePluginCompatibility,
  RuntimePluginCompatibilityStatus,
  RuntimePluginTrustDecision,
  RuntimePluginTrustDecisionStatus,
  RuntimeRoutingPluginKind,
  RuntimeRegistryPackageDescriptor,
} from "./code-runtime-rpc/runtimeKernelAndExtensions.js";

export type RuntimeCompositionSourceKind =
  | "runtime_extension"
  | "workspace_skill"
  | "prompt_overlay"
  | "session_command"
  | "route_plugin"
  | "host_binding";

export type RuntimeActivationState =
  | "active"
  | "degraded"
  | "failed"
  | "deactivated"
  | "refresh_pending";

export type RuntimeInvocationVisibilityReason =
  | "published"
  | "hidden_by_policy"
  | "shadowed"
  | "deactivated"
  | "blocked"
  | "declaration_only";

export type RuntimeCompositionSourceDescriptor = {
  id: string;
  sourceKind: RuntimeCompositionSourceKind;
  displayName?: string | null;
  summary?: string | null;
  pluginId?: string | null;
  packageRef?: string | null;
  contractSurfaces?: KernelCapabilityContractSurface[] | null;
};

export type RuntimeActivationRecord = {
  sourceId: string;
  state: RuntimeActivationState;
  ready: boolean;
  reason?: string | null;
  diagnostics?: string[] | null;
};

export type RuntimeInvocationShadow = {
  invocationId: string;
  shadowedByInvocationId: string;
  reason: RuntimeInvocationVisibilityReason;
};

export type RuntimeInvocationDescriptor = {
  id: string;
  sourceId: string;
  visibleReason: RuntimeInvocationVisibilityReason;
  executable: boolean;
  packageRef?: string | null;
  pluginId?: string | null;
};

export type RuntimeCompositionBlockedPlugin = {
  pluginId: string;
  packageRef?: string | null;
  reason: string;
  stage: "selector" | "trust" | "compatibility" | "dependency";
};

export type RuntimeCompositionPluginSelection = {
  pluginId: string;
  packageRef?: string | null;
  source: string;
  reason?: string | null;
};

export type RuntimeCompositionRouteCandidate = {
  pluginId: string;
  routeKind?: RuntimeRoutingPluginKind | null;
  providerId?: ModelProvider | null;
  preferredBackendIds?: string[] | null;
  resolvedBackendId?: string | null;
};

export type RuntimeCompositionBackendCandidate = {
  backendId: string;
  sourcePluginId?: string | null;
};

export type RuntimeCompositionResolutionProvenance = {
  activeProfileId: string | null;
  activeProfileName?: string | null;
  appliedLayerOrder: ("built_in" | "user" | "workspace" | "launch_override")[];
  selectorDecisions: Record<string, string>;
};

export type RuntimeCompositionResolution = {
  selectedPlugins: RuntimeCompositionPluginSelection[];
  selectedRouteCandidates: RuntimeCompositionRouteCandidate[];
  selectedBackendCandidates: RuntimeCompositionBackendCandidate[];
  blockedPlugins: RuntimeCompositionBlockedPlugin[];
  trustDecisions: RuntimePluginTrustDecision[];
  provenance: RuntimeCompositionResolutionProvenance;
};

export type RuntimeHostBindingState = "unbound" | "binding" | "bound" | "degraded" | "blocked";

export type RuntimeHostPublicationState = "hidden" | "declaration_only" | "published" | "blocked";

export type RuntimeCompositionAuthorityState = "published" | "stale" | "unavailable";

export type RuntimeAuthorityFreshnessState =
  | "current"
  | "pending_publish"
  | "stale"
  | "unavailable";

export type RuntimeAuthorityLiveEventKind =
  | "composition_published"
  | "composition_stale"
  | "run_summary_changed"
  | "review_summary_changed";

export type RuntimeAuthorityLiveEvent = {
  workspaceId: string;
  kind: RuntimeAuthorityLiveEventKind;
  authorityState: RuntimeCompositionAuthorityState;
  freshnessState: RuntimeAuthorityFreshnessState;
  authorityRevision: number | null;
  lastAcceptedRevision: number | null;
  lastPublishAttemptAt: number | null;
  publishedAt: number | null;
  publisherSessionId: string | null;
};

export type RuntimeHostBindingDiagnostic = {
  code: string;
  severity: "info" | "warning" | "error";
  summary: string;
  detail?: string | null;
};

export type RuntimeHostBindingDescriptor = {
  pluginId: string;
  packageRef?: string | null;
  source: string;
  bindingState: RuntimeHostBindingState;
  publicationState: RuntimeHostPublicationState;
  contractFormat?: string | null;
  contractBoundary?: string | null;
  interfaceId?: string | null;
  rawBindingState?: "bound" | "declaration_only" | "unbound" | null;
  executable?: boolean | null;
  reason?: string | null;
  diagnostics?: RuntimeHostBindingDiagnostic[] | null;
  contractSurfaces?: KernelCapabilityContractSurface[] | null;
};

export type RuntimeCompositionPluginEntryV2 = {
  pluginId: string;
  source: string;
  packageRef?: string | null;
  installed: boolean;
  trust: RuntimePluginTrustDecision;
  trustStatus: RuntimePluginTrustDecisionStatus;
  compatibility: RuntimePluginCompatibility;
  compatibilityStatus: RuntimePluginCompatibilityStatus;
  bindingState: RuntimeHostBindingState;
  publicationState: RuntimeHostPublicationState;
  selectedInActiveProfile: boolean;
  blockedReason?: string | null;
  selectedReason?: string | null;
  routeCandidate: boolean;
  selectedRouteCandidate?: RuntimeCompositionRouteCandidate | null;
  backendCandidateIds: string[];
  backendCandidates: RuntimeCompositionBackendCandidate[];
  bindingDescriptor: RuntimeHostBindingDescriptor | null;
  bindingDiagnostics: RuntimeHostBindingDiagnostic[];
  registryPackage?: RuntimeRegistryPackageDescriptor | null;
};

export type RuntimeCompositionProfileSummaryV2 = {
  id: string;
  name: string;
  scope: "built_in" | "user" | "workspace";
  enabled: boolean;
  active: boolean;
};

export type RuntimeCompositionResolveV2Response = {
  activeProfile: import("./runtimeCompositionProfiles.js").RuntimeCompositionProfile | null;
  authorityState: RuntimeCompositionAuthorityState;
  freshnessState: RuntimeAuthorityFreshnessState;
  authorityRevision: number | null;
  lastAcceptedRevision: number | null;
  lastPublishAttemptAt: number | null;
  publishedAt: number | null;
  publisherSessionId: string | null;
  provenance: RuntimeCompositionResolutionProvenance;
  pluginEntries: RuntimeCompositionPluginEntryV2[];
  selectedRouteCandidates: RuntimeCompositionRouteCandidate[];
  selectedBackendCandidates: RuntimeCompositionBackendCandidate[];
  blockedPlugins: RuntimeCompositionBlockedPlugin[];
  trustDecisions: RuntimePluginTrustDecision[];
};

export type RuntimeCompositionPolicySnapshot = {
  trust: RuntimePluginTrustDecision[];
  compatibility?: RuntimePluginCompatibility[] | null;
};
