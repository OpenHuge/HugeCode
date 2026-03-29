import { readRuntimeKernelRoutingPluginMetadata } from "../kernel/runtimeKernelRoutingPlugins";
import type { RuntimeKernelPluginDescriptor } from "../kernel/runtimeKernelPluginTypes";

export type RuntimeKernelPluginReadinessState = "ready" | "attention" | "blocked";

export type RuntimeKernelPluginReadinessEntry = {
  id: string;
  name: string;
  version: string;
  source: RuntimeKernelPluginDescriptor["source"];
  sourceLabel: string;
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
  remediationSummary: string;
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

function toSourceLabel(source: RuntimeKernelPluginDescriptor["source"]) {
  switch (source) {
    case "runtime_extension":
      return "Runtime extension";
    case "live_skill":
      return "Live skill";
    case "repo_manifest":
      return "Repo manifest";
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
    case "provider_route":
      return "Provider route";
    case "backend_route":
      return "Backend route";
    case "execution_route":
      return "Execution route";
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

  if (plugin.source === "wasi_host" || plugin.source === "rpc_host") {
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

  if (plugin.source === "wasi_host" || plugin.source === "rpc_host") {
    return {
      state: "ready",
      label: "Runtime-managed",
      detail: "Host binders do not request additional operator permissions through this surface.",
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

function buildReadinessState(input: {
  plugin: RuntimeKernelPluginDescriptor;
  capabilitySupport: RuntimeKernelPluginReadinessEntry["capabilitySupport"];
  permissionState: RuntimeKernelPluginReadinessEntry["permissionState"];
}): RuntimeKernelPluginReadinessState {
  if (
    (!input.plugin.enabled && input.plugin.source !== "repo_manifest") ||
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
      capabilitySupport,
      permissionState,
      readiness: {
        state: readinessState,
        label: formatReadinessLabel(readinessState),
        detail: buildReadinessDetail(plugin, readinessState, permissionState),
      },
      remediationSummary: buildRemediationSummary(plugin, readinessState, permissionState),
    };
  });
}
