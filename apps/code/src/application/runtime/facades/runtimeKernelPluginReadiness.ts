import { readRuntimeKernelPluginCompositionMetadata } from "../kernel/runtimeKernelComposition";
import { readRuntimeKernelPluginRegistryMetadata } from "../kernel/runtimeKernelPluginRegistry";
import { readRuntimeKernelRoutingPluginMetadata } from "../kernel/runtimeKernelRoutingPlugins";
import type { RuntimeKernelPluginDescriptor } from "../kernel/runtimeKernelPluginTypes";

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
  source: RuntimeKernelPluginDescriptor["source"];
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
    label: string;
    detail: string;
  };
  trustState: {
    state: RuntimeKernelPluginReadinessState;
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

function formatReadinessLabel(state: RuntimeKernelPluginReadinessState) {
  if (state === "ready") {
    return "Ready";
  }
  if (state === "attention") {
    return "Attention";
  }
  return "Blocked";
}

function formatList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "none";
}

function formatLayerOrder(values: string[]) {
  return values.length > 0 ? values.join(" -> ") : "none";
}

function isHostBinderSource(source: RuntimeKernelPluginDescriptor["source"]) {
  return source === "wasi_host" || source === "rpc_host";
}

function isSelectedStateLabel(label: string) {
  return label === "Selected in active profile" || label === "Selected route";
}

function toSourceLabel(source: RuntimeKernelPluginDescriptor["source"]) {
  switch (source) {
    case "runtime_extension":
      return "Runtime extension";
    case "live_skill":
      return "Live skill";
    case "repo_manifest":
      return "Repo manifest";
    case "provider_route":
      return "Provider route";
    case "backend_route":
      return "Backend route";
    case "execution_route":
      return "Execution route";
    case "wasi_host":
      return "WASI host";
    case "rpc_host":
      return "RPC host";
    case "mcp_remote":
      return "MCP remote";
    case "wasi_component":
      return "WASI component";
    case "a2a_remote":
      return "A2A remote";
    case "host_bridge":
      return "Host bridge";
  }
}

function buildCapabilitySupport(
  plugin: RuntimeKernelPluginDescriptor
): RuntimeKernelPluginReadinessEntry["capabilitySupport"] {
  const publishedCapabilities = plugin.capabilities
    .filter((capability) => capability.enabled)
    .map((capability) => capability.id);
  const surfaceIds = plugin.binding.surfaces.map((surface) => surface.id);
  const routingMetadata = readRuntimeKernelRoutingPluginMetadata(plugin.metadata);

  if (routingMetadata) {
    return {
      state: routingMetadata.readiness,
      summary:
        routingMetadata.readiness === "ready"
          ? "Runtime published a launch-ready route."
          : routingMetadata.readiness === "attention"
            ? "Runtime published a usable route that still needs operator attention."
            : "Runtime published this route as blocked for launch.",
      detail:
        routingMetadata.detail ??
        routingMetadata.blockingReason ??
        "Runtime did not publish additional routing detail for this plugin.",
    };
  }

  if (isHostBinderSource(plugin.source)) {
    return {
      state: plugin.binding.state === "bound" ? "ready" : "blocked",
      summary:
        plugin.binding.state === "bound"
          ? "Runtime host binder imports are active."
          : "Runtime host binder imports are published, but the binder is not connected.",
      detail:
        surfaceIds.length > 0
          ? `Published import surfaces: ${formatList(surfaceIds)}.`
          : "Runtime did not publish import surface identifiers for this host binder.",
    };
  }

  if (plugin.binding.state === "declaration_only") {
    return {
      state: "attention",
      summary:
        publishedCapabilities.length > 0
          ? `Manifest declares ${formatList(publishedCapabilities)}.`
          : "Manifest declaration published without runtime-backed capabilities.",
      detail:
        plugin.operations.execution.reason ??
        "Runtime has not published a bound provider for this manifest yet.",
    };
  }

  if (publishedCapabilities.length > 0) {
    return {
      state: "ready",
      summary: `Publishes ${formatList(publishedCapabilities)}.`,
      detail: `Execution ${plugin.operations.execution.executable ? "available" : "unavailable"}; resources ${
        plugin.operations.resources.readable ? "readable" : "unavailable"
      }.`,
    };
  }

  if (
    plugin.operations.execution.executable ||
    plugin.operations.resources.readable ||
    plugin.operations.permissions.evaluable
  ) {
    return {
      state: "ready",
      summary: "Runtime publishes operator-usable plugin surfaces.",
      detail: `Execution ${plugin.operations.execution.executable ? "available" : "unavailable"}; resources ${
        plugin.operations.resources.readable ? "readable" : "unavailable"
      }; permissions ${plugin.operations.permissions.evaluable ? "evaluable" : "unavailable"}.`,
    };
  }

  return {
    state: "blocked",
    summary: "Runtime did not publish a usable capability surface for this plugin.",
    detail:
      plugin.operations.execution.reason ??
      plugin.operations.resources.reason ??
      plugin.operations.permissions.reason ??
      "No operator-usable plugin surfaces were published.",
  };
}

