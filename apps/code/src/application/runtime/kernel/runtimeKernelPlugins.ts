import type {
  KernelCapabilityDescriptor,
  LiveSkillExecuteRequest,
  LiveSkillExecutionResult,
  LiveSkillSummary,
  RuntimeExtensionHealthReadResponse,
  RuntimeExtensionPermissionsEvaluateResponse,
  RuntimeExtensionResourceReadResponse,
  RuntimeExtensionRecord,
} from "@ku0/code-runtime-host-contract";
import { listRuntimeLiveSkills } from "../ports/tauriRuntimeSkills";
import { runRuntimeLiveSkill } from "../ports/tauriRuntime";
import {
  evaluateRuntimeExtensionPermissions,
  listRuntimeExtensions,
  readRuntimeExtensionHealth,
  readRuntimeExtensionResource,
} from "../ports/runtimeExtensions";
import { listRuntimeKernelCapabilities } from "../ports/runtimeKernelCapabilities";
import { getProvidersCatalog, listOAuthAccounts, listOAuthPools } from "../ports/tauriOauth";
import type { RuntimeWorkspaceSkillManifest } from "./runtimeWorkspaceSkillManifests";
import { readRuntimeWorkspaceSkillManifests } from "./runtimeWorkspaceSkillManifests";
import {
  createRuntimeProviderRoutePluginDescriptors,
  readRuntimeKernelRoutingPluginMetadata,
  resolveRuntimeKernelRouteSelection,
  type RuntimeKernelResolvedRoute,
  type RuntimeKernelRouteOption,
} from "./runtimeKernelRoutingPlugins";
import type {
  RuntimeKernelPluginBinding,
  RuntimeKernelPluginCapabilityDescriptor,
  RuntimeKernelPluginContractSurface,
  RuntimeKernelPluginDescriptor,
  RuntimeKernelPluginExecutionAvailability,
  RuntimeKernelPluginHostProfile,
  RuntimeKernelPluginOperations,
  RuntimeKernelPluginPermissionsAvailability,
  RuntimeKernelPluginResourceAvailability,
  RuntimeKernelPluginResourceDescriptor,
  RuntimeKernelPluginSource,
  RuntimeKernelPluginTransport,
} from "./runtimeKernelPluginTypes";

export {
  createRuntimeProviderRoutePluginDescriptors,
  readRuntimeKernelRoutingPluginMetadata,
  resolveRuntimeKernelRouteSelection,
};
export type {
  RuntimeKernelPluginBinding,
  RuntimeKernelPluginCapabilityDescriptor,
  RuntimeKernelPluginContractSurface,
  RuntimeKernelPluginDescriptor,
  RuntimeKernelPluginExecutionAvailability,
  RuntimeKernelPluginHostProfile,
  RuntimeKernelPluginOperations,
  RuntimeKernelPluginPermissionsAvailability,
  RuntimeKernelPluginResourceAvailability,
  RuntimeKernelPluginResourceDescriptor,
  RuntimeKernelPluginSource,
  RuntimeKernelPluginTransport,
} from "./runtimeKernelPluginTypes";

export type RuntimeKernelPluginPermissionsResult = {
  pluginId: string;
  permissions: string[];
  decision: "allow" | "ask" | "deny" | "unsupported";
  warnings: string[];
  authority: "runtime_extension" | "runtime_live_skill" | "repo_manifest";
  bindingState: RuntimeKernelPluginBinding["state"];
  evaluationMode: Exclude<RuntimeKernelPluginPermissionsAvailability["mode"], "none">;
};

type NormalizedKernelHostCapabilityMetadata = {
  pluginSource: Extract<RuntimeKernelPluginSource, "wasi_host" | "rpc_host">;
  bindingState: RuntimeKernelPluginBinding["state"];
  contractFormat: "wit" | "rpc";
  contractBoundary: string;
  interfaceId: string | null;
  worldId: string | null;
  contractSurfaces: RuntimeKernelPluginContractSurface[];
  summary: string | null;
  reason: string | null;
  warnings: string[];
  hostManaged: boolean | null;
  semverQualifiedImports: boolean | null;
  canonicalAbiResources: boolean | null;
};

export type { RuntimeKernelResolvedRoute, RuntimeKernelRouteOption };

export type RuntimeKernelPluginResourceResult = RuntimeExtensionResourceReadResponse | null;

export type RuntimeKernelPluginCatalogProvider = {
  listPluginDescriptors: (workspaceId: string) => Promise<RuntimeKernelPluginDescriptor[]>;
};

