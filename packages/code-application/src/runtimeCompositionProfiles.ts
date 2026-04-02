import type { RuntimeCompositionProfile } from "@ku0/code-runtime-host-contract";

type RuntimeCompositionProfileNestedPolicyOverrides = {
  routePolicy?: Partial<RuntimeCompositionProfile["routePolicy"]>;
  backendPolicy?: Partial<RuntimeCompositionProfile["backendPolicy"]>;
  trustPolicy?: Partial<RuntimeCompositionProfile["trustPolicy"]>;
  observabilityPolicy?: Partial<RuntimeCompositionProfile["observabilityPolicy"]>;
};

export type RuntimeCompositionProfileLaunchOverride =
  RuntimeCompositionProfileNestedPolicyOverrides &
    Partial<
      Pick<RuntimeCompositionProfile, "pluginSelectors" | "executionPolicyRefs" | "configLayers">
    >;

export type RuntimeCompositionProfileUpdates = RuntimeCompositionProfileNestedPolicyOverrides &
  Partial<
    Omit<
      RuntimeCompositionProfile,
      "id" | "scope" | "routePolicy" | "backendPolicy" | "trustPolicy" | "observabilityPolicy"
    >
  >;

const DEFAULT_RUNTIME_COMPOSITION_PROFILES: RuntimeCompositionProfile[] = [
  {
    id: "built-in-default",
    name: "Built-in Default",
    scope: "built_in",
    enabled: true,
    pluginSelectors: [],
    routePolicy: {
      preferredRoutePluginIds: [],
      providerPreference: [],
      allowRuntimeFallback: true,
    },
    backendPolicy: {
      preferredBackendIds: [],
      resolvedBackendId: null,
    },
    trustPolicy: {
      requireVerifiedSignatures: true,
      allowDevOverrides: false,
      blockedPublishers: [],
    },
    executionPolicyRefs: ["built-in/runtime-default"],
    observabilityPolicy: {
      emitStableEvents: true,
      emitOtelAlignedTelemetry: true,
    },
    configLayers: [
      {
        id: "built-in-default",
        source: "built_in",
        summary: "Default control-plane baseline for all workspaces.",
      },
    ],
  },
  {
    id: "user-default",
    name: "User Default",
    scope: "user",
    enabled: true,
    pluginSelectors: [],
    routePolicy: {
      preferredRoutePluginIds: [],
      providerPreference: ["openai", "anthropic"],
      allowRuntimeFallback: true,
    },
    backendPolicy: {
      preferredBackendIds: ["backend-default"],
      resolvedBackendId: null,
    },
    trustPolicy: {
      requireVerifiedSignatures: true,
      allowDevOverrides: false,
      blockedPublishers: [],
    },
    executionPolicyRefs: ["user/default"],
    observabilityPolicy: {
      emitStableEvents: true,
      emitOtelAlignedTelemetry: true,
    },
    configLayers: [
      {
        id: "user-default",
        source: "user",
        summary: "User-level route and backend preference defaults.",
      },
    ],
  },
  {
    id: "workspace-default",
    name: "Workspace Default",
    scope: "workspace",
    enabled: true,
    pluginSelectors: [],
    routePolicy: {
      preferredRoutePluginIds: [],
      providerPreference: [],
      allowRuntimeFallback: true,
    },
    backendPolicy: {
      preferredBackendIds: ["backend-primary", "backend-fallback"],
      resolvedBackendId: null,
    },
    trustPolicy: {
      requireVerifiedSignatures: true,
      allowDevOverrides: false,
      blockedPublishers: [],
    },
    executionPolicyRefs: ["workspace/default"],
    observabilityPolicy: {
      emitStableEvents: true,
      emitOtelAlignedTelemetry: true,
    },
    configLayers: [
      {
        id: "workspace-default",
        source: "workspace",
        summary: "Workspace-level backend preference and trust defaults.",
      },
    ],
  },
];

export function cloneRuntimeCompositionProfile(
  profile: RuntimeCompositionProfile
): RuntimeCompositionProfile {
  return {
    ...profile,
    pluginSelectors: profile.pluginSelectors.map((selector) => ({ ...selector })),
    routePolicy: {
      ...profile.routePolicy,
      preferredRoutePluginIds: [...(profile.routePolicy.preferredRoutePluginIds ?? [])],
      providerPreference: [...(profile.routePolicy.providerPreference ?? [])],
    },
    backendPolicy: {
      ...profile.backendPolicy,
      preferredBackendIds: [...(profile.backendPolicy.preferredBackendIds ?? [])],
    },
    trustPolicy: {
      ...profile.trustPolicy,
      blockedPublishers: [...(profile.trustPolicy.blockedPublishers ?? [])],
    },
    executionPolicyRefs: [...profile.executionPolicyRefs],
    observabilityPolicy: { ...profile.observabilityPolicy },
    configLayers: profile.configLayers.map((layer) => ({ ...layer })),
  };
}

export function buildDefaultRuntimeCompositionProfiles(): RuntimeCompositionProfile[] {
  return DEFAULT_RUNTIME_COMPOSITION_PROFILES.map((profile) =>
    cloneRuntimeCompositionProfile(profile)
  );
}

