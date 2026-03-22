import type {
  AgentTaskDurabilityDiagnostics,
  DistributedDiagnostics,
} from "../utils/debugEntryDiagnostics";
import { DebugDistributedDiagnosticsSection } from "./DebugDistributedDiagnosticsSection";
import { DebugDurabilitySection } from "./DebugDurabilitySection";

export type DebugDiagnosticsSummaryProps = {
  observabilityCapabilityEnabled: boolean;
  distributedDiagnostics: DistributedDiagnostics | null;
  hasRemoteExecutionDiagnostics: boolean;
  agentTaskDurabilityDiagnostics: AgentTaskDurabilityDiagnostics | null;
};

export function DebugDiagnosticsSummary({
  observabilityCapabilityEnabled,
  distributedDiagnostics,
  hasRemoteExecutionDiagnostics,
  agentTaskDurabilityDiagnostics,
}: DebugDiagnosticsSummaryProps) {
  return (
    <>
      {observabilityCapabilityEnabled ? (
        <DebugDistributedDiagnosticsSection
          distributedDiagnostics={distributedDiagnostics}
          hasRemoteExecutionDiagnostics={hasRemoteExecutionDiagnostics}
        />
      ) : null}
      {agentTaskDurabilityDiagnostics ? (
        <DebugDurabilitySection diagnostics={agentTaskDurabilityDiagnostics} />
      ) : null}
    </>
  );
}
