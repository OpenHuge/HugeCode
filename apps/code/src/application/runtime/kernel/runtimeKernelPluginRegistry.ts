import type {
  RuntimePluginCompatibility,
  RuntimePluginPackageManifest,
  RuntimePluginPackageTransport,
  RuntimePluginTrustDecision,
  RuntimeRegistryPackageDescriptor,
} from "@ku0/code-runtime-host-contract";
import { CODE_RUNTIME_RPC_CONTRACT_VERSION } from "@ku0/code-runtime-host-contract";
import type { RuntimeKernelPluginDescriptor } from "./runtimeKernelPlugins";

const RUNTIME_KERNEL_PLUGIN_REGISTRY_METADATA_KEY = "pluginRegistry";
const LOCAL_DEV_PUBLISHER = "local-dev";

export type RuntimeKernelPluginRegistrySearchFilters = {
  transport?: RuntimePluginPackageTransport | null;
  installed?: boolean | null;
  trustStatus?: RuntimePluginTrustDecision["status"] | null;
};

export type RuntimeKernelPluginVerifyResult = {
  package: RuntimeRegistryPackageDescriptor;
  trust: RuntimePluginTrustDecision;
  compatibility: RuntimePluginCompatibility;
  installable: boolean;
};

export type RuntimeKernelPluginInstallRequest = {
  packageRef: string;
  trustOverride?: "allow_unsigned_local_dev" | null;
};

export type RuntimeKernelPluginInstallResult = {
  package: RuntimeRegistryPackageDescriptor;
  installed: boolean;
  blockedReason: string | null;
};

export type RuntimeKernelPluginUpdateResult = {
  package: RuntimeRegistryPackageDescriptor | null;
  updated: boolean;
  blockedReason: string | null;
};

export type RuntimeKernelPluginUninstallResult = {
  packageRef: string;
  removed: boolean;
  blockedReason: string | null;
};

export type RuntimeKernelPluginRegistryFacade = {
  searchPackages: (
    query: string,
    filters?: RuntimeKernelPluginRegistrySearchFilters
  ) => Promise<RuntimeRegistryPackageDescriptor[]>;
  getPackage: (packageRef: string) => Promise<RuntimeRegistryPackageDescriptor | null>;
  verifyPackage: (
    packageRefOrManifest: string | RuntimePluginPackageManifest
  ) => Promise<RuntimeKernelPluginVerifyResult>;
  installPackage: (
    request: RuntimeKernelPluginInstallRequest
  ) => Promise<RuntimeKernelPluginInstallResult>;
  updatePackage: (pluginIdOrPackageRef: string) => Promise<RuntimeKernelPluginUpdateResult>;
  uninstallPackage: (pluginId: string) => Promise<RuntimeKernelPluginUninstallResult>;
  listInstalledPackages: () => Promise<RuntimeRegistryPackageDescriptor[]>;
};

export type RuntimeKernelPluginRegistryMetadata = {
  packageRef: string;
  transport: RuntimePluginPackageTransport;
  source: RuntimeRegistryPackageDescriptor["source"];
  installed: boolean;
  installedPluginId: string | null;
  publisher: string | null;
  trust: RuntimePluginTrustDecision;
  compatibility: RuntimePluginCompatibility;
};

function createCompatibility(
  input?: Partial<RuntimePluginCompatibility>
): RuntimePluginCompatibility {
  return {
    status: "compatible",
    minimumHostContractVersion: CODE_RUNTIME_RPC_CONTRACT_VERSION,
    supportedRuntimeProtocolVersions: [CODE_RUNTIME_RPC_CONTRACT_VERSION],
    supportedCapabilityKeys: [
      "plugins.catalog",
      "plugins.registry",
      "composition.runtime",
      "extensions.activation",
      "control.agent",
      "session.commands",
    ],
    optionalTransportFeatures: [],
    blockers: [],
    ...input,
  };
}