export function mergeRuntimeCompositionProfiles(
  profiles: RuntimeCompositionProfile[],
  activeProfileId: string,
  launchOverride?: RuntimeCompositionProfileLaunchOverride | null
): RuntimeCompositionProfile {
  const fallbackProfiles = buildDefaultRuntimeCompositionProfiles();
  const builtIn = profiles.find((profile) => profile.scope === "built_in") ?? fallbackProfiles[0];
  const user = profiles.find((profile) => profile.scope === "user") ?? fallbackProfiles[1];
  const active =
    profiles.find((profile) => profile.id === activeProfileId) ??
    profiles.find((profile) => profile.scope === "workspace") ??
    fallbackProfiles[2];

  if (!builtIn || !user || !active) {
    throw new Error("Missing default runtime composition profiles.");
  }

  const launchLayers = launchOverride?.configLayers ?? [];

  return {
    ...cloneRuntimeCompositionProfile(builtIn),
    id: active.id,
    name: active.name,
    scope: active.scope,
    enabled: active.enabled,
    pluginSelectors: [
      ...builtIn.pluginSelectors,
      ...user.pluginSelectors,
      ...active.pluginSelectors,
      ...(launchOverride?.pluginSelectors ?? []),
    ],
    routePolicy: {
      ...builtIn.routePolicy,
      ...user.routePolicy,
      ...active.routePolicy,
      ...(launchOverride?.routePolicy ?? {}),
    },
    backendPolicy: {
      ...builtIn.backendPolicy,
      ...user.backendPolicy,
      ...active.backendPolicy,
      ...(launchOverride?.backendPolicy ?? {}),
    },
    trustPolicy: {
      ...builtIn.trustPolicy,
      ...user.trustPolicy,
      ...active.trustPolicy,
      ...(launchOverride?.trustPolicy ?? {}),
      blockedPublishers: [
        ...(builtIn.trustPolicy.blockedPublishers ?? []),
        ...(user.trustPolicy.blockedPublishers ?? []),
        ...(active.trustPolicy.blockedPublishers ?? []),
        ...(launchOverride?.trustPolicy?.blockedPublishers ?? []),
      ],
    },
    executionPolicyRefs: [
      ...builtIn.executionPolicyRefs,
      ...user.executionPolicyRefs,
      ...active.executionPolicyRefs,
      ...(launchOverride?.executionPolicyRefs ?? []),
    ],
    observabilityPolicy: {
      ...builtIn.observabilityPolicy,
      ...user.observabilityPolicy,
      ...active.observabilityPolicy,
      ...(launchOverride?.observabilityPolicy ?? {}),
    },
    configLayers: [
      ...builtIn.configLayers,
      ...user.configLayers,
      ...active.configLayers,
      ...launchLayers.map((layer: RuntimeCompositionProfile["configLayers"][number]) => ({
        ...layer,
        source: "launch_override" as const,
      })),
    ],
  };
}

export function applyRuntimeCompositionProfileUpdates(
  profile: RuntimeCompositionProfile,
  updates?: RuntimeCompositionProfileUpdates
): RuntimeCompositionProfile {
  if (!updates) {
    return cloneRuntimeCompositionProfile(profile);
  }

  const { id: _id, scope: _scope, ...safeUpdates } = updates as Partial<RuntimeCompositionProfile>;

  return {
    ...cloneRuntimeCompositionProfile(profile),
    ...safeUpdates,
    pluginSelectors: (safeUpdates.pluginSelectors ?? profile.pluginSelectors).map((selector) => ({
      ...selector,
    })),
    routePolicy: {
      ...profile.routePolicy,
      ...(safeUpdates.routePolicy ?? {}),
      preferredRoutePluginIds: [
        ...(safeUpdates.routePolicy?.preferredRoutePluginIds ??
          profile.routePolicy.preferredRoutePluginIds ??
          []),
      ],
      providerPreference: [
        ...(safeUpdates.routePolicy?.providerPreference ??
          profile.routePolicy.providerPreference ??
          []),
      ],
    },
    backendPolicy: {
      ...profile.backendPolicy,
      ...(safeUpdates.backendPolicy ?? {}),
      preferredBackendIds: [
        ...(safeUpdates.backendPolicy?.preferredBackendIds ??
          profile.backendPolicy.preferredBackendIds ??
          []),
      ],
    },
    trustPolicy: {
      ...profile.trustPolicy,
      ...(safeUpdates.trustPolicy ?? {}),
      blockedPublishers: [
        ...(safeUpdates.trustPolicy?.blockedPublishers ??
          profile.trustPolicy.blockedPublishers ??
          []),
      ],
    },
    executionPolicyRefs: [...(safeUpdates.executionPolicyRefs ?? profile.executionPolicyRefs)],
    observabilityPolicy: {
      ...profile.observabilityPolicy,
      ...(safeUpdates.observabilityPolicy ?? {}),
    },
    configLayers:
      safeUpdates.configLayers?.map((layer: RuntimeCompositionProfile["configLayers"][number]) => ({
        ...layer,
      })) ?? profile.configLayers,
  };
}
