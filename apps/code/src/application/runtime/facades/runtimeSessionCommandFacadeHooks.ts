import { useCallback } from "react";
import { useRuntimeKernel } from "../kernel/RuntimeKernelContext";
import type { RuntimeWorkspaceId } from "../types/runtimeIds";
import type { RuntimeSessionCommandFacade } from "./runtimeSessionCommandFacade";
import { RUNTIME_KERNEL_CAPABILITY_KEYS } from "../kernel/runtimeKernelCapabilities";
import {
  resolveWorkspaceRuntimeCapability,
  useWorkspaceRuntimeCapability,
} from "../hooks/useWorkspaceRuntimeCapability";

export function useWorkspaceRuntimeSessionCommands(
  workspaceId: RuntimeWorkspaceId
): RuntimeSessionCommandFacade {
  return useWorkspaceRuntimeCapability(workspaceId, RUNTIME_KERNEL_CAPABILITY_KEYS.sessionCommands);
}

export function useRuntimeSessionCommandsResolver(): (
  workspaceId: RuntimeWorkspaceId
) => RuntimeSessionCommandFacade {
  const kernel = useRuntimeKernel();

  return useCallback(
    (workspaceId: RuntimeWorkspaceId) =>
      resolveWorkspaceRuntimeCapability(
        kernel,
        workspaceId,
        RUNTIME_KERNEL_CAPABILITY_KEYS.sessionCommands
      ),
    [kernel]
  );
}