function buildPermissionState(
  plugin: RuntimeKernelPluginDescriptor
): RuntimeKernelPluginReadinessEntry["permissionState"] {
  const permissionList = formatList(plugin.permissions);
  const routingMetadata = readRuntimeKernelRoutingPluginMetadata(plugin.metadata);

  if (routingMetadata) {
    return {
      state: "ready",
      label: "Runtime-managed",
      detail:
        routingMetadata.readinessMessage ??
        "Runtime manages credentials and approval state for this route selection.",
    };
  }

  if (isHostBinderSource(plugin.source)) {
    return {
      state: "ready",
      label: "Runtime-managed",
      detail: "Host binders do not request additional operator permissions through this surface.",
    };
  }

  if (plugin.permissions.length === 0) {
    return {
      state: "ready",
      label: "None",
      detail: "Runtime does not require extra permissions for this plugin.",
    };
  }

  if (plugin.permissionDecision === "allow") {
    return {
      state: "ready",
      label: "Allowed",
      detail:
        plugin.permissions.length > 0
          ? `Runtime allows permissions: ${permissionList}.`
          : "Runtime does not require extra permissions for this plugin.",
    };
  }

  if (plugin.permissionDecision === "ask") {
    return {
      state: "attention",
      label: "Approval required",
      detail:
        plugin.operations.permissions.reason ??
        `Operator approval is required for permissions: ${permissionList}.`,
    };
  }

  if (plugin.permissionDecision === "deny") {
    return {
      state: "blocked",
      label: "Denied",
      detail:
        plugin.operations.permissions.reason ??
        `Runtime currently denies permissions: ${permissionList}.`,
    };
  }

  if (plugin.permissionDecision === "unsupported" || !plugin.operations.permissions.evaluable) {
    if (plugin.binding.state === "declaration_only") {
      return {
        state: "attention",
        label: "Unavailable",
        detail:
          plugin.operations.permissions.reason ??
          "Runtime has not published a permission evaluation path for this plugin yet.",
      };
    }

    return {
      state: "blocked",
      label: "Unsupported",
      detail: plugin.operations.permissions.reason ?? "Runtime permission state unavailable.",
    };
  }

  return {
    state: "attention",
    label: "Unknown",
    detail: "Runtime has not published a resolved permission decision yet.",
  };
}

