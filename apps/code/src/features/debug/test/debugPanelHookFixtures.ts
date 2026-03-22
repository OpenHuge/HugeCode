import { vi } from "vitest";
import type { CreateDebugPanelViewModelParams } from "../hooks/debugPanelViewModel";
import { createDebugEntries } from "./debugPanelComponentFixtures";

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
    runRemoteStatusProbe: vi.fn(),
    runTerminalStatusProbe: vi.fn(),
    runSettingsProbe: vi.fn(),
    runBootstrapProbe: vi.fn(),
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
    runtimeProbe: createDebugRuntimeProbeState(),
    formattedEntries: [],
    entryDiagnostics: createDebugEntryDiagnosticsState(),
    ...overrides,
  };
}
