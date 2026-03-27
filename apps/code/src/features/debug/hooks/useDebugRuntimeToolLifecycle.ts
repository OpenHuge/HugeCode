import {
  useWorkspaceRuntimeToolLifecycle,
  type WorkspaceRuntimeToolLifecycleState,
} from "../../shared/hooks/useWorkspaceRuntimeToolLifecycle";

type UseDebugRuntimeToolLifecycleOptions = {
  workspaceId: string | null;
  enabled: boolean;
};

type DebugRuntimeToolLifecycleState = WorkspaceRuntimeToolLifecycleState;

export function useDebugRuntimeToolLifecycle({
  workspaceId,
  enabled,
}: UseDebugRuntimeToolLifecycleOptions): DebugRuntimeToolLifecycleState {
  return useWorkspaceRuntimeToolLifecycle({
    workspaceId,
    enabled,
  });
}
