import type {
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
import type { RuntimeWorkspaceSkillManifest } from "./runtimeWorkspaceSkillManifests";
import { readRuntimeWorkspaceSkillManifests } from "./runtimeWorkspaceSkillManifests";

export type RuntimeKernelPluginSource =
  | "runtime_extension"
  | "live_skill"
  | "repo_manifest"
  | "wasi_host"
  | "rpc_host";

export type RuntimeKernelPluginTransport = RuntimeKernelPluginSource;

export type RuntimeKernelPluginHostProfile = {
  kind: "runtime" | "repository" | "wasi" | "rpc";
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
  metadata: Record<string, unknown> | null;
  permissionDecision: "allow" | "ask" | "deny" | "unsupported" | null;
  health: {
    state: "healthy" | "degraded" | "unsupported" | "unknown";
    checkedAt: number | null;
    warnings: string[];
  } | null;
};

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
  ) => Promise<RuntimeExtensionPermissionsEvaluateResponse | null>;
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
  evaluatePluginPermissions: (
    pluginId: string
  ) => Promise<RuntimeExtensionPermissionsEvaluateResponse | null>;
};

function createReservedHostPluginDescriptor(
  source: Extract<RuntimeKernelPluginSource, "wasi_host" | "rpc_host">
): RuntimeKernelPluginDescriptor {
  const isWasiHost = source === "wasi_host";

  return {
    id: isWasiHost ? "host:wasi" : "host:rpc",
    name: isWasiHost ? "WASI host slot" : "RPC host slot",
    version: "unbound",
    summary: isWasiHost
      ? "Reserved component-model host slot for future WIT/world bindings."
      : "Reserved remote host slot for future RPC-backed plugin bindings.",
    source,
    transport: source,
    hostProfile: {
      kind: isWasiHost ? "wasi" : "rpc",
      executionBoundaries: [source],
    },
    workspaceId: null,
    enabled: false,
    runtimeBacked: false,
    capabilities: [],
    permissions: [],
    resources: [],
    executionBoundaries: [source],
    metadata: {
      bindingState: "unbound",
      contractFormat: isWasiHost ? "wit" : "rpc",
      contractBoundary: isWasiHost ? "world-imports" : "remote-procedure-calls",
      semverQualifiedImports: isWasiHost,
      canonicalAbiResources: isWasiHost,
      hostManaged: true,
    },
    permissionDecision: "unsupported",
    health: {
      state: "unsupported",
      checkedAt: null,
      warnings: ["Host provider is not yet bound in apps/code."],
    },
  };
}

export function createReservedHostPluginDescriptors(): RuntimeKernelPluginDescriptor[] {
  return [
    createReservedHostPluginDescriptor("rpc_host"),
    createReservedHostPluginDescriptor("wasi_host"),
  ];
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
  return {
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
    metadata: {
      distribution: extension.distribution,
      kind: extension.kind,
      transport: extension.transport,
      provenance: extension.provenance,
      config: extension.config,
    },
    permissionDecision: permissionResult?.decision ?? null,
    health: normalizeWarningsToHealth(healthResult),
  };
}

export function normalizeLiveSkillPluginDescriptor(
  skill: LiveSkillSummary
): RuntimeKernelPluginDescriptor {
  return {
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
    permissions: skill.supportsNetwork ? ["network"] : [],
    resources: [],
    executionBoundaries: ["runtime"],
    metadata: {
      source: skill.source,
      kind: skill.kind,
      aliases: skill.aliases ?? [],
    },
    permissionDecision: null,
    health: {
      state: "healthy",
      checkedAt: null,
      warnings: [],
    },
  };
}

export function normalizeRepoManifestPluginDescriptor(
  manifest: RuntimeWorkspaceSkillManifest
): RuntimeKernelPluginDescriptor {
  return {
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
    metadata: {
      trustLevel: manifest.trustLevel,
      entrypoint: manifest.entrypoint,
      compatibility: manifest.compatibility,
      manifestPath: manifest.manifestPath,
    },
    permissionDecision: "unsupported",
    health: {
      state: "unsupported",
      checkedAt: null,
      warnings: [],
    },
  };
}

const PLUGIN_SOURCE_PRIORITY: Record<RuntimeKernelPluginSource, number> = {
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

async function listRepoManifestPluginDescriptors(
  workspaceId: string
): Promise<RuntimeKernelPluginDescriptor[]> {
  const manifests = await readRuntimeWorkspaceSkillManifests(workspaceId);
  return manifests.map((manifest) => normalizeRepoManifestPluginDescriptor(manifest));
}

export function createRuntimeKernelPluginCatalogProvider(): RuntimeKernelPluginCatalogProvider {
  return {
    listPluginDescriptors: async (workspaceId) =>
      mergeRuntimeKernelPluginDescriptors([
        ...createReservedHostPluginDescriptors(),
        ...(await listRepoManifestPluginDescriptors(workspaceId)),
        ...(await listLiveSkillPluginDescriptors()),
        ...(await listRuntimeExtensionPluginDescriptors(workspaceId)),
      ]),
  };
}

export function createRuntimeKernelPluginResourceProvider(): RuntimeKernelPluginResourceProvider {
  return {
    readPluginResource: async (workspaceId, descriptor, resourceId) => {
      if (descriptor.source !== "runtime_extension") {
        return null;
      }
      return readRuntimeExtensionResource({
        workspaceId,
        extensionId: descriptor.id,
        resourceId,
      });
    },
  };
}

export function createRuntimeKernelPluginExecutionProvider(): RuntimeKernelPluginExecutionProvider {
  return {
    executePlugin: async (_workspaceId, descriptor, request) => {
      if (descriptor.source === "live_skill") {
        return runRuntimeLiveSkill(request);
      }
      if (descriptor.source === "repo_manifest") {
        throw new Error(
          `Plugin \`${descriptor.id}\` is declaration-only and does not expose a bound execution provider.`
        );
      }
      if (descriptor.source === "wasi_host") {
        throw new Error(
          `Plugin \`${descriptor.id}\` reserves a WIT/component-model host slot and is currently unbound in apps/code.`
        );
      }
      if (descriptor.source === "rpc_host") {
        throw new Error(
          `Plugin \`${descriptor.id}\` reserves an RPC host slot and is currently unbound in apps/code.`
        );
      }
      throw new Error(`Plugin \`${descriptor.id}\` does not expose a bound execution provider.`);
    },
  };
}

export function createRuntimeKernelPluginPermissionsProvider(): RuntimeKernelPluginPermissionsProvider {
  return {
    evaluatePluginPermissions: async (workspaceId, descriptor) => {
      if (descriptor.source !== "runtime_extension") {
        return null;
      }
      return evaluateRuntimeExtensionPermissions({
        workspaceId,
        extensionId: descriptor.id,
      });
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
