import type { RuntimeEventChannelDiagnostics } from "../../../application/runtime/ports/runtimeEventChannelDiagnostics";
import type {
  AgentTaskDurabilityDiagnostics,
  DistributedDiagnostics,
} from "../utils/debugEntryDiagnostics";
import { DebugDiagnosticsSummary } from "./DebugDiagnosticsSummary";
import { DebugEntriesList, type FormattedDebugEntry } from "./DebugEntriesList";
import { DebugEventChannelsSection } from "./DebugEventChannelsSection";
import {
  DebugRuntimeProbesSection,
  type DebugRuntimeProbesSectionProps,
} from "./DebugRuntimeProbesSection";

export type DebugPanelBodyProps = DebugRuntimeProbesSectionProps & {
  isOpen: boolean;
  observabilityCapabilityEnabled: boolean;
  distributedDiagnostics: DistributedDiagnostics | null;
  hasRemoteExecutionDiagnostics: boolean;
  agentTaskDurabilityDiagnostics: AgentTaskDurabilityDiagnostics | null;
  eventChannelDiagnostics: RuntimeEventChannelDiagnostics[];
  runtimeEventBridgePath: "legacy" | "v2";
  formattedEntries: FormattedDebugEntry[];
};

export function DebugPanelBody({
  isOpen,
  observabilityCapabilityEnabled,
  distributedDiagnostics,
  hasRemoteExecutionDiagnostics,
  agentTaskDurabilityDiagnostics,
  eventChannelDiagnostics,
  runtimeEventBridgePath,
  formattedEntries,
  ...probeProps
}: DebugPanelBodyProps) {
  return (
    <>
      <DebugDiagnosticsSummary
        observabilityCapabilityEnabled={observabilityCapabilityEnabled}
        distributedDiagnostics={distributedDiagnostics}
        hasRemoteExecutionDiagnostics={hasRemoteExecutionDiagnostics}
        agentTaskDurabilityDiagnostics={agentTaskDurabilityDiagnostics}
      />
      <DebugEventChannelsSection
        eventChannelDiagnostics={eventChannelDiagnostics}
        runtimeEventBridgePath={runtimeEventBridgePath}
      />
      <DebugRuntimeProbesSection {...probeProps} />
      {isOpen ? <DebugEntriesList formattedEntries={formattedEntries} /> : null}
    </>
  );
}
