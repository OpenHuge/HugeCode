import {
  RUNTIME_COMPOSITION_APPLIED_LAYER_ORDER,
  type RuntimeCompositionBackendCandidate,
  type RuntimeCompositionBlockedPlugin,
  type RuntimeCompositionConfigLayer,
  type RuntimeCompositionPluginEntryV2,
  type RuntimeCompositionProfile,
  type RuntimeCompositionProfileSummaryV2,
  type RuntimeCompositionResolution,
  type RuntimeCompositionResolveV2Response,
  type RuntimeCompositionTrustPolicy,
  type RuntimeHostBindingDescriptor,
  type RuntimeHostBindingDiagnostic,
  type RuntimeHostBindingState,
  type RuntimeHostPublicationState,
  type RuntimePluginCompatibility,
  type RuntimePluginTrustDecision,
  type RuntimeRegistryPackageDescriptor,
} from "@ku0/code-runtime-host-contract";
import {
  applyRuntimeCompositionProfileUpdates,
  buildDefaultRuntimeCompositionProfiles,
  cloneRuntimeCompositionProfile,
  mergeRuntimeCompositionProfiles,
  type RuntimeCompositionProfileLaunchOverride,
  type RuntimeCompositionProfileUpdates,
} from "@ku0/code-application";
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
  launchOverride?: RuntimeCompositionProfileLaunchOverride | null;
};

export type RuntimeKernelCompositionApplyInput = {
  profileId: string;
  updates?: RuntimeCompositionProfileUpdates;
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
  bindingState?: RuntimeHostBindingState;
  publicationState?: RuntimeHostPublicationState;
  trustStatus?: RuntimePluginTrustDecision["status"];
  compatibilityStatus?: RuntimePluginCompatibility["status"];
  bindingDiagnostics?: RuntimeHostBindingDiagnostic[];
};

export type RuntimeKernelCompositionFacade = {
  listProfiles: () => Promise<RuntimeCompositionProfile[]>;
  listProfilesV2: () => Promise<RuntimeCompositionProfileSummaryV2[]>;
  getProfile: (profileId: string) => Promise<RuntimeCompositionProfile | null>;
  getProfileV2: (profileId: string) => Promise<RuntimeCompositionProfileSummaryV2 | null>;
  previewResolution: (
    input?: RuntimeKernelCompositionPreviewInput
  ) => Promise<RuntimeCompositionResolution>;
  previewResolutionV2: (
    input?: RuntimeKernelCompositionPreviewInput
  ) => Promise<RuntimeCompositionResolveV2Response>;
  applyProfile: (
    input: RuntimeKernelCompositionApplyInput
  ) => Promise<RuntimeCompositionResolution>;
  applyProfileV2: (
    input: RuntimeKernelCompositionApplyInput
  ) => Promise<RuntimeCompositionResolveV2Response>;
  getActiveResolution: () => Promise<RuntimeCompositionResolution>;
  getActiveResolutionV2: () => Promise<RuntimeCompositionResolveV2Response>;
};

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

function createDefaultTrustDecision(input: {
  pluginId: string;
  packageRef: string | null;
}): RuntimePluginTrustDecision {
  return {
    status: "runtime_managed",
    verificationStatus: "runtime_managed",
    publisher: "runtime",
    attestationSource: "runtime",
    blockedReason: null,
    packageRef: input.packageRef ?? `runtime://${input.pluginId}`,
    pluginId: input.pluginId,
  };
}

function createDefaultCompatibility(): RuntimePluginCompatibility {
  return {
    status: "compatible",
    minimumHostContractVersion: null,
    supportedRuntimeProtocolVersions: [],
    supportedCapabilityKeys: [],
    optionalTransportFeatures: [],
    blockers: [],
  };
}

function createBindingDiagnostics(input: {
  plugin: RuntimeKernelPluginDescriptor;
  blocked: RuntimeCompositionBlockedPlugin | null;
  bindingState: RuntimeHostBindingState;
  publicationState: RuntimeHostPublicationState;
}): RuntimeHostBindingDiagnostic[] {
  if (input.blocked) {
    return [
      {
        code: `${input.blocked.stage}_blocked`,
        severity: "error",
        summary: input.blocked.reason,
        detail: input.plugin.operations.execution.reason,
      },
    ];
  }

  if (input.plugin.binding.state === "declaration_only") {
    return [
      {
        code: "declaration_only",
        severity: "info",
        summary:
          input.plugin.operations.execution.reason ??
          `Plugin \`${input.plugin.id}\` is declaration-only and not published into the live runtime.`,
      },
    ];
  }

  if (input.bindingState === "unbound") {
    return [
      {
        code: "unbound",
        severity: "warning",
        summary:
          input.plugin.operations.execution.reason ??
          `Plugin \`${input.plugin.id}\` is not yet bound into the live runtime catalog.`,
      },
    ];
  }

  if (input.publicationState === "hidden" && input.plugin.operations.execution.reason) {
    return [
      {
        code: "hidden",
        severity: "info",
        summary: input.plugin.operations.execution.reason,
      },
    ];
  }

  return [];
}

