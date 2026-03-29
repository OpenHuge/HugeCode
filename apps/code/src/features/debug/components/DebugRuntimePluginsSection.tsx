import {
  readRuntimeKernelRoutingPluginMetadata,
  type RuntimeKernelPluginDescriptor,
} from "../../../application/runtime/kernel/runtimeKernelPlugins";
import { readRuntimeKernelPluginCompositionMetadata } from "../../../application/runtime/kernel/runtimeKernelComposition";
import { readRuntimeKernelPluginRegistryMetadata } from "../../../application/runtime/kernel/runtimeKernelPluginRegistry";
import type { WorkspaceRuntimePluginProjectionState } from "../../../application/runtime/facades/runtimeKernelPluginProjectionHooks";
import {
  DebugDiagnosticsDefinitionList,
  type DebugDiagnosticsFieldDescriptor,
} from "./DebugDiagnosticsFieldGroups";

export type DebugRuntimePluginsSectionProps = WorkspaceRuntimePluginProjectionState;

function createPluginFields(
  plugin: RuntimeKernelPluginDescriptor
): DebugDiagnosticsFieldDescriptor[] {
  const execution = plugin.operations.execution;
  const resources = plugin.operations.resources;
  const permissions = plugin.operations.permissions;
  const fields: DebugDiagnosticsFieldDescriptor[] = [
    { label: "source", value: plugin.source },
    { label: "transport", value: plugin.transport },
    { label: "binding_state", value: plugin.binding.state },
    { label: "execution_state", value: execution.executable ? "executable" : "blocked" },
    { label: "execution_mode", value: execution.mode },
    { label: "resource_state", value: resources.readable ? "readable" : "blocked" },
    { label: "resource_mode", value: resources.mode },
    { label: "permissions_state", value: permissions.evaluable ? "evaluable" : "blocked" },
    { label: "permissions_mode", value: permissions.mode },
    { label: "contract_format", value: plugin.binding.contractFormat },
    { label: "contract_boundary", value: plugin.binding.contractBoundary },
    {
      label: "contract_surfaces",
      value:
        plugin.binding.surfaces.length > 0
          ? plugin.binding.surfaces
              .map((surface) => `${surface.direction}:${surface.kind}:${surface.id}`)
              .join(", ")
          : "-",
    },
    { label: "enabled", value: plugin.enabled ? "yes" : "no" },
    { label: "runtime_backed", value: plugin.runtimeBacked ? "yes" : "no" },
    { label: "execution_reason", value: execution.reason ?? "-" },
    { label: "resource_reason", value: resources.reason ?? "-" },
    { label: "permissions_reason", value: permissions.reason ?? "-" },
    {
      label: "permissions",
      value: plugin.permissions.length > 0 ? plugin.permissions.join(", ") : "-",
    },
    {
      label: "capabilities",
      value:
        plugin.capabilities.length > 0
          ? plugin.capabilities.map((capability) => capability.id).join(", ")
          : "-",
    },
  ];
  const routingMetadata = readRuntimeKernelRoutingPluginMetadata(plugin.metadata);
  const registryMetadata = readRuntimeKernelPluginRegistryMetadata(plugin.metadata);
  const compositionMetadata = readRuntimeKernelPluginCompositionMetadata(plugin.metadata);
  if (registryMetadata) {
    fields.push(
      { label: "package_ref", value: registryMetadata.packageRef },
      { label: "package_transport", value: registryMetadata.transport },
      { label: "package_source", value: registryMetadata.source },
      { label: "package_publisher", value: registryMetadata.publisher ?? "-" },
      { label: "trust_status", value: registryMetadata.trust.status },
      { label: "verification_status", value: registryMetadata.trust.verificationStatus },
      { label: "compatibility_status", value: registryMetadata.compatibility.status }
    );
  }
  if (compositionMetadata) {
    fields.push(
      { label: "active_profile", value: compositionMetadata.activeProfileId ?? "-" },
      {
        label: "selected_in_active_profile",
        value: compositionMetadata.selectedInActiveProfile ? "yes" : "no",
      },
      {
        label: "blocked_in_active_profile",
        value: compositionMetadata.blockedInActiveProfile ? "yes" : "no",
      },
      { label: "blocked_reason", value: compositionMetadata.blockedReason ?? "-" },
      {
        label: "selected_backends",
        value:
          compositionMetadata.selectedBackendCandidateIds.length > 0
            ? compositionMetadata.selectedBackendCandidateIds.join(", ")
            : "-",
      }
    );
  }
  if (routingMetadata) {
    fields.push(
      { label: "route_kind", value: routingMetadata.routeKind },
      { label: "route_value", value: routingMetadata.routeValue },
      { label: "route_readiness", value: routingMetadata.readiness },
      { label: "route_provenance", value: routingMetadata.provenance ?? "-" },
      { label: "route_provider", value: routingMetadata.providerId ?? "-" },
      { label: "route_pool", value: routingMetadata.pool ?? "-" },
      {
        label: "preferred_backends",
        value: routingMetadata.preferredBackendIds?.join(", ") ?? "-",
      },
      { label: "resolved_backend", value: routingMetadata.resolvedBackendId ?? "-" }
    );
  }
  return fields;
}

export function DebugRuntimePluginsSection({
  plugins,
  loading,
  error,
  projectionBacked,
  registry,
  composition,
}: DebugRuntimePluginsSectionProps) {
  return (
    <div className="debug-event-channel-diagnostics" data-testid="debug-runtime-plugins">
      <div className="debug-event-channel-diagnostics-title">Runtime plugins</div>
      <div className="debug-event-channel-diagnostics-empty">
        projection extensions: {projectionBacked ? "connected" : "not connected"}
      </div>
      <div className="debug-event-channel-diagnostics-empty">
        registry packages: {registry.installedCount} installed | {registry.verifiedCount} verified
        {" | "}
        {registry.blockedCount} blocked
      </div>
      <div className="debug-event-channel-diagnostics-empty">
        active profile: {composition.activeProfile?.name ?? composition.activeProfileId ?? "none"}
        {" | "}routes selected: {composition.resolution?.selectedRouteCandidates.length ?? 0}
        {" | "}backends selected: {composition.resolution?.selectedBackendCandidates.length ?? 0}
      </div>
      {loading ? (
        <div className="debug-event-channel-diagnostics-empty">Loading runtime plugins...</div>
      ) : error ? (
        <div className="debug-event-channel-diagnostics-empty">Plugin catalog error: {error}</div>
      ) : plugins.length === 0 ? (
        <div className="debug-event-channel-diagnostics-empty">
          No runtime plugins available yet.
        </div>
      ) : (
        <div className="debug-event-channel-diagnostics-grid">
          {plugins.map((plugin) => (
            <div key={plugin.id} className="debug-event-channel-diagnostics-item">
              <div className="debug-event-channel-diagnostics-label">
                {plugin.name} ({plugin.version})
              </div>
              <DebugDiagnosticsDefinitionList fields={createPluginFields(plugin)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
