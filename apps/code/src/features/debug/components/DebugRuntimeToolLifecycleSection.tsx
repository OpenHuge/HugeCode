import type {
  RuntimeToolLifecycleEvent,
  RuntimeToolLifecycleHookCheckpoint,
} from "../../../application/runtime/ports/runtimeToolLifecycle";
import {
  sortRuntimeToolLifecycleEventsByRecency,
  sortRuntimeToolLifecycleHookCheckpointsByRecency,
} from "../../../application/runtime/ports/runtimeToolLifecycle";
import {
  DebugDiagnosticsDefinitionList,
  type DebugDiagnosticsFieldDescriptor,
} from "./DebugDiagnosticsFieldGroups";

export type DebugRuntimeToolLifecycleSectionProps = {
  hookCheckpoints: RuntimeToolLifecycleHookCheckpoint[];
  lifecycleEvents: RuntimeToolLifecycleEvent[];
};

function formatLifecycleTimestamp(value: number): string {
  return new Date(value).toISOString();
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

function createHookCheckpointFields(
  checkpoint: RuntimeToolLifecycleHookCheckpoint
): DebugDiagnosticsFieldDescriptor[] {
  return [
    { label: "at", value: formatLifecycleTimestamp(checkpoint.at) },
    { label: "source", value: checkpoint.source },
    { label: "workspace", value: checkpoint.workspaceId ?? "-" },
    { label: "thread", value: checkpoint.threadId ?? "-" },
    { label: "turn", value: checkpoint.turnId ?? "-" },
    { label: "tool", value: checkpoint.toolName ?? "-" },
    { label: "tool_call", value: checkpoint.toolCallId ?? "-" },
    { label: "scope", value: checkpoint.scope ?? "-" },
    { label: "event_id", value: checkpoint.lifecycleEventId },
    { label: "reason", value: checkpoint.reason ?? "-" },
  ];
}

export function DebugRuntimeToolLifecycleSection({
  hookCheckpoints,
  lifecycleEvents,
}: DebugRuntimeToolLifecycleSectionProps) {
  const sortedEvents = sortRuntimeToolLifecycleEventsByRecency(lifecycleEvents);
  const sortedHookCheckpoints = sortRuntimeToolLifecycleHookCheckpointsByRecency(hookCheckpoints);
  const latestEvent = sortedEvents[0] ?? null;
  const latestHookCheckpoint = sortedHookCheckpoints[0] ?? null;

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
      {latestHookCheckpoint ? (
        <>
          <div className="debug-event-channel-diagnostics-empty">
            {sortedHookCheckpoints.length} hook checkpoints observed.
          </div>
          <div className="debug-event-channel-diagnostics-empty">
            Latest hook checkpoint: {latestHookCheckpoint.point}/{latestHookCheckpoint.status} at{" "}
            <time dateTime={formatLifecycleTimestamp(latestHookCheckpoint.at)}>
              {formatLifecycleTimestamp(latestHookCheckpoint.at)}
            </time>
            .
          </div>
        </>
      ) : null}
      {sortedEvents.length === 0 && sortedHookCheckpoints.length === 0 ? (
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
          {sortedHookCheckpoints.map((checkpoint) => (
            <div key={checkpoint.key} className="debug-event-channel-diagnostics-item">
              <div className="debug-event-channel-diagnostics-label">
                {checkpoint.point}/{checkpoint.status}
              </div>
              <DebugDiagnosticsDefinitionList fields={createHookCheckpointFields(checkpoint)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