function resolveBindingAndPublicationState(input: {
  plugin: RuntimeKernelPluginDescriptor;
  blocked: RuntimeCompositionBlockedPlugin | null;
}): {
  bindingState: RuntimeHostBindingState;
  publicationState: RuntimeHostPublicationState;
} {
  if (input.blocked?.stage === "trust" || input.blocked?.stage === "compatibility") {
    return {
      bindingState: "blocked",
      publicationState: "blocked",
    };
  }

  if (input.blocked !== null) {
    return {
      bindingState: input.plugin.binding.state === "bound" ? "bound" : "unbound",
      publicationState: "blocked",
    };
  }

  if (input.plugin.binding.state === "declaration_only") {
    return {
      bindingState: "unbound",
      publicationState: "declaration_only",
    };
  }

  if (input.plugin.binding.state !== "bound") {
    return {
      bindingState: "unbound",
      publicationState: "hidden",
    };
  }

  if (input.plugin.health?.state === "degraded") {
    return {
      bindingState: "degraded",
      publicationState: "hidden",
    };
  }

  return {
    bindingState: "bound",
    publicationState: input.plugin.operations.execution.executable ? "published" : "hidden",
  };
}

function createBindingDescriptor(input: {
  plugin: RuntimeKernelPluginDescriptor;
  packageDescriptor: RuntimeRegistryPackageDescriptor | null;
  blocked: RuntimeCompositionBlockedPlugin | null;
}): RuntimeHostBindingDescriptor {
  const states = resolveBindingAndPublicationState({
    plugin: input.plugin,
    blocked: input.blocked,
  });
  const diagnostics = createBindingDiagnostics({
    plugin: input.plugin,
    blocked: input.blocked,
    bindingState: states.bindingState,
    publicationState: states.publicationState,
  });
  return {
    pluginId: input.plugin.id,
    packageRef: input.packageDescriptor?.packageRef ?? null,
    source: input.plugin.source,
    bindingState: states.bindingState,
    publicationState: states.publicationState,
    contractFormat: input.plugin.binding.contractFormat,
    contractBoundary: input.plugin.binding.contractBoundary,
    interfaceId: input.plugin.binding.interfaceId,
    rawBindingState: input.plugin.binding.state,
    executable: input.plugin.operations.execution.executable,
    reason: input.blocked?.reason ?? input.plugin.operations.execution.reason,
    diagnostics,
    contractSurfaces: input.plugin.binding.surfaces,
  };
}

