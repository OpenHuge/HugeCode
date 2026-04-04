import type {
  RuntimeCompositionProfile,
  RuntimeCompositionResolution,
  RuntimePluginCompatibility,
  RuntimePluginPackageTransport,
  RuntimePluginTrustDecision,
  RuntimePluginTrustDecisionStatus,
  RuntimeRegistryPackageDescriptor,
} from "@ku0/code-runtime-host-contract";

const RUNTIME_CONTROL_PLANE_PLUGIN_REGISTRY_METADATA_KEY = "pluginRegistry";
const RUNTIME_CONTROL_PLANE_PLUGIN_COMPOSITION_METADATA_KEY = "composition";

type RuntimeControlPlaneCompositionAuthorityState = "published" | "stale" | "unavailable";
type RuntimeControlPlaneBindingState = "unbound" | "binding" | "bound" | "degraded" | "blocked";
type RuntimeControlPlanePublicationState = "hidden" | "declaration_only" | "published" | "blocked";
type RuntimeControlPlaneBindingDiagnostic = {
  code: string;
  severity: "info" | "warning" | "error";
  summary: string;
  detail?: string | null;
};

export type RuntimeControlPlanePluginRegistryMetadata = {
  packageRef: string;
  transport: RuntimePluginPackageTransport;
  source: RuntimeRegistryPackageDescriptor["source"];
  installed: boolean;
  installedPluginId: string | null;
  publisher: string | null;
  trust: RuntimePluginTrustDecision;
  compatibility: RuntimePluginCompatibility;
};

export type RuntimeControlPlanePluginCompositionMetadata = {
  activeProfileId: string | null;
  activeProfileName: string | null;
  authorityState?: RuntimeControlPlaneCompositionAuthorityState;
  authorityRevision?: number | null;
  selectedInActiveProfile: boolean;
  blockedInActiveProfile: boolean;
  blockedReason: string | null;
  selectedRouteCandidate: boolean;
  selectedBackendCandidateIds: string[];
  layerOrder: RuntimeCompositionResolution["provenance"]["appliedLayerOrder"];
  bindingState?: RuntimeControlPlaneBindingState;
  publicationState?: RuntimeControlPlanePublicationState;
  trustStatus?: RuntimePluginTrustDecisionStatus;
  compatibilityStatus?: RuntimePluginCompatibility["status"];
  bindingDiagnostics?: RuntimeControlPlaneBindingDiagnostic[];
};

export type RuntimeControlPlanePluginDescriptor = {
  id: string;
  name: string;
  summary: string | null;
  source: string;
  transport: string;
  runtimeBacked: boolean;
  metadata: Record<string, unknown> | null;
};

export type RuntimeControlPlaneOperatorActionKind =
  | "install"
  | "install_with_dev_override"
  | "update"
  | "uninstall"
  | "preview_profile"
  | "apply_profile";

export type RuntimeControlPlaneOperatorActionTone = "primary" | "neutral" | "warning" | "danger";

export type RuntimeControlPlaneOperatorAction = {
  id: string;
  kind: RuntimeControlPlaneOperatorActionKind;
  label: string;
  detail: string | null;
  tone: RuntimeControlPlaneOperatorActionTone;
  disabledReason: string | null;
  packageRef: string | null;
  pluginId: string | null;
  profileId: string | null;
};

export type RuntimeControlPlanePluginInventoryItem = {
  id: string;
  label: string;
  summary: string | null;
  source: string;
  transport: string;
  selectedInActiveProfile: boolean;
  blockedInActiveProfile: boolean;
  statusLabel: string;
  stateSummary: string;
  attentionReason: string | null;
  installState: "installed" | "catalog_only" | "runtime_managed";
  trustStatus: RuntimePluginTrustDecisionStatus | "unknown";
  compatibilityStatus: "compatible" | "incompatible" | "unknown";
  bindingState: "unbound" | "binding" | "bound" | "degraded" | "blocked" | "unknown";
  publicationState: "hidden" | "declaration_only" | "published" | "blocked" | "unknown";
  registry: RuntimeControlPlanePluginRegistryMetadata | null;
  composition: RuntimeControlPlanePluginCompositionMetadata | null;
  actions: RuntimeControlPlaneOperatorAction[];
};

export type RuntimeControlPlaneProfileItem = {
  id: string;
  label: string;
  scope: RuntimeCompositionProfile["scope"];
  enabled: boolean;
  active: boolean;
  summary: string;
  actions: RuntimeControlPlaneOperatorAction[];
};

