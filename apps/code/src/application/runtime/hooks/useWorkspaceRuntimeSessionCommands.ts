import { useWorkspaceRuntimeScope } from "../kernel/WorkspaceRuntimeScope";
import type { RuntimeSessionCommandFacade } from "../facades/runtimeSessionCommandFacade";
import type { RuntimeWorkspaceId } from "../types/runtimeIds";

export function useWorkspaceRuntimeSessionCommands(
  workspaceId: RuntimeWorkspaceId
): RuntimeSessionCommandFacade {
  return useWorkspaceRuntimeScope(workspaceId).runtimeSessionCommands;
}
