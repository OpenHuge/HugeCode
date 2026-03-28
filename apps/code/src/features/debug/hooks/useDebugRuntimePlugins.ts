import {
  useWorkspaceRuntimePluginProjection,
  type WorkspaceRuntimePluginProjectionState,
} from "../../../application/runtime/facades/runtimeKernelPluginProjectionHooks";

export type DebugRuntimePluginsState = WorkspaceRuntimePluginProjectionState;

export function useDebugRuntimePlugins(input: {
  workspaceId: string | null;
  enabled: boolean;
}): DebugRuntimePluginsState {
  return useWorkspaceRuntimePluginProjection(input);
}
