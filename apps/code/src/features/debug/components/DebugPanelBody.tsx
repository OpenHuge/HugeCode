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
import { DebugRuntimeToolExecutionMetricsSection } from "./DebugRuntimeToolExecutionMetricsSection";
import { DebugRuntimeToolLifecycleSection } from "./DebugRuntimeToolLifecycleSection";
import type {
  RuntimeToolLifecycleEvent,
  RuntimeToolLifecycleHookCheckpoint,
  RuntimeToolLifecyclePresentationSummary,
} from "../../../application/runtime/ports/runtimeToolLifecycle";
import type {
  RuntimeToolExecutionRecentEntry,
  RuntimeToolExecutionTotals,
} from "../../../application/runtime/ports/runtimeToolExecutionMetrics";

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
  runtimeToolLifecycleSummary: RuntimeToolLifecyclePresentationSummary;
  runtimeToolLifecycleHookCheckpoints: RuntimeToolLifecycleHookCheckpoint[];
  runtimeToolLifecycleEvents: RuntimeToolLifecycleEvent[];
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
  runtimeToolLifecycleSummary,
  runtimeToolLifecycleHookCheckpoints,
  runtimeToolLifecycleEvents,
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
      <DebugRuntimeToolLifecycleSection
        lifecycleEvents={runtimeToolLifecycleEvents}
        hookCheckpoints={runtimeToolLifecycleHookCheckpoints}
        summary={runtimeToolLifecycleSummary}
      />
      <DebugRuntimeProbesSection {...probeProps} />
      {isOpen ? <DebugEntriesList formattedEntries={formattedEntries} /> : null}
    </>
  );
}
