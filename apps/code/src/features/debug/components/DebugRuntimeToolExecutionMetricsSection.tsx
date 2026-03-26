import type {
  RuntimeToolExecutionRecentEntry,
  RuntimeToolExecutionTotals,
} from "../../../application/runtime/ports/runtimeToolExecutionMetrics";
import {
  DebugDiagnosticsDefinitionList,
  DebugDiagnosticsMetricGrid,
  type DebugDiagnosticsFieldDescriptor,
} from "./DebugDiagnosticsFieldGroups";

export type DebugRuntimeToolExecutionMetricsSectionProps = {
  updatedAt: number;
  totals: RuntimeToolExecutionTotals;
  recentExecutions: RuntimeToolExecutionRecentEntry[];
};

function formatTimestamp(value: number): string {
  return new Date(value).toISOString();
}

function createTotalsFields(totals: RuntimeToolExecutionTotals): DebugDiagnosticsFieldDescriptor[] {
  return [
    { label: "attemptedTotal", value: totals.attemptedTotal },
    { label: "startedTotal", value: totals.startedTotal },
    { label: "completedTotal", value: totals.completedTotal },
    { label: "successTotal", value: totals.successTotal },
    { label: "validationFailedTotal", value: totals.validationFailedTotal },
    { label: "runtimeFailedTotal", value: totals.runtimeFailedTotal },
    { label: "timeoutTotal", value: totals.timeoutTotal },
    { label: "blockedTotal", value: totals.blockedTotal },
    { label: "truncatedTotal", value: totals.truncatedTotal },
  ];
}

function createExecutionFields(
  execution: RuntimeToolExecutionRecentEntry
): DebugDiagnosticsFieldDescriptor[] {
  return [
    { label: "at", value: formatTimestamp(execution.at) },
    { label: "status", value: execution.status },
    { label: "scope", value: execution.scope },
    { label: "duration_ms", value: execution.durationMs ?? "-" },
    { label: "truncated", value: execution.truncatedOutput ? "yes" : "no" },
    { label: "error_code", value: execution.errorCode ?? "-" },
    {
      label: "annotations",
      value: execution.annotations.length > 0 ? execution.annotations.join(", ") : "-",
    },
  ];
}

export function DebugRuntimeToolExecutionMetricsSection({
  updatedAt,
  totals,
  recentExecutions,
}: DebugRuntimeToolExecutionMetricsSectionProps) {
  const visibleExecutions = recentExecutions.slice(0, 6);

  return (
    <div
      className="debug-event-channel-diagnostics"
      data-testid="debug-runtime-tool-execution-metrics"
    >
      <div className="debug-event-channel-diagnostics-title">Tool execution metrics</div>
      <div className="debug-event-channel-diagnostics-empty">
        Snapshot updated: {updatedAt > 0 ? formatTimestamp(updatedAt) : "not yet recorded"}.
      </div>
      <DebugDiagnosticsMetricGrid
        fields={createTotalsFields(totals)}
        gridClassName="debug-diagnostics-summary-grid"
        itemClassName="debug-diagnostics-summary-item"
      />
      {visibleExecutions.length === 0 ? (
        <div className="debug-event-channel-diagnostics-empty">
          No tool execution metrics recorded yet.
        </div>
      ) : (
        <div className="debug-event-channel-diagnostics-grid">
          {visibleExecutions.map((execution) => (
            <div
              key={`${execution.at}-${execution.scope}-${execution.toolName}`}
              className="debug-event-channel-diagnostics-item"
            >
              <div className="debug-event-channel-diagnostics-label">{execution.toolName}</div>
              <DebugDiagnosticsDefinitionList fields={createExecutionFields(execution)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
