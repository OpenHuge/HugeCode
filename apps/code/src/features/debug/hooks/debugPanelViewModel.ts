import type { DebugPanelViewModel, DebugPanelViewModelParams } from "./debugPanelViewModelTypes";
import type { useDebugEntryDiagnostics } from "./useDebugEntryDiagnostics";
import type { useDebugRuntimeCapabilities } from "./useDebugRuntimeCapabilities";
import type { useDebugRuntimeEventChannels } from "./useDebugRuntimeEventChannels";
import type { useDebugRuntimeToolLifecycle } from "./useDebugRuntimeToolLifecycle";
import type { useDebugRuntimeProbe } from "./useDebugRuntimeProbe";
import type { useFormattedDebugEntries } from "./useFormattedDebugEntries";
import type { useRuntimeDiagnosticsExport } from "./useRuntimeDiagnosticsExport";

export type {
  DebugPanelShellViewModelProps,
  DebugPanelVariant,
  DebugPanelViewModel,
  DebugPanelViewModelParams,
} from "./debugPanelViewModelTypes";

type DebugRuntimeCapabilitiesState = ReturnType<typeof useDebugRuntimeCapabilities>;
type RuntimeDiagnosticsExportState = ReturnType<typeof useRuntimeDiagnosticsExport>;
type DebugRuntimeEventChannelsState = ReturnType<typeof useDebugRuntimeEventChannels>;
type DebugRuntimeToolLifecycleState = ReturnType<typeof useDebugRuntimeToolLifecycle>;
type DebugRuntimeProbeState = ReturnType<typeof useDebugRuntimeProbe>;
type DebugEntryDiagnosticsState = ReturnType<typeof useDebugEntryDiagnostics>;
type FormattedEntries = ReturnType<typeof useFormattedDebugEntries>;

export type CreateDebugPanelViewModelParams = DebugPanelViewModelParams & {
  runtimeCapabilities: DebugRuntimeCapabilitiesState;
  diagnosticsExport: RuntimeDiagnosticsExportState;
  runtimeEventChannels: DebugRuntimeEventChannelsState;
  runtimeToolLifecycle: DebugRuntimeToolLifecycleState;
  runtimeProbe: DebugRuntimeProbeState;
  formattedEntries: FormattedEntries;
  entryDiagnostics: DebugEntryDiagnosticsState;
};

export function isDebugPanelVisible({
  isOpen,
  variant,
}: Pick<DebugPanelViewModelParams, "isOpen" | "variant">): boolean {
  return variant === "full" || isOpen;
}

export function createDebugPanelViewModel({
  isOpen,
  onClear,
  onCopy,
  onResizeStart,
  variant,
  runtimeCapabilities,
  diagnosticsExport,
  runtimeEventChannels,
  runtimeToolLifecycle,
  runtimeProbe,
  formattedEntries,
  entryDiagnostics,
}: CreateDebugPanelViewModelParams): DebugPanelViewModel {
  const isVisible = isDebugPanelVisible({ isOpen, variant });
  const {
    observabilityCapabilityEnabled,
    diagnosticsExportCapabilityResolved,
    diagnosticsExportSupported,
  } = runtimeCapabilities;
  const {
    diagnosticsExportBusy,
    diagnosticsExportError,
    diagnosticsExportStatus,
    exportDiagnostics,
  } = diagnosticsExport;
  const { eventChannelDiagnostics, runtimeEventBridgePath } = runtimeEventChannels;
  const { lifecycleEvents: runtimeToolLifecycleEvents } = runtimeToolLifecycle;
  const {
    runtimeProbeBusyLabel,
    runtimeProbeError,
    runtimeProbeResult,
    liveSkillId,
    setLiveSkillId,
    liveSkillInput,
    setLiveSkillInput,
    liveSkillPath,
    setLiveSkillPath,
    liveSkillQuery,
    setLiveSkillQuery,
    liveSkillMaxDepth,
    setLiveSkillMaxDepth,
    liveSkillMaxResults,
    setLiveSkillMaxResults,
    liveSkillIncludeHidden,
    setLiveSkillIncludeHidden,
    isCoreTreeSkillSelected,
    runHealthProbe,
    runToolMetricsProbe,
    runRemoteStatusProbe,
    runTerminalStatusProbe,
    runSettingsProbe,
    runBootstrapProbe,
    runToolLifecycleProbe,
    runLiveSkillProbe,
    isRuntimeProbeBusy,
  } = runtimeProbe;
  const { distributedDiagnostics, agentTaskDurabilityDiagnostics, hasRemoteExecutionDiagnostics } =
    entryDiagnostics;

  return {
    isVisible,
    shellProps: {
      variant,
      isOpen,
      onResizeStart,
      diagnosticsExportBusy,
      diagnosticsExportSupported,
      onExportDiagnostics: (mode) => void exportDiagnostics(mode),
      onCopy,
      onClear,
      diagnosticsExportCapabilityResolved,
      diagnosticsExportError,
      diagnosticsExportStatus,
    },
    bodyProps: {
      isOpen,
      observabilityCapabilityEnabled,
      distributedDiagnostics,
      hasRemoteExecutionDiagnostics,
      agentTaskDurabilityDiagnostics,
      eventChannelDiagnostics,
      runtimeToolLifecycleEvents,
      runtimeEventBridgePath,
      formattedEntries,
      isRuntimeProbeBusy,
      runtimeProbeBusyLabel,
      runtimeProbeError,
      runtimeProbeResult,
      liveSkillId,
      liveSkillInput,
      liveSkillPath,
      liveSkillQuery,
      liveSkillMaxDepth,
      liveSkillMaxResults,
      liveSkillIncludeHidden,
      isCoreTreeSkillSelected,
      onLiveSkillIdChange: setLiveSkillId,
      onLiveSkillInputChange: setLiveSkillInput,
      onLiveSkillPathChange: setLiveSkillPath,
      onLiveSkillQueryChange: setLiveSkillQuery,
      onLiveSkillMaxDepthChange: setLiveSkillMaxDepth,
      onLiveSkillMaxResultsChange: setLiveSkillMaxResults,
      onLiveSkillIncludeHiddenChange: setLiveSkillIncludeHidden,
      onRunHealthProbe: runHealthProbe,
      onRunToolMetricsProbe: runToolMetricsProbe,
      onRunRemoteStatusProbe: runRemoteStatusProbe,
      onRunTerminalStatusProbe: runTerminalStatusProbe,
      onRunSettingsProbe: runSettingsProbe,
      onRunBootstrapProbe: runBootstrapProbe,
      onRunToolLifecycleProbe: runToolLifecycleProbe,
      onRunLiveSkillProbe: runLiveSkillProbe,
    },
  };
}
