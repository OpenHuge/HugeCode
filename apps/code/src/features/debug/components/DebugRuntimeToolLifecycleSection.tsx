import type { RuntimeToolLifecycleEvent } from "../../../application/runtime/ports/runtimeToolLifecycle";
import {
  DebugDiagnosticsDefinitionList,
  type DebugDiagnosticsFieldDescriptor,
} from "./DebugDiagnosticsFieldGroups";

export type DebugRuntimeToolLifecycleSectionProps = {
  lifecycleEvents: RuntimeToolLifecycleEvent[];
};

function createLifecycleFields(
  event: RuntimeToolLifecycleEvent
): DebugDiagnosticsFieldDescriptor[] {
  return [
    { label: "source", value: event.source },
    { label: "status", value: event.status ?? "-" },
    { label: "workspace", value: event.workspaceId ?? "-" },
    { label: "thread", value: event.threadId ?? "-" },
    { label: "turn", value: event.turnId ?? "-" },
    { label: "tool", value: event.toolName ?? "-" },
    { label: "tool_call", value: event.toolCallId ?? "-" },
    { label: "scope", value: event.scope ?? "-" },
    { label: "error_code", value: event.errorCode ?? "-" },
  ];
}

export function DebugRuntimeToolLifecycleSection({
  lifecycleEvents,
}: DebugRuntimeToolLifecycleSectionProps) {
  return (
    <div className="debug-event-channel-diagnostics" data-testid="debug-runtime-tool-lifecycle">
      <div className="debug-event-channel-diagnostics-title">Tool lifecycle</div>
      {lifecycleEvents.length === 0 ? (
        <div className="debug-event-channel-diagnostics-empty">
          No lifecycle activity observed yet.
        </div>
      ) : (
        <div className="debug-event-channel-diagnostics-grid">
          {lifecycleEvents.map((event) => (
            <div key={event.id} className="debug-event-channel-diagnostics-item">
              <div className="debug-event-channel-diagnostics-label">
                {event.kind}/{event.phase}
              </div>
              <DebugDiagnosticsDefinitionList fields={createLifecycleFields(event)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