export type RuntimeKernelPluginResourceProvider = {
  readPluginResource: (
    workspaceId: string,
    descriptor: RuntimeKernelPluginDescriptor,
    resourceId: string
  ) => Promise<RuntimeKernelPluginResourceResult>;
};

export type RuntimeKernelPluginExecutionProvider = {
  executePlugin: (
    workspaceId: string,
    descriptor: RuntimeKernelPluginDescriptor,
    request: LiveSkillExecuteRequest
  ) => Promise<LiveSkillExecutionResult>;
};

export type RuntimeKernelPluginPermissionsProvider = {
  evaluatePluginPermissions: (
    workspaceId: string,
    descriptor: RuntimeKernelPluginDescriptor
  ) => Promise<RuntimeKernelPluginPermissionsResult>;
};

export type RuntimeKernelPluginCatalogFacade = {
  listPlugins: () => Promise<RuntimeKernelPluginDescriptor[]>;
  readPluginResource: (
    pluginId: string,
    resourceId: string
  ) => Promise<RuntimeKernelPluginResourceResult>;
  executePlugin: (
    pluginId: string,
    request: LiveSkillExecuteRequest
  ) => Promise<LiveSkillExecutionResult>;
  evaluatePluginPermissions: (pluginId: string) => Promise<RuntimeKernelPluginPermissionsResult>;
};

function buildRuntimeKernelPluginExecutionAvailability(input: {
  id: string;
  source: RuntimeKernelPluginSource;
  metadata?: Record<string, unknown> | null;
}): RuntimeKernelPluginExecutionAvailability {
  const routingMetadata = readRuntimeKernelRoutingPluginMetadata(input.metadata);
  if (routingMetadata) {
    if (!routingMetadata.launchAllowed) {
      return {
        executable: false,
        mode: "none",
        reason:
          routingMetadata.blockingReason ??
          routingMetadata.detail ??
          `Route plugin \`${input.id}\` is not ready for execution.`,
      };
    }
    return {
      executable: true,
      mode:
        input.source === "backend_route"
          ? "backend_route"
          : input.source === "provider_route"
            ? "provider_route"
            : "execution_route",
      reason: null,
    };
  }
  if (input.source === "live_skill") {
    return {
      executable: true,
      mode: "live_skill",
      reason: null,
    };
  }
  if (input.source === "repo_manifest") {
    return {
      executable: false,
      mode: "none",
      reason: `Plugin \`${input.id}\` is declaration-only and does not expose a bound execution provider.`,
    };
  }
  if (
    input.source === "mcp_remote" ||
    input.source === "wasi_component" ||
    input.source === "a2a_remote" ||
    input.source === "host_bridge"
  ) {
    return {
      executable: false,
      mode: "none",
      reason: `Plugin \`${input.id}\` is installed in the registry but not yet bound into the live runtime catalog.`,
    };
  }
  if (input.source === "wasi_host") {
    return {
      executable: false,
      mode: "none",
      reason: `Plugin \`${input.id}\` reserves a WIT/component-model host slot and is currently unbound in the runtime host binder.`,
    };
  }
  if (input.source === "rpc_host") {
    return {
      executable: false,
      mode: "none",
      reason: `Plugin \`${input.id}\` reserves an RPC host slot and is currently unbound in the runtime host binder.`,
    };
  }
  return {
    executable: false,
    mode: "none",
    reason: `Plugin \`${input.id}\` is bound for catalog/resource access only and does not expose an execution provider.`,
  };
}

function buildRuntimeKernelPluginResourceAvailability(input: {
  id: string;
  source: RuntimeKernelPluginSource;
}): RuntimeKernelPluginResourceAvailability {
  if (input.source === "runtime_extension") {
    return {
      readable: true,
      mode: "runtime_extension_resource",
      reason: null,
    };
  }
  if (input.source === "repo_manifest") {
    return {
      readable: true,
      mode: "repo_manifest_resource",
      reason: null,
    };
  }
  return {
    readable: false,
    mode: "none",
    reason: `Plugin \`${input.id}\` does not expose readable resources through the runtime kernel.`,
  };
}

