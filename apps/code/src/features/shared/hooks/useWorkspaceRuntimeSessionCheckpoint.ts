import { buildRuntimeSessionCheckpointBaseline } from "../../../application/runtime/facades/runtimeSessionCheckpointFacade";
import type { RuntimeSessionCheckpointPresentationSummary } from "../../../application/runtime/facades/runtimeSessionCheckpointPresentation";
import { buildRuntimeSessionCheckpointPresentationSummary } from "../../../application/runtime/facades/runtimeSessionCheckpointPresentation";
import {
  RUNTIME_SESSION_CHECKPOINT_BASELINE_SCHEMA_VERSION,
  RUNTIME_SESSION_CHECKPOINT_PROJECTION_SOURCE,
  type RuntimeSessionCheckpointBaseline,
} from "../../../application/runtime/types/runtimeSessionCheckpoint";
import {
  useWorkspaceRuntimeToolLifecycle,
  type WorkspaceRuntimeToolLifecycleState,
} from "./useWorkspaceRuntimeToolLifecycle";

type UseWorkspaceRuntimeSessionCheckpointOptions = {
  workspaceId: string | null;
  enabled?: boolean;
};

export type WorkspaceRuntimeSessionCheckpointState = {
  lifecycle: WorkspaceRuntimeToolLifecycleState;
  sessionCheckpointBaseline: RuntimeSessionCheckpointBaseline;
  sessionCheckpointSummary: RuntimeSessionCheckpointPresentationSummary;
};

function buildEmptyRuntimeSessionCheckpointBaseline(
  workspaceId: string | null
): RuntimeSessionCheckpointBaseline {
  return {
    schemaVersion: RUNTIME_SESSION_CHECKPOINT_BASELINE_SCHEMA_VERSION,
    workspaceId,
    lifecycleRevision: 0,
    projectionSource: RUNTIME_SESSION_CHECKPOINT_PROJECTION_SOURCE,
    sessions: [],
  };
}

export function useWorkspaceRuntimeSessionCheckpoint({
  workspaceId,
  enabled = true,
}: UseWorkspaceRuntimeSessionCheckpointOptions): WorkspaceRuntimeSessionCheckpointState {
  const lifecycle = useWorkspaceRuntimeToolLifecycle({
    workspaceId,
    enabled,
  });

  const sessionCheckpointBaseline = enabled
    ? buildRuntimeSessionCheckpointBaseline({
        workspaceId,
        lifecycleSnapshot: {
          revision: lifecycle.revision,
          lastEvent: lifecycle.lastEvent,
          recentEvents: lifecycle.lifecycleEvents,
          lastHookCheckpoint: lifecycle.lastHookCheckpoint,
          recentHookCheckpoints: lifecycle.hookCheckpoints,
        },
      })
    : buildEmptyRuntimeSessionCheckpointBaseline(workspaceId);

  return {
    lifecycle,
    sessionCheckpointBaseline,
    sessionCheckpointSummary:
      buildRuntimeSessionCheckpointPresentationSummary(sessionCheckpointBaseline),
  };
}