function buildSelectionState(
  plugin: RuntimeKernelPluginDescriptor
): RuntimeKernelPluginReadinessEntry["selectionState"] {
  const compositionMetadata = readRuntimeKernelPluginCompositionMetadata(plugin.metadata);
  const routingMetadata = readRuntimeKernelRoutingPluginMetadata(plugin.metadata);
  if (compositionMetadata?.blockedInActiveProfile) {
    return {
      state: "blocked",
      label: "Blocked in active profile",
      detail:
        compositionMetadata.blockedReason ??
        "The active runtime composition profile blocks this plugin from launch.",
    };
  }
  if (compositionMetadata?.selectedRouteCandidate) {
    return {
      state: "ready",
      label: "Selected route",
      detail:
        routingMetadata?.provenance === "backend_preference"
          ? `Selected from backend preference: ${formatList(routingMetadata.preferredBackendIds ?? [])}.`
          : routingMetadata?.provenance === "explicit_route"
            ? "Selected explicitly by the active profile."
            : routingMetadata?.provenance === "runtime_fallback"
              ? "Current launch relies on this runtime fallback route."
              : "Selected for the active launch path.",
    };
  }
  if (compositionMetadata?.selectedInActiveProfile) {
    return {
      state: "ready",
      label: "Selected in active profile",
      detail: `Chosen by the active runtime profile across layers ${formatLayerOrder(
        compositionMetadata.layerOrder
      )}.`,
    };
  }
  if (
    plugin.source === "provider_route" ||
    plugin.source === "backend_route" ||
    plugin.source === "execution_route"
  ) {
    return {
      state: "attention",
      label: "Published route",
      detail: "Published in the catalog, but not used by the active profile.",
    };
  }
  if (plugin.source === "repo_manifest") {
    return {
      state: "attention",
      label: "Repository declaration",
      detail: "Visible because the repository manifest declared it for this workspace.",
    };
  }
  return {
    state: "ready",
    label: "Available inventory",
    detail: "Published in the catalog but not selected by the active profile.",
  };
}

function buildTrustState(
  plugin: RuntimeKernelPluginDescriptor
): RuntimeKernelPluginReadinessEntry["trustState"] {
  const registryMetadata = readRuntimeKernelPluginRegistryMetadata(plugin.metadata);
  if (registryMetadata) {
    if (registryMetadata.compatibility.status === "incompatible") {
      return {
        state: "blocked",
        label: "Incompatible",
        detail:
          registryMetadata.compatibility.blockers?.[0] ??
          "This package requires a host/runtime contract the workspace cannot satisfy.",
      };
    }
    if (registryMetadata.trust.status === "verified") {
      return {
        state: "ready",
        label: "Verified",
        detail:
          registryMetadata.publisher !== null
            ? `Verified publisher: ${registryMetadata.publisher}.`
            : "Runtime verified this package before surfacing it.",
      };
    }
    if (registryMetadata.trust.status === "runtime_managed") {
      return {
        state: "ready",
        label: "Runtime-managed",
        detail: "Runtime owns package provenance and trust for this surface.",
      };
    }
    if (registryMetadata.trust.status === "dev_override") {
      return {
        state: "attention",
        label: "Dev override",
        detail:
          registryMetadata.trust.blockedReason ??
          "This package relies on a local development trust override.",
      };
    }
    if (registryMetadata.trust.status === "blocked") {
      return {
        state: "blocked",
        label: "Trust blocked",
        detail:
          registryMetadata.trust.blockedReason ??
          "Runtime trust policy currently blocks this package.",
      };
    }
    return {
      state: "attention",
      label: "Trust unknown",
      detail: "Runtime did not publish a stable trust decision for this package yet.",
    };
  }

  if (plugin.runtimeBacked || isHostBinderSource(plugin.source)) {
    return {
      state: "ready",
      label: "Runtime-published",
      detail: "Published directly by runtime instead of an installable package.",
    };
  }

  if (plugin.source === "repo_manifest") {
    return {
      state: "attention",
      label: "Repository-local",
      detail: "Repository manifest entry without registry attestation metadata.",
    };
  }

  return {
    state: "attention",
    label: "Trust unspecified",
    detail: "Runtime did not publish trust metadata for this plugin source.",
  };
}

function buildBadges(input: {
  plugin: RuntimeKernelPluginDescriptor;
  readinessState: RuntimeKernelPluginReadinessState;
  selectionState: RuntimeKernelPluginReadinessEntry["selectionState"];
  trustState: RuntimeKernelPluginReadinessEntry["trustState"];
}): RuntimeKernelPluginReadinessBadge[] {
  const badges: RuntimeKernelPluginReadinessBadge[] = [
    {
      label:
        input.readinessState === "ready"
          ? "Ready"
          : input.readinessState === "attention"
            ? "Attention"
            : "Blocked",
      tone:
        input.readinessState === "ready"
          ? "success"
          : input.readinessState === "attention"
            ? "warning"
            : "danger",
    },
  ];

  if (isSelectedStateLabel(input.selectionState.label)) {
    badges.push({
      label: input.selectionState.label,
      tone: "success",
    });
  } else if (input.selectionState.state !== "ready") {
    badges.push({
      label: input.selectionState.label,
      tone: input.selectionState.state === "blocked" ? "danger" : "warning",
    });
  }

  badges.push({
    label: input.trustState.label,
    tone:
      input.trustState.state === "ready"
        ? "neutral"
        : input.trustState.state === "attention"
          ? "warning"
          : "danger",
  });

  if (isHostBinderSource(input.plugin.source)) {
    badges.push({
      label: "Host truth",
      tone: "neutral",
    });
  }

  return badges;
}

