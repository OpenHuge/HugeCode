import type { RuntimeEventChannelDiagnostics } from "../../../application/runtime/ports/runtimeEventChannelDiagnostics";
import type {
  RuntimeToolExecutionRecentEntry,
  RuntimeToolExecutionTotals,
} from "../../../application/runtime/ports/runtimeToolExecutionMetrics";
import {
  type AgentTaskDurabilityDiagnostics,
  type DistributedDiagnostics,
} from "../utils/debugEntryDiagnostics";
import { DebugDiagnosticsSummary } from "./DebugDiagnosticsSummary";
import { DebugEntriesList, type FormattedDebugEntry } from "./DebugEntriesList";
import { DebugEventChannelsSection } from "./DebugEventChannelsSection";
import {
  DebugRuntimeProbesSection,
  type DebugRuntimeProbesSectionProps,
} from "./DebugRuntimeProbesSection";
import { DebugRuntimePluginsSection } from "./DebugRuntimePluginsSection";
import { DebugRuntimeToolExecutionMetricsSection } from "./DebugRuntimeToolExecutionMetricsSection";
import { DebugRuntimeToolLifecycleSection } from "./DebugRuntimeToolLifecycleSection";
import type { DebugRuntimeToolLifecycleState } from "../hooks/useDebugRuntimeToolLifecycle";
import type { DebugRuntimePluginsState } from "../hooks/useDebugRuntimePlugins";

export type DebugPanelBodyProps = DebugRuntimeProbesSectionProps & {
  isOpen: boolean;
  observabilityCapabilityEnabled: boolean;
  distributedDiagnostics: DistributedDiagnostics | null;
  hasRemoteExecutionDiagnostics: boolean;
  agentTaskDurabilityDiagnostics: AgentTaskDurabilityDiagnostics | null;
  eventChannelDiagnostics: RuntimeEventChannelDiagnostics[];
  runtimeToolExecutionMetricsUpdatedAt: number;
  runtimeToolExecutionTotals: RuntimeToolExecutionTotals;
  runtimeToolExecutionRecentExecutions: RuntimeToolExecutionRecentEntry[];
  runtimeToolLifecycle: DebugRuntimeToolLifecycleState;
  runtimePlugins: DebugRuntimePluginsState;
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
  runtimeToolExecutionMetricsUpdatedAt,
  runtimeToolExecutionTotals,
  runtimeToolExecutionRecentExecutions,
  runtimeToolLifecycle,
  runtimePlugins,
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
      <DebugRuntimeToolExecutionMetricsSection
        updatedAt={runtimeToolExecutionMetricsUpdatedAt}
        totals={runtimeToolExecutionTotals}
        recentExecutions={runtimeToolExecutionRecentExecutions}
      />
      <DebugRuntimeToolLifecycleSection runtimeToolLifecycle={runtimeToolLifecycle} />
      <DebugRuntimePluginsSection {...runtimePlugins} />
      <DebugRuntimeProbesSection {...probeProps} />
      {isOpen ? <DebugEntriesList formattedEntries={formattedEntries} /> : null}
    </>
  );
}