function buildRuntimeKernelPluginPermissionsAvailability(input: {
  id: string;
  source: RuntimeKernelPluginSource;
}): RuntimeKernelPluginPermissionsAvailability {
  if (input.source === "runtime_extension") {
    return {
      evaluable: true,
      mode: "runtime_extension_permissions",
      reason: null,
    };
  }
  if (input.source === "live_skill") {
    return {
      evaluable: true,
      mode: "live_skill_permissions",
      reason: null,
    };
  }
  if (input.source === "repo_manifest") {
    return {
      evaluable: true,
      mode: "repo_manifest_permissions",
      reason: null,
    };
  }
  return {
    evaluable: false,
    mode: "none",
    reason: `Plugin \`${input.id}\` does not publish runtime-evaluable permission state.`,
  };
}

function attachRuntimeKernelPluginOperations(
  descriptor: Omit<RuntimeKernelPluginDescriptor, "operations">
): RuntimeKernelPluginDescriptor {
  return {
    ...descriptor,
    operations: {
      execution: buildRuntimeKernelPluginExecutionAvailability(descriptor),
      resources: buildRuntimeKernelPluginResourceAvailability(descriptor),
      permissions: buildRuntimeKernelPluginPermissionsAvailability(descriptor),
    },
  };
}

export function resolveRuntimeKernelPluginExecutionAvailability(
  descriptor: RuntimeKernelPluginDescriptor
): RuntimeKernelPluginExecutionAvailability {
  return descriptor.operations.execution;
}

export function resolveRuntimeKernelPluginResourceAvailability(
  descriptor: RuntimeKernelPluginDescriptor,
  resourceId?: string
): RuntimeKernelPluginResourceAvailability {
  if (
    descriptor.operations.resources.mode === "repo_manifest_resource" &&
    resourceId &&
    resourceId !== "manifest"
  ) {
    return {
      readable: false,
      mode: "none",
      reason: `Plugin \`${descriptor.id}\` only exposes the repository manifest resource \`manifest\`.`,
    };
  }
  return descriptor.operations.resources;
}

export function resolveRuntimeKernelPluginPermissionsAvailability(
  descriptor: RuntimeKernelPluginDescriptor
): RuntimeKernelPluginPermissionsAvailability {
  return descriptor.operations.permissions;
}

function isHostPluginSource(
  value: unknown
): value is Extract<RuntimeKernelPluginSource, "wasi_host" | "rpc_host"> {
  return value === "wasi_host" || value === "rpc_host";
}

function isContractSurfaceKind(
  value: unknown
): value is RuntimeKernelPluginContractSurface["kind"] {
  return (
    value === "world" ||
    value === "interface" ||
    value === "procedure_set" ||
    value === "extension" ||
    value === "skill" ||
    value === "manifest" ||
    value === "route"
  );
}

function isContractSurfaceDirection(
  value: unknown
): value is RuntimeKernelPluginContractSurface["direction"] {
  return value === "import" || value === "export";
}

function readOptionalStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function readOptionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeContractSurfaces(value: unknown): RuntimeKernelPluginContractSurface[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) {
      return [];
    }
    const surface = entry as Record<string, unknown>;
    const id = readOptionalText(surface.id);
    if (
      !id ||
      !isContractSurfaceKind(surface.kind) ||
      !isContractSurfaceDirection(surface.direction)
    ) {
      return [];
    }
    return [
      {
        id,
        kind: surface.kind,
        direction: surface.direction,
        summary: readOptionalText(surface.summary),
      },
    ];
  });
}

function createPluginContractSurface(input: RuntimeKernelPluginContractSurface) {
  return input;
}

function createDefaultHostContractSurfaces(input: {
  source: Extract<RuntimeKernelPluginSource, "wasi_host" | "rpc_host">;
  interfaceId: string | null;
  worldId: string | null;
}): RuntimeKernelPluginContractSurface[] {
  if (input.source === "wasi_host") {
    return [
      createPluginContractSurface({
        id: input.worldId ?? "hugecode:runtime/plugin-host",
        kind: "world",
        direction: "import",
        summary:
          "Reserved component-model world that the runtime host binder is expected to satisfy.",
      }),
      createPluginContractSurface({
        id: input.interfaceId ?? "wasi:*/*",
        kind: "interface",
        direction: "import",
        summary: "Semver-qualified WIT interface imports published by the runtime host binder.",
      }),
    ];
  }

  return [
    createPluginContractSurface({
      id: input.interfaceId ?? "runtime.plugin.host",
      kind: "procedure_set",
      direction: "import",
      summary: "RPC procedure surface reserved for a runtime-managed plugin host binder.",
    }),
  ];
}

