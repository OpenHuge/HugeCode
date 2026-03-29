import type { KernelCapabilityContractSurface } from "@ku0/code-runtime-host-contract";

export type RuntimeKernelPluginSource =
  | "runtime_extension"
  | "live_skill"
  | "repo_manifest"
  | "mcp_remote"
  | "wasi_component"
  | "a2a_remote"
  | "host_bridge"
  | "wasi_host"
  | "rpc_host"
  | "provider_route"
  | "backend_route"
  | "execution_route";

export type RuntimeKernelPluginTransport = RuntimeKernelPluginSource;

export type RuntimeKernelPluginHostProfile = {
  kind: "runtime" | "repository" | "wasi" | "rpc" | "routing" | "remote" | "component" | "bridge";
  executionBoundaries: string[];
};

export type RuntimeKernelPluginCapabilityDescriptor = {
  id: string;
  enabled: boolean;
};

export type RuntimeKernelPluginResourceDescriptor = {
  id: string;
  contentType: string | null;
};

export type RuntimeKernelPluginContractSurface = {
  id: string;
  kind: KernelCapabilityContractSurface["kind"];
  direction: KernelCapabilityContractSurface["direction"];
  summary: string | null;
};

export type RuntimeKernelPluginBinding = {
  state: "bound" | "declaration_only" | "unbound";
  contractFormat:
    | "runtime_extension"
    | "live_skill"
    | "manifest"
    | "wit"
    | "rpc"
    | "route"
    | "mcp"
    | "a2a"
    | "wasi_component"
    | "host_bridge";
  contractBoundary: string;
  interfaceId: string | null;
  surfaces: RuntimeKernelPluginContractSurface[];
};

export type RuntimeKernelPluginExecutionAvailability = {
  executable: boolean;
  mode: "live_skill" | "provider_route" | "backend_route" | "execution_route" | "none";
  reason: string | null;
};

export type RuntimeKernelPluginResourceAvailability = {
  readable: boolean;
  mode: "runtime_extension_resource" | "repo_manifest_resource" | "none";
  reason: string | null;
};

export type RuntimeKernelPluginPermissionsAvailability = {
  evaluable: boolean;
  mode:
    | "runtime_extension_permissions"
    | "live_skill_permissions"
    | "repo_manifest_permissions"
    | "none";
  reason: string | null;
};

export type RuntimeKernelPluginOperations = {
  execution: RuntimeKernelPluginExecutionAvailability;
  resources: RuntimeKernelPluginResourceAvailability;
  permissions: RuntimeKernelPluginPermissionsAvailability;
};

export type RuntimeKernelPluginDescriptor = {
  id: string;
  name: string;
  version: string;
  summary: string | null;
  source: RuntimeKernelPluginSource;
  transport: RuntimeKernelPluginTransport;
  hostProfile: RuntimeKernelPluginHostProfile;
  workspaceId: string | null;
  enabled: boolean;
  runtimeBacked: boolean;
  capabilities: RuntimeKernelPluginCapabilityDescriptor[];
  permissions: string[];
  resources: RuntimeKernelPluginResourceDescriptor[];
  executionBoundaries: string[];
  binding: RuntimeKernelPluginBinding;
  operations: RuntimeKernelPluginOperations;
  metadata: Record<string, unknown> | null;
  permissionDecision: "allow" | "ask" | "deny" | "unsupported" | null;
  health: {
    state: "healthy" | "degraded" | "unsupported" | "unknown";
    checkedAt: number | null;
    warnings: string[];
  } | null;
};
