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
  return {
    isOpen: true,
    observabilityCapabilityEnabled: true,
    distributedDiagnostics: null,
    hasRemoteExecutionDiagnostics: false,
    agentTaskDurabilityDiagnostics: null,
    eventChannelDiagnostics: [],
    runtimeToolLifecycleEvents: [],
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
    onRunRemoteStatusProbe: vi.fn(),
    onRunTerminalStatusProbe: vi.fn(),
    onRunSettingsProbe: vi.fn(),
    onRunBootstrapProbe: vi.fn(),
    onRunLiveSkillProbe: vi.fn(),
    ...overrides,
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
    runtimeToolLifecycleEvents: [createRuntimeToolLifecycleEvent()],
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