function createDefaultPluginContractSurfaces(input: {
  source: Exclude<RuntimeKernelPluginSource, "wasi_host" | "rpc_host">;
  interfaceId: string;
}): RuntimeKernelPluginContractSurface[] {
  if (input.source === "runtime_extension") {
    return [
      createPluginContractSurface({
        id: input.interfaceId,
        kind: "extension",
        direction: "export",
        summary: "Runtime extension record exported through the kernel plugin catalog.",
      }),
    ];
  }
  if (input.source === "live_skill") {
    return [
      createPluginContractSurface({
        id: input.interfaceId,
        kind: "skill",
        direction: "export",
        summary: "Live skill execution surface exported by the runtime.",
      }),
    ];
  }
  return [
    createPluginContractSurface({
      id: input.interfaceId,
      kind: "manifest",
      direction: "export",
      summary: "Repository manifest declaration exported through the workspace plugin catalog.",
    }),
  ];
}

function readKernelHostCapabilityMetadata(
  metadata: Record<string, unknown> | null | undefined
): NormalizedKernelHostCapabilityMetadata | null {
  if (!metadata || !isHostPluginSource(metadata.pluginSource)) {
    return null;
  }

  const bindingState =
    metadata.bindingState === "bound" ||
    metadata.bindingState === "declaration_only" ||
    metadata.bindingState === "unbound"
      ? metadata.bindingState
      : "unbound";
  const normalizedContractFormat =
    metadata.contractFormat === "wit" || metadata.contractFormat === "rpc"
      ? metadata.contractFormat
      : null;
  if (!normalizedContractFormat) {
    return null;
  }

  return {
    pluginSource: metadata.pluginSource,
    bindingState,
    contractFormat: normalizedContractFormat,
    contractBoundary:
      readOptionalText(metadata.contractBoundary) ??
      (metadata.pluginSource === "wasi_host" ? "world-imports" : "remote-procedure-calls"),
    interfaceId: readOptionalText(metadata.interfaceId),
    worldId: readOptionalText(metadata.worldId),
    contractSurfaces: normalizeContractSurfaces(metadata.contractSurfaces),
    summary: readOptionalText(metadata.summary),
    reason: readOptionalText(metadata.reason),
    warnings: readOptionalStringArray(metadata.warnings),
    hostManaged: typeof metadata.hostManaged === "boolean" ? metadata.hostManaged : null,
    semverQualifiedImports:
      typeof metadata.semverQualifiedImports === "boolean" ? metadata.semverQualifiedImports : null,
    canonicalAbiResources:
      typeof metadata.canonicalAbiResources === "boolean" ? metadata.canonicalAbiResources : null,
  };
}

function normalizeHostPluginDescriptor(input: {
  source: Extract<RuntimeKernelPluginSource, "wasi_host" | "rpc_host">;
  runtimeBacked: boolean;
  enabled: boolean;
  name?: string | null;
  version?: string | null;
  summary?: string | null;
  bindingState?: RuntimeKernelPluginBinding["state"];
  interfaceId?: string | null;
  worldId?: string | null;
  contractSurfaces?: RuntimeKernelPluginContractSurface[];
  metadata?: Record<string, unknown> | null;
  warnings?: string[];
  health?: RuntimeKernelPluginDescriptor["health"];
}) {
  const isWasiHost = input.source === "wasi_host";
  const summary =
    input.summary ??
    (isWasiHost
      ? "Reserved component-model host slot for future WIT/world bindings."
      : "Reserved remote host slot for future RPC-backed plugin bindings.");
  const bindingState = input.bindingState ?? "unbound";
  const interfaceId = input.interfaceId ?? (isWasiHost ? "wasi:*/*" : "runtime.plugin.host");
  const worldId = input.worldId ?? (isWasiHost ? "hugecode:runtime/plugin-host" : null);
  const contractSurfaces =
    input.contractSurfaces && input.contractSurfaces.length > 0
      ? input.contractSurfaces
      : createDefaultHostContractSurfaces({
          source: input.source,
          interfaceId,
          worldId,
        });

  return attachRuntimeKernelPluginOperations({
    id: isWasiHost ? "host:wasi" : "host:rpc",
    name: input.name ?? (isWasiHost ? "WASI host slot" : "RPC host slot"),
    version: input.version ?? (bindingState === "bound" ? "bound" : "unbound"),
    summary,
    source: input.source,
    transport: input.source,
    hostProfile: {
      kind: isWasiHost ? "wasi" : "rpc",
      executionBoundaries: [input.source],
    },
    workspaceId: null,
    enabled: input.enabled,
    runtimeBacked: input.runtimeBacked,
    capabilities: [],
    permissions: [],
    resources: [],
    executionBoundaries: [input.source],
    binding: {
      state: bindingState,
      contractFormat: isWasiHost ? "wit" : "rpc",
      contractBoundary: isWasiHost ? "world-imports" : "remote-procedure-calls",
      interfaceId,
      surfaces: contractSurfaces,
    },
    metadata: {
      bindingState,
      contractFormat: isWasiHost ? "wit" : "rpc",
      contractBoundary: isWasiHost ? "world-imports" : "remote-procedure-calls",
      interfaceId,
      worldId,
      contractSurfaces,
      hostManaged: true,
      semverQualifiedImports: isWasiHost,
      canonicalAbiResources: isWasiHost,
      ...(input.metadata ?? {}),
    },
    permissionDecision: "unsupported",
    health: input.health ?? {
      state: "unsupported",
      checkedAt: null,
      warnings: input.warnings ?? ["Host provider is not yet bound in apps/code."],
    },
  });
}

