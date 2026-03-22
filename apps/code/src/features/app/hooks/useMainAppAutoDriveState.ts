import type { AccessMode, WorkspaceInfo } from "../../../types";
import { useWorkspaceRuntimeAgentControl } from "../../../application/runtime/ports/runtimeAgentControl";
import { DEFAULT_RUNTIME_WORKSPACE_ID } from "../../../utils/runtimeWorkspaceIds";
import { useAutoDriveController } from "../../autodrive/hooks/useAutoDriveController";
import type { ThreadCodexParamsPatch } from "../../threads/hooks/useThreadCodexParams";
import type { useThreadCodexControls } from "./useThreadCodexControls";
import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";

export function useMainAppAutoDriveState(
  activeWorkspace: WorkspaceInfo | null,
  activeThreadId: string | null,
  missionControlProjection: HugeCodeMissionControlSnapshot | null,
  threadCodexState: Pick<
    ReturnType<typeof useThreadCodexControls>,
    "accessMode" | "selectedModelId" | "selectedEffort"
  >,
  threadCodexParamsVersion: number,
  getThreadCodexParams: (
    workspaceId: string,
    threadId: string
  ) => { autoDriveDraft?: ReturnType<typeof useAutoDriveController>["draft"] | null } | null,
  patchThreadCodexParams: (
    workspaceId: string,
    threadId: string,
    patch: ThreadCodexParamsPatch
  ) => void,
  preferredBackendIds?: string[] | null,
  refreshMissionControl?: (() => Promise<void> | void) | null
) {
  const runtimeControl = useWorkspaceRuntimeAgentControl(
    (activeWorkspace?.id ?? DEFAULT_RUNTIME_WORKSPACE_ID) as Parameters<
      typeof useWorkspaceRuntimeAgentControl
    >[0]
  );
  return useAutoDriveController({
    activeWorkspace,
    activeThreadId,
    accessMode: threadCodexState.accessMode as AccessMode,
    selectedModelId: threadCodexState.selectedModelId,
    selectedEffort: threadCodexState.selectedEffort,
    preferredBackendIds,
    missionControlProjection,
    runtimeControl,
    onRefreshMissionControl: refreshMissionControl ?? null,
    threadCodexParamsVersion,
    getThreadCodexParams,
    patchThreadCodexParams,
  });
}
