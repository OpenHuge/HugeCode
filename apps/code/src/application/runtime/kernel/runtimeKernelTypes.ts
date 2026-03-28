import type {
  WorkspaceClientRuntimeBindings,
  WorkspaceClientRuntimeGatewayBindings,
} from "@ku0/code-workspace-client";
import type { DesktopHostAdapter } from "../adapters/DesktopHostAdapter";
import type { RuntimeGateway } from "../facades/RuntimeGateway";
import type { RuntimeWorkspaceId } from "../types/runtimeIds";
import type {
  RuntimeKernelCapabilityKey,
  RuntimeKernelCapabilityMap,
} from "./runtimeKernelCapabilities";

export type WorkspaceRuntimeScope = {
  workspaceId: RuntimeWorkspaceId;
  runtimeGateway: RuntimeGateway;
  getCapability: <K extends RuntimeKernelCapabilityKey>(key: K) => RuntimeKernelCapabilityMap[K];
  hasCapability: (key: string) => boolean;
  listCapabilities: () => RuntimeKernelCapabilityKey[];
};

export type RuntimeKernel = {
  runtimeGateway: RuntimeGateway;
  workspaceClientRuntimeGateway: WorkspaceClientRuntimeGatewayBindings;
  workspaceClientRuntime: WorkspaceClientRuntimeBindings;
  desktopHost: DesktopHostAdapter;
  getWorkspaceScope: (workspaceId: RuntimeWorkspaceId) => WorkspaceRuntimeScope;
};