function createTrustDecision(
  input?: Partial<RuntimePluginTrustDecision>
): RuntimePluginTrustDecision {
  return {
    status: "verified",
    verificationStatus: "verified",
    publisher: null,
    attestationSource: "sigstore",
    blockedReason: null,
    packageRef: null,
    pluginId: null,
    ...input,
  };
}

function createManifest(input: {
  packageId: string;
  version: string;
  transport: RuntimePluginPackageTransport;
  publisher: string;
  pluginId: string;
  displayName: string;
  summary: string;
  contractSurfaces: RuntimePluginPackageManifest["contractSurfaces"];
  dependencies?: string[];
  permissions?: string[];
  compatibility?: RuntimePluginCompatibility;
  attestations?: RuntimePluginPackageManifest["attestations"];
}): RuntimePluginPackageManifest {
  return {
    packageId: input.packageId,
    version: input.version,
    publisher: input.publisher,
    transport: input.transport,
    entry: {
      pluginId: input.pluginId,
      displayName: input.displayName,
      summary: input.summary,
      interfaceId: input.pluginId,
    },
    contractSurfaces: input.contractSurfaces,
    compatibility: input.compatibility ?? createCompatibility(),
    dependencies: input.dependencies ?? [],
    permissions: input.permissions ?? [],
    defaultConfig: {},
    attestations: input.attestations ?? [],
  };
}

function createPackageDescriptor(input: {
  packageRef: string;
  source: RuntimeRegistryPackageDescriptor["source"];
  installed: boolean;
  installedPluginId?: string | null;
  manifest: RuntimePluginPackageManifest;
  summary?: string | null;
  compatibility?: RuntimePluginCompatibility;
  trust?: RuntimePluginTrustDecision;
}): RuntimeRegistryPackageDescriptor {
  const compatibility =
    input.compatibility ?? input.manifest.compatibility ?? createCompatibility();
  const trust =
    input.trust ??
    createTrustDecision({
      publisher: input.manifest.publisher ?? null,
      packageRef: input.packageRef,
      pluginId: input.installedPluginId ?? input.manifest.entry.pluginId,
    });
  return {
    packageRef: input.packageRef,
    packageId: input.manifest.packageId,
    version: input.manifest.version,
    publisher: input.manifest.publisher ?? null,
    summary: input.summary ?? input.manifest.entry.summary ?? null,
    transport: input.manifest.transport,
    source: input.source,
    installed: input.installed,
    installedPluginId: input.installedPluginId ?? null,
    manifest: input.manifest,
    compatibility,
    trust,
  };
}

