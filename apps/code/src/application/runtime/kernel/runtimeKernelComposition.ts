import type {
  RuntimeCompositionBackendCandidate,
  RuntimeCompositionBlockedPlugin,
  RuntimeCompositionConfigLayer,
  RuntimeCompositionProfile,
  RuntimeCompositionResolution,
  RuntimeCompositionTrustPolicy,
  RuntimePluginTrustDecision,
  RuntimeRegistryPackageDescriptor,
} from "@ku0/code-runtime-host-contract";
import { readRuntimeKernelRoutingPluginMetadata } from "./runtimeKernelPlugins";
import type { RuntimeKernelPluginDescriptor } from "./runtimeKernelPlugins";
import {
  createRuntimeKernelPluginRegistryMetadata,
  normalizeRuntimeRegistryPackagePluginDescriptor,
  type RuntimeKernelPluginRegistryFacade,
} from "./runtimeKernelPluginRegistry";

const RUNTIME_KERNEL_PLUGIN_COMPOSITION_METADATA_KEY = "composition";

export type RuntimeKernelCompositionPreviewInput = {
  profileId?: string | null;
  launchOverride?: Partial<
    Pick<
      RuntimeCompositionProfile,
      | "pluginSelectors"
      | "routePolicy"
      | "backendPolicy"
      | "trustPolicy"
      | "executionPolicyRefs"
      | "observabilityPolicy"
      | "configLayers"
    >
  > | null;
};

export type RuntimeKernelCompositionApplyInput = {
  profileId: string;
  updates?: Partial<Omit<RuntimeCompositionProfile, "id" | "scope">>;
};

export type RuntimeKernelPluginCompositionMetadata = {
  activeProfileId: string | null;
  activeProfileName: string | null;
  selectedInActiveProfile: boolean;
  blockedInActiveProfile: boolean;
  blockedReason: string | null;
  selectedRouteCandidate: boolean;
  selectedBackendCandidateIds: string[];
  layerOrder: RuntimeCompositionConfigLayer["source"][];
};

export type RuntimeKernelCompositionFacade = {
  listProfiles: () => Promise<RuntimeCompositionProfile[]>;
  getProfile: (profileId: string) => Promise<RuntimeCompositionProfile | null>;
  previewResolution: (
    input?: RuntimeKernelCompositionPreviewInput
  ) => Promise<RuntimeCompositionResolution>;
  applyProfile: (
    input: RuntimeKernelCompositionApplyInput
  ) => Promise<RuntimeCompositionResolution>;
  getActiveResolution: () => Promise<RuntimeCompositionResolution>;
};

function cloneProfile(profile: RuntimeCompositionProfile): RuntimeCompositionProfile {
  return {
    ...profile,
    pluginSelectors: [...profile.pluginSelectors],
    routePolicy: { ...profile.routePolicy },
    backendPolicy: { ...profile.backendPolicy },
    trustPolicy: {
      ...profile.trustPolicy,
      blockedPublishers: [...(profile.trustPolicy.blockedPublishers ?? [])],
    },
    executionPolicyRefs: [...profile.executionPolicyRefs],
    observabilityPolicy: { ...profile.observabilityPolicy },
    configLayers: profile.configLayers.map((layer) => ({ ...layer })),
  };
}

function buildDefaultProfiles(): RuntimeCompositionProfile[] {
  return [
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
}

function mergeProfiles(
  profiles: RuntimeCompositionProfile[],
  activeProfileId: string,
  launchOverride?: RuntimeKernelCompositionPreviewInput["launchOverride"]
): RuntimeCompositionProfile {
  const builtIn =
    profiles.find((profile) => profile.scope === "built_in") ?? buildDefaultProfiles()[0];
  const user = profiles.find((profile) => profile.scope === "user") ?? buildDefaultProfiles()[1];
  const active =
    profiles.find((profile) => profile.id === activeProfileId) ??
    profiles.find((profile) => profile.scope === "workspace") ??
    buildDefaultProfiles()[2];

  const launchLayers = launchOverride?.configLayers ?? [];
  return {
    ...cloneProfile(builtIn),
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
      ...launchLayers.map((layer) => ({ ...layer, source: "launch_override" as const })),
    ],
  };
}