function createReservedHostPluginDescriptor(
  source: Extract<RuntimeKernelPluginSource, "wasi_host" | "rpc_host">
): RuntimeKernelPluginDescriptor {
  return normalizeHostPluginDescriptor({
    source,
    runtimeBacked: false,
    enabled: false,
  });
}

export function createReservedHostPluginDescriptors(): RuntimeKernelPluginDescriptor[] {
  return [
    createReservedHostPluginDescriptor("rpc_host"),
    createReservedHostPluginDescriptor("wasi_host"),
  ];
}

function normalizeKernelCapabilityHealth(
  capability: KernelCapabilityDescriptor
): RuntimeKernelPluginDescriptor["health"] {
  const warnings = readOptionalStringArray(capability.metadata?.warnings);
  if (capability.health === "ready") {
    return {
      state: "healthy",
      checkedAt: null,
      warnings,
    };
  }
  if (capability.health === "attention") {
    return {
      state: "degraded",
      checkedAt: null,
      warnings,
    };
  }
  return {
    state: "unsupported",
    checkedAt: null,
    warnings:
      warnings.length > 0
        ? warnings
        : [
            typeof capability.metadata?.reason === "string"
              ? capability.metadata.reason
              : "Runtime host binder is not currently connected.",
          ],
  };
}

export function normalizeRuntimeHostCapabilityPluginDescriptor(
  capability: KernelCapabilityDescriptor
): RuntimeKernelPluginDescriptor | null {
  if (capability.kind !== "host") {
    return null;
  }
  const metadata = readKernelHostCapabilityMetadata(capability.metadata ?? null);
  if (!metadata) {
    return null;
  }

  const normalizedBindingState =
    metadata.bindingState ?? (capability.enabled ? "bound" : "unbound");

  return normalizeHostPluginDescriptor({
    source: metadata.pluginSource,
    runtimeBacked: true,
    enabled: capability.enabled,
    name: capability.name,
    version: normalizedBindingState === "bound" ? "bound" : "unbound",
    summary: metadata.summary,
    bindingState: normalizedBindingState,
    interfaceId: metadata.interfaceId,
    worldId: metadata.worldId,
    contractSurfaces: metadata.contractSurfaces ?? undefined,
    metadata: capability.metadata ?? null,
    warnings: metadata.warnings ?? [],
    health: normalizeKernelCapabilityHealth(capability),
  });
}

function normalizeCapabilityIds(capabilities: string[]): RuntimeKernelPluginCapabilityDescriptor[] {
  return capabilities.map((capability) => ({ id: capability, enabled: true }));
}

function normalizeWarningsToHealth(
  health: RuntimeExtensionHealthReadResponse | null
): RuntimeKernelPluginDescriptor["health"] {
  if (!health) {
    return null;
  }
  return {
    state: health.healthy ? "healthy" : "degraded",
    checkedAt: health.checkedAt,
    warnings: health.warnings,
  };
}