function createSeedPackageCatalog(): RuntimeRegistryPackageDescriptor[] {
  const compatibleRemote = createManifest({
    packageId: "hugecode.mcp.search",
    version: "1.0.0",
    transport: "mcp_remote",
    publisher: "HugeCode Labs",
    pluginId: "pkg.search.remote",
    displayName: "Remote Search Tools",
    summary: "Verified MCP remote package for shared search and route tooling.",
    contractSurfaces: [
      {
        id: "pkg.search.remote.routes",
        kind: "route",
        direction: "export",
        summary: "Remote MCP route exported for control-plane selection.",
      },
      {
        id: "pkg.search.remote.tools",
        kind: "procedure_set",
        direction: "export",
        summary: "Remote MCP tool procedures exposed after install.",
      },
    ],
    permissions: ["network"],
    attestations: [
      {
        kind: "signature",
        source: "sigstore",
        identity: "https://example.invalid/hugecode/search",
        verified: true,
        summary: "Transparency-backed package signature.",
      },
    ],
  });

  const unsignedRemote = createManifest({
    packageId: "hugecode.mcp.unsigned-lab",
    version: "0.3.0",
    transport: "mcp_remote",
    publisher: "Community Lab",
    pluginId: "pkg.unsigned.remote",
    displayName: "Unsigned Remote Lab",
    summary: "Unsigned remote package used to verify trust blocking defaults.",
    contractSurfaces: [
      {
        id: "pkg.unsigned.remote.routes",
        kind: "route",
        direction: "export",
        summary: "Experimental remote route surface.",
      },
    ],
    permissions: ["network"],
  });

  const incompatibleWasi = createManifest({
    packageId: "hugecode.wasi.future-host",
    version: "2.0.0",
    transport: "wasi_component",
    publisher: "HugeCode Labs",
    pluginId: "pkg.future.wasi",
    displayName: "Future WASI Host",
    summary: "WASI component package that intentionally requires a newer host contract.",
    contractSurfaces: [
      {
        id: "hugecode:plugin/future-host",
        kind: "world",
        direction: "export",
        summary: "Future WIT world exported by the component package.",
      },
      {
        id: "hugecode:plugin/future-host@1.0.0",
        kind: "interface",
        direction: "export",
        summary: "Future WIT interface exported by the component package.",
      },
    ],
    compatibility: createCompatibility({
      status: "incompatible",
      minimumHostContractVersion: "999.0.0",
      blockers: ["Requires a newer host contract version than the current runtime exposes."],
    }),
    permissions: ["filesystem.read"],
  });

  const dependentA2A = createManifest({
    packageId: "hugecode.a2a.planner",
    version: "1.1.0",
    transport: "a2a_remote",
    publisher: "HugeCode Labs",
    pluginId: "pkg.planner.a2a",
    displayName: "Planner Agent Package",
    summary: "Verified A2A remote package that depends on the search MCP package.",
    contractSurfaces: [
      {
        id: "pkg.planner.a2a.routes",
        kind: "route",
        direction: "export",
        summary: "A2A route exported for execution planning.",
      },
      {
        id: "pkg.planner.a2a.tasks",
        kind: "procedure_set",
        direction: "export",
        summary: "Agent task procedures published by the remote A2A package.",
      },
    ],
    dependencies: ["hugecode.mcp.search@1.0.0"],
    permissions: ["network"],
  });

  const localDevPackage = createManifest({
    packageId: "hugecode.dev.local-bridge",
    version: "0.0.1",
    transport: "host_bridge",
    publisher: LOCAL_DEV_PUBLISHER,
    pluginId: "pkg.dev.bridge",
    displayName: "Local Dev Bridge",
    summary:
      "Local bridge package that can bypass verification only with an explicit dev override.",
    contractSurfaces: [
      {
        id: "pkg.dev.bridge",
        kind: "manifest",
        direction: "export",
        summary: "Local development bridge manifest.",
      },
    ],
  });

  return [
    createPackageDescriptor({
      packageRef: "hugecode.mcp.search@1.0.0",
      source: "catalog",
      installed: false,
      manifest: compatibleRemote,
    }),
    createPackageDescriptor({
      packageRef: "hugecode.mcp.unsigned-lab@0.3.0",
      source: "catalog",
      installed: false,
      manifest: unsignedRemote,
      trust: createTrustDecision({
        status: "blocked",
        verificationStatus: "unsigned",
        publisher: unsignedRemote.publisher ?? null,
        attestationSource: null,
        blockedReason: "Unsigned remote packages are blocked by default.",
        packageRef: "hugecode.mcp.unsigned-lab@0.3.0",
        pluginId: unsignedRemote.entry.pluginId,
      }),
    }),
    createPackageDescriptor({
      packageRef: "hugecode.wasi.future-host@2.0.0",
      source: "catalog",
      installed: false,
      manifest: incompatibleWasi,
      compatibility: incompatibleWasi.compatibility ?? createCompatibility(),
      trust: createTrustDecision({
        publisher: incompatibleWasi.publisher ?? null,
        packageRef: "hugecode.wasi.future-host@2.0.0",
        pluginId: incompatibleWasi.entry.pluginId,
      }),
    }),
    createPackageDescriptor({
      packageRef: "hugecode.a2a.planner@1.1.0",
      source: "catalog",
      installed: false,
      manifest: dependentA2A,
    }),
    createPackageDescriptor({
      packageRef: "hugecode.dev.local-bridge@0.0.1",
      source: "catalog",
      installed: false,
      manifest: localDevPackage,
      trust: createTrustDecision({
        status: "blocked",
        verificationStatus: "attestation_missing",
        publisher: localDevPackage.publisher ?? null,
        attestationSource: null,
        blockedReason: "Local development packages need an explicit dev trust override.",
        packageRef: "hugecode.dev.local-bridge@0.0.1",
        pluginId: localDevPackage.entry.pluginId,
      }),
    }),
  ];
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readOptionalStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((entry) => readOptionalString(entry))
        .filter((entry): entry is string => entry !== null)
    : [];
}

