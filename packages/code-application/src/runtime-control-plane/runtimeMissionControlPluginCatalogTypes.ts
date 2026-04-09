import type {
  KernelCapabilityContractSurface,
  ModelPool,
  ModelProvider,
  OAuthProviderId,
  RuntimeProviderExecutionKind,
  RuntimeProviderReadinessKind,
  RuntimeRoutingPluginMetadata,
  RuntimeRoutingPluginProvenance,
} from "@ku0/code-runtime-host-contract";
import type {
  RuntimeControlPlanePluginCompositionMetadata,
  RuntimeControlPlanePluginRegistryMetadata,
} from "../runtimeControlPlaneOperatorModel";

export type RuntimeMissionControlPluginSource =
  | "runtime_extension"
  | "live_skill"
  | "repo_manifest"
  | "mcp_remote"
  | "wasi_component"
  | "a2a_remote"
  | "host_bridge"
  | "wasi_host"
  | "rpc_host"
  | "provider_route"
  | "backend_route"
  | "execution_route";

export type RuntimeMissionControlPluginDescriptor = {
  id: string;
  name: string;
  version: string;
  source: RuntimeMissionControlPluginSource;
  enabled: boolean;
  runtimeBacked: boolean;
  capabilities: Array<{
    id: string;
    enabled: boolean;
  }>;
  permissions: string[];
  binding: {
    state: "bound" | "declaration_only" | "unbound";
    surfaces: Array<{
      id: string;
      kind: KernelCapabilityContractSurface["kind"];
      direction: KernelCapabilityContractSurface["direction"];
      summary: string | null;
    }>;
  };
  operations: {
    execution: {
      executable: boolean;
      reason: string | null;
    };
    resources: {
      readable: boolean;
      reason: string | null;
    };
    permissions: {
      evaluable: boolean;
      reason: string | null;
    };
  };
  metadata: Record<string, unknown> | null;
  permissionDecision: "allow" | "ask" | "deny" | "unsupported" | null;
  health: {
    state: "healthy" | "degraded" | "unsupported" | "unknown";
    warnings: string[];
  } | null;
};

export type RuntimeMissionControlActivationReadiness = {
  detail: string;
};

export type RuntimeMissionControlActivationRecord = {
  activationId: string;
  state:
    | "discovered"
    | "verified"
    | "installed"
    | "bound"
    | "active"
    | "degraded"
    | "refresh_pending"
    | "deactivated"
    | "failed"
    | "uninstalled";
  readiness: RuntimeMissionControlActivationReadiness;
};

export type RuntimeKernelPluginReadinessState = "ready" | "attention" | "blocked";

export type RuntimeKernelPluginReadinessTone = "neutral" | "success" | "warning" | "danger";

export type RuntimeKernelPluginReadinessBadge = {
  label: string;
  tone: RuntimeKernelPluginReadinessTone;
};

export type RuntimeKernelPluginReadinessEntry = {
  id: string;
  name: string;
  version: string;
  source: RuntimeMissionControlPluginDescriptor["source"];
  sourceLabel: string;
  badges: RuntimeKernelPluginReadinessBadge[];
  capabilitySupport: {
    state: RuntimeKernelPluginReadinessState;
    summary: string;
    detail: string;
  };
  permissionState: {
    state: RuntimeKernelPluginReadinessState;
    label: string;
    detail: string;
  };
  readiness: {
    state: RuntimeKernelPluginReadinessState;
    label: "Ready" | "Attention" | "Blocked";
    detail: string;
  };
  selectionState: {
    state: RuntimeKernelPluginReadinessState;
    kind:
      | "blocked_in_active_profile"
      | "selected_route"
      | "selected_in_active_profile"
      | "published_route"
      | "repository_declaration"
      | "available_inventory";
    label: string;
    detail: string;
  };
  trustState: {
    state: RuntimeKernelPluginReadinessState;
    kind:
      | "incompatible"
      | "verified"
      | "runtime_managed"
      | "dev_override"
      | "trust_blocked"
      | "trust_unknown"
      | "runtime_published"
      | "repository_local"
      | "trust_unspecified";
    label: string;
    detail: string;
  };
  activationState: {
    state: RuntimeKernelPluginReadinessState;
    lifecycle: RuntimeMissionControlActivationRecord["state"] | "untracked";
    label: string;
    detail: string;
  };
  remediationSummary: string;
};

export type RuntimeKernelPluginReadinessSection = {
  id: "needs_action" | "selected_now" | "inventory";
  title: string;
  description: string;
  entries: RuntimeKernelPluginReadinessEntry[];
};

export type RuntimeMissionControlPluginCatalogStatus = {
  label: string;
  tone: "neutral" | "running" | "success" | "warning" | "danger";
};

