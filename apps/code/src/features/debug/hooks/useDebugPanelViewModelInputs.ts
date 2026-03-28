import {
  type CreateDebugPanelViewModelParams,
  type DebugPanelViewModelParams,
  isDebugPanelVisible,
} from "./debugPanelViewModel";
import { useDebugEntryDiagnostics } from "./useDebugEntryDiagnostics";
import { useDebugRuntimeCapabilities } from "./useDebugRuntimeCapabilities";
import { useDebugRuntimeEventChannels } from "./useDebugRuntimeEventChannels";
import { useDebugRuntimePlugins } from "./useDebugRuntimePlugins";
import { useDebugRuntimeToolExecutionMetrics } from "./useDebugRuntimeToolExecutionMetrics";
import { useDebugRuntimeToolLifecycle } from "./useDebugRuntimeToolLifecycle";
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
  const runtimePlugins = useDebugRuntimePlugins({
    workspaceId: params.workspaceId,
    enabled: isVisible,
  });
  const runtimeToolExecutionMetrics = useDebugRuntimeToolExecutionMetrics({
    enabled: isVisible,
  });
  const runtimeToolLifecycle = useDebugRuntimeToolLifecycle({
    workspaceId: params.workspaceId,
    enabled: isVisible,
  });
  const runtimeProbe = useDebugRuntimeProbe({ workspaceId: params.workspaceId });
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
    runtimePlugins,
    runtimeToolExecutionMetrics,
    runtimeToolLifecycle,
    runtimeProbe,
    formattedEntries,
    entryDiagnostics,
  };
}
