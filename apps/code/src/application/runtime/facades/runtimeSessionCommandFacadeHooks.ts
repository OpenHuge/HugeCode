import { useCallback } from "react";
import { useRuntimeKernel } from "../kernel/RuntimeKernelContext";
import { useWorkspaceRuntimeScope } from "../kernel/WorkspaceRuntimeScope";
import type { RuntimeWorkspaceId } from "../types/runtimeIds";
import type { RuntimeSessionCommandFacade } from "./runtimeSessionCommandFacade";

export function useWorkspaceRuntimeSessionCommands(
  workspaceId: RuntimeWorkspaceId
): RuntimeSessionCommandFacade {
  return useWorkspaceRuntimeScope(workspaceId).runtimeSessionCommands;
}

export function useRuntimeSessionCommandsResolver(): (
  workspaceId: RuntimeWorkspaceId
) => RuntimeSessionCommandFacade {
  const kernel = useRuntimeKernel();

  return useCallback(
    (workspaceId: RuntimeWorkspaceId) =>
      kernel.getWorkspaceScope(workspaceId).runtimeSessionCommands,
    [kernel]
  );
}
