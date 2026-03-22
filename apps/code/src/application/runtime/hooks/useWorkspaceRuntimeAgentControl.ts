import { useWorkspaceRuntimeScope } from "../kernel/WorkspaceRuntimeScope";
import type { RuntimeAgentControlFacade } from "../facades/runtimeAgentControlFacade";
import type { RuntimeWorkspaceId } from "../types/runtimeIds";

export function useWorkspaceRuntimeAgentControl(
  workspaceId: RuntimeWorkspaceId
): RuntimeAgentControlFacade {
  return useWorkspaceRuntimeScope(workspaceId).runtimeAgentControl;
}