function createCompositionMetadata(input: {
  pluginId: string;
  resolution: RuntimeCompositionResolution;
  snapshot?: RuntimeCompositionResolveV2Response | null;
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
  const pluginEntry = input.snapshot?.pluginEntries.find(
    (entry) => entry.pluginId === input.pluginId
  );
  return {
    activeProfileId: input.resolution.provenance.activeProfileId,
    activeProfileName: input.resolution.provenance.activeProfileName ?? null,
    selectedInActiveProfile: selected,
    blockedInActiveProfile: blocked !== null,
    blockedReason: blocked?.reason ?? null,
    selectedRouteCandidate,
    selectedBackendCandidateIds,
    layerOrder: input.resolution.provenance.appliedLayerOrder,
    bindingState: pluginEntry?.bindingState,
    publicationState: pluginEntry?.publicationState,
    trustStatus: pluginEntry?.trustStatus,
    compatibilityStatus: pluginEntry?.compatibilityStatus,
    bindingDiagnostics: pluginEntry?.bindingDiagnostics ?? [],
  };
}

export function createRuntimeKernelPluginCompositionMetadata(
  pluginId: string,
  resolution: RuntimeCompositionResolution,
  snapshot?: RuntimeCompositionResolveV2Response | null
): RuntimeKernelPluginCompositionMetadata {
  return createCompositionMetadata({
    pluginId,
    resolution,
    snapshot,
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
    (input.seedProfiles ?? buildDefaultRuntimeCompositionProfiles()).map(
      (profile) => [profile.id, cloneRuntimeCompositionProfile(profile)] as const
    )
  );
  let activeProfileId =
    [...profiles.values()].find((profile) => profile.scope === "workspace")?.id ??
    "workspace-default";

  async function resolveCompositionState(
    previewInput?: RuntimeKernelCompositionPreviewInput
  ): Promise<{
    resolution: RuntimeCompositionResolution;
    snapshot: RuntimeCompositionResolveV2Response;
  }> {
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
    const effectiveProfile = mergeRuntimeCompositionProfiles(
      [...profiles.values()],
      previewInput?.profileId ?? activeProfileId,
      previewInput?.launchOverride ?? null
    );
    const selectorDecisions: Record<string, string> = {};
    const selectedPlugins: RuntimeCompositionResolution["selectedPlugins"] = [];
    const blockedPlugins: RuntimeCompositionBlockedPlugin[] = [];
    const trustDecisions: RuntimePluginTrustDecision[] = [];
    const pluginEntries = new Map<
      string,
      {
        plugin: RuntimeKernelPluginDescriptor;
        packageDescriptor: RuntimeRegistryPackageDescriptor | null;
        trust: RuntimePluginTrustDecision;
        compatibility: RuntimePluginCompatibility;
        blocked: RuntimeCompositionBlockedPlugin | null;
        selectedReason: string | null;
      }
    >();

    for (const plugin of plugins) {
      const packageDescriptor = readPackageDescriptorForPlugin({
        plugin,
        registryPackages,
      });
      const selector = effectiveProfile.pluginSelectors.find(
        (candidate: RuntimeCompositionProfile["pluginSelectors"][number]) =>
          matchesSelector({
            plugin,
            packageDescriptor,
            selector: candidate,
          })
      );
      if (selector) {
        selectorDecisions[plugin.id] = selector.action;
      }
      let blocked: RuntimeCompositionBlockedPlugin | null = null;

      if (selector?.action === "exclude") {
        blocked = {
          pluginId: plugin.id,
          packageRef: packageDescriptor?.packageRef ?? null,
          reason:
            selector.reason ??
            `Plugin \`${plugin.id}\` was excluded by the active composition profile.`,
          stage: "selector",
        };
        blockedPlugins.push(blocked);
      }

      const trust =
        packageDescriptor?.trust ??
        createDefaultTrustDecision({
          pluginId: plugin.id,
          packageRef: packageDescriptor?.packageRef ?? null,
        });
      const compatibility = packageDescriptor?.compatibility ?? createDefaultCompatibility();
      trustDecisions.push(trust);
      if (blocked === null) {
        const trustCheck = isTrustAllowed({
          trust,
          trustPolicy: effectiveProfile.trustPolicy,
          publisher: packageDescriptor?.publisher ?? null,
        });
        if (!trustCheck.allowed) {
          blocked = {
            pluginId: plugin.id,
            packageRef: packageDescriptor?.packageRef ?? null,
            reason: trustCheck.reason ?? "Plugin trust requirements are not satisfied.",
            stage: "trust",
          };
          blockedPlugins.push(blocked);
        }
      }

      if (blocked === null && compatibility.status === "incompatible") {
        blocked = {
          pluginId: plugin.id,
          packageRef: packageDescriptor?.packageRef ?? null,
          reason:
            compatibility.blockers?.[0] ?? "Plugin compatibility requirements are not satisfied.",
          stage: "compatibility",
        };
        blockedPlugins.push(blocked);
      }

      if (blocked === null) {
        selectedPlugins.push({
          pluginId: plugin.id,
          packageRef: packageDescriptor?.packageRef ?? null,
          source: plugin.source,
          reason: selector?.reason ?? null,
        });
      }

      pluginEntries.set(plugin.id, {
        plugin,
        packageDescriptor,
        trust,
        compatibility,
        blocked,
        selectedReason: selector?.reason ?? null,
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

    const resolution = {
      selectedPlugins,
      selectedRouteCandidates,
      selectedBackendCandidates: [...backendCandidates.values()],
      blockedPlugins,
      trustDecisions,
      provenance: {
        activeProfileId: effectiveProfile.id,
        activeProfileName: effectiveProfile.name,
        appliedLayerOrder: [...RUNTIME_COMPOSITION_APPLIED_LAYER_ORDER],
        selectorDecisions,
      },
    };
    const routeCandidatesByPluginId = new Map(
      selectedRouteCandidates.map((entry) => [entry.pluginId, entry] as const)
    );
    const backendCandidatesByPluginId = new Map<string, RuntimeCompositionBackendCandidate[]>();
    for (const candidate of resolution.selectedBackendCandidates) {
      if (!candidate.sourcePluginId) {
        continue;
      }
      const existing = backendCandidatesByPluginId.get(candidate.sourcePluginId) ?? [];
      existing.push(candidate);
      backendCandidatesByPluginId.set(candidate.sourcePluginId, existing);
    }

    const snapshot: RuntimeCompositionResolveV2Response = {
      activeProfile: cloneRuntimeCompositionProfile(effectiveProfile),
      provenance: resolution.provenance,
      pluginEntries: [...pluginEntries.values()]
        .map((entry): RuntimeCompositionPluginEntryV2 => {
          const bindingDescriptor = createBindingDescriptor({
            plugin: entry.plugin,
            packageDescriptor: entry.packageDescriptor,
            blocked: entry.blocked,
          });
          return {
            pluginId: entry.plugin.id,
            source: entry.plugin.source,
            packageRef: entry.packageDescriptor?.packageRef ?? null,
            installed: entry.packageDescriptor?.installed ?? false,
            trust: entry.trust,
            trustStatus: entry.trust.status,
            compatibility: entry.compatibility,
            compatibilityStatus: entry.compatibility.status,
            bindingState: bindingDescriptor.bindingState,
            publicationState: bindingDescriptor.publicationState,
            selectedInActiveProfile: selectedPlugins.some(
              (selection) => selection.pluginId === entry.plugin.id
            ),
            blockedReason: entry.blocked?.reason ?? null,
            selectedReason: entry.selectedReason,
            routeCandidate: routeCandidatesByPluginId.has(entry.plugin.id),
            selectedRouteCandidate: routeCandidatesByPluginId.get(entry.plugin.id) ?? null,
            backendCandidateIds: (backendCandidatesByPluginId.get(entry.plugin.id) ?? []).map(
              (candidate) => candidate.backendId
            ),
            backendCandidates: backendCandidatesByPluginId.get(entry.plugin.id) ?? [],
            bindingDescriptor,
            bindingDiagnostics: bindingDescriptor.diagnostics ?? [],
            registryPackage: entry.packageDescriptor,
          };
        })
        .sort((left, right) => left.pluginId.localeCompare(right.pluginId)),
      selectedRouteCandidates: resolution.selectedRouteCandidates,
      selectedBackendCandidates: resolution.selectedBackendCandidates,
      blockedPlugins: resolution.blockedPlugins,
      trustDecisions: resolution.trustDecisions,
    };

    return {
      resolution,
      snapshot,
    };
  }

  return {
    listProfiles: async () =>
      [...profiles.values()].map((profile) => cloneRuntimeCompositionProfile(profile)),
    listProfilesV2: async () =>
      [...profiles.values()].map((profile) => ({
        id: profile.id,
        name: profile.name,
        scope: profile.scope,
        enabled: profile.enabled,
        active: profile.id === activeProfileId,
      })),
    getProfile: async (profileId) => {
      const profile = profiles.get(profileId);
      return profile ? cloneRuntimeCompositionProfile(profile) : null;
    },
    getProfileV2: async (profileId) => {
      const profile = profiles.get(profileId);
      if (!profile) {
        return null;
      }
      return {
        id: profile.id,
        name: profile.name,
        scope: profile.scope,
        enabled: profile.enabled,
        active: profile.id === activeProfileId,
      };
    },
    previewResolution: async (previewInput) =>
      (await resolveCompositionState(previewInput)).resolution,
    previewResolutionV2: async (previewInput) =>
      (await resolveCompositionState(previewInput)).snapshot,
    applyProfile: async (applyInput) => {
      const current = profiles.get(applyInput.profileId);
      if (!current) {
        throw new Error(`Unknown runtime composition profile \`${applyInput.profileId}\`.`);
      }
      profiles.set(
        applyInput.profileId,
        applyRuntimeCompositionProfileUpdates(current, applyInput.updates)
      );
      activeProfileId = applyInput.profileId;
      return (await resolveCompositionState()).resolution;
    },
    applyProfileV2: async (applyInput) => {
      const current = profiles.get(applyInput.profileId);
      if (!current) {
        throw new Error(`Unknown runtime composition profile \`${applyInput.profileId}\`.`);
      }
      profiles.set(
        applyInput.profileId,
        applyRuntimeCompositionProfileUpdates(current, applyInput.updates)
      );
      activeProfileId = applyInput.profileId;
      return (await resolveCompositionState()).snapshot;
    },
    getActiveResolution: async () => (await resolveCompositionState()).resolution,
    getActiveResolutionV2: async () => (await resolveCompositionState()).snapshot,
  };
}

export function attachRuntimeKernelCompositionMetadata(input: {
  plugins: RuntimeKernelPluginDescriptor[];
  resolution: RuntimeCompositionResolution | null;
  snapshot?: RuntimeCompositionResolveV2Response | null;
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
        createRuntimeKernelPluginCompositionMetadata(plugin.id, resolution, input.snapshot),
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
