import type {
  WorkspaceClientRuntimeBindings,
  WorkspaceClientRuntimeGatewayBindings,
} from "@ku0/code-workspace-client";
import type { DesktopHostAdapter } from "../adapters/DesktopHostAdapter";
import type { RuntimeGateway } from "../facades/RuntimeGateway";
import type { RuntimeAgentControlFacade } from "../facades/runtimeAgentControlFacade";
import type { RuntimeWorkspaceId } from "../types/runtimeIds";

export type WorkspaceRuntimeScope = {
  workspaceId: RuntimeWorkspaceId;
  runtimeGateway: RuntimeGateway;
  runtimeAgentControl: RuntimeAgentControlFacade;
};

export type RuntimeKernel = {
  runtimeGateway: RuntimeGateway;
  workspaceClientRuntimeGateway: WorkspaceClientRuntimeGatewayBindings;
  workspaceClientRuntime: WorkspaceClientRuntimeBindings;
  desktopHost: DesktopHostAdapter;
  getWorkspaceScope: (workspaceId: RuntimeWorkspaceId) => WorkspaceRuntimeScope;
};