function buildReadinessState(input: {
  plugin: RuntimeKernelPluginDescriptor;
  capabilitySupport: RuntimeKernelPluginReadinessEntry["capabilitySupport"];
  permissionState: RuntimeKernelPluginReadinessEntry["permissionState"];
}): RuntimeKernelPluginReadinessState {
  if (
    (!input.plugin.enabled &&
      input.plugin.source !== "repo_manifest" &&
      input.plugin.source !== "provider_route" &&
      input.plugin.source !== "backend_route" &&
      input.plugin.source !== "execution_route") ||
    input.plugin.binding.state === "unbound" ||
    input.permissionState.state === "blocked" ||
    (input.plugin.runtimeBacked && input.plugin.health?.state === "unsupported") ||
    input.capabilitySupport.state === "blocked"
  ) {
    return "blocked";
  }

  if (
    input.plugin.binding.state === "declaration_only" ||
    input.permissionState.state === "attention" ||
    input.plugin.health?.state === "degraded" ||
    input.capabilitySupport.state === "attention"
  ) {
    return "attention";
  }

  return "ready";
}

function buildReadinessDetail(
  plugin: RuntimeKernelPluginDescriptor,
  readinessState: RuntimeKernelPluginReadinessState,
  permissionState: RuntimeKernelPluginReadinessEntry["permissionState"]
) {
  const routingMetadata = readRuntimeKernelRoutingPluginMetadata(plugin.metadata);
  if (routingMetadata) {
    return (
      routingMetadata.detail ??
      routingMetadata.blockingReason ??
      routingMetadata.readinessMessage ??
      "Runtime published this routing surface."
    );
  }

  if (readinessState === "blocked") {
    if (plugin.binding.state === "unbound") {
      return (
        plugin.operations.execution.reason ??
        (typeof plugin.metadata?.["reason"] === "string" ? plugin.metadata["reason"] : null) ??
        "Runtime host binder is not connected."
      );
    }
    if (!plugin.enabled && plugin.source !== "repo_manifest") {
      return "Runtime reports this plugin as disabled.";
    }
    if (permissionState.state === "blocked") {
      return permissionState.detail;
    }
    if (plugin.runtimeBacked && plugin.health?.state === "unsupported") {
      return plugin.health.warnings[0] ?? "Runtime marks this plugin as unsupported.";
    }
  }

  if (readinessState === "attention") {
    if (plugin.binding.state === "declaration_only") {
      return "Runtime only published a repository declaration, not a bound implementation.";
    }
    if (plugin.health?.state === "degraded") {
      return plugin.health.warnings[0] ?? "Runtime reported health warnings for this plugin.";
    }
    if (permissionState.state === "attention") {
      return permissionState.detail;
    }
  }

  return "Runtime published this plugin as operator-usable.";
}

function buildRemediationSummary(
  plugin: RuntimeKernelPluginDescriptor,
  readinessState: RuntimeKernelPluginReadinessState,
  permissionState: RuntimeKernelPluginReadinessEntry["permissionState"]
) {
  if (plugin.source === "wasi_host") {
    return "Connect the WASI host binder so runtime can satisfy the published WIT imports.";
  }
  if (plugin.source === "rpc_host") {
    return "Connect the RPC host binder so runtime can satisfy the published RPC imports.";
  }
  if (plugin.binding.state === "declaration_only") {
    return "Bind or install a runtime-backed implementation so this manifest can move beyond declaration-only readiness.";
  }
  if (
    plugin.source === "provider_route" ||
    plugin.source === "backend_route" ||
    plugin.source === "execution_route"
  ) {
    return readinessState === "blocked"
      ? "Adjust route selection or restore provider/backend readiness before launch."
      : "No operator action required unless route readiness changes.";
  }
  if (permissionState.state === "attention") {
    return "Review the published permission request before relying on this plugin.";
  }
  if (permissionState.state === "blocked") {
    return "Restore a supported runtime permission path before relying on this plugin.";
  }
  if (plugin.health?.state === "degraded") {
    return plugin.source === "live_skill"
      ? "Inspect runtime health warnings before relying on this live skill."
      : "Inspect runtime health warnings before relying on this extension.";
  }
  if (readinessState === "ready") {
    return "No operator action required.";
  }
  return "Inspect runtime plugin configuration before continuing.";
}

