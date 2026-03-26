import type { RuntimeToolLifecycleEvent } from "../../../application/runtime/ports/runtimeToolLifecycle";
import {
  DebugDiagnosticsDefinitionList,
  type DebugDiagnosticsFieldDescriptor,
} from "./DebugDiagnosticsFieldGroups";

export type DebugRuntimeToolLifecycleSectionProps = {
  lifecycleEvents: RuntimeToolLifecycleEvent[];
};

function formatLifecycleTimestamp(value: number): string {
  return new Date(value).toISOString();
}

function sortLifecycleEvents(events: RuntimeToolLifecycleEvent[]): RuntimeToolLifecycleEvent[] {
  return events.slice().sort((left, right) => right.at - left.at);
}

function createLifecycleFields(
  event: RuntimeToolLifecycleEvent
): DebugDiagnosticsFieldDescriptor[] {
  return [
    { label: "at", value: formatLifecycleTimestamp(event.at) },
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
  const sortedEvents = sortLifecycleEvents(lifecycleEvents);
  const latestEvent = sortedEvents[0] ?? null;

  return (
    <div className="debug-event-channel-diagnostics" data-testid="debug-runtime-tool-lifecycle">
      <div className="debug-event-channel-diagnostics-title">Tool lifecycle</div>
      {latestEvent ? (
        <>
          <div className="debug-event-channel-diagnostics-empty">
            {sortedEvents.length} events observed.
          </div>
          <div className="debug-event-channel-diagnostics-empty">
            Latest event: {latestEvent.kind}/{latestEvent.phase} at{" "}
            <time dateTime={formatLifecycleTimestamp(latestEvent.at)}>
              {formatLifecycleTimestamp(latestEvent.at)}
            </time>
            .
          </div>
        </>
      ) : null}
      {sortedEvents.length === 0 ? (
        <div className="debug-event-channel-diagnostics-empty">
          No lifecycle activity observed yet.
        </div>
      ) : (
        <div className="debug-event-channel-diagnostics-grid">
          {sortedEvents.map((event) => (
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
