import { vi } from "vitest";
import type { DebugEntry } from "../../../types";
import type { DebugPanelBodyProps } from "../components/DebugPanelBody";
import type {
  DebugPanelShellViewModelProps,
  DebugPanelViewModel,
} from "../hooks/debugPanelViewModelTypes";
import {
  createAgentTaskDurabilityDiagnostics,
  createDistributedDiagnostics,
  createFormattedDebugEntries,
  createRuntimeEventChannelDiagnostics,
  createRuntimeToolLifecycleEvent,
} from "./debugDiagnosticsFixtures";
import { buildRuntimeToolLifecyclePresentationSummary } from "../../../application/runtime/ports/runtimeToolLifecycle";

export function createDebugEntries(): DebugEntry[] {
  return [
    {
      id: "entry-1",
      timestamp: 1,
      source: "event",
      label: "runtime.updated",
      payload: {},
    },
  ];
}

export function createDebugPanelShellProps(
  overrides: Partial<DebugPanelShellViewModelProps> = {}
): DebugPanelShellViewModelProps {
  return {
    variant: "dock",
    isOpen: true,
    onResizeStart: undefined,
    diagnosticsExportBusy: false,
    diagnosticsExportSupported: true,
    onExportDiagnostics: vi.fn(),
    onCopy: vi.fn(),
    onClear: vi.fn(),
    diagnosticsExportCapabilityResolved: true,
    diagnosticsExportError: null,
    diagnosticsExportStatus: "ready",
    ...overrides,
  };
}

export function createDebugPanelBodyProps(
  overrides: Partial<DebugPanelBodyProps> = {}
): DebugPanelBodyProps {
  const baseProps: DebugPanelBodyProps = {
    isOpen: true,
    observabilityCapabilityEnabled: true,
    distributedDiagnostics: null,
    hasRemoteExecutionDiagnostics: false,
    agentTaskDurabilityDiagnostics: null,
    eventChannelDiagnostics: [],
    runtimeToolExecutionMetricsUpdatedAt: 0,
    runtimeToolExecutionTotals: {
      attemptedTotal: 0,
      startedTotal: 0,
      completedTotal: 0,
      successTotal: 0,
      validationFailedTotal: 0,
      runtimeFailedTotal: 0,
      timeoutTotal: 0,
      blockedTotal: 0,
      truncatedTotal: 0,
    },
    runtimeToolExecutionRecentExecutions: [],
    runtimeToolLifecycleSummary: buildRuntimeToolLifecyclePresentationSummary({
      lifecycleEvents: [],
      hookCheckpoints: [],
    }),
    runtimeToolLifecycleHookCheckpoints: [],
    runtimeToolLifecycleEvents: [],
    runtimeSessionCheckpointBaseline: {
      schemaVersion: "runtime-session-checkpoint-baseline/v1",
      workspaceId: "workspace-1",
      lifecycleRevision: 0,
      projectionSource: "runtime_tool_lifecycle",
      sessions: [],
    },
    runtimeSessionCheckpointSummary: {
      hasSessions: false,
      latestHookCheckpointKey: null,
      latestLifecycleEventId: null,
      latestSession: null,
      latestSessionLabel: null,
      totalCheckpointPayloads: 0,
      totalRecords: 0,
      totalSessions: 0,
    },
    runtimeEventBridgePath: "legacy",
    formattedEntries: [],
    isRuntimeProbeBusy: false,
    runtimeProbeBusyLabel: "idle",
    runtimeProbeError: null,
    runtimeProbeResult: null,
    liveSkillId: "core-bash",
    liveSkillInput: "",
    liveSkillPath: "",
    liveSkillQuery: "",
    liveSkillMaxDepth: "2",
    liveSkillMaxResults: "10",
    liveSkillIncludeHidden: false,
    isCoreTreeSkillSelected: false,
    onLiveSkillIdChange: vi.fn(),
    onLiveSkillInputChange: vi.fn(),
    onLiveSkillPathChange: vi.fn(),
    onLiveSkillQueryChange: vi.fn(),
    onLiveSkillMaxDepthChange: vi.fn(),
    onLiveSkillMaxResultsChange: vi.fn(),
    onLiveSkillIncludeHiddenChange: vi.fn(),
    onRunHealthProbe: vi.fn(),
    onRunToolMetricsProbe: vi.fn(),
    onRunRemoteStatusProbe: vi.fn(),
    onRunTerminalStatusProbe: vi.fn(),
    onRunSettingsProbe: vi.fn(),
    onRunBootstrapProbe: vi.fn(),
    onRunToolLifecycleProbe: vi.fn(),
    onRunLiveSkillProbe: vi.fn(),
  };

  const mergedProps = {
    ...baseProps,
    ...overrides,
  };

  if (overrides.runtimeToolLifecycleSummary !== undefined) {
    return mergedProps;
  }

  return {
    ...mergedProps,
    runtimeToolLifecycleSummary: buildRuntimeToolLifecyclePresentationSummary({
      lifecycleEvents: mergedProps.runtimeToolLifecycleEvents,
      hookCheckpoints: mergedProps.runtimeToolLifecycleHookCheckpoints,
    }),
  };
}

export function createPopulatedDebugPanelBodyProps(
  overrides: Partial<DebugPanelBodyProps> = {}
): DebugPanelBodyProps {
  return createDebugPanelBodyProps({
    observabilityCapabilityEnabled: true,
    distributedDiagnostics: createDistributedDiagnostics(),
    hasRemoteExecutionDiagnostics: true,
    agentTaskDurabilityDiagnostics: createAgentTaskDurabilityDiagnostics(),
    eventChannelDiagnostics: createRuntimeEventChannelDiagnostics(),
    runtimeToolLifecycleSummary: buildRuntimeToolLifecyclePresentationSummary({
      lifecycleEvents: [createRuntimeToolLifecycleEvent()],
      hookCheckpoints: [],
    }),
    runtimeToolLifecycleHookCheckpoints: [],
    runtimeToolLifecycleEvents: [createRuntimeToolLifecycleEvent()],
    runtimeSessionCheckpointBaseline: {
      schemaVersion: "runtime-session-checkpoint-baseline/v1",
      workspaceId: "workspace-1",
      lifecycleRevision: 1,
      projectionSource: "runtime_tool_lifecycle",
      sessions: [],
    },
    runtimeSessionCheckpointSummary: {
      hasSessions: false,
      latestHookCheckpointKey: null,
      latestLifecycleEventId: null,
      latestSession: null,
      latestSessionLabel: null,
      totalCheckpointPayloads: 0,
      totalRecords: 0,
      totalSessions: 0,
    },
    runtimeEventBridgePath: "v2",
    formattedEntries: createFormattedDebugEntries(),
    ...overrides,
  });
}

export function createDebugPanelViewModel(
  overrides: {
    isVisible?: boolean;
    shellProps?: Partial<DebugPanelShellViewModelProps>;
    bodyProps?: Partial<DebugPanelBodyProps>;
  } = {}
): DebugPanelViewModel {
  return {
    isVisible: overrides.isVisible ?? true,
    shellProps: createDebugPanelShellProps(overrides.shellProps),
    bodyProps: createDebugPanelBodyProps(overrides.bodyProps),
  };
}