export function buildRuntimeKernelPluginReadinessEntries(
  plugins: RuntimeKernelPluginDescriptor[]
): RuntimeKernelPluginReadinessEntry[] {
  return plugins.map((plugin) => {
    const capabilitySupport = buildCapabilitySupport(plugin);
    const permissionState = buildPermissionState(plugin);
    const selectionState = buildSelectionState(plugin);
    const trustState = buildTrustState(plugin);
    const readinessState = buildReadinessState({
      plugin,
      capabilitySupport,
      permissionState,
    });

    return {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      source: plugin.source,
      sourceLabel: toSourceLabel(plugin.source),
      badges: buildBadges({
        plugin,
        readinessState,
        selectionState,
        trustState,
      }),
      capabilitySupport,
      permissionState,
      readiness: {
        state: readinessState,
        label: formatReadinessLabel(readinessState),
        detail: buildReadinessDetail(plugin, readinessState, permissionState),
      },
      selectionState,
      trustState,
      remediationSummary: buildRemediationSummary(plugin, readinessState, permissionState),
    };
  });
}

function compareSectionEntries(
  left: RuntimeKernelPluginReadinessEntry,
  right: RuntimeKernelPluginReadinessEntry
) {
  const readinessRank = {
    blocked: 0,
    attention: 1,
    ready: 2,
  } satisfies Record<RuntimeKernelPluginReadinessState, number>;
  const leftSelected = isSelectedStateLabel(left.selectionState.label);
  const rightSelected = isSelectedStateLabel(right.selectionState.label);

  if (readinessRank[left.readiness.state] !== readinessRank[right.readiness.state]) {
    return readinessRank[left.readiness.state] - readinessRank[right.readiness.state];
  }
  if (leftSelected !== rightSelected) {
    return leftSelected ? -1 : 1;
  }
  if (left.trustState.state !== right.trustState.state) {
    return readinessRank[left.trustState.state] - readinessRank[right.trustState.state];
  }
  return left.name.localeCompare(right.name);
}

export function buildRuntimeKernelPluginReadinessSections(
  entries: RuntimeKernelPluginReadinessEntry[]
): RuntimeKernelPluginReadinessSection[] {
  const needsAction = entries
    .filter((entry) => entry.readiness.state !== "ready")
    .sort(compareSectionEntries);
  const selectedNow = entries
    .filter(
      (entry) =>
        entry.readiness.state === "ready" && isSelectedStateLabel(entry.selectionState.label)
    )
    .sort(compareSectionEntries);
  const accountedFor = new Set([...needsAction, ...selectedNow].map((entry) => entry.id));
  const inventory = entries
    .filter((entry) => !accountedFor.has(entry.id))
    .sort(compareSectionEntries);

  return [
    {
      id: "needs_action",
      title: "Needs action",
      description:
        needsAction.length > 0
          ? "Runtime still requires action on these plugin surfaces."
          : "No plugin surfaces currently need action.",
      entries: needsAction,
    },
    {
      id: "selected_now",
      title: "Selected now",
      description:
        selectedNow.length > 0
          ? "These surfaces are selected by the active profile or route."
          : "No fully ready selected plugin surfaces yet.",
      entries: selectedNow,
    },
    {
      id: "inventory",
      title: "Inventory",
      description:
        inventory.length > 0
          ? "Remaining runtime-published inventory for later activation."
          : "No additional runtime-published inventory.",
      entries: inventory,
    },
  ];
}