function matchesSelector(input: {
  plugin: RuntimeKernelPluginDescriptor;
  packageDescriptor: RuntimeRegistryPackageDescriptor | null;
  selector: RuntimeCompositionProfile["pluginSelectors"][number];
}): boolean {
  const routingMetadata = readRuntimeKernelRoutingPluginMetadata(input.plugin.metadata);
  switch (input.selector.matchBy) {
    case "pluginId":
      return input.plugin.id === input.selector.matchValue;
    case "packageRef":
      return input.packageDescriptor?.packageRef === input.selector.matchValue;
    case "source":
      return input.plugin.source === input.selector.matchValue;
    case "transport":
      return input.plugin.transport === input.selector.matchValue;
    case "routeKind":
      return routingMetadata?.routeKind === input.selector.matchValue;
    default:
      return false;
  }
}

function readPackageDescriptorForPlugin(input: {
  plugin: RuntimeKernelPluginDescriptor;
  registryPackages: RuntimeRegistryPackageDescriptor[];
}) {
  return (
    input.registryPackages.find((entry) => entry.installedPluginId === input.plugin.id) ??
    input.registryPackages.find(
      (entry) =>
        `pkg:${entry.packageRef}` === input.plugin.id ||
        entry.manifest.entry.pluginId === input.plugin.id
    ) ??
    null
  );
}

function isTrustAllowed(input: {
  trust: RuntimePluginTrustDecision;
  trustPolicy: RuntimeCompositionTrustPolicy;
  publisher: string | null;
}) {
  if (
    input.publisher &&
    (input.trustPolicy.blockedPublishers ?? []).some((publisher) => publisher === input.publisher)
  ) {
    return {
      allowed: false,
      reason: `Publisher ${input.publisher} is blocked by trust policy.`,
    };
  }
  if (input.trustPolicy.requireVerifiedSignatures && input.trust.status === "blocked") {
    return {
      allowed: false,
      reason: input.trust.blockedReason ?? "Plugin trust verification is blocked.",
    };
  }
  if (!input.trustPolicy.allowDevOverrides && input.trust.status === "dev_override") {
    return {
      allowed: false,
      reason: "Development trust overrides are disabled for the active profile.",
    };
  }
  return { allowed: true, reason: null };
}

function createCompositionMetadata(input: {
  pluginId: string;
  resolution: RuntimeCompositionResolution;
}): RuntimeKernelPluginCompositionMetadata {
  const blocked =
    input.resolution.blockedPlugins.find((entry) => entry.pluginId === input.pluginId) ?? null;
  const selected = input.resolution.selectedPlugins.some(
    (entry) => entry.pluginId === input.pluginId
  );
  const selectedRouteCandidate = input.resolution.selectedRouteCandidates.some(
    (entry) => entry.pluginId === input.pluginId
  );
  const selectedBackendCandidateIds = input.resolution.selectedBackendCandidates
    .filter((entry) => entry.sourcePluginId === input.pluginId)
    .map((entry) => entry.backendId);
  return {
    activeProfileId: input.resolution.provenance.activeProfileId,
    activeProfileName: input.resolution.provenance.activeProfileName ?? null,
    selectedInActiveProfile: selected,
    blockedInActiveProfile: blocked !== null,
    blockedReason: blocked?.reason ?? null,
    selectedRouteCandidate,
    selectedBackendCandidateIds,
    layerOrder: input.resolution.provenance.appliedLayerOrder,
  };
}

export function createRuntimeKernelPluginCompositionMetadata(
  pluginId: string,
  resolution: RuntimeCompositionResolution
): RuntimeKernelPluginCompositionMetadata {
  return createCompositionMetadata({
    pluginId,
    resolution,
  });
}