export type RuntimeMissionControlPluginCatalogSummary = {
  status: RuntimeMissionControlPluginCatalogStatus;
  plugins: RuntimeMissionControlPluginDescriptor[];
  readinessEntries: RuntimeKernelPluginReadinessEntry[];
  readinessSections: RuntimeKernelPluginReadinessSection[];
  total: number;
  enabled: number;
  runtimeBacked: number;
  executableCount: number;
  nonExecutableCount: number;
  readableResourceCount: number;
  permissionEvaluableCount: number;
  contractSurfaceCount: number;
  contractImportSurfaceCount: number;
  contractExportSurfaceCount: number;
  boundCount: number;
  declarationOnlyCount: number;
  unboundCount: number;
  runtimeExtensionCount: number;
  liveSkillCount: number;
  repoManifestCount: number;
  routingCount: number;
  providerRouteCount: number;
  backendRouteCount: number;
  executionRouteCount: number;
  externalPackageCount: number;
  verifiedPackageCount: number;
  blockedPackageCount: number;
  selectedInActiveProfileCount: number;
  readyRouteCount: number;
  attentionRouteCount: number;
  blockedRouteCount: number;
  unsupportedHostCount: number;
  healthyCount: number;
  degradedCount: number;
  unsupportedCount: number;
  readyCount: number;
  attentionCount: number;
  blockedCount: number;
  projectionBacked: boolean;
  error: string | null;
};

function readOptionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readOptionalStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function normalizeStringArray(value: unknown): string[] | null {
  const normalized = [...new Set(readOptionalStringArray(value))];
  return normalized.length > 0 ? normalized : null;
}

function isRoutingPluginKind(value: unknown): value is RuntimeRoutingPluginMetadata["routeKind"] {
  return (
    value === "provider_family" || value === "backend_placement" || value === "combined_execution"
  );
}

function isRoutingPluginReadiness(
  value: unknown
): value is RuntimeRoutingPluginMetadata["readiness"] {
  return value === "ready" || value === "attention" || value === "blocked";
}

function isRoutingPluginProvenance(value: unknown): value is RuntimeRoutingPluginProvenance {
  return (
    value === "auto" ||
    value === "explicit_route" ||
    value === "model_selection" ||
    value === "backend_preference" ||
    value === "runtime_fallback"
  );
}

export function readRuntimeControlPlaneRoutingPluginMetadata(
  metadata: Record<string, unknown> | null | undefined
): RuntimeRoutingPluginMetadata | null {
  if (!metadata) {
    return null;
  }
  const routeKind = metadata.routeKind;
  const routeValue = readOptionalText(metadata.routeValue);
  const readiness = metadata.readiness;
  if (
    !isRoutingPluginKind(routeKind) ||
    !routeValue ||
    !isRoutingPluginReadiness(readiness) ||
    typeof metadata.launchAllowed !== "boolean"
  ) {
    return null;
  }

  return {
    routeKind,
    routeValue,
    readiness,
    launchAllowed: metadata.launchAllowed,
    detail: readOptionalText(metadata.detail),
    blockingReason: readOptionalText(metadata.blockingReason),
    recommendedAction: readOptionalText(metadata.recommendedAction),
    fallbackDetail: readOptionalText(metadata.fallbackDetail),
    providerId: readOptionalText(metadata.providerId) as ModelProvider | null,
    providerLabel: readOptionalText(metadata.providerLabel),
    oauthProviderId: readOptionalText(metadata.oauthProviderId) as OAuthProviderId | null,
    pool: readOptionalText(metadata.pool) as ModelPool | null,
    defaultModelId: readOptionalText(metadata.defaultModelId),
    provenance: isRoutingPluginProvenance(metadata.provenance) ? metadata.provenance : null,
    preferredBackendIds: normalizeStringArray(metadata.preferredBackendIds),
    resolvedBackendId: readOptionalText(metadata.resolvedBackendId),
    readinessKind: readOptionalText(metadata.readinessKind) as RuntimeProviderReadinessKind | null,
    readinessMessage: readOptionalText(metadata.readinessMessage),
    executionKind: readOptionalText(metadata.executionKind) as RuntimeProviderExecutionKind | null,
    capabilityMatrix:
      metadata.capabilityMatrix && typeof metadata.capabilityMatrix === "object"
        ? (metadata.capabilityMatrix as RuntimeRoutingPluginMetadata["capabilityMatrix"])
        : null,
    providerAvailable:
      typeof metadata.providerAvailable === "boolean" ? metadata.providerAvailable : null,
    accountsTotal:
      typeof metadata.accountsTotal === "number" && Number.isFinite(metadata.accountsTotal)
        ? metadata.accountsTotal
        : null,
    enabledAccountCount:
      typeof metadata.enabledAccountCount === "number" &&
      Number.isFinite(metadata.enabledAccountCount)
        ? metadata.enabledAccountCount
        : null,
    credentialReadyAccountCount:
      typeof metadata.credentialReadyAccountCount === "number" &&
      Number.isFinite(metadata.credentialReadyAccountCount)
        ? metadata.credentialReadyAccountCount
        : null,
    poolsTotal:
      typeof metadata.poolsTotal === "number" && Number.isFinite(metadata.poolsTotal)
        ? metadata.poolsTotal
        : null,
    enabledPoolCount:
      typeof metadata.enabledPoolCount === "number" && Number.isFinite(metadata.enabledPoolCount)
        ? metadata.enabledPoolCount
        : null,
    poolRoutingReady:
      typeof metadata.poolRoutingReady === "boolean" ? metadata.poolRoutingReady : null,
  };
}

export type {
  RuntimeControlPlanePluginCompositionMetadata,
  RuntimeControlPlanePluginRegistryMetadata,
};
