import { vi } from "vitest";
import { buildRuntimeSessionCheckpointBaseline } from "../../../application/runtime/facades/runtimeSessionCheckpointFacade";
import { buildRuntimeSessionCheckpointPresentationSummary } from "../../../application/runtime/facades/runtimeSessionCheckpointPresentation";
import { buildRuntimeToolLifecyclePresentationSummary } from "../../../application/runtime/ports/runtimeToolLifecycle";
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

function createRuntimeToolLifecycleFixture(input?: {
  hookCheckpoints?: DebugPanelBodyProps["runtimeToolLifecycle"]["hookCheckpoints"];
  lifecycleEvents?: DebugPanelBodyProps["runtimeToolLifecycle"]["lifecycleEvents"];
  revision?: number;
  workspaceId?: string | null;
}): DebugPanelBodyProps["runtimeToolLifecycle"] {
  const lifecycleEvents = input?.lifecycleEvents ?? [];
  const hookCheckpoints = input?.hookCheckpoints ?? [];
  const revision = input?.revision ?? 0;
  const workspaceId = input?.workspaceId ?? "workspace-1";
  const lifecycle = {
    summary: buildRuntimeToolLifecyclePresentationSummary({
      lifecycleEvents,
      hookCheckpoints,
    }),
    revision,
    lastHookCheckpoint: hookCheckpoints[0] ?? null,
    lastEvent: lifecycleEvents[0] ?? null,
    hookCheckpoints,
    lifecycleEvents,
  };
  const sessionCheckpointBaseline = buildRuntimeSessionCheckpointBaseline({
    workspaceId,
    lifecycleSnapshot: {
      revision: lifecycle.revision,
      lastEvent: lifecycle.lastEvent,
      recentEvents: lifecycle.lifecycleEvents,
      lastHookCheckpoint: lifecycle.lastHookCheckpoint,
      recentHookCheckpoints: lifecycle.hookCheckpoints,
    },
  });

  return {
    ...lifecycle,
    sessionCheckpointBaseline,
    sessionCheckpointSummary:
      buildRuntimeSessionCheckpointPresentationSummary(sessionCheckpointBaseline),
  };
}

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
    runtimeToolLifecycle: createRuntimeToolLifecycleFixture(),
    runtimePlugins: {
      plugins: [],
      loading: false,
      error: null,
      projectionBacked: false,
      refresh: vi.fn(async () => undefined),
      registry: {
        packages: [],
        installedCount: 0,
        verifiedCount: 0,
        blockedCount: 0,
        error: null,
      },
      composition: {
        profiles: [],
        activeProfileId: null,
        activeProfile: null,
        resolution: null,
        error: null,
      },
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

  const mergedRuntimeToolLifecycle = {
    ...baseProps.runtimeToolLifecycle,
    ...overrides.runtimeToolLifecycle,
  };

  return {
    ...baseProps,
    ...overrides,
    runtimeToolLifecycle: createRuntimeToolLifecycleFixture({
      workspaceId: mergedRuntimeToolLifecycle.sessionCheckpointBaseline.workspaceId,
      lifecycleEvents: mergedRuntimeToolLifecycle.lifecycleEvents,
      hookCheckpoints: mergedRuntimeToolLifecycle.hookCheckpoints,
      revision: mergedRuntimeToolLifecycle.revision,
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
    runtimeToolLifecycle: createRuntimeToolLifecycleFixture({
      lifecycleEvents: [createRuntimeToolLifecycleEvent()],
      revision: 1,
    }),
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
