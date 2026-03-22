import type { RuntimeGateway } from "../facades/RuntimeGateway";
import { createRuntimeAgentControlFacade } from "../facades/runtimeAgentControlFacade";
import type { RuntimeWorkspaceId } from "../types/runtimeIds";
import type { WorkspaceRuntimeScope } from "./runtimeKernelTypes";
import type { RuntimeAgentControlDependencies } from "../facades/runtimeAgentControlFacade";

type CreateWorkspaceRuntimeScopeInput = {
  workspaceId: RuntimeWorkspaceId;
  runtimeGateway: RuntimeGateway;
  runtimeAgentControlDependencies: RuntimeAgentControlDependencies;
};

export function createWorkspaceRuntimeScope({
  workspaceId,
  runtimeGateway,
  runtimeAgentControlDependencies,
}: CreateWorkspaceRuntimeScopeInput): WorkspaceRuntimeScope {
  return {
    workspaceId,
    runtimeGateway,
    runtimeAgentControl: createRuntimeAgentControlFacade(
      workspaceId,
      runtimeAgentControlDependencies
    ),
  };
}
