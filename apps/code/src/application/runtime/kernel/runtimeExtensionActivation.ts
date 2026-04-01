import {
  CODE_RUNTIME_RPC_CONTRACT_VERSION,
  type LiveSkillSummary,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeRegistryPackageDescriptor } from "@ku0/code-runtime-host-contract";
import type {
  RuntimeKernelPluginInstallRequest,
  RuntimeKernelPluginRegistryFacade,
  RuntimeKernelPluginVerifyResult,
} from "./runtimeKernelPluginRegistry";
import type { RuntimeKernelPluginCatalogFacade } from "./runtimeKernelPlugins";
import type { RuntimeKernelPluginDescriptor } from "./runtimeKernelPluginTypes";
import type {
  RuntimeWorkspaceSkillManifest,
  RuntimeWorkspaceSkillManifestCompatibility,
} from "./runtimeWorkspaceSkillManifests";

export type RuntimeExtensionActivationState =
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

export type RuntimeExtensionActivationReadinessState = "ready" | "attention" | "blocked";

export type RuntimeExtensionActivationRefreshMode = "cache_only" | "full";

export type RuntimeExtensionContributionKind =
  | "invocation"
  | "skill"
  | "hook"
  | "resource"
  | "route"
  | "policy"
  | "subagent_role"
  | "host_binding";

export type RuntimeExtensionContributionBindingStage =
  | "compile_time_descriptor"
  | "runtime_binding"
  | "session_overlay";

export type RuntimeExtensionActivationSourceType =
  | "runtime_plugin"
  | "behavior_asset"
  | "registry_package"
  | "session_overlay";

export type RuntimeExtensionActivationSourceScope =
  | "runtime"
  | "workspace"
  | "package"
  | "session_overlay"
  | "host";

export type RuntimeExtensionActivationDiagnosticPhase =
  | "discover"
  | "verify"
  | "install"
  | "bind"
  | "activate"
  | "refresh"
  | "deactivate"
  | "uninstall";

export type RuntimeExtensionActivationDiagnosticSeverity = "info" | "warning" | "error";

export type RuntimeExtensionActivationDiagnostic = {
  phase: RuntimeExtensionActivationDiagnosticPhase;
  severity: RuntimeExtensionActivationDiagnosticSeverity;
  code: string;
  message: string;
  at: number;
};

export type RuntimeExtensionActivationTransition = {
  state: RuntimeExtensionActivationState;
  at: number;
  reason: string;
};

export type RuntimeExtensionContributionDescriptor = {
  id: string;
  kind: RuntimeExtensionContributionKind;
  sourceId: string;
  title: string;
  bindingStage: RuntimeExtensionContributionBindingStage;
  active: boolean;
  metadata: Record<string, unknown> | null;
};

export type RuntimeExtensionActivationReadiness = {
  state: RuntimeExtensionActivationReadinessState;
  summary: string;
  detail: string;
};

export type RuntimeBehaviorAssetBinding = {
  bindingState: "bound" | "declaration_only";
  liveDescriptorId: string | null;
  runtimeSkillId: string | null;
  reason: string | null;
};

export type RuntimeBehaviorAssetDescriptor = {
  assetId: string;
  sourceId: string;
  sourceScope: "workspace" | "session_overlay";
  name: string;
  version: string;
  kind: RuntimeWorkspaceSkillManifest["kind"];
  trustLevel: RuntimeWorkspaceSkillManifest["trustLevel"];
  entrypoint: string | null;
  manifestPath: string | null;
  permissions: string[];
  compatibility: RuntimeWorkspaceSkillManifestCompatibility;
  compileState: "compiled" | "degraded" | "failed";
  readiness: RuntimeExtensionActivationReadiness;
  runtimeBinding: RuntimeBehaviorAssetBinding;
  diagnostics: RuntimeExtensionActivationDiagnostic[];
  contributions: RuntimeExtensionContributionDescriptor[];
};

export type RuntimeBehaviorAssetInput = Omit<RuntimeWorkspaceSkillManifest, "manifestPath"> & {
  manifestPath?: string | null;
  contributionHints?: Partial<{
    hooks: string[];
    resources: string[];
    routes: string[];
    policies: string[];
    subagentRoles: string[];
    hostBindings: string[];
  }>;
};

export type RuntimeExtensionActivationRecord = {
  activationId: string;
  sourceType: RuntimeExtensionActivationSourceType;
  sourceScope: RuntimeExtensionActivationSourceScope;
  sourceRef: string;
  pluginId: string | null;
  packageRef: string | null;
  overlayId: string | null;
  sessionId: string | null;
  name: string;
  version: string;
  state: RuntimeExtensionActivationState;
  readiness: RuntimeExtensionActivationReadiness;
  diagnostics: RuntimeExtensionActivationDiagnostic[];
  contributions: RuntimeExtensionContributionDescriptor[];
  transitionHistory: RuntimeExtensionActivationTransition[];
  metadata: Record<string, unknown> | null;
};

export type RuntimeExtensionActivationSnapshot = {
  workspaceId: string;
  sessionId: string | null;
  refreshMode: RuntimeExtensionActivationRefreshMode;
  refreshedAt: number;
  records: RuntimeExtensionActivationRecord[];
  activeContributions: RuntimeExtensionContributionDescriptor[];
  summary: {
    total: number;
    active: number;
    degraded: number;
    failed: number;
    deactivated: number;
    refreshPending: number;
    uninstalled: number;
  };
};

export type RuntimeExtensionActivationService = {
  readSnapshot: (input?: {
    sessionId?: string | null;
  }) => Promise<RuntimeExtensionActivationSnapshot>;
  refresh: (input?: {
    sessionId?: string | null;
    mode?: RuntimeExtensionActivationRefreshMode;
  }) => Promise<RuntimeExtensionActivationSnapshot>;
  activate: (input: {
    activationId: string;
    sessionId?: string | null;
  }) => Promise<RuntimeExtensionActivationSnapshot>;
  deactivate: (input: {
    activationId: string;
    sessionId?: string | null;
  }) => Promise<RuntimeExtensionActivationSnapshot>;
  retryActivation: (input: {
    activationId: string;
    sessionId?: string | null;
  }) => Promise<RuntimeExtensionActivationSnapshot>;
  verifyPackage: (
    packageRefOrManifest: string | RuntimeRegistryPackageDescriptor["manifest"]
  ) => Promise<RuntimeKernelPluginVerifyResult>;
  installPackage: (
    input: RuntimeKernelPluginInstallRequest & { sessionId?: string | null }
  ) => Promise<RuntimeExtensionActivationSnapshot>;
  uninstall: (input: {
    activationId: string;
    sessionId?: string | null;
  }) => Promise<RuntimeExtensionActivationSnapshot>;
  upsertSessionOverlay: (input: {
    sessionId: string;
    overlayId: string;
    asset: RuntimeBehaviorAssetInput;
  }) => Promise<RuntimeExtensionActivationSnapshot>;
  removeSessionOverlay: (input: {
    sessionId: string;
    overlayId: string;
  }) => Promise<RuntimeExtensionActivationSnapshot>;
};

