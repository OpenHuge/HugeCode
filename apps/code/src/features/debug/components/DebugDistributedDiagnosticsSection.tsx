import type { DistributedDiagnostics } from "../utils/debugEntryDiagnostics";
import { formatExecutionMode } from "../utils/debugEntryDiagnostics";
import {
  DebugDiagnosticsDefinitionList,
  type DebugDiagnosticsFieldDescriptor,
  DebugDiagnosticsMetricGrid,
} from "./DebugDiagnosticsFieldGroups";

export type DebugDistributedDiagnosticsSectionProps = {
  distributedDiagnostics: DistributedDiagnostics | null;
  hasRemoteExecutionDiagnostics: boolean;
};

function createSummaryFields(
  distributedDiagnostics: DistributedDiagnostics | null
): DebugDiagnosticsFieldDescriptor[] {
  return [
    {
      label: "backendsTotal",
      value: distributedDiagnostics?.backendsTotal ?? "-",
    },
    {
      label: "backendsHealthy",
      value: distributedDiagnostics?.backendsHealthy ?? "-",
    },
    {
      label: "backendsDraining",
      value: distributedDiagnostics?.backendsDraining ?? "-",
    },
    {
      label: "placementFailuresTotal",
      value: distributedDiagnostics?.placementFailuresTotal ?? "-",
    },
    {
      label: "queueDepth",
      value: distributedDiagnostics?.queueDepth ?? "-",
    },
    {
      label: "snapshotAgeMs",
      value: distributedDiagnostics?.snapshotAgeMs ?? "-",
    },
    {
      label: "stateFabricFanoutQueueDepth",
      value: distributedDiagnostics?.stateFabricFanoutQueueDepth ?? "-",
    },
    {
      label: "threadLiveUpdateFanoutQueueDepth",
      value: distributedDiagnostics?.threadLiveUpdateFanoutQueueDepth ?? "-",
    },
    {
      label: "stateFabricFanoutCoalescedTotal",
      value: distributedDiagnostics?.stateFabricFanoutCoalescedTotal ?? "-",
    },
    {
      label: "threadLiveUpdateFanoutCoalescedTotal",
      value: distributedDiagnostics?.threadLiveUpdateFanoutCoalescedTotal ?? "-",
    },
  ];
}

function createRemoteFields(
  distributedDiagnostics: DistributedDiagnostics | null
): DebugDiagnosticsFieldDescriptor[] {
  return [
    {
      label: "access_mode",
      value: distributedDiagnostics?.accessMode ?? "-",
    },
    {
      label: "routed_provider",
      value: distributedDiagnostics?.routedProvider ?? "-",
    },
    {
      label: "execution_mode",
      value: formatExecutionMode(distributedDiagnostics?.executionMode ?? null),
    },
    {
      label: "reason",
      value: distributedDiagnostics?.reason ?? "-",
    },
  ];
}

export function DebugDistributedDiagnosticsSection({
  distributedDiagnostics,
  hasRemoteExecutionDiagnostics,
}: DebugDistributedDiagnosticsSectionProps) {
  return (
    <div className="debug-distributed-diagnostics" data-testid="debug-distributed-diagnostics">
      <div className="debug-distributed-diagnostics-title">Distributed Diagnostics</div>
      <DebugDiagnosticsMetricGrid
        fields={createSummaryFields(distributedDiagnostics)}
        gridClassName="debug-distributed-diagnostics-grid"
        itemClassName="debug-distributed-diagnostics-item"
      />
      {hasRemoteExecutionDiagnostics ? (
        <details
          className="debug-distributed-diagnostics-remote"
          data-testid="debug-remote-execution-diagnostics"
        >
          <summary>Remote-provider execution diagnostics</summary>
          <div className="debug-distributed-diagnostics-remote-copy">
            Execution is routed through runtime providers by default. Local machine execution may be
            restricted by execution mode and policy.
          </div>
          <DebugDiagnosticsDefinitionList
            fields={createRemoteFields(distributedDiagnostics)}
            className="debug-distributed-diagnostics-remote-fields"
          />
        </details>
      ) : null}
    </div>
  );
}