export type RuntimeControlPlaneOperatorModel = {
  counts: {
    needsAction: number;
    selectedNow: number;
    inventory: number;
    profiles: number;
  };
  needsAction: RuntimeControlPlanePluginInventoryItem[];
  selectedNow: RuntimeControlPlanePluginInventoryItem[];
  inventory: RuntimeControlPlanePluginInventoryItem[];
  profiles: RuntimeControlPlaneProfileItem[];
};

function readOptionalText(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function readRuntimeControlPlanePluginRegistryMetadata(
  metadata: Record<string, unknown> | null | undefined
): RuntimeControlPlanePluginRegistryMetadata | null {
  if (!metadata) {
    return null;
  }
  const value = metadata[RUNTIME_CONTROL_PLANE_PLUGIN_REGISTRY_METADATA_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as RuntimeControlPlanePluginRegistryMetadata;
}

export function readRuntimeControlPlanePluginCompositionMetadata(
  metadata: Record<string, unknown> | null | undefined
): RuntimeControlPlanePluginCompositionMetadata | null {
  if (!metadata) {
    return null;
  }
  const value = metadata[RUNTIME_CONTROL_PLANE_PLUGIN_COMPOSITION_METADATA_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as RuntimeControlPlanePluginCompositionMetadata;
}

function getCompatibilityBlocker(
  registry: RuntimeControlPlanePluginRegistryMetadata | null
): string | null {
  const blockers = registry?.compatibility.blockers ?? [];
  return blockers.find((entry) => typeof entry === "string" && entry.trim().length > 0) ?? null;
}

function buildInstallDisabledReason(input: {
  registry: RuntimeControlPlanePluginRegistryMetadata;
}): string | null {
  if (input.registry.trust.status === "blocked") {
    return (
      readOptionalText(input.registry.trust.blockedReason) ??
      "Package trust requirements are not satisfied."
    );
  }
  if (input.registry.compatibility.status === "incompatible") {
    return (
      getCompatibilityBlocker(input.registry) ??
      "Package compatibility requirements are not satisfied."
    );
  }
  return null;
}

function buildPluginStatusLabel(input: {
  plugin: RuntimeControlPlanePluginDescriptor;
  registry: RuntimeControlPlanePluginRegistryMetadata | null;
  composition: RuntimeControlPlanePluginCompositionMetadata | null;
}): string {
  if (input.composition?.authorityState === "unavailable") {
    return "Authority unavailable";
  }
  if (input.composition?.authorityState === "stale") {
    return "Authority stale";
  }
  if (
    input.composition?.publicationState === "blocked" ||
    input.composition?.bindingState === "blocked"
  ) {
    return "Blocked";
  }
  if (input.composition?.publicationState === "published") {
    return "Published";
  }
  if (input.composition?.publicationState === "declaration_only") {
    return "Declared";
  }
  if (input.composition?.bindingState === "degraded") {
    return "Degraded";
  }
  if (input.composition?.bindingState === "bound") {
    return "Bound";
  }
  if (input.registry?.installed && input.composition?.bindingState === "unbound") {
    return "Installed, unbound";
  }
  if (input.registry?.installed) {
    return "Installed";
  }
  if (input.registry?.source === "catalog") {
    return "Available";
  }
  if (input.plugin.runtimeBacked) {
    return "Runtime";
  }
  return "Inventory";
}

function buildPluginStateSummary(input: {
  registry: RuntimeControlPlanePluginRegistryMetadata | null;
  composition: RuntimeControlPlanePluginCompositionMetadata | null;
}): string {
  const authorityState = input.composition?.authorityState ?? "unknown";
  const installState =
    input.registry?.source === "runtime_managed"
      ? "runtime-managed"
      : input.registry?.installed
        ? "installed"
        : "catalog-only";
  const trustState = input.composition?.trustStatus ?? input.registry?.trust.status ?? "unknown";
  const compatibilityState =
    input.composition?.compatibilityStatus ?? input.registry?.compatibility.status ?? "unknown";
  const bindingState = input.composition?.bindingState ?? "unknown";
  const publicationState = input.composition?.publicationState ?? "unknown";
  return `Authority ${authorityState} | Install ${installState} | Trust ${trustState} | Compatibility ${compatibilityState} | Bind ${bindingState} | Publish ${publicationState}`;
}

function buildPluginAttentionReason(input: {
  registry: RuntimeControlPlanePluginRegistryMetadata | null;
  composition: RuntimeControlPlanePluginCompositionMetadata | null;
}): string | null {
  return (
    (input.composition?.authorityState === "unavailable"
      ? "Runtime composition authority has not published a workspace snapshot yet."
      : input.composition?.authorityState === "stale"
        ? "Runtime composition authority rejected the latest local snapshot as stale."
        : null) ??
    readOptionalText(input.composition?.blockedReason) ??
    readOptionalText(input.registry?.trust.blockedReason) ??
    getCompatibilityBlocker(input.registry)
  );
}

function buildPluginActions(input: {
  plugin: RuntimeControlPlanePluginDescriptor;
  registry: RuntimeControlPlanePluginRegistryMetadata | null;
  activeProfile: RuntimeCompositionProfile | null;
}): RuntimeControlPlaneOperatorAction[] {
  const actions: RuntimeControlPlaneOperatorAction[] = [];
  const registry = input.registry;
  if (!registry || registry.source === "runtime_managed") {
    return actions;
  }

  const baseId = registry.installedPluginId ?? input.plugin.id;
  const installDisabledReason = buildInstallDisabledReason({ registry });

  if (!registry.installed) {
    if (registry.publisher === "local-dev" && registry.trust.status === "blocked") {
      actions.push({
        id: `${baseId}:install-with-dev-override`,
        kind: "install_with_dev_override",
        label: "Install with dev trust override",
        detail: "Allow an unsigned local-dev package for this workspace profile.",
        tone: "warning",
        disabledReason: input.activeProfile?.trustPolicy.allowDevOverrides
          ? null
          : "The active composition profile does not allow development trust overrides.",
        packageRef: registry.packageRef,
        pluginId: registry.installedPluginId ?? input.plugin.id,
        profileId: input.activeProfile?.id ?? null,
      });
    } else {
      actions.push({
        id: `${baseId}:install`,
        kind: "install",
        label: "Install",
        detail: "Install this package into the runtime plugin registry.",
        tone: "primary",
        disabledReason: installDisabledReason,
        packageRef: registry.packageRef,
        pluginId: registry.installedPluginId ?? input.plugin.id,
        profileId: null,
      });
    }
    return actions;
  }

  actions.push({
    id: `${baseId}:update`,
    kind: "update",
    label: "Check for update",
    detail: "Refresh this installed package against the current registry catalog.",
    tone: "neutral",
    disabledReason: null,
    packageRef: registry.packageRef,
    pluginId: registry.installedPluginId ?? input.plugin.id,
    profileId: null,
  });

  actions.push({
    id: `${baseId}:uninstall`,
    kind: "uninstall",
    label: "Uninstall",
    detail: "Remove this installed package from the runtime plugin registry.",
    tone: "danger",
    disabledReason: null,
    packageRef: registry.packageRef,
    pluginId: registry.installedPluginId ?? input.plugin.id,
    profileId: null,
  });

  return actions;
}

function countsAsNeedsAction(item: RuntimeControlPlanePluginInventoryItem) {
  if (item.blockedInActiveProfile || item.attentionReason !== null) {
    return true;
  }

  return item.actions.some(
    (action) => action.kind === "install" || action.kind === "install_with_dev_override"
  );
}

function compareInventoryItems(
  left: RuntimeControlPlanePluginInventoryItem,
  right: RuntimeControlPlanePluginInventoryItem
) {
  if (left.blockedInActiveProfile !== right.blockedInActiveProfile) {
    return left.blockedInActiveProfile ? -1 : 1;
  }
  if (left.selectedInActiveProfile !== right.selectedInActiveProfile) {
    return left.selectedInActiveProfile ? -1 : 1;
  }
  return left.label.localeCompare(right.label);
}

function buildPluginInventoryItem(input: {
  plugin: RuntimeControlPlanePluginDescriptor;
  activeProfile: RuntimeCompositionProfile | null;
}): RuntimeControlPlanePluginInventoryItem {
  const registry = readRuntimeControlPlanePluginRegistryMetadata(input.plugin.metadata);
  const composition = readRuntimeControlPlanePluginCompositionMetadata(input.plugin.metadata);
  return {
    id: input.plugin.id,
    label: input.plugin.name,
    summary:
      readOptionalText(input.plugin.summary) ?? readOptionalText(registry?.packageRef) ?? null,
    source: input.plugin.source,
    transport: input.plugin.transport,
    selectedInActiveProfile: composition?.selectedInActiveProfile === true,
    blockedInActiveProfile: composition?.blockedInActiveProfile === true,
    statusLabel: buildPluginStatusLabel({
      plugin: input.plugin,
      registry,
      composition,
    }),
    stateSummary: buildPluginStateSummary({
      registry,
      composition,
    }),
    attentionReason: buildPluginAttentionReason({ registry, composition }),
    installState:
      registry?.source === "runtime_managed"
        ? "runtime_managed"
        : registry?.installed
          ? "installed"
          : "catalog_only",
    trustStatus: composition?.trustStatus ?? registry?.trust.status ?? "unknown",
    compatibilityStatus:
      composition?.compatibilityStatus ?? registry?.compatibility.status ?? "unknown",
    bindingState: composition?.bindingState ?? "unknown",
    publicationState: composition?.publicationState ?? "unknown",
    registry,
    composition,
    actions: buildPluginActions({
      plugin: input.plugin,
      registry,
      activeProfile: input.activeProfile,
    }),
  };
}

function buildProfileSummary(input: {
  profile: RuntimeCompositionProfile;
  resolution: RuntimeCompositionResolution | null;
  active: boolean;
}): string {
  if (input.active && input.resolution) {
    return `Selected plugins ${input.resolution.selectedPlugins.length}, blocked ${input.resolution.blockedPlugins.length}, routes ${input.resolution.selectedRouteCandidates.length}, backends ${input.resolution.selectedBackendCandidates.length}.`;
  }
  if (!input.profile.enabled) {
    return "Profile is disabled and cannot be applied until it is enabled.";
  }
  return "Preview the resulting plugin selection or apply this profile as the active control-plane policy.";
}

function buildProfileActions(input: {
  profile: RuntimeCompositionProfile;
  activeProfileId: string | null;
}): RuntimeControlPlaneOperatorAction[] {
  const active = input.profile.id === input.activeProfileId;
  return [
    {
      id: `profile:${input.profile.id}:preview`,
      kind: "preview_profile",
      label: active ? "Preview active profile" : "Preview profile",
      detail: "Resolve plugin, route, backend, and trust outcomes without applying changes.",
      tone: "neutral",
      disabledReason: null,
      packageRef: null,
      pluginId: null,
      profileId: input.profile.id,
    },
    {
      id: `profile:${input.profile.id}:apply`,
      kind: "apply_profile",
      label: active ? "Active profile" : "Apply profile",
      detail: "Promote this composition profile into the active runtime control plane.",
      tone: "primary",
      disabledReason: active
        ? "This composition profile is already active."
        : input.profile.enabled
          ? null
          : "Only enabled composition profiles can be applied.",
      packageRef: null,
      pluginId: null,
      profileId: input.profile.id,
    },
  ];
}

function compareProfiles(
  left: RuntimeControlPlaneProfileItem,
  right: RuntimeControlPlaneProfileItem
) {
  if (left.active !== right.active) {
    return left.active ? -1 : 1;
  }
  return left.label.localeCompare(right.label);
}

export function buildRuntimeControlPlaneOperatorModel(input: {
  plugins: RuntimeControlPlanePluginDescriptor[];
  profiles: RuntimeCompositionProfile[];
  activeProfile: RuntimeCompositionProfile | null;
  activeProfileId: string | null;
  resolution: RuntimeCompositionResolution | null;
}): RuntimeControlPlaneOperatorModel {
  const inventory = input.plugins
    .map((plugin) =>
      buildPluginInventoryItem({
        plugin,
        activeProfile: input.activeProfile,
      })
    )
    .sort(compareInventoryItems);
  const needsAction = inventory.filter(countsAsNeedsAction);
  const selectedNow = inventory.filter((item) => item.selectedInActiveProfile);
  const profiles = input.profiles
    .map((profile) => ({
      id: profile.id,
      label: profile.name,
      scope: profile.scope,
      enabled: profile.enabled,
      active: profile.id === input.activeProfileId,
      summary: buildProfileSummary({
        profile,
        resolution: input.resolution,
        active: profile.id === input.activeProfileId,
      }),
      actions: buildProfileActions({
        profile,
        activeProfileId: input.activeProfileId,
      }),
    }))
    .sort(compareProfiles);

  return {
    counts: {
      needsAction: needsAction.length,
      selectedNow: selectedNow.length,
      inventory: inventory.length,
      profiles: profiles.length,
    },
    needsAction,
    selectedNow,
    inventory,
    profiles,
  };
}
