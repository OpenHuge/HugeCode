import { vi } from "vitest";
import type { CreateDebugPanelViewModelParams } from "../hooks/debugPanelViewModel";
import { createDebugEntries } from "./debugPanelComponentFixtures";
import { buildRuntimeToolLifecyclePresentationSummary } from "../../../application/runtime/ports/runtimeToolLifecycle";

export function createDebugRuntimeCapabilitiesState(
  overrides: Partial<CreateDebugPanelViewModelParams["runtimeCapabilities"]> = {}
): CreateDebugPanelViewModelParams["runtimeCapabilities"] {
  return {
    observabilityCapabilityEnabled: true,
    diagnosticsExportCapabilityResolved: true,
    diagnosticsExportSupported: true,
    ...overrides,
  };
}

export function createRuntimeDiagnosticsExportState(
  overrides: Partial<CreateDebugPanelViewModelParams["diagnosticsExport"]> = {}
): CreateDebugPanelViewModelParams["diagnosticsExport"] {
  return {
    diagnosticsExportBusy: false,
    diagnosticsExportError: null,
    diagnosticsExportStatus: "ready",
    exportDiagnostics: vi.fn(async () => undefined),
    ...overrides,
  };
}

export function createDebugRuntimeEventChannelsState(
  overrides: Partial<CreateDebugPanelViewModelParams["runtimeEventChannels"]> = {}
): CreateDebugPanelViewModelParams["runtimeEventChannels"] {
  return {
    eventChannelDiagnostics: [],
    runtimeEventBridgePath: "legacy",
    ...overrides,
  };
}

export function createDebugRuntimePluginsState(
  overrides: Partial<CreateDebugPanelViewModelParams["runtimePlugins"]> = {}
): CreateDebugPanelViewModelParams["runtimePlugins"] {
  return {
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
    ...overrides,
  };
}

export function createDebugRuntimeToolExecutionMetricsState(
  overrides: Partial<CreateDebugPanelViewModelParams["runtimeToolExecutionMetrics"]> = {}
): CreateDebugPanelViewModelParams["runtimeToolExecutionMetrics"] {
  return {
    updatedAt: 0,
    totals: {
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
    recentExecutions: [],
    ...overrides,
  };
}

export function createDebugRuntimeProbeState(
  overrides: Partial<CreateDebugPanelViewModelParams["runtimeProbe"]> = {}
): CreateDebugPanelViewModelParams["runtimeProbe"] {
  return {
    runtimeProbeBusyLabel: null,
    runtimeProbeError: null,
    runtimeProbeResult: null,
    liveSkillId: "core-bash",
    setLiveSkillId: vi.fn(),
    liveSkillInput: "{}",
    setLiveSkillInput: vi.fn(),
    liveSkillPath: "",
    setLiveSkillPath: vi.fn(),
    liveSkillQuery: "",
    setLiveSkillQuery: vi.fn(),
    liveSkillMaxDepth: "2",
    setLiveSkillMaxDepth: vi.fn(),
    liveSkillMaxResults: "10",
    setLiveSkillMaxResults: vi.fn(),
    liveSkillIncludeHidden: false,
    setLiveSkillIncludeHidden: vi.fn(),
    isCoreTreeSkillSelected: false,
    runHealthProbe: vi.fn(),
    runToolMetricsProbe: vi.fn(),
    runRemoteStatusProbe: vi.fn(),
    runTerminalStatusProbe: vi.fn(),
    runSettingsProbe: vi.fn(),
    runBootstrapProbe: vi.fn(),
    runToolLifecycleProbe: vi.fn(),
    runLiveSkillProbe: vi.fn(),
    isRuntimeProbeBusy: false,
    ...overrides,
  };
}

export function createDebugEntryDiagnosticsState(
  overrides: Partial<CreateDebugPanelViewModelParams["entryDiagnostics"]> = {}
): CreateDebugPanelViewModelParams["entryDiagnostics"] {
  return {
    distributedDiagnostics: null,
    agentTaskDurabilityDiagnostics: null,
    hasRemoteExecutionDiagnostics: false,
    ...overrides,
  };
}

export function createDebugPanelViewModelBuilderParams(
  overrides: Partial<CreateDebugPanelViewModelParams> = {}
): CreateDebugPanelViewModelParams {
  return {
    entries: createDebugEntries(),
    isOpen: true,
    workspaceId: "workspace-1",
    onClear: vi.fn(),
    onCopy: vi.fn(),
    onResizeStart: vi.fn(),
    variant: "dock",
    runtimeCapabilities: createDebugRuntimeCapabilitiesState(),
    diagnosticsExport: createRuntimeDiagnosticsExportState(),
    runtimeEventChannels: createDebugRuntimeEventChannelsState(),
    runtimePlugins: createDebugRuntimePluginsState(),
    runtimeToolExecutionMetrics: createDebugRuntimeToolExecutionMetricsState(),
    runtimeToolLifecycle: {
      summary: buildRuntimeToolLifecyclePresentationSummary({
        lifecycleEvents: [],
        hookCheckpoints: [],
      }),
      revision: 0,
      lastHookCheckpoint: null,
      lastEvent: null,
      hookCheckpoints: [],
      lifecycleEvents: [],
      sessionCheckpointBaseline: {
        schemaVersion: "runtime-session-checkpoint-baseline/v1",
        workspaceId: "workspace-1",
        lifecycleRevision: 0,
        projectionSource: "runtime_tool_lifecycle",
        sessions: [],
      },
      sessionCheckpointSummary: {
        hasSessions: false,
        latestHookCheckpointKey: null,
        latestLifecycleEventId: null,
        latestSession: null,
        latestSessionLabel: null,
        totalCheckpointPayloads: 0,
        totalRecords: 0,
        totalSessions: 0,
      },
    },
    runtimeProbe: createDebugRuntimeProbeState(),
    formattedEntries: [],
    entryDiagnostics: createDebugEntryDiagnosticsState(),
    ...overrides,
  };
}
