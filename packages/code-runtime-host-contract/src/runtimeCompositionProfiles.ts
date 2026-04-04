import type { ModelProvider } from "./code-runtime-rpc/foundation.js";

export const RUNTIME_COMPOSITION_CONFIG_LAYER_SOURCES = [
  "built_in",
  "user",
  "workspace",
  "launch_override",
] as const;

export const RUNTIME_COMPOSITION_APPLIED_LAYER_ORDER = [
  ...RUNTIME_COMPOSITION_CONFIG_LAYER_SOURCES,
] as const;

export type RuntimeCompositionConfigLayerSource =
  (typeof RUNTIME_COMPOSITION_CONFIG_LAYER_SOURCES)[number];

export const RUNTIME_COMPOSITION_PROFILE_SCOPES = ["built_in", "user", "workspace"] as const;

export type RuntimeCompositionProfileScope = (typeof RUNTIME_COMPOSITION_PROFILE_SCOPES)[number];

export type RuntimeCompositionPluginSelectorAction = "include" | "exclude" | "prefer";

export type RuntimeCompositionPluginSelector = {
  matchBy: "pluginId" | "packageRef" | "source" | "transport" | "routeKind";
  matchValue: string;
  action: RuntimeCompositionPluginSelectorAction;
  reason?: string | null;
};

export type RuntimeCompositionRoutePolicy = {
  preferredRoutePluginIds?: string[] | null;
  providerPreference?: ModelProvider[] | string[] | null;
  allowRuntimeFallback?: boolean | null;
};

export type RuntimeCompositionBackendPolicy = {
  preferredBackendIds?: string[] | null;
  resolvedBackendId?: string | null;
};

export type RuntimeCompositionTrustPolicy = {
  requireVerifiedSignatures: boolean;
  allowDevOverrides: boolean;
  blockedPublishers?: string[] | null;
};

export type RuntimeCompositionObservabilityPolicy = {
  emitStableEvents: boolean;
  emitOtelAlignedTelemetry: boolean;
};

type RuntimeCompositionProfileNestedPolicyOverrides = {
  routePolicy?: Partial<RuntimeCompositionProfile["routePolicy"]>;
  backendPolicy?: Partial<RuntimeCompositionProfile["backendPolicy"]>;
  trustPolicy?: Partial<RuntimeCompositionProfile["trustPolicy"]>;
  observabilityPolicy?: Partial<RuntimeCompositionProfile["observabilityPolicy"]>;
};

export type RuntimeCompositionExecutionPolicy = {
  refs: string[];
};

export type RuntimeCompositionConfigLayer = {
  id: string;
  source: RuntimeCompositionConfigLayerSource;
  summary?: string | null;
};

export type RuntimeCompositionProfile = {
  id: string;
  name: string;
  scope: RuntimeCompositionProfileScope;
  enabled: boolean;
  pluginSelectors: RuntimeCompositionPluginSelector[];
  routePolicy: RuntimeCompositionRoutePolicy;
  backendPolicy: RuntimeCompositionBackendPolicy;
  trustPolicy: RuntimeCompositionTrustPolicy;
  executionPolicyRefs: string[];
  observabilityPolicy: RuntimeCompositionObservabilityPolicy;
  configLayers: RuntimeCompositionConfigLayer[];
};

export type RuntimeCompositionProfileLaunchOverride =
  RuntimeCompositionProfileNestedPolicyOverrides &
    Partial<
      Pick<RuntimeCompositionProfile, "pluginSelectors" | "executionPolicyRefs" | "configLayers">
    >;
