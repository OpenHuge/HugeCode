import { useCallback } from "react";
import type { RuntimeSessionCommandFacade } from "../facades/runtimeSessionCommandFacade";
import { useRuntimeKernel } from "../kernel/RuntimeKernelContext";
import type { RuntimeWorkspaceId } from "../types/runtimeIds";

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