type RuntimeExtensionActivationDependencies = {
  workspaceId: string;
  pluginCatalog: Pick<RuntimeKernelPluginCatalogFacade, "listPlugins">;
  pluginRegistry: Pick<
    RuntimeKernelPluginRegistryFacade,
    | "listInstalledPackages"
    | "verifyPackage"
    | "installPackage"
    | "uninstallPackage"
    | "updatePackage"
  >;
  readWorkspaceSkillManifests: (workspaceId: string) => Promise<RuntimeWorkspaceSkillManifest[]>;
  listRuntimeLiveSkills: () => Promise<LiveSkillSummary[]>;
  now?: () => number;
  runtimeVersion?: string;
  appVersion?: string;
};

type DiscoveredActivationSources = {
  plugins: RuntimeKernelPluginDescriptor[];
  installedPackages: RuntimeRegistryPackageDescriptor[];
  workspaceSkillManifests: RuntimeWorkspaceSkillManifest[];
  runtimeLiveSkills: LiveSkillSummary[];
};

type SessionOverlayStore = Map<string, RuntimeBehaviorAssetInput>;

type ActivationMutationState = {
  deactivatedActivationIds: Set<string>;
  tombstones: Map<string, RuntimeExtensionActivationRecord>;
};

function compareVersion(left: string, right: string): number {
  const leftParts = left.split(".").map((entry) => Number.parseInt(entry, 10) || 0);
  const rightParts = right.split(".").map((entry) => Number.parseInt(entry, 10) || 0);
  const limit = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < limit; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

function createDiagnostic(
  at: number,
  phase: RuntimeExtensionActivationDiagnosticPhase,
  severity: RuntimeExtensionActivationDiagnosticSeverity,
  code: string,
  message: string
): RuntimeExtensionActivationDiagnostic {
  return {
    phase,
    severity,
    code,
    message,
    at,
  };
}

function buildTransitionHistory(
  at: number,
  states: Array<{ state: RuntimeExtensionActivationState; reason: string }>
): RuntimeExtensionActivationTransition[] {
  return states.map((entry) => ({
    state: entry.state,
    at,
    reason: entry.reason,
  }));
}

function createReadiness(
  state: RuntimeExtensionActivationReadinessState,
  summary: string,
  detail: string
): RuntimeExtensionActivationReadiness {
  return {
    state,
    summary,
    detail,
  };
}

function readContributionHints(manifest: RuntimeBehaviorAssetInput): {
  hooks: string[];
  resources: string[];
  routes: string[];
  policies: string[];
  subagentRoles: string[];
  hostBindings: string[];
} {
  return {
    hooks: manifest.contributionHints?.hooks ?? [],
    resources: manifest.contributionHints?.resources ?? [],
    routes: manifest.contributionHints?.routes ?? [],
    policies: manifest.contributionHints?.policies ?? [],
    subagentRoles: manifest.contributionHints?.subagentRoles ?? [],
    hostBindings: manifest.contributionHints?.hostBindings ?? [],
  };
}

function buildBehaviorAssetContributionDescriptors(input: {
  manifest: RuntimeBehaviorAssetInput;
  sourceId: string;
  sourceScope: RuntimeBehaviorAssetDescriptor["sourceScope"];
  runtimeBound: boolean;
  runtimeSkill?: LiveSkillSummary | null;
}): RuntimeExtensionContributionDescriptor[] {
  const bindingStage: RuntimeExtensionContributionBindingStage =
    input.sourceScope === "session_overlay"
      ? "session_overlay"
      : input.runtimeBound
        ? "runtime_binding"
        : "compile_time_descriptor";
  const contributions: RuntimeExtensionContributionDescriptor[] = [];
  if (input.manifest.kind === "skill") {
    contributions.push({
      id: input.manifest.id,
      kind: "skill",
      sourceId: input.sourceId,
      title: input.manifest.name,
      bindingStage,
      active: false,
      metadata: {
        entrypoint: input.manifest.entrypoint,
        source: input.sourceScope,
        kind: input.manifest.kind,
        tags: [],
        runtimeSkillId: input.runtimeSkill?.id ?? null,
        aliases: input.runtimeSkill?.aliases ?? [],
      },
    });
    contributions.push({
      id: `${input.manifest.id}:invoke`,
      kind: "invocation",
      sourceId: input.sourceId,
      title: `${input.manifest.name} invocation`,
      bindingStage,
      active: false,
      metadata: {
        skillId: input.manifest.id,
        source: input.sourceScope,
        kind: input.manifest.kind,
        tags: [],
        runtimeSkillId: input.runtimeSkill?.id ?? null,
        aliases: input.runtimeSkill?.aliases ?? [],
      },
    });
  }
  if (input.manifest.permissions.length > 0) {
    contributions.push({
      id: `${input.manifest.id}:policy`,
      kind: "policy",
      sourceId: input.sourceId,
      title: `${input.manifest.name} permissions`,
      bindingStage: "compile_time_descriptor",
      active: false,
      metadata: {
        permissions: input.manifest.permissions,
      },
    });
  }
  const contributionHints = readContributionHints(input.manifest);
  for (const hookId of contributionHints.hooks) {
    contributions.push({
      id: `${input.manifest.id}:hook:${hookId}`,
      kind: "hook",
      sourceId: input.sourceId,
      title: hookId,
      bindingStage,
      active: false,
      metadata: null,
    });
  }
  for (const resourceId of contributionHints.resources) {
    contributions.push({
      id: `${input.manifest.id}:resource:${resourceId}`,
      kind: "resource",
      sourceId: input.sourceId,
      title: resourceId,
      bindingStage,
      active: false,
      metadata: null,
    });
  }
  for (const routeId of contributionHints.routes) {
    contributions.push({
      id: `${input.manifest.id}:route:${routeId}`,
      kind: "route",
      sourceId: input.sourceId,
      title: routeId,
      bindingStage,
      active: false,
      metadata: null,
    });
  }
  for (const policyId of contributionHints.policies) {
    contributions.push({
      id: `${input.manifest.id}:policy:${policyId}`,
      kind: "policy",
      sourceId: input.sourceId,
      title: policyId,
      bindingStage: "compile_time_descriptor",
      active: false,
      metadata: null,
    });
  }
  for (const subagentRole of contributionHints.subagentRoles) {
    contributions.push({
      id: `${input.manifest.id}:subagent_role:${subagentRole}`,
      kind: "subagent_role",
      sourceId: input.sourceId,
      title: subagentRole,
      bindingStage,
      active: false,
      metadata: null,
    });
  }
  for (const hostBindingId of contributionHints.hostBindings) {
    contributions.push({
      id: `${input.manifest.id}:host_binding:${hostBindingId}`,
      kind: "host_binding",
      sourceId: input.sourceId,
      title: hostBindingId,
      bindingStage,
      active: false,
      metadata: null,
    });
  }
  return contributions;
}

export function compileRuntimeBehaviorAsset(input: {
  manifest: RuntimeBehaviorAssetInput;
  runtimeSkill?: LiveSkillSummary | null;
  sourceScope: RuntimeBehaviorAssetDescriptor["sourceScope"];
  runtimeVersion?: string;
  appVersion?: string;
  overlayId?: string | null;
  sessionId?: string | null;
  now?: () => number;
}): RuntimeBehaviorAssetDescriptor {
  const at = input.now?.() ?? Date.now();
  const runtimeVersion = input.runtimeVersion ?? CODE_RUNTIME_RPC_CONTRACT_VERSION;
  const appVersion = input.appVersion ?? CODE_RUNTIME_RPC_CONTRACT_VERSION;
  const sourceId =
    input.sourceScope === "workspace"
      ? `behavior:workspace:${input.manifest.id}`
      : `overlay:${input.sessionId ?? "session"}:${input.overlayId ?? input.manifest.id}`;
  const diagnostics: RuntimeExtensionActivationDiagnostic[] = [];
  const compatibility = input.manifest.compatibility;
  let compileState: RuntimeBehaviorAssetDescriptor["compileState"] = "compiled";
  let readiness = createReadiness(
    "ready",
    "Behavior asset is compiled and runtime-usable.",
    "This asset can publish live contributions immediately."
  );
  let runtimeBinding: RuntimeBehaviorAssetBinding;

  if (compareVersion(runtimeVersion, compatibility.minRuntime) < 0) {
    compileState = "failed";
    diagnostics.push(
      createDiagnostic(
        at,
        "verify",
        "error",
        "runtime_version_unsupported",
        `Requires runtime ${compatibility.minRuntime} or newer; current runtime is ${runtimeVersion}.`
      )
    );
  }
  if (compatibility.maxRuntime && compareVersion(runtimeVersion, compatibility.maxRuntime) > 0) {
    compileState = "failed";
    diagnostics.push(
      createDiagnostic(
        at,
        "verify",
        "error",
        "runtime_version_too_new",
        `Supports runtime up to ${compatibility.maxRuntime}; current runtime is ${runtimeVersion}.`
      )
    );
  }
  if (compatibility.minApp && compareVersion(appVersion, compatibility.minApp) < 0) {
    compileState = "failed";
    diagnostics.push(
      createDiagnostic(
        at,
        "verify",
        "error",
        "app_version_unsupported",
        `Requires app ${compatibility.minApp} or newer; current app is ${appVersion}.`
      )
    );
  }
  if (compileState === "failed") {
    readiness = createReadiness(
      "blocked",
      "Behavior asset failed compatibility verification.",
      diagnostics[0]?.message ?? "Asset verification failed."
    );
    runtimeBinding = {
      bindingState: "declaration_only",
      liveDescriptorId: null,
      runtimeSkillId: null,
      reason: readiness.detail,
    };
  } else if (input.sourceScope === "session_overlay") {
    runtimeBinding = {
      bindingState: "bound",
      liveDescriptorId: input.manifest.id,
      runtimeSkillId: input.runtimeSkill?.id ?? null,
      reason: null,
    };
  } else if (input.manifest.kind === "skill" && !input.runtimeSkill) {
    compileState = "degraded";
    const message =
      "Workspace manifest is present, but runtime has not published the live skill yet.";
    diagnostics.push(createDiagnostic(at, "bind", "warning", "binding_unavailable", message));
    readiness = createReadiness("attention", "Behavior asset is declaration-only.", message);
    runtimeBinding = {
      bindingState: "declaration_only",
      liveDescriptorId: null,
      runtimeSkillId: null,
      reason: message,
    };
  } else if (input.runtimeSkill && !input.runtimeSkill.enabled) {
    compileState = "degraded";
    const message = "Runtime published the live skill, but it is currently disabled.";
    diagnostics.push(
      createDiagnostic(at, "activate", "warning", "runtime_skill_disabled", message)
    );
    readiness = createReadiness(
      "attention",
      "Behavior asset is bound but disabled in runtime.",
      message
    );
    runtimeBinding = {
      bindingState: "bound",
      liveDescriptorId: input.runtimeSkill.id,
      runtimeSkillId: input.runtimeSkill.id,
      reason: message,
    };
  } else {
    runtimeBinding = {
      bindingState: "bound",
      liveDescriptorId: input.runtimeSkill?.id ?? input.manifest.id,
      runtimeSkillId: input.runtimeSkill?.id ?? null,
      reason: null,
    };
  }

  return {
    assetId: input.manifest.id,
    sourceId,
    sourceScope: input.sourceScope,
    name: input.manifest.name,
    version: input.manifest.version,
    kind: input.manifest.kind,
    trustLevel: input.manifest.trustLevel,
    entrypoint: input.manifest.entrypoint,
    manifestPath: input.manifest.manifestPath ?? null,
    permissions: input.manifest.permissions,
    compatibility: input.manifest.compatibility,
    compileState,
    readiness,
    runtimeBinding,
    diagnostics,
    contributions: buildBehaviorAssetContributionDescriptors({
      manifest: input.manifest,
      sourceId,
      sourceScope: input.sourceScope,
      runtimeBound: runtimeBinding.bindingState === "bound",
      runtimeSkill: input.runtimeSkill ?? null,
    }),
  };
}

function cloneContribution(
  contribution: RuntimeExtensionContributionDescriptor,
  active: boolean
): RuntimeExtensionContributionDescriptor {
  return {
    ...contribution,
    active,
  };
}

function normalizePluginContributions(
  plugin: RuntimeKernelPluginDescriptor,
  activationId: string
): RuntimeExtensionContributionDescriptor[] {
  const contributions: RuntimeExtensionContributionDescriptor[] = [];
  const pluginAliases = Array.isArray(plugin.metadata?.aliases)
    ? plugin.metadata.aliases.filter((value): value is string => typeof value === "string")
    : [];
  if (plugin.source === "live_skill") {
    contributions.push({
      id: plugin.id,
      kind: "skill",
      sourceId: activationId,
      title: plugin.name,
      bindingStage: "runtime_binding",
      active: false,
      metadata: {
        source: plugin.metadata?.source ?? "runtime",
        kind: plugin.metadata?.kind ?? "runtime_skill",
        tags: plugin.capabilities.map((capability) => capability.id),
        runtimeSkillId: plugin.id,
        aliases: pluginAliases,
      },
    });
    contributions.push({
      id: `${plugin.id}:invoke`,
      kind: "invocation",
      sourceId: activationId,
      title: `${plugin.name} invocation`,
      bindingStage: "runtime_binding",
      active: false,
      metadata: {
        skillId: plugin.id,
        source: plugin.metadata?.source ?? "runtime",
        kind: plugin.metadata?.kind ?? "runtime_skill",
        tags: plugin.capabilities.map((capability) => capability.id),
        runtimeSkillId: plugin.id,
        aliases: pluginAliases,
      },
    });
  }
  for (const capability of plugin.capabilities) {
    contributions.push({
      id: `${plugin.id}:invocation:${capability.id}`,
      kind: "invocation",
      sourceId: activationId,
      title: capability.id,
      bindingStage: "runtime_binding",
      active: false,
      metadata: {
        enabled: capability.enabled,
      },
    });
  }
  for (const resource of plugin.resources) {
    contributions.push({
      id: `${plugin.id}:resource:${resource.id}`,
      kind: "resource",
      sourceId: activationId,
      title: resource.id,
      bindingStage: "runtime_binding",
      active: false,
      metadata: {
        contentType: resource.contentType,
      },
    });
  }
  if (
    plugin.source === "provider_route" ||
    plugin.source === "backend_route" ||
    plugin.source === "execution_route"
  ) {
    contributions.push({
      id: `${plugin.id}:route`,
      kind: "route",
      sourceId: activationId,
      title: plugin.name,
      bindingStage: "runtime_binding",
      active: false,
      metadata: plugin.metadata,
    });
  }
  if (plugin.source === "wasi_host" || plugin.source === "rpc_host") {
    contributions.push({
      id: `${plugin.id}:host_binding`,
      kind: "host_binding",
      sourceId: activationId,
      title: plugin.name,
      bindingStage: "runtime_binding",
      active: false,
      metadata: plugin.metadata,
    });
  }
  if (plugin.permissions.length > 0) {
    contributions.push({
      id: `${plugin.id}:policy`,
      kind: "policy",
      sourceId: activationId,
      title: `${plugin.name} permissions`,
      bindingStage: "runtime_binding",
      active: false,
      metadata: {
        permissions: plugin.permissions,
      },
    });
  }
  const hookIds = Array.isArray(plugin.metadata?.hooks)
    ? plugin.metadata?.hooks.filter((value): value is string => typeof value === "string")
    : [];
  for (const hookId of hookIds) {
    contributions.push({
      id: `${plugin.id}:hook:${hookId}`,
      kind: "hook",
      sourceId: activationId,
      title: hookId,
      bindingStage: "runtime_binding",
      active: false,
      metadata: null,
    });
  }
  const roleIds = Array.isArray(plugin.metadata?.subagentRoles)
    ? plugin.metadata?.subagentRoles.filter((value): value is string => typeof value === "string")
    : [];
  for (const roleId of roleIds) {
    contributions.push({
      id: `${plugin.id}:subagent_role:${roleId}`,
      kind: "subagent_role",
      sourceId: activationId,
      title: roleId,
      bindingStage: "runtime_binding",
      active: false,
      metadata: null,
    });
  }
  return contributions;
}

function buildPluginRecord(input: {
  plugin: RuntimeKernelPluginDescriptor;
  at: number;
  refreshMode: RuntimeExtensionActivationRefreshMode;
  deactivated: boolean;
  packageDescriptor?: RuntimeRegistryPackageDescriptor | null;
  sessionId: string | null;
}): RuntimeExtensionActivationRecord {
  const { plugin } = input;
  const activationId = `plugin:${plugin.id}`;
  const diagnostics: RuntimeExtensionActivationDiagnostic[] = [];
  const historyStates: Array<{ state: RuntimeExtensionActivationState; reason: string }> = [];
  if (input.refreshMode === "full") {
    historyStates.push({
      state: "refresh_pending",
      reason: "Full refresh is rebuilding activation truth.",
    });
  }
  historyStates.push({
    state: "discovered",
    reason: "Runtime published this plugin during discovery.",
  });
  historyStates.push({
    state: "verified",
    reason: "Plugin metadata passed runtime-facing verification.",
  });
  historyStates.push({
    state: "installed",
    reason: "Plugin is present in runtime-managed inventory.",
  });

  let state: RuntimeExtensionActivationState;
  let readiness: RuntimeExtensionActivationReadiness;
  if (input.deactivated || !plugin.enabled) {
    diagnostics.push(
      createDiagnostic(
        input.at,
        "deactivate",
        "info",
        "activation_deactivated",
        "Activation is currently disabled."
      )
    );
    state = "deactivated";
    readiness = createReadiness(
      "attention",
      "Activation is deactivated.",
      "Enable it to restore live contributions."
    );
  } else if (input.packageDescriptor?.trust.status === "blocked") {
    diagnostics.push(
      createDiagnostic(
        input.at,
        "verify",
        "error",
        "trust_blocked",
        input.packageDescriptor.trust.blockedReason ?? "Package trust verification is blocked."
      )
    );
    state = "failed";
    readiness = createReadiness(
      "blocked",
      "Trust verification failed.",
      diagnostics[0]?.message ?? "Trust blocked."
    );
  } else if (input.packageDescriptor?.compatibility.status === "incompatible") {
    diagnostics.push(
      createDiagnostic(
        input.at,
        "verify",
        "error",
        "compatibility_blocked",
        input.packageDescriptor.compatibility.blockers?.[0] ??
          "Package compatibility blocks activation on this runtime."
      )
    );
    state = "failed";
    readiness = createReadiness(
      "blocked",
      "Compatibility verification failed.",
      diagnostics[0]?.message ?? "Compatibility blocked."
    );
  } else if (plugin.binding.state !== "bound") {
    diagnostics.push(
      createDiagnostic(
        input.at,
        "bind",
        "warning",
        "binding_unavailable",
        plugin.operations.execution.reason ??
          "Runtime has not published a bound implementation for this plugin yet."
      )
    );
    state = "degraded";
    readiness = createReadiness(
      "attention",
      "Plugin is installed but not fully bound.",
      diagnostics[0]?.message ?? "Binding unavailable."
    );
  } else if (plugin.health?.state === "degraded") {
    diagnostics.push(
      createDiagnostic(
        input.at,
        "activate",
        "warning",
        "health_degraded",
        plugin.health.warnings[0] ?? "Runtime health is degraded for this plugin."
      )
    );
    historyStates.push({
      state: "bound",
      reason: "Runtime published a bound plugin contract.",
    });
    state = "degraded";
    readiness = createReadiness(
      "attention",
      "Plugin is active with degraded health.",
      diagnostics[0]?.message ?? "Health degraded."
    );
  } else if (plugin.health?.state === "unsupported") {
    diagnostics.push(
      createDiagnostic(
        input.at,
        "activate",
        "error",
        "health_unsupported",
        plugin.health.warnings[0] ?? "Runtime marked this plugin as unsupported."
      )
    );
    historyStates.push({
      state: "bound",
      reason: "Runtime published a bound plugin contract.",
    });
    state = "failed";
    readiness = createReadiness(
      "blocked",
      "Plugin is unsupported.",
      diagnostics[0]?.message ?? "Plugin unsupported."
    );
  } else if (plugin.permissionDecision === "deny") {
    diagnostics.push(
      createDiagnostic(
        input.at,
        "activate",
        "error",
        "permission_denied",
        "Runtime denied the published permission request."
      )
    );
    historyStates.push({
      state: "bound",
      reason: "Runtime published a bound plugin contract.",
    });
    state = "failed";
    readiness = createReadiness(
      "blocked",
      "Runtime denied activation permissions.",
      diagnostics[0]?.message ?? "Permission denied."
    );
  } else if (plugin.permissionDecision === "ask") {
    diagnostics.push(
      createDiagnostic(
        input.at,
        "activate",
        "warning",
        "approval_required",
        "Runtime requires approval before this plugin can be relied on."
      )
    );
    historyStates.push({
      state: "bound",
      reason: "Runtime published a bound plugin contract.",
    });
    state = "degraded";
    readiness = createReadiness(
      "attention",
      "Plugin needs approval to stay usable.",
      diagnostics[0]?.message ?? "Approval required."
    );
  } else {
    historyStates.push({
      state: "bound",
      reason: "Runtime published a bound plugin contract.",
    });
    state = "active";
    readiness = createReadiness(
      "ready",
      "Plugin is active.",
      "Live contributions are available now."
    );
  }
  historyStates.push({
    state,
    reason: readiness.summary,
  });

  const contributions = normalizePluginContributions(plugin, activationId).map((contribution) =>
    cloneContribution(contribution, state === "active" || state === "degraded")
  );
  return {
    activationId,
    sourceType: "runtime_plugin",
    sourceScope:
      plugin.source === "wasi_host" || plugin.source === "rpc_host"
        ? "host"
        : plugin.source === "provider_route" ||
            plugin.source === "backend_route" ||
            plugin.source === "execution_route"
          ? "runtime"
          : "runtime",
    sourceRef: plugin.id,
    pluginId: plugin.id,
    packageRef: input.packageDescriptor?.packageRef ?? null,
    overlayId: null,
    sessionId: input.sessionId,
    name: plugin.name,
    version: plugin.version,
    state,
    readiness,
    diagnostics,
    contributions,
    transitionHistory: buildTransitionHistory(input.at, historyStates),
    metadata: {
      source: plugin.source,
      bindingState: plugin.binding.state,
      runtimeBacked: plugin.runtimeBacked,
    },
  };
}

function buildPackageRecord(input: {
  packageDescriptor: RuntimeRegistryPackageDescriptor;
  at: number;
  refreshMode: RuntimeExtensionActivationRefreshMode;
  deactivated: boolean;
  sessionId: string | null;
}): RuntimeExtensionActivationRecord {
  const activationId = `package:${input.packageDescriptor.packageRef}`;
  const diagnostics: RuntimeExtensionActivationDiagnostic[] = [];
  const historyStates: Array<{ state: RuntimeExtensionActivationState; reason: string }> = [];
  if (input.refreshMode === "full") {
    historyStates.push({
      state: "refresh_pending",
      reason: "Full refresh is rebuilding activation truth.",
    });
  }
  historyStates.push({
    state: "discovered",
    reason: "Registry package was discovered in installed inventory.",
  });
  historyStates.push({
    state: "verified",
    reason: "Package metadata was evaluated against trust and compatibility rules.",
  });
  historyStates.push({
    state: "installed",
    reason: "Package is installed in the registry.",
  });

  let state: RuntimeExtensionActivationState;
  let readiness: RuntimeExtensionActivationReadiness;
  if (input.deactivated) {
    diagnostics.push(
      createDiagnostic(
        input.at,
        "deactivate",
        "info",
        "activation_deactivated",
        "Activation is currently disabled."
      )
    );
    state = "deactivated";
    readiness = createReadiness(
      "attention",
      "Package activation is deactivated.",
      "Enable it to resume package binding."
    );
  } else if (input.packageDescriptor.trust.status === "blocked") {
    diagnostics.push(
      createDiagnostic(
        input.at,
        "verify",
        "error",
        "trust_blocked",
        input.packageDescriptor.trust.blockedReason ?? "Package trust verification is blocked."
      )
    );
    state = "failed";
    readiness = createReadiness(
      "blocked",
      "Package trust is blocked.",
      diagnostics[0]?.message ?? "Trust blocked."
    );
  } else if (input.packageDescriptor.compatibility.status === "incompatible") {
    diagnostics.push(
      createDiagnostic(
        input.at,
        "verify",
        "error",
        "compatibility_blocked",
        input.packageDescriptor.compatibility.blockers?.[0] ??
          "Package compatibility blocks activation on this runtime."
      )
    );
    state = "failed";
    readiness = createReadiness(
      "blocked",
      "Package compatibility is blocked.",
      diagnostics[0]?.message ?? "Compatibility blocked."
    );
  } else {
    diagnostics.push(
      createDiagnostic(
        input.at,
        "bind",
        "warning",
        "binding_unavailable",
        `Package \`${input.packageDescriptor.packageRef}\` is installed but not yet bound into the live runtime catalog.`
      )
    );
    state = "degraded";
    readiness = createReadiness(
      "attention",
      "Package is installed but not yet bound.",
      diagnostics[0]?.message ?? "Binding unavailable."
    );
  }
  historyStates.push({
    state,
    reason: readiness.summary,
  });
  return {
    activationId,
    sourceType: "registry_package",
    sourceScope: "package",
    sourceRef: input.packageDescriptor.packageRef,
    pluginId: input.packageDescriptor.installedPluginId ?? null,
    packageRef: input.packageDescriptor.packageRef,
    overlayId: null,
    sessionId: input.sessionId,
    name: input.packageDescriptor.manifest.entry.displayName ?? input.packageDescriptor.packageId,
    version: input.packageDescriptor.version,
    state,
    readiness,
    diagnostics,
    contributions: [],
    transitionHistory: buildTransitionHistory(input.at, historyStates),
    metadata: {
      transport: input.packageDescriptor.transport,
    },
  };
}

function buildBehaviorAssetRecord(input: {
  descriptor: RuntimeBehaviorAssetDescriptor;
  at: number;
  refreshMode: RuntimeExtensionActivationRefreshMode;
  deactivated: boolean;
  sessionId: string | null;
  overlayId: string | null;
}): RuntimeExtensionActivationRecord {
  const historyStates: Array<{ state: RuntimeExtensionActivationState; reason: string }> = [];
  if (input.refreshMode === "full") {
    historyStates.push({
      state: "refresh_pending",
      reason: "Full refresh is rebuilding activation truth.",
    });
  }
  historyStates.push({
    state: "discovered",
    reason:
      input.descriptor.sourceScope === "workspace"
        ? "Workspace behavior asset manifest was discovered."
        : "Session overlay behavior asset was discovered.",
  });
  historyStates.push({
    state: "verified",
    reason: "Behavior asset descriptor passed manifest verification.",
  });
  historyStates.push({
    state: "installed",
    reason:
      input.descriptor.sourceScope === "workspace"
        ? "Behavior asset is installed via repository state."
        : "Behavior asset overlay is installed for this session.",
  });
  if (input.descriptor.runtimeBinding.bindingState === "bound") {
    historyStates.push({
      state: "bound",
      reason: "Behavior asset compiled into a live descriptor binding.",
    });
  }

  let state: RuntimeExtensionActivationState;
  let readiness = input.descriptor.readiness;
  const diagnostics = [...input.descriptor.diagnostics];
  if (input.deactivated) {
    diagnostics.push(
      createDiagnostic(
        input.at,
        "deactivate",
        "info",
        "activation_deactivated",
        "Activation is currently disabled."
      )
    );
    state = "deactivated";
    readiness = createReadiness(
      "attention",
      "Behavior asset is deactivated.",
      "Enable it to restore live contributions."
    );
  } else if (input.descriptor.compileState === "failed") {
    state = "failed";
  } else if (input.descriptor.compileState === "degraded") {
    state = "degraded";
  } else {
    state = "active";
  }
  historyStates.push({
    state,
    reason: readiness.summary,
  });

  return {
    activationId: input.descriptor.sourceId,
    sourceType: input.descriptor.sourceScope === "workspace" ? "behavior_asset" : "session_overlay",
    sourceScope: input.descriptor.sourceScope,
    sourceRef: input.descriptor.assetId,
    pluginId: input.descriptor.runtimeBinding.runtimeSkillId,
    packageRef: null,
    overlayId: input.overlayId,
    sessionId: input.sessionId,
    name: input.descriptor.name,
    version: input.descriptor.version,
    state,
    readiness,
    diagnostics,
    contributions: input.descriptor.contributions.map((contribution) =>
      cloneContribution(contribution, state === "active" || state === "degraded")
    ),
    transitionHistory: buildTransitionHistory(input.at, historyStates),
    metadata: {
      manifestPath: input.descriptor.manifestPath,
      trustLevel: input.descriptor.trustLevel,
      kind: input.descriptor.kind,
    },
  };
}

function buildTombstoneRecord(input: {
  activationId: string;
  name: string;
  version: string;
  sessionId: string | null;
}): RuntimeExtensionActivationRecord {
  const at = Date.now();
  return {
    activationId: input.activationId,
    sourceType: "session_overlay",
    sourceScope: "session_overlay",
    sourceRef: input.activationId,
    pluginId: null,
    packageRef: null,
    overlayId: input.activationId,
    sessionId: input.sessionId,
    name: input.name,
    version: input.version,
    state: "uninstalled",
    readiness: createReadiness(
      "attention",
      "Activation was removed.",
      "This activation no longer contributes live behavior."
    ),
    diagnostics: [
      createDiagnostic(
        at,
        "uninstall",
        "info",
        "activation_uninstalled",
        "Activation was removed from this scope."
      ),
    ],
    contributions: [],
    transitionHistory: buildTransitionHistory(at, [
      {
        state: "uninstalled",
        reason: "Activation was removed from this scope.",
      },
    ]),
    metadata: null,
  };
}

function summarizeSnapshot(records: RuntimeExtensionActivationRecord[]) {
  return {
    total: records.length,
    active: records.filter((record) => record.state === "active").length,
    degraded: records.filter((record) => record.state === "degraded").length,
    failed: records.filter((record) => record.state === "failed").length,
    deactivated: records.filter((record) => record.state === "deactivated").length,
    refreshPending: records.filter((record) => record.state === "refresh_pending").length,
    uninstalled: records.filter((record) => record.state === "uninstalled").length,
  };
}

function sessionKey(sessionId?: string | null) {
  return sessionId ?? "__workspace__";
}

function toOverlayActivationId(sessionId: string, overlayId: string) {
  return `overlay:${sessionId}:${overlayId}`;
}

function findLiveSkill(liveSkills: LiveSkillSummary[], skillId: string): LiveSkillSummary | null {
  const normalized = skillId.trim().toLowerCase();
  return (
    liveSkills.find((skill) => skill.id.trim().toLowerCase() === normalized) ??
    liveSkills.find((skill) =>
      (skill.aliases ?? []).some((alias) => alias.trim().toLowerCase() === normalized)
    ) ??
    null
  );
}

function sortRecords(records: RuntimeExtensionActivationRecord[]) {
  return [...records].sort((left, right) => left.activationId.localeCompare(right.activationId));
}

export function createRuntimeExtensionActivationService(
  dependencies: RuntimeExtensionActivationDependencies
): RuntimeExtensionActivationService {
  const now = dependencies.now ?? (() => Date.now());
  const runtimeVersion = dependencies.runtimeVersion ?? CODE_RUNTIME_RPC_CONTRACT_VERSION;
  const appVersion = dependencies.appVersion ?? CODE_RUNTIME_RPC_CONTRACT_VERSION;
  let discoveredCache: DiscoveredActivationSources | null = null;
  const snapshotCache = new Map<string, RuntimeExtensionActivationSnapshot>();
  const overlayStore = new Map<string, SessionOverlayStore>();
  const mutationStateBySessionKey = new Map<string, ActivationMutationState>();

  function getMutationState(targetSessionId?: string | null): ActivationMutationState {
    const key = sessionKey(targetSessionId);
    const existing = mutationStateBySessionKey.get(key);
    if (existing) {
      return existing;
    }
    const created: ActivationMutationState = {
      deactivatedActivationIds: new Set<string>(),
      tombstones: new Map<string, RuntimeExtensionActivationRecord>(),
    };
    mutationStateBySessionKey.set(key, created);
    return created;
  }

  function getOverlayStore(targetSessionId: string): SessionOverlayStore {
    const existing = overlayStore.get(targetSessionId);
    if (existing) {
      return existing;
    }
    const created = new Map<string, RuntimeBehaviorAssetInput>();
    overlayStore.set(targetSessionId, created);
    return created;
  }

  async function loadSources(
    refreshMode: RuntimeExtensionActivationRefreshMode
  ): Promise<DiscoveredActivationSources> {
    if (refreshMode === "cache_only" && discoveredCache) {
      return discoveredCache;
    }
    const [plugins, installedPackages, workspaceSkillManifests, runtimeLiveSkills] =
      await Promise.all([
        dependencies.pluginCatalog.listPlugins(),
        dependencies.pluginRegistry.listInstalledPackages(),
        dependencies.readWorkspaceSkillManifests(dependencies.workspaceId),
        dependencies.listRuntimeLiveSkills(),
      ]);
    discoveredCache = {
      plugins,
      installedPackages,
      workspaceSkillManifests,
      runtimeLiveSkills,
    };
    return discoveredCache;
  }

  function buildSnapshotFromSources(input: {
    sources: DiscoveredActivationSources;
    targetSessionId: string | null;
    refreshMode: RuntimeExtensionActivationRefreshMode;
  }): RuntimeExtensionActivationSnapshot {
    const at = now();
    const sessionState = getMutationState(input.targetSessionId);
    const records: RuntimeExtensionActivationRecord[] = [];
    const consumedLiveSkillIds = new Set<string>();
    const representedPluginIds = new Set<string>();
    const representedPackageRefs = new Set<string>();

    for (const manifest of input.sources.workspaceSkillManifests) {
      const behaviorAsset = compileRuntimeBehaviorAsset({
        manifest,
        runtimeSkill: findLiveSkill(input.sources.runtimeLiveSkills, manifest.id),
        sourceScope: "workspace",
        runtimeVersion,
        appVersion,
        now,
      });
      if (behaviorAsset.runtimeBinding.runtimeSkillId) {
        consumedLiveSkillIds.add(behaviorAsset.runtimeBinding.runtimeSkillId);
      }
      records.push(
        buildBehaviorAssetRecord({
          descriptor: behaviorAsset,
          at,
          refreshMode: input.refreshMode,
          deactivated: sessionState.deactivatedActivationIds.has(behaviorAsset.sourceId),
          sessionId: input.targetSessionId,
          overlayId: null,
        })
      );
    }

    for (const plugin of input.sources.plugins) {
      if (plugin.source === "repo_manifest") {
        continue;
      }
      if (plugin.source === "live_skill" && consumedLiveSkillIds.has(plugin.id)) {
        continue;
      }
      const packageDescriptor =
        input.sources.installedPackages.find((entry) => entry.installedPluginId === plugin.id) ??
        null;
      if (packageDescriptor) {
        representedPackageRefs.add(packageDescriptor.packageRef);
      }
      representedPluginIds.add(plugin.id);
      records.push(
        buildPluginRecord({
          plugin,
          at,
          refreshMode: input.refreshMode,
          deactivated: sessionState.deactivatedActivationIds.has(`plugin:${plugin.id}`),
          packageDescriptor,
          sessionId: input.targetSessionId,
        })
      );
    }

    for (const packageDescriptor of input.sources.installedPackages) {
      if (representedPackageRefs.has(packageDescriptor.packageRef)) {
        continue;
      }
      if (
        packageDescriptor.installedPluginId &&
        representedPluginIds.has(packageDescriptor.installedPluginId)
      ) {
        continue;
      }
      records.push(
        buildPackageRecord({
          packageDescriptor,
          at,
          refreshMode: input.refreshMode,
          deactivated: sessionState.deactivatedActivationIds.has(
            `package:${packageDescriptor.packageRef}`
          ),
          sessionId: input.targetSessionId,
        })
      );
    }

    if (input.targetSessionId) {
      const overlays = overlayStore.get(input.targetSessionId);
      for (const [overlayId, asset] of overlays ?? []) {
        const descriptor = compileRuntimeBehaviorAsset({
          manifest: {
            ...asset,
            manifestPath: asset.manifestPath ?? null,
          },
          runtimeSkill:
            asset.kind === "skill"
              ? findLiveSkill(input.sources.runtimeLiveSkills, asset.id)
              : null,
          sourceScope: "session_overlay",
          runtimeVersion,
          appVersion,
          overlayId,
          sessionId: input.targetSessionId,
          now,
        });
        records.push(
          buildBehaviorAssetRecord({
            descriptor,
            at,
            refreshMode: input.refreshMode,
            deactivated: sessionState.deactivatedActivationIds.has(descriptor.sourceId),
            sessionId: input.targetSessionId,
            overlayId,
          })
        );
      }
    }

    const tombstones = [...sessionState.tombstones.values()];
    const sortedRecords = sortRecords([...records, ...tombstones]);
    const activeContributions = sortedRecords.flatMap((record) =>
      record.state === "active" || record.state === "degraded"
        ? record.contributions.map((contribution) => cloneContribution(contribution, true))
        : []
    );
    return {
      workspaceId: dependencies.workspaceId,
      sessionId: input.targetSessionId,
      refreshMode: input.refreshMode,
      refreshedAt: at,
      records: sortedRecords,
      activeContributions,
      summary: summarizeSnapshot(sortedRecords),
    };
  }

  async function refreshSnapshot(input?: {
    sessionId?: string | null;
    mode?: RuntimeExtensionActivationRefreshMode;
  }): Promise<RuntimeExtensionActivationSnapshot> {
    const refreshMode = input?.mode ?? "full";
    const sources = await loadSources(refreshMode);
    const snapshot = buildSnapshotFromSources({
      sources,
      targetSessionId: input?.sessionId ?? null,
      refreshMode,
    });
    snapshotCache.set(sessionKey(input?.sessionId), snapshot);
    return snapshot;
  }

  async function readSnapshot(input?: {
    sessionId?: string | null;
  }): Promise<RuntimeExtensionActivationSnapshot> {
    const key = sessionKey(input?.sessionId);
    const cached = snapshotCache.get(key);
    if (cached) {
      return cached;
    }
    return refreshSnapshot({
      sessionId: input?.sessionId ?? null,
      mode: "full",
    });
  }

  return {
    readSnapshot,
    refresh: refreshSnapshot,
    activate: async (input) => {
      const state = getMutationState(input.sessionId);
      state.deactivatedActivationIds.delete(input.activationId);
      state.tombstones.delete(input.activationId);
      return refreshSnapshot({
        sessionId: input.sessionId ?? null,
        mode: "cache_only",
      });
    },
    deactivate: async (input) => {
      const state = getMutationState(input.sessionId);
      state.deactivatedActivationIds.add(input.activationId);
      return refreshSnapshot({
        sessionId: input.sessionId ?? null,
        mode: "cache_only",
      });
    },
    retryActivation: async (input) => {
      const state = getMutationState(input.sessionId);
      state.tombstones.delete(input.activationId);
      return refreshSnapshot({
        sessionId: input.sessionId ?? null,
        mode: "full",
      });
    },
    verifyPackage: (packageRefOrManifest) =>
      dependencies.pluginRegistry.verifyPackage(packageRefOrManifest),
    installPackage: async (input) => {
      const result = await dependencies.pluginRegistry.installPackage({
        packageRef: input.packageRef,
        trustOverride: input.trustOverride,
      });
      const state = getMutationState(input.sessionId);
      state.tombstones.delete(`package:${result.package.packageRef}`);
      return refreshSnapshot({
        sessionId: input.sessionId ?? null,
        mode: "full",
      });
    },
    uninstall: async (input) => {
      const snapshot = await readSnapshot({
        sessionId: input.sessionId ?? null,
      });
      const record = snapshot.records.find((entry) => entry.activationId === input.activationId);
      const state = getMutationState(input.sessionId);
      if (!record) {
        return snapshot;
      }
      if (record.sourceType === "registry_package" && record.packageRef) {
        await dependencies.pluginRegistry.uninstallPackage(record.packageRef);
      }
      if (record.sourceType === "session_overlay" && input.sessionId && record.overlayId) {
        const overlays = overlayStore.get(input.sessionId);
        overlays?.delete(record.overlayId);
      }
      state.deactivatedActivationIds.delete(record.activationId);
      state.tombstones.set(
        record.activationId,
        buildTombstoneRecord({
          activationId: record.activationId,
          name: record.name,
          version: record.version,
          sessionId: input.sessionId ?? null,
        })
      );
      return refreshSnapshot({
        sessionId: input.sessionId ?? null,
        mode: "cache_only",
      });
    },
    upsertSessionOverlay: async (input) => {
      const overlays = getOverlayStore(input.sessionId);
      overlays.set(input.overlayId, input.asset);
      const state = getMutationState(input.sessionId);
      state.tombstones.delete(toOverlayActivationId(input.sessionId, input.overlayId));
      return refreshSnapshot({
        sessionId: input.sessionId,
        mode: "cache_only",
      });
    },
    removeSessionOverlay: async (input) => {
      const snapshot = await readSnapshot({
        sessionId: input.sessionId,
      });
      const activationId = toOverlayActivationId(input.sessionId, input.overlayId);
      const existing = snapshot.records.find((record) => record.activationId === activationId);
      overlayStore.get(input.sessionId)?.delete(input.overlayId);
      const state = getMutationState(input.sessionId);
      state.deactivatedActivationIds.delete(activationId);
      state.tombstones.set(
        activationId,
        buildTombstoneRecord({
          activationId,
          name: existing?.name ?? input.overlayId,
          version: existing?.version ?? "unknown",
          sessionId: input.sessionId,
        })
      );
      return refreshSnapshot({
        sessionId: input.sessionId,
        mode: "cache_only",
      });
    },
  };
}
