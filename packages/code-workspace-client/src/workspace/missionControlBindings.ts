import type {
  HugeCodeMissionControlSnapshot,
  KernelProjectionScope,
} from "@ku0/code-runtime-host-contract";
import type {
  WorkspaceClientRuntimeBindings,
  WorkspaceClientRuntimeMissionControlBindings,
  WorkspaceClientRuntimeMissionControlSourceAdapter,
  WorkspaceClientRuntimeReviewBindings,
} from "./bindings";
import { readMissionControlProjectionSlice } from "../workspace-shell/kernelProjectionStore";

export type MissionControlSnapshotReader = () => Promise<HugeCodeMissionControlSnapshot>;
export type SnapshotBackedMissionControlSurfaceBindings = Pick<
  WorkspaceClientRuntimeBindings,
  "missionControl" | "review"
>;

const MISSION_CONTROL_PROJECTION_SCOPES: KernelProjectionScope[] = ["mission_control"];

type WorkspaceClientMissionControlSurfaceBindingsInput =
  WorkspaceClientRuntimeMissionControlSourceAdapter;

export async function readMissionControlSnapshotFromSourceAdapter(
  adapter: WorkspaceClientRuntimeMissionControlSourceAdapter
): Promise<HugeCodeMissionControlSnapshot> {
  if (adapter.bootstrapKernelProjection) {
    try {
      const bootstrap = await adapter.bootstrapKernelProjection({
        scopes: MISSION_CONTROL_PROJECTION_SCOPES,
      });
      const missionControl = readMissionControlProjectionSlice(bootstrap);
      if (missionControl) {
        return missionControl;
      }
      adapter.reportMissionControlFallback?.({
        reason: "projection_slice_missing",
      });
    } catch (error) {
      adapter.reportMissionControlFallback?.({
        reason: "projection_bootstrap_failed",
        error,
      });
      // Fall through to snapshot-backed truth when projection bootstrap is unavailable.
    }
  }

  return await adapter.readMissionControlSnapshot();
}

export function createWorkspaceClientRuntimeMissionControlBindings(
  input: WorkspaceClientMissionControlSurfaceBindingsInput
): WorkspaceClientRuntimeMissionControlBindings {
  const readMissionControlSnapshot = async () =>
    await readMissionControlSnapshotFromSourceAdapter(input);

  return {
    readMissionControlSnapshot,
  };
}

export function createWorkspaceClientRuntimeReviewBindings(
  input: WorkspaceClientRuntimeMissionControlSourceAdapter
): WorkspaceClientRuntimeReviewBindings {
  return {
    listReviewPacks: async () =>
      (await readMissionControlSnapshotFromSourceAdapter(input)).reviewPacks,
  };
}

export function createWorkspaceClientRuntimeMissionControlSurfaceBindings(
  input: WorkspaceClientMissionControlSurfaceBindingsInput
): SnapshotBackedMissionControlSurfaceBindings {
  return {
    missionControl: createWorkspaceClientRuntimeMissionControlBindings(input),
    review: createWorkspaceClientRuntimeReviewBindings(input),
  };
}

export function createSnapshotBackedMissionControlBindings(input: {
  readMissionControlSnapshot: MissionControlSnapshotReader;
}): WorkspaceClientRuntimeMissionControlBindings {
  return createWorkspaceClientRuntimeMissionControlBindings(input);
}

export function createSnapshotBackedReviewBindings(input: {
  readMissionControlSnapshot: MissionControlSnapshotReader;
}): WorkspaceClientRuntimeReviewBindings {
  return createWorkspaceClientRuntimeReviewBindings(input);
}

export function createSnapshotBackedMissionControlSurfaceBindings(input: {
  readMissionControlSnapshot: MissionControlSnapshotReader;
}): SnapshotBackedMissionControlSurfaceBindings {
  return createWorkspaceClientRuntimeMissionControlSurfaceBindings(input);
}
