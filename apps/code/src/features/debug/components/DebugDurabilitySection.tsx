import type { AgentTaskDurabilityDiagnostics } from "../utils/debugEntryDiagnostics";
import { formatDiagnosticsTimestamp } from "../utils/debugEntryDiagnostics";
import {
  DebugDiagnosticsDefinitionList,
  type DebugDiagnosticsFieldDescriptor,
} from "./DebugDiagnosticsFieldGroups";

export type DebugDurabilitySectionProps = {
  diagnostics: AgentTaskDurabilityDiagnostics;
};

function createPrimaryFields(
  diagnostics: AgentTaskDurabilityDiagnostics
): DebugDiagnosticsFieldDescriptor[] {
  return [
    { label: "reason", value: diagnostics.reason },
    { label: "revision", value: diagnostics.revision ?? "-" },
    { label: "occurrences_in_window", value: diagnostics.occurrencesInWindow },
    {
      label: "first_seen_at",
      value: formatDiagnosticsTimestamp(diagnostics.firstSeenAt),
    },
    {
      label: "last_seen_at",
      value: formatDiagnosticsTimestamp(diagnostics.lastSeenAt),
    },
    { label: "mode", value: diagnostics.mode ?? "-" },
    {
      label: "degraded",
      value: diagnostics.degraded === null ? "-" : diagnostics.degraded ? "true" : "false",
    },
    {
      label: "checkpoint_write_total",
      value: diagnostics.checkpointWriteTotal ?? "-",
    },
    {
      label: "checkpoint_write_failed_total",
      value: diagnostics.checkpointWriteFailedTotal ?? "-",
    },
  ];
}

function createSecondaryFields(
  diagnostics: AgentTaskDurabilityDiagnostics
): DebugDiagnosticsFieldDescriptor[] {
  return [
    {
      label: "agent_task_checkpoint_recover_total",
      value: diagnostics.agentTaskCheckpointRecoverTotal ?? "-",
    },
    {
      label: "subagent_checkpoint_recover_total",
      value: diagnostics.subagentCheckpointRecoverTotal ?? "-",
    },
    {
      label: "runtime_recovery_interrupt_total",
      value: diagnostics.runtimeRecoveryInterruptTotal ?? "-",
    },
    {
      label: "agent_task_resume_total",
      value: diagnostics.agentTaskResumeTotal ?? "-",
    },
    {
      label: "agent_task_resume_failed_total",
      value: diagnostics.agentTaskResumeFailedTotal ?? "-",
    },
  ];
}

export function DebugDurabilitySection({ diagnostics }: DebugDurabilitySectionProps) {
  return (
    <div
      className="debug-event-channel-diagnostics"
      data-testid="debug-agent-task-durability-diagnostics"
    >
      <div className="debug-event-channel-diagnostics-title">Agent Task Durability</div>
      <div className="debug-event-channel-diagnostics-grid">
        <div className="debug-event-channel-diagnostics-item">
          <DebugDiagnosticsDefinitionList fields={createPrimaryFields(diagnostics)} />
        </div>
        <div className="debug-event-channel-diagnostics-item">
          <DebugDiagnosticsDefinitionList fields={createSecondaryFields(diagnostics)} />
        </div>
      </div>
    </div>
  );
}
