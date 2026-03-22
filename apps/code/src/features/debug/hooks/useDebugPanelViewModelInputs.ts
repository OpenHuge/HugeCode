import {
  type CreateDebugPanelViewModelParams,
  type DebugPanelViewModelParams,
  isDebugPanelVisible,
} from "./debugPanelViewModel";
import { useDebugEntryDiagnostics } from "./useDebugEntryDiagnostics";
import { useDebugRuntimeCapabilities } from "./useDebugRuntimeCapabilities";
import { useDebugRuntimeEventChannels } from "./useDebugRuntimeEventChannels";
import { useDebugRuntimeProbe } from "./useDebugRuntimeProbe";
import { useFormattedDebugEntries } from "./useFormattedDebugEntries";
import { useRuntimeDiagnosticsExport } from "./useRuntimeDiagnosticsExport";

export function useDebugPanelViewModelInputs(
  params: DebugPanelViewModelParams
): CreateDebugPanelViewModelParams {
  const isVisible = isDebugPanelVisible(params);
  const runtimeCapabilities = useDebugRuntimeCapabilities();
  const diagnosticsExport = useRuntimeDiagnosticsExport({ workspaceId: params.workspaceId });
  const runtimeEventChannels = useDebugRuntimeEventChannels();
  const runtimeProbe = useDebugRuntimeProbe();
  const formattedEntries = useFormattedDebugEntries(params.entries, isVisible);
  const entryDiagnostics = useDebugEntryDiagnostics(
    params.entries,
    runtimeCapabilities.observabilityCapabilityEnabled,
    isVisible
  );

  return {
    ...params,
    runtimeCapabilities,
    diagnosticsExport,
    runtimeEventChannels,
    runtimeProbe,
    formattedEntries,
    entryDiagnostics,
  };
}
