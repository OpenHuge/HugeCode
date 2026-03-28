import { useWorkspaceRuntimeCapability } from "./useWorkspaceRuntimeCapability";
import type { RuntimeAgentControlFacade } from "../facades/runtimeAgentControlFacade";
import type { RuntimeWorkspaceId } from "../types/runtimeIds";
import { RUNTIME_KERNEL_CAPABILITY_KEYS } from "../kernel/runtimeKernelCapabilities";

export function useWorkspaceRuntimeAgentControl(
  workspaceId: RuntimeWorkspaceId
): RuntimeAgentControlFacade {
  return useWorkspaceRuntimeCapability(workspaceId, RUNTIME_KERNEL_CAPABILITY_KEYS.agentControl);
}