function readContractSurfaces(
  plugin: RuntimeKernelPluginDescriptor
): RuntimePluginPackageManifest["contractSurfaces"] {
  return plugin.binding.surfaces.map((surface) => ({
    id: surface.id,
    kind: surface.kind,
    direction: surface.direction,
    summary: surface.summary,
  }));
}

function createRuntimeManagedPackageDescriptor(
  plugin: RuntimeKernelPluginDescriptor
): RuntimeRegistryPackageDescriptor {
  const packageRef = `runtime://${plugin.id}@${plugin.version}`;
  return createPackageDescriptor({
    packageRef,
    source: "runtime_managed",
    installed: true,
    installedPluginId: plugin.id,
    manifest: {
      packageId: `runtime.${plugin.id}`,
      version: plugin.version,
      publisher: "runtime",
      transport:
        plugin.transport === "runtime_extension" || plugin.transport === "repo_manifest"
          ? plugin.transport
          : plugin.source === "wasi_host"
            ? "wasi_component"
            : plugin.source === "rpc_host"
              ? "host_bridge"
              : plugin.source === "provider_route" ||
                  plugin.source === "backend_route" ||
                  plugin.source === "execution_route"
                ? "runtime_extension"
                : "runtime_extension",
      entry: {
        pluginId: plugin.id,
        displayName: plugin.name,
        summary: plugin.summary,
        interfaceId: plugin.binding.interfaceId,
      },
      contractSurfaces: readContractSurfaces(plugin),
      compatibility: createCompatibility(),
      dependencies: [],
      permissions: plugin.permissions,
      defaultConfig: null,
      attestations: null,
    },
    compatibility: createCompatibility(),
    trust: createTrustDecision({
      status: "runtime_managed",
      verificationStatus: "runtime_managed",
      publisher: "runtime",
      attestationSource: "runtime",
      packageRef,
      pluginId: plugin.id,
    }),
  });
}

function mapTransportToPluginSource(
  transport: RuntimePluginPackageTransport
):
  | "mcp_remote"
  | "wasi_component"
  | "a2a_remote"
  | "runtime_extension"
  | "host_bridge"
  | "repo_manifest" {
  return transport;
}

function createOperationsForPackagePlugin(
  packageDescriptor: RuntimeRegistryPackageDescriptor
): RuntimeKernelPluginDescriptor["operations"] {
  return {
    execution: {
      executable: false,
      mode: "none",
      reason: `Package \`${packageDescriptor.packageRef}\` is installed in the registry but is not yet runtime-bound for execution.`,
    },
    resources: {
      readable: false,
      mode: "none",
      reason: `Package \`${packageDescriptor.packageRef}\` does not expose readable runtime resources until it is bound into the live plugin catalog.`,
    },
    permissions: {
      evaluable: false,
      mode: "none",
      reason: `Package \`${packageDescriptor.packageRef}\` does not publish runtime-evaluable permissions until activation.`,
    },
  };
}

