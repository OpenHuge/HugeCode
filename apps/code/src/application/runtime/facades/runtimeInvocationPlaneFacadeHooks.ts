import { useCallback } from "react";
import type { RuntimeWorkspaceId } from "../types/runtimeIds";
import type { RuntimeInvocationPlaneFacade } from "../kernel/runtimeInvocationPlane";
import { useRuntimeKernel } from "../kernel/RuntimeKernelContext";
import { RUNTIME_KERNEL_CAPABILITY_KEYS } from "../kernel/runtimeKernelCapabilities";
import {
  resolveWorkspaceRuntimeCapability,
  useWorkspaceRuntimeCapability,
} from "../hooks/useWorkspaceRuntimeCapability";

export function useWorkspaceRuntimeInvocationPlane(
  workspaceId: RuntimeWorkspaceId
): RuntimeInvocationPlaneFacade {
  return useWorkspaceRuntimeCapability(workspaceId, RUNTIME_KERNEL_CAPABILITY_KEYS.invocationPlane);
}

export function useRuntimeInvocationPlaneResolver(): (
  workspaceId: RuntimeWorkspaceId
) => RuntimeInvocationPlaneFacade {
  const kernel = useRuntimeKernel();

  return useCallback(
    (workspaceId: RuntimeWorkspaceId) =>
      resolveWorkspaceRuntimeCapability(
        kernel,
        workspaceId,
        RUNTIME_KERNEL_CAPABILITY_KEYS.invocationPlane
      ),
    [kernel]
  );
}
