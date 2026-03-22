import { useMemo } from "react";
import type { RuntimeWorkspaceId } from "../types/runtimeIds";
import { useRuntimeKernel } from "./RuntimeKernelContext";
import type { WorkspaceRuntimeScope } from "./runtimeKernelTypes";

export function useWorkspaceRuntimeScope(workspaceId: RuntimeWorkspaceId): WorkspaceRuntimeScope {
  const kernel = useRuntimeKernel();
  return useMemo(() => kernel.getWorkspaceScope(workspaceId), [kernel, workspaceId]);
}
