import {
  useWorkspaceRuntimeSessionCheckpoint,
  type WorkspaceRuntimeSessionCheckpointState,
} from "../../shared/hooks/useWorkspaceRuntimeSessionCheckpoint";

type UseDebugRuntimeToolLifecycleOptions = {
  workspaceId: string | null;
  enabled: boolean;
};

export type DebugRuntimeToolLifecycleState = WorkspaceRuntimeSessionCheckpointState["lifecycle"] & {
  sessionCheckpointBaseline: WorkspaceRuntimeSessionCheckpointState["sessionCheckpointBaseline"];
  sessionCheckpointSummary: WorkspaceRuntimeSessionCheckpointState["sessionCheckpointSummary"];
};

export function useDebugRuntimeToolLifecycle({
  workspaceId,
  enabled,
}: UseDebugRuntimeToolLifecycleOptions): DebugRuntimeToolLifecycleState {
  const sessionCheckpointState = useWorkspaceRuntimeSessionCheckpoint({
    workspaceId,
    enabled,
  });

  return {
    ...sessionCheckpointState.lifecycle,
    sessionCheckpointBaseline: sessionCheckpointState.sessionCheckpointBaseline,
    sessionCheckpointSummary: sessionCheckpointState.sessionCheckpointSummary,
  };
}
