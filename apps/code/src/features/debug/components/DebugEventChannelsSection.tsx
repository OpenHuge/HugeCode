import type { RuntimeEventChannelDiagnostics } from "../../../application/runtime/ports/runtimeEventChannelDiagnostics";
import {
  DebugDiagnosticsDefinitionList,
  type DebugDiagnosticsFieldDescriptor,
} from "./DebugDiagnosticsFieldGroups";

export type DebugEventChannelsSectionProps = {
  eventChannelDiagnostics: RuntimeEventChannelDiagnostics[];
  runtimeEventBridgePath: "legacy" | "v2";
};

function createChannelFields(
  channel: RuntimeEventChannelDiagnostics
): DebugDiagnosticsFieldDescriptor[] {
  return [
    { label: "status", value: channel.status },
    { label: "transport", value: channel.transport },
    { label: "retry_attempt", value: channel.retryAttempt },
    { label: "retry_delay_ms", value: channel.retryDelayMs ?? "-" },
    { label: "last_error", value: channel.lastError ?? "-" },
    { label: "fallback_since_ms", value: channel.fallbackSinceMs ?? "-" },
    { label: "consecutive_failures", value: channel.consecutiveFailures },
    { label: "last_transition_reason", value: channel.lastTransitionReason ?? "-" },
  ];
}

export function DebugEventChannelsSection({
  eventChannelDiagnostics,
  runtimeEventBridgePath,
}: DebugEventChannelsSectionProps) {
  return (
    <div className="debug-event-channel-diagnostics" data-testid="debug-event-channel-diagnostics">
      <div className="debug-event-channel-diagnostics-title">Event channels</div>
      <div
        className="debug-event-channel-diagnostics-empty"
        data-testid="debug-runtime-event-bridge-path"
      >
        runtime event path: {runtimeEventBridgePath}
      </div>
      {eventChannelDiagnostics.length === 0 ? (
        <div className="debug-event-channel-diagnostics-empty">
          No channel diagnostics available yet.
        </div>
      ) : (
        <div className="debug-event-channel-diagnostics-grid">
          {eventChannelDiagnostics.map((channel) => (
            <div key={channel.id} className="debug-event-channel-diagnostics-item">
              <div className="debug-event-channel-diagnostics-label">{channel.label}</div>
              <DebugDiagnosticsDefinitionList fields={createChannelFields(channel)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
