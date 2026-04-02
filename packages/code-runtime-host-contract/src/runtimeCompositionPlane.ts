import type { ModelProvider } from "./code-runtime-rpc/foundation.js";
import type {
  KernelCapabilityContractSurface,
  RuntimePluginCompatibility,
  RuntimePluginTrustDecision,
  RuntimeRoutingPluginKind,
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

export type RuntimeCompositionPolicySnapshot = {
  trust: RuntimePluginTrustDecision[];
  compatibility?: RuntimePluginCompatibility[] | null;
};