export function normalizeRuntimeExtensionPluginDescriptor(
  extension: RuntimeExtensionRecord,
  permissionResult: RuntimeExtensionPermissionsEvaluateResponse | null,
  healthResult: RuntimeExtensionHealthReadResponse | null
): RuntimeKernelPluginDescriptor {
  return attachRuntimeKernelPluginOperations({
    id: extension.extensionId,
    name: extension.displayName || extension.name,
    version: extension.version,
    summary: extension.summary,
    source: "runtime_extension",
    transport: "runtime_extension",
    hostProfile: {
      kind: "runtime",
      executionBoundaries: ["runtime"],
    },
    workspaceId: extension.workspaceId,
    enabled: extension.enabled,
    runtimeBacked: true,
    capabilities: normalizeCapabilityIds(extension.capabilities),
    permissions: permissionResult?.permissions ?? extension.permissions,
    resources: [],
    executionBoundaries: ["runtime"],
    binding: {
      state: "bound",
      contractFormat: "runtime_extension",
      contractBoundary: "runtime-extension-record",
      interfaceId: extension.extensionId,
      surfaces: createDefaultPluginContractSurfaces({
        source: "runtime_extension",
        interfaceId: extension.extensionId,
      }),
    },
    metadata: {
      distribution: extension.distribution,
      kind: extension.kind,
      transport: extension.transport,
      provenance: extension.provenance,
      config: extension.config,
    },
    permissionDecision: permissionResult?.decision ?? null,
    health: normalizeWarningsToHealth(healthResult),
  });
}

export function normalizeLiveSkillPluginDescriptor(
  skill: LiveSkillSummary
): RuntimeKernelPluginDescriptor {
  const normalizedPermissions = skill.permissions ?? (skill.supportsNetwork ? ["network"] : []);
  return attachRuntimeKernelPluginOperations({
    id: skill.id,
    name: skill.name,
    version: skill.version,
    summary: skill.description,
    source: "live_skill",
    transport: "live_skill",
    hostProfile: {
      kind: "runtime",
      executionBoundaries: ["runtime"],
    },
    workspaceId: null,
    enabled: skill.enabled,
    runtimeBacked: true,
    capabilities: normalizeCapabilityIds(skill.tags),
    permissions: normalizedPermissions,
    resources: [],
    executionBoundaries: ["runtime"],
    binding: {
      state: "bound",
      contractFormat: "live_skill",
      contractBoundary: "runtime-live-skill",
      interfaceId: skill.id,
      surfaces: createDefaultPluginContractSurfaces({
        source: "live_skill",
        interfaceId: skill.id,
      }),
    },
    metadata: {
      source: skill.source,
      kind: skill.kind,
      aliases: skill.aliases ?? [],
      permissionAuthority: "runtime_live_skill",
    },
    permissionDecision: skill.enabled ? "allow" : "deny",
    health: {
      state: "healthy",
      checkedAt: null,
      warnings: [],
    },
  });
}

export function normalizeRepoManifestPluginDescriptor(
  manifest: RuntimeWorkspaceSkillManifest
): RuntimeKernelPluginDescriptor {
  return attachRuntimeKernelPluginOperations({
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    summary: null,
    source: "repo_manifest",
    transport: "repo_manifest",
    hostProfile: {
      kind: "repository",
      executionBoundaries: ["repository"],
    },
    workspaceId: null,
    enabled: true,
    runtimeBacked: false,
    capabilities: normalizeCapabilityIds([manifest.kind]),
    permissions: manifest.permissions,
    resources: [{ id: "manifest", contentType: "application/json" }],
    executionBoundaries: ["repository"],
    binding: {
      state: "declaration_only",
      contractFormat: "manifest",
      contractBoundary: "repository-manifest",
      interfaceId: manifest.id,
      surfaces: createDefaultPluginContractSurfaces({
        source: "repo_manifest",
        interfaceId: manifest.id,
      }),
    },
    metadata: {
      trustLevel: manifest.trustLevel,
      entrypoint: manifest.entrypoint,
      compatibility: manifest.compatibility,
      manifestPath: manifest.manifestPath,
      permissionAuthority: "repo_manifest",
    },
    permissionDecision: manifest.permissions.length > 0 ? "ask" : "allow",
    health: {
      state: "unsupported",
      checkedAt: null,
      warnings: [],
    },
  });
}

const PLUGIN_SOURCE_PRIORITY: Record<RuntimeKernelPluginSource, number> = {
  mcp_remote: 9,
  a2a_remote: 9,
  wasi_component: 9,
  host_bridge: 9,
  execution_route: 8,
  backend_route: 7,
  provider_route: 6,
  runtime_extension: 5,
  live_skill: 4,
  repo_manifest: 3,
  wasi_host: 2,
  rpc_host: 1,
};