export function normalizeRuntimeRegistryPackagePluginDescriptor(
  packageDescriptor: RuntimeRegistryPackageDescriptor
): RuntimeKernelPluginDescriptor {
  const source = mapTransportToPluginSource(packageDescriptor.transport);
  return {
    id: packageDescriptor.installedPluginId ?? `pkg:${packageDescriptor.packageRef}`,
    name: packageDescriptor.manifest.entry.displayName ?? packageDescriptor.packageId,
    version: packageDescriptor.version,
    summary: packageDescriptor.summary ?? null,
    source,
    transport: source,
    hostProfile: {
      kind:
        packageDescriptor.transport === "wasi_component"
          ? "component"
          : packageDescriptor.transport === "host_bridge"
            ? "bridge"
            : packageDescriptor.transport === "repo_manifest"
              ? "repository"
              : packageDescriptor.transport === "runtime_extension"
                ? "runtime"
                : "remote",
      executionBoundaries: ["registry"],
    },
    workspaceId: null,
    enabled:
      packageDescriptor.installed &&
      packageDescriptor.compatibility.status === "compatible" &&
      packageDescriptor.trust.status !== "blocked",
    runtimeBacked: false,
    capabilities: [],
    permissions: packageDescriptor.manifest.permissions ?? [],
    resources: [],
    executionBoundaries: ["registry"],
    binding: {
      state: packageDescriptor.installed ? "declaration_only" : "unbound",
      contractFormat:
        packageDescriptor.transport === "mcp_remote"
          ? "mcp"
          : packageDescriptor.transport === "a2a_remote"
            ? "a2a"
            : packageDescriptor.transport === "wasi_component"
              ? "wasi_component"
              : packageDescriptor.transport === "host_bridge"
                ? "host_bridge"
                : packageDescriptor.transport === "runtime_extension"
                  ? "runtime_extension"
                  : "manifest",
      contractBoundary: `registry:${packageDescriptor.transport}`,
      interfaceId: packageDescriptor.manifest.entry.interfaceId ?? null,
      surfaces: packageDescriptor.manifest.contractSurfaces.map((surface) => ({
        id: surface.id,
        kind: surface.kind,
        direction: surface.direction,
        summary: surface.summary ?? null,
      })),
    },
    operations: createOperationsForPackagePlugin(packageDescriptor),
    metadata: {
      [RUNTIME_KERNEL_PLUGIN_REGISTRY_METADATA_KEY]:
        createRuntimeKernelPluginRegistryMetadata(packageDescriptor),
      packageManifest: packageDescriptor.manifest,
    },
    permissionDecision: null,
    health: null,
  };
}

export function createRuntimeKernelPluginRegistryMetadata(
  packageDescriptor: RuntimeRegistryPackageDescriptor
): RuntimeKernelPluginRegistryMetadata {
  return {
    packageRef: packageDescriptor.packageRef,
    transport: packageDescriptor.transport,
    source: packageDescriptor.source,
    installed: packageDescriptor.installed,
    installedPluginId: packageDescriptor.installedPluginId ?? null,
    publisher: packageDescriptor.publisher ?? null,
    trust: packageDescriptor.trust,
    compatibility: packageDescriptor.compatibility,
  };
}

