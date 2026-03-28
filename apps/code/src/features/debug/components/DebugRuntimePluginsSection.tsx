import type { RuntimeKernelPluginDescriptor } from "../../../application/runtime/kernel/runtimeKernelPlugins";
import {
  DebugDiagnosticsDefinitionList,
  type DebugDiagnosticsFieldDescriptor,
} from "./DebugDiagnosticsFieldGroups";

export type DebugRuntimePluginsSectionProps = {
  plugins: RuntimeKernelPluginDescriptor[];
  loading: boolean;
  error: string | null;
  projectionBacked: boolean;
};

function createPluginFields(
  plugin: RuntimeKernelPluginDescriptor
): DebugDiagnosticsFieldDescriptor[] {
  return [
    { label: "source", value: plugin.source },
    { label: "transport", value: plugin.transport },
    { label: "binding_state", value: plugin.binding.state },
    { label: "contract_format", value: plugin.binding.contractFormat },
    { label: "contract_boundary", value: plugin.binding.contractBoundary },
    { label: "enabled", value: plugin.enabled ? "yes" : "no" },
    { label: "runtime_backed", value: plugin.runtimeBacked ? "yes" : "no" },
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
}

export function DebugRuntimePluginsSection({
  plugins,
  loading,
  error,
  projectionBacked,
}: DebugRuntimePluginsSectionProps) {
  return (
    <div className="debug-event-channel-diagnostics" data-testid="debug-runtime-plugins">
      <div className="debug-event-channel-diagnostics-title">Runtime plugins</div>
      <div className="debug-event-channel-diagnostics-empty">
        projection extensions: {projectionBacked ? "connected" : "not connected"}
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