export function mergeRuntimeKernelPluginDescriptors(
  descriptors: RuntimeKernelPluginDescriptor[]
): RuntimeKernelPluginDescriptor[] {
  const merged = new Map<string, RuntimeKernelPluginDescriptor>();

  for (const descriptor of descriptors) {
    const existing = merged.get(descriptor.id);
    if (!existing) {
      merged.set(descriptor.id, descriptor);
      continue;
    }
    if (PLUGIN_SOURCE_PRIORITY[descriptor.source] >= PLUGIN_SOURCE_PRIORITY[existing.source]) {
      merged.set(descriptor.id, {
        ...descriptor,
        metadata: {
          ...(existing.metadata ?? {}),
          ...(descriptor.metadata ?? {}),
        },
      });
      continue;
    }
    merged.set(descriptor.id, {
      ...existing,
      metadata: {
        ...(descriptor.metadata ?? {}),
        ...(existing.metadata ?? {}),
      },
    });
  }

  return [...merged.values()].sort((left, right) => left.id.localeCompare(right.id));
}

async function listRuntimeExtensionPluginDescriptors(
  workspaceId: string
): Promise<RuntimeKernelPluginDescriptor[]> {
  const extensions = await listRuntimeExtensions(workspaceId);

  return Promise.all(
    extensions.map(async (extension) =>
      normalizeRuntimeExtensionPluginDescriptor(
        extension,
        await evaluateRuntimeExtensionPermissions({
          workspaceId,
          extensionId: extension.extensionId,
        }),
        await readRuntimeExtensionHealth({
          workspaceId,
          extensionId: extension.extensionId,
        })
      )
    )
  );
}

async function listLiveSkillPluginDescriptors(): Promise<RuntimeKernelPluginDescriptor[]> {
  const liveSkills = await listRuntimeLiveSkills();
  return liveSkills.map((skill) => normalizeLiveSkillPluginDescriptor(skill));
}

async function listRuntimeHostCapabilityPluginDescriptors(): Promise<
  RuntimeKernelPluginDescriptor[]
> {
  try {
    const capabilities = await listRuntimeKernelCapabilities();
    return capabilities
      .map((capability) => normalizeRuntimeHostCapabilityPluginDescriptor(capability))
      .filter((descriptor): descriptor is RuntimeKernelPluginDescriptor => descriptor !== null);
  } catch {
    return [];
  }
}

async function listRuntimeProviderRoutePluginDescriptors(): Promise<
  RuntimeKernelPluginDescriptor[]
> {
  try {
    const [providers, accounts, pools] = await Promise.all([
      getProvidersCatalog(),
      listOAuthAccounts(null),
      listOAuthPools(null),
    ]);
    return createRuntimeProviderRoutePluginDescriptors({
      providers,
      accounts,
      pools,
    });
  } catch {
    return [];
  }
}

async function listRepoManifestPluginDescriptors(
  workspaceId: string
): Promise<RuntimeKernelPluginDescriptor[]> {
  const manifests = await readRuntimeWorkspaceSkillManifests(workspaceId);
  return manifests.map((manifest) => normalizeRepoManifestPluginDescriptor(manifest));
}

export function createRuntimeKernelPluginCatalogProvider(): RuntimeKernelPluginCatalogProvider {
  return {
    listPluginDescriptors: async (workspaceId) => {
      const routingDescriptors = await listRuntimeProviderRoutePluginDescriptors();
      const hostDescriptors = await listRuntimeHostCapabilityPluginDescriptors();
      return mergeRuntimeKernelPluginDescriptors([
        ...routingDescriptors,
        ...hostDescriptors,
        ...(await listRepoManifestPluginDescriptors(workspaceId)),
        ...(await listLiveSkillPluginDescriptors()),
        ...(await listRuntimeExtensionPluginDescriptors(workspaceId)),
      ]);
    },
  };
}

export function createRuntimeKernelPluginResourceProvider(): RuntimeKernelPluginResourceProvider {
  return {
    readPluginResource: async (workspaceId, descriptor, resourceId) => {
      const availability = resolveRuntimeKernelPluginResourceAvailability(descriptor, resourceId);
      if (availability.mode === "runtime_extension_resource") {
        return readRuntimeExtensionResource({
          workspaceId,
          extensionId: descriptor.id,
          resourceId,
        });
      }
      if (availability.mode === "repo_manifest_resource") {
        const manifests = await readRuntimeWorkspaceSkillManifests(workspaceId);
        const manifest = manifests.find((entry) => entry.id === descriptor.id) ?? null;
        if (!manifest) {
          throw new Error(
            `Plugin \`${descriptor.id}\` no longer has a repository manifest in workspace \`${workspaceId}\`.`
          );
        }
        return {
          extensionId: descriptor.id,
          resourceId: "manifest",
          contentType: "application/json",
          content: JSON.stringify(manifest, null, 2),
          metadata: {
            source: "repo_manifest",
            manifestPath: manifest.manifestPath,
          },
        };
      }
      throw new Error(
        availability.reason ??
          `Plugin \`${descriptor.id}\` does not expose readable resources through the runtime kernel.`
      );
    },
  };
}

