import type {
  RuntimeToolLifecycleEvent,
  RuntimeToolLifecycleHookCheckpoint,
} from "../../../application/runtime/ports/runtimeToolLifecycle";
import {
  formatRuntimeToolLifecycleEventKey,
  formatRuntimeToolLifecycleHookCheckpointKey,
} from "../../../application/runtime/ports/runtimeToolLifecycle";
import type { WorkspaceRuntimeToolLifecycleProjection } from "../../shared/hooks/useWorkspaceRuntimeToolLifecycle";
import {
  DebugDiagnosticsDefinitionList,
  type DebugDiagnosticsFieldDescriptor,
} from "./DebugDiagnosticsFieldGroups";

export type DebugRuntimeToolLifecycleSectionProps = {
  runtimeToolLifecycle: WorkspaceRuntimeToolLifecycleProjection;
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
  runtimeToolLifecycle,
}: DebugRuntimeToolLifecycleSectionProps) {
  const { hookCheckpoints, lifecycleEvents, summary } = runtimeToolLifecycle;
  return (
    <div className="debug-event-channel-diagnostics" data-testid="debug-runtime-tool-lifecycle">
      <div className="debug-event-channel-diagnostics-title">Tool lifecycle</div>
      {summary.latestEvent ? (
        <>
          <div className="debug-event-channel-diagnostics-empty">
            {summary.totalEvents} events observed.
          </div>
          <div className="debug-event-channel-diagnostics-empty">
            Latest event: {summary.latestEventKey} at{" "}
            <time dateTime={formatLifecycleTimestamp(summary.latestEvent.at)}>
              {formatLifecycleTimestamp(summary.latestEvent.at)}
            </time>
            .
          </div>
        </>
      ) : null}
      {summary.latestHookCheckpoint ? (
        <>
          <div className="debug-event-channel-diagnostics-empty">
            {summary.totalHookCheckpoints} hook checkpoints observed.
          </div>
          <div className="debug-event-channel-diagnostics-empty">
            Latest hook checkpoint: {summary.latestHookCheckpointKey} at{" "}
            <time dateTime={formatLifecycleTimestamp(summary.latestHookCheckpoint.at)}>
              {formatLifecycleTimestamp(summary.latestHookCheckpoint.at)}
            </time>
            .
          </div>
        </>
      ) : null}
      {!summary.hasActivity ? (
        <div className="debug-event-channel-diagnostics-empty">
          No lifecycle activity observed yet.
        </div>
      ) : (
        <div className="debug-event-channel-diagnostics-grid">
          {lifecycleEvents.map((event) => (
            <div key={event.id} className="debug-event-channel-diagnostics-item">
              <div className="debug-event-channel-diagnostics-label">
                {formatRuntimeToolLifecycleEventKey(event)}
              </div>
              <DebugDiagnosticsDefinitionList fields={createLifecycleFields(event)} />
            </div>
          ))}
          {hookCheckpoints.map((checkpoint) => (
            <div key={checkpoint.key} className="debug-event-channel-diagnostics-item">
              <div className="debug-event-channel-diagnostics-label">
                {formatRuntimeToolLifecycleHookCheckpointKey(checkpoint)}
              </div>
              <DebugDiagnosticsDefinitionList fields={createHookCheckpointFields(checkpoint)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