export function readRuntimeKernelPluginRegistryMetadata(
  metadata: Record<string, unknown> | null | undefined
): RuntimeKernelPluginRegistryMetadata | null {
  if (!metadata) {
    return null;
  }
  const value = metadata[RUNTIME_KERNEL_PLUGIN_REGISTRY_METADATA_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const packageRef = readOptionalString(record.packageRef);
  const transport = readOptionalString(record.transport) as RuntimePluginPackageTransport | null;
  const source = readOptionalString(record.source) as
    | RuntimeRegistryPackageDescriptor["source"]
    | null;
  if (!packageRef || !transport || !source) {
    return null;
  }
  return {
    packageRef,
    transport,
    source,
    installed: record.installed === true,
    installedPluginId: readOptionalString(record.installedPluginId),
    publisher: readOptionalString(record.publisher),
    trust: (record.trust ?? createTrustDecision()) as RuntimePluginTrustDecision,
    compatibility: (record.compatibility ?? createCompatibility()) as RuntimePluginCompatibility,
  };
}

function normalizeDependencyPackageRef(dependency: string): string {
  return dependency.trim();
}

function verifyPackageDescriptor(
  packageDescriptor: RuntimeRegistryPackageDescriptor,
  installedPackageRefs: Set<string>,
  trustOverride?: RuntimeKernelPluginInstallRequest["trustOverride"]
): RuntimeKernelPluginVerifyResult {
  const dependencyBlockers = readOptionalStringArray(
    packageDescriptor.manifest.dependencies
  ).filter((dependency) => !installedPackageRefs.has(normalizeDependencyPackageRef(dependency)));
  const compatibility = {
    ...packageDescriptor.compatibility,
    blockers: [
      ...(packageDescriptor.compatibility.blockers ?? []),
      ...dependencyBlockers.map((dependency) => `Missing dependency ${dependency}.`),
    ],
    status:
      packageDescriptor.compatibility.status === "incompatible" || dependencyBlockers.length > 0
        ? "incompatible"
        : packageDescriptor.compatibility.status,
  } satisfies RuntimePluginCompatibility;

  let trust = packageDescriptor.trust;
  if (
    packageDescriptor.publisher === LOCAL_DEV_PUBLISHER &&
    trustOverride === "allow_unsigned_local_dev"
  ) {
    trust = {
      ...trust,
      status: "dev_override",
      verificationStatus: "dev_override",
      blockedReason: null,
    };
  }

  const installable =
    trust.status !== "blocked" &&
    compatibility.status !== "incompatible" &&
    (compatibility.blockers ?? []).length === 0;

  return {
    package: packageDescriptor,
    trust,
    compatibility,
    installable,
  };
}

export function createRuntimeKernelPluginRegistryFacade(input: {
  workspaceId: string;
  pluginCatalog: {
    listPlugins: () => Promise<RuntimeKernelPluginDescriptor[]>;
  };
  seedPackages?: RuntimeRegistryPackageDescriptor[];
}): RuntimeKernelPluginRegistryFacade {
  const seedCatalog = new Map(
    (input.seedPackages ?? createSeedPackageCatalog()).map(
      (entry) => [entry.packageRef, entry] as const
    )
  );
  const installedOverrides = new Map<string, RuntimeRegistryPackageDescriptor>();

  async function listRuntimeManagedPackages() {
    const livePlugins = await input.pluginCatalog.listPlugins();
    return livePlugins.map((plugin) => createRuntimeManagedPackageDescriptor(plugin));
  }

  async function listAllKnownPackages() {
    const runtimeManaged = await listRuntimeManagedPackages();
    const packages = new Map<string, RuntimeRegistryPackageDescriptor>(
      [...seedCatalog.values(), ...runtimeManaged].map(
        (entry) => [entry.packageRef, entry] as const
      )
    );
    for (const [packageRef, override] of installedOverrides.entries()) {
      packages.set(packageRef, override);
    }
    return [...packages.values()].sort((left, right) =>
      left.packageRef.localeCompare(right.packageRef)
    );
  }

  return {
    searchPackages: async (query, filters) => {
      const normalizedQuery = query.trim().toLowerCase();
      return (await listAllKnownPackages()).filter((entry) => {
        if (
          normalizedQuery.length > 0 &&
          ![
            entry.packageRef,
            entry.packageId,
            entry.summary ?? "",
            entry.manifest.entry.displayName ?? "",
            entry.publisher ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery)
        ) {
          return false;
        }
        if (filters?.transport && entry.transport !== filters.transport) {
          return false;
        }
        if (filters?.installed !== null && filters?.installed !== undefined) {
          if (entry.installed !== filters.installed) {
            return false;
          }
        }
        if (filters?.trustStatus && entry.trust.status !== filters.trustStatus) {
          return false;
        }
        return true;
      });
    },
    getPackage: async (packageRef) =>
      (await listAllKnownPackages()).find((entry) => entry.packageRef === packageRef) ?? null,
    verifyPackage: async (packageRefOrManifest) => {
      const packages = await listAllKnownPackages();
      const installedPackageRefs = new Set(
        packages.filter((entry) => entry.installed).map((entry) => entry.packageRef)
      );
      if (typeof packageRefOrManifest === "string") {
        const packageDescriptor =
          packages.find((entry) => entry.packageRef === packageRefOrManifest) ?? null;
        if (!packageDescriptor) {
          throw new Error(`Unknown runtime plugin package \`${packageRefOrManifest}\`.`);
        }
        return verifyPackageDescriptor(packageDescriptor, installedPackageRefs);
      }
      const packageRef = `${packageRefOrManifest.packageId}@${packageRefOrManifest.version}`;
      return verifyPackageDescriptor(
        createPackageDescriptor({
          packageRef,
          source: "catalog",
          installed: false,
          manifest: packageRefOrManifest,
        }),
        installedPackageRefs
      );
    },
    installPackage: async (request) => {
      const packageDescriptor =
        seedCatalog.get(request.packageRef) ?? installedOverrides.get(request.packageRef);
      if (!packageDescriptor) {
        throw new Error(`Unknown runtime plugin package \`${request.packageRef}\`.`);
      }
      const installedPackageRefs = new Set(
        (await listAllKnownPackages())
          .filter((entry) => entry.installed)
          .map((entry) => entry.packageRef)
      );
      const verification = verifyPackageDescriptor(
        packageDescriptor,
        installedPackageRefs,
        request.trustOverride
      );
      if (!verification.installable) {
        return {
          package: {
            ...packageDescriptor,
            compatibility: verification.compatibility,
            trust: verification.trust,
          },
          installed: false,
          blockedReason:
            verification.trust.blockedReason ??
            verification.compatibility.blockers?.[0] ??
            "Package installation is blocked by policy.",
        };
      }
      const installedPackage = {
        ...packageDescriptor,
        source: "installed" as const,
        installed: true,
        installedPluginId: packageDescriptor.manifest.entry.pluginId,
        compatibility: verification.compatibility,
        trust: verification.trust,
      };
      installedOverrides.set(installedPackage.packageRef, installedPackage);
      return {
        package: installedPackage,
        installed: true,
        blockedReason: null,
      };
    },
    updatePackage: async (pluginIdOrPackageRef) => {
      const packages = await listAllKnownPackages();
      const current =
        packages.find((entry) => entry.packageRef === pluginIdOrPackageRef) ??
        packages.find((entry) => entry.installedPluginId === pluginIdOrPackageRef) ??
        null;
      if (!current) {
        throw new Error(`Unknown runtime plugin package \`${pluginIdOrPackageRef}\`.`);
      }
      return {
        package: current,
        updated: false,
        blockedReason: null,
      };
    },
    uninstallPackage: async (pluginId) => {
      const packages = await listAllKnownPackages();
      const current = packages.find((entry) => entry.installedPluginId === pluginId) ?? null;
      if (!current) {
        return {
          packageRef: pluginId,
          removed: false,
          blockedReason: `Unknown runtime plugin package bound to plugin \`${pluginId}\`.`,
        };
      }
      if (current.source === "runtime_managed") {
        return {
          packageRef: current.packageRef,
          removed: false,
          blockedReason: "Runtime-managed plugins cannot be uninstalled from the registry facade.",
        };
      }
      installedOverrides.delete(current.packageRef);
      return {
        packageRef: current.packageRef,
        removed: true,
        blockedReason: null,
      };
    },
    listInstalledPackages: async () =>
      (await listAllKnownPackages()).filter(
        (entry) => entry.installed || entry.source === "runtime_managed"
      ),
  };
}