export function createRuntimeKernelPluginExecutionProvider(): RuntimeKernelPluginExecutionProvider {
  return {
    executePlugin: async (_workspaceId, descriptor, request) => {
      const availability = resolveRuntimeKernelPluginExecutionAvailability(descriptor);
      if (availability.mode === "live_skill") {
        return runRuntimeLiveSkill(request);
      }
      throw new Error(
        availability.reason ??
          `Plugin \`${descriptor.id}\` does not expose a bound execution provider.`
      );
    },
  };
}

export function createRuntimeKernelPluginPermissionsProvider(): RuntimeKernelPluginPermissionsProvider {
  return {
    evaluatePluginPermissions: async (workspaceId, descriptor) => {
      const availability = resolveRuntimeKernelPluginPermissionsAvailability(descriptor);
      if (availability.mode === "runtime_extension_permissions") {
        const permissionResult = await evaluateRuntimeExtensionPermissions({
          workspaceId,
          extensionId: descriptor.id,
        });
        return {
          pluginId: descriptor.id,
          permissions: permissionResult.permissions,
          decision: permissionResult.decision,
          warnings: permissionResult.warnings,
          authority: "runtime_extension",
          bindingState: descriptor.binding.state,
          evaluationMode: availability.mode,
        };
      }
      if (availability.mode === "live_skill_permissions") {
        return {
          pluginId: descriptor.id,
          permissions: descriptor.permissions,
          decision: descriptor.enabled ? "allow" : "deny",
          warnings: descriptor.enabled ? [] : ["Live skill is currently disabled in the runtime."],
          authority: "runtime_live_skill",
          bindingState: descriptor.binding.state,
          evaluationMode: availability.mode,
        };
      }
      if (availability.mode === "repo_manifest_permissions") {
        return {
          pluginId: descriptor.id,
          permissions: descriptor.permissions,
          decision: descriptor.permissions.length > 0 ? "ask" : "allow",
          warnings:
            descriptor.permissions.length > 0
              ? ["Permissions are repository-declared and require a bound runtime host."]
              : [],
          authority: "repo_manifest",
          bindingState: descriptor.binding.state,
          evaluationMode: availability.mode,
        };
      }
      throw new Error(
        availability.reason ??
          `Plugin \`${descriptor.id}\` does not publish runtime-evaluable permission state.`
      );
    },
  };
}

export function createRuntimeKernelPluginCatalogFacade(input: {
  workspaceId: string;
  catalogProvider?: RuntimeKernelPluginCatalogProvider;
  resourceProvider?: RuntimeKernelPluginResourceProvider;
  executionProvider?: RuntimeKernelPluginExecutionProvider;
  permissionsProvider?: RuntimeKernelPluginPermissionsProvider;
}): RuntimeKernelPluginCatalogFacade {
  const catalogProvider = input.catalogProvider ?? createRuntimeKernelPluginCatalogProvider();
  const resourceProvider = input.resourceProvider ?? createRuntimeKernelPluginResourceProvider();
  const executionProvider = input.executionProvider ?? createRuntimeKernelPluginExecutionProvider();
  const permissionsProvider =
    input.permissionsProvider ?? createRuntimeKernelPluginPermissionsProvider();

  const resolvePlugin = async (pluginId: string) => {
    const plugins = await catalogProvider.listPluginDescriptors(input.workspaceId);
    const plugin = plugins.find((entry) => entry.id === pluginId) ?? null;
    if (!plugin) {
      throw new Error(`Unknown runtime kernel plugin \`${pluginId}\`.`);
    }
    return plugin;
  };

  return {
    listPlugins: () => catalogProvider.listPluginDescriptors(input.workspaceId),
    readPluginResource: async (pluginId, resourceId) =>
      resourceProvider.readPluginResource(
        input.workspaceId,
        await resolvePlugin(pluginId),
        resourceId
      ),
    executePlugin: async (pluginId, request) =>
      executionProvider.executePlugin(input.workspaceId, await resolvePlugin(pluginId), request),
    evaluatePluginPermissions: async (pluginId) =>
      permissionsProvider.evaluatePluginPermissions(
        input.workspaceId,
        await resolvePlugin(pluginId)
      ),
  };
}