export function readRuntimeKernelPluginCompositionMetadata(
  metadata: Record<string, unknown> | null | undefined
): RuntimeKernelPluginCompositionMetadata | null {
  if (!metadata) {
    return null;
  }
  const value = metadata[RUNTIME_KERNEL_PLUGIN_COMPOSITION_METADATA_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as RuntimeKernelPluginCompositionMetadata;
}

export function createRuntimeKernelCompositionFacade(input: {
  workspaceId: string;
  pluginCatalog: {
    listPlugins: () => Promise<RuntimeKernelPluginDescriptor[]>;
  };
  pluginRegistry: RuntimeKernelPluginRegistryFacade;
  seedProfiles?: RuntimeCompositionProfile[];
}): RuntimeKernelCompositionFacade {
  const profiles = new Map(
    (input.seedProfiles ?? buildDefaultProfiles()).map(
      (profile) => [profile.id, cloneProfile(profile)] as const
    )
  );
  let activeProfileId =
    [...profiles.values()].find((profile) => profile.scope === "workspace")?.id ??
    "workspace-default";

  async function resolveComposition(
    previewInput?: RuntimeKernelCompositionPreviewInput
  ): Promise<RuntimeCompositionResolution> {
    const runtimePlugins = await input.pluginCatalog.listPlugins();
    const registryPackages = await input.pluginRegistry.listInstalledPackages();
    const registryPlugins = registryPackages
      .filter((entry) => entry.source !== "runtime_managed")
      .map((entry) => normalizeRuntimeRegistryPackagePluginDescriptor(entry));
    const plugins = [...runtimePlugins];
    for (const registryPlugin of registryPlugins) {
      if (plugins.some((plugin) => plugin.id === registryPlugin.id)) {
        continue;
      }
      plugins.push(registryPlugin);
    }
    const effectiveProfile = mergeProfiles(
      [...profiles.values()],
      previewInput?.profileId ?? activeProfileId,
      previewInput?.launchOverride ?? null
    );
    const selectorDecisions: Record<string, string> = {};
    const selectedPlugins: RuntimeCompositionResolution["selectedPlugins"] = [];
    const blockedPlugins: RuntimeCompositionBlockedPlugin[] = [];
    const trustDecisions: RuntimePluginTrustDecision[] = [];

    for (const plugin of plugins) {
      const packageDescriptor = readPackageDescriptorForPlugin({
        plugin,
        registryPackages,
      });
      const selector = effectiveProfile.pluginSelectors.find((candidate) =>
        matchesSelector({
          plugin,
          packageDescriptor,
          selector: candidate,
        })
      );
      if (selector) {
        selectorDecisions[plugin.id] = selector.action;
      }
      if (selector?.action === "exclude") {
        blockedPlugins.push({
          pluginId: plugin.id,
          packageRef: packageDescriptor?.packageRef ?? null,
          reason:
            selector.reason ??
            `Plugin \`${plugin.id}\` was excluded by the active composition profile.`,
          stage: "selector",
        });
        continue;
      }

      const trust = packageDescriptor?.trust ?? {
        status: "runtime_managed",
        verificationStatus: "runtime_managed",
        publisher: "runtime",
        attestationSource: "runtime",
        blockedReason: null,
        packageRef: packageDescriptor?.packageRef ?? `runtime://${plugin.id}`,
        pluginId: plugin.id,
      };
      trustDecisions.push(trust);
      const trustCheck = isTrustAllowed({
        trust,
        trustPolicy: effectiveProfile.trustPolicy,
        publisher: packageDescriptor?.publisher ?? null,
      });
      if (!trustCheck.allowed) {
        blockedPlugins.push({
          pluginId: plugin.id,
          packageRef: packageDescriptor?.packageRef ?? null,
          reason: trustCheck.reason ?? "Plugin trust requirements are not satisfied.",
          stage: "trust",
        });
        continue;
      }

      if (packageDescriptor?.compatibility.status === "incompatible") {
        blockedPlugins.push({
          pluginId: plugin.id,
          packageRef: packageDescriptor.packageRef,
          reason:
            packageDescriptor.compatibility.blockers?.[0] ??
            "Plugin compatibility requirements are not satisfied.",
          stage: "compatibility",
        });
        continue;
      }

      selectedPlugins.push({
        pluginId: plugin.id,
        packageRef: packageDescriptor?.packageRef ?? null,
        source: plugin.source,
        reason: selector?.reason ?? null,
      });
    }

    const routePlugins = plugins.filter(
      (plugin) =>
        selectedPlugins.some((selection) => selection.pluginId === plugin.id) &&
        readRuntimeKernelRoutingPluginMetadata(plugin.metadata) !== null
    );
    const preferredRouteIds = effectiveProfile.routePolicy.preferredRoutePluginIds ?? [];
    const sortedRoutePlugins = [...routePlugins].sort((left, right) => {
      const leftPreferred = preferredRouteIds.indexOf(left.id);
      const rightPreferred = preferredRouteIds.indexOf(right.id);
      if (leftPreferred !== -1 || rightPreferred !== -1) {
        if (leftPreferred === -1) {
          return 1;
        }
        if (rightPreferred === -1) {
          return -1;
        }
        return leftPreferred - rightPreferred;
      }
      return left.id.localeCompare(right.id);
    });
    const selectedRouteCandidates = sortedRoutePlugins.map((plugin) => {
      const routingMetadata = readRuntimeKernelRoutingPluginMetadata(plugin.metadata);
      return {
        pluginId: plugin.id,
        routeKind: routingMetadata?.routeKind ?? null,
        providerId: routingMetadata?.providerId ?? null,
        preferredBackendIds: routingMetadata?.preferredBackendIds ?? null,
        resolvedBackendId: routingMetadata?.resolvedBackendId ?? null,
      };
    });
    const backendCandidates = new Map<string, RuntimeCompositionBackendCandidate>();
    for (const backendId of effectiveProfile.backendPolicy.preferredBackendIds ?? []) {
      backendCandidates.set(backendId, {
        backendId,
        sourcePluginId: null,
      });
    }
    for (const route of selectedRouteCandidates) {
      for (const backendId of route.preferredBackendIds ?? []) {
        backendCandidates.set(backendId, {
          backendId,
          sourcePluginId: route.pluginId,
        });
      }
      if (route.resolvedBackendId) {
        backendCandidates.set(route.resolvedBackendId, {
          backendId: route.resolvedBackendId,
          sourcePluginId: route.pluginId,
        });
      }
    }
    if (effectiveProfile.backendPolicy.resolvedBackendId) {
      backendCandidates.set(effectiveProfile.backendPolicy.resolvedBackendId, {
        backendId: effectiveProfile.backendPolicy.resolvedBackendId,
        sourcePluginId: null,
      });
    }

    return {
      selectedPlugins,
      selectedRouteCandidates,
      selectedBackendCandidates: [...backendCandidates.values()],
      blockedPlugins,
      trustDecisions,
      provenance: {
        activeProfileId: effectiveProfile.id,
        activeProfileName: effectiveProfile.name,
        appliedLayerOrder: ["built_in", "user", "workspace", "launch_override"],
        selectorDecisions,
      },
    };
  }

  return {
    listProfiles: async () => [...profiles.values()].map((profile) => cloneProfile(profile)),
    getProfile: async (profileId) => {
      const profile = profiles.get(profileId);
      return profile ? cloneProfile(profile) : null;
    },
    previewResolution: (previewInput) => resolveComposition(previewInput),
    applyProfile: async (applyInput) => {
      const current = profiles.get(applyInput.profileId);
      if (!current) {
        throw new Error(`Unknown runtime composition profile \`${applyInput.profileId}\`.`);
      }
      profiles.set(applyInput.profileId, {
        ...cloneProfile(current),
        ...applyInput.updates,
        pluginSelectors: applyInput.updates?.pluginSelectors ?? current.pluginSelectors,
        routePolicy: {
          ...current.routePolicy,
          ...(applyInput.updates?.routePolicy ?? {}),
        },
        backendPolicy: {
          ...current.backendPolicy,
          ...(applyInput.updates?.backendPolicy ?? {}),
        },
        trustPolicy: {
          ...current.trustPolicy,
          ...(applyInput.updates?.trustPolicy ?? {}),
        },
        executionPolicyRefs: applyInput.updates?.executionPolicyRefs ?? current.executionPolicyRefs,
        observabilityPolicy: {
          ...current.observabilityPolicy,
          ...(applyInput.updates?.observabilityPolicy ?? {}),
        },
        configLayers: applyInput.updates?.configLayers ?? current.configLayers,
      });
      activeProfileId = applyInput.profileId;
      return resolveComposition();
    },
    getActiveResolution: () => resolveComposition(),
  };
}

export function attachRuntimeKernelCompositionMetadata(input: {
  plugins: RuntimeKernelPluginDescriptor[];
  resolution: RuntimeCompositionResolution | null;
}) {
  const resolution = input.resolution;
  if (!resolution) {
    return input.plugins;
  }
  return input.plugins.map((plugin) => ({
    ...plugin,
    metadata: {
      ...(plugin.metadata ?? {}),
      [RUNTIME_KERNEL_PLUGIN_COMPOSITION_METADATA_KEY]:
        createRuntimeKernelPluginCompositionMetadata(plugin.id, resolution),
    },
  }));
}

export function attachRuntimeKernelRegistryMetadataToPlugin(input: {
  plugin: RuntimeKernelPluginDescriptor;
  packageDescriptor: RuntimeRegistryPackageDescriptor;
}) {
  return {
    ...input.plugin,
    metadata: {
      ...(input.plugin.metadata ?? {}),
      pluginRegistry: createRuntimeKernelPluginRegistryMetadata(input.packageDescriptor),
    },
  };
}
