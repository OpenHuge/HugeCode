import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  KernelCapabilityDescriptor,
  LiveSkillSummary,
  OAuthAccountSummary,
  OAuthPoolSummary,
  RuntimeProviderCatalogEntry,
  RuntimeExtensionRecord,
} from "@ku0/code-runtime-host-contract";

const readRuntimeWorkspaceSkillManifestsMock = vi.hoisted(() => vi.fn());
const readRuntimeExtensionResourceMock = vi.hoisted(() => vi.fn());
const evaluateRuntimeExtensionPermissionsMock = vi.hoisted(() => vi.fn());
const listRuntimeKernelCapabilitiesMock = vi.hoisted(() => vi.fn());
const runRuntimeLiveSkillMock = vi.hoisted(() => vi.fn());
const getProvidersCatalogMock = vi.hoisted(() => vi.fn());
const listOAuthAccountsMock = vi.hoisted(() => vi.fn());
const listOAuthPoolsMock = vi.hoisted(() => vi.fn());

vi.mock("../ports/runtimeExtensions", () => ({
  evaluateRuntimeExtensionPermissions: evaluateRuntimeExtensionPermissionsMock,
  listRuntimeExtensions: vi.fn(),
  readRuntimeExtensionHealth: vi.fn(),
  readRuntimeExtensionResource: readRuntimeExtensionResourceMock,
}));

vi.mock("./runtimeWorkspaceSkillManifests", async () => {
  const actual = await vi.importActual<typeof import("./runtimeWorkspaceSkillManifests")>(
    "./runtimeWorkspaceSkillManifests"
  );
  return {
    ...actual,
    readRuntimeWorkspaceSkillManifests: readRuntimeWorkspaceSkillManifestsMock,
  };
});

vi.mock("../ports/tauriRuntime", () => ({
  runRuntimeLiveSkill: runRuntimeLiveSkillMock,
}));

vi.mock("../ports/runtimeKernelCapabilities", () => ({
  listRuntimeKernelCapabilities: listRuntimeKernelCapabilitiesMock,
}));

vi.mock("../ports/tauriRuntimeSkills", () => ({
  listRuntimeLiveSkills: vi.fn(),
}));

vi.mock("../ports/tauriOauth", () => ({
  getProvidersCatalog: getProvidersCatalogMock,
  listOAuthAccounts: listOAuthAccountsMock,
  listOAuthPools: listOAuthPoolsMock,
}));

function createExtensionRecord(
  overrides: Partial<RuntimeExtensionRecord> = {}
): RuntimeExtensionRecord {
  return {
    extensionId: "ext-1",
    version: "1.0.0",
    displayName: "Extension One",
    publisher: "HugeCode",
    summary: "Unified extension record",
    kind: "instruction",
    distribution: "workspace",
    name: "Extension One",
    transport: "repo-manifest",
    lifecycleState: "enabled",
    enabled: true,
    workspaceId: "ws-1",
    capabilities: ["review"],
    permissions: ["workspace:read"],
    uiApps: [],
    provenance: { scope: "workspace" },
    config: {},
    installedAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

function createLiveSkillSummary(overrides: Partial<LiveSkillSummary> = {}): LiveSkillSummary {
  return {
    id: "review-agent",
    name: "Review Agent",
    description: "Structured review",
    kind: "research_orchestration",
    source: "workspace",
    version: "1.0.0",
    enabled: true,
    supportsNetwork: false,
    permissions: [],
    tags: ["review"],
    ...overrides,
  };
}

function createHostCapabilityDescriptor(
  overrides: Partial<KernelCapabilityDescriptor> = {}
): KernelCapabilityDescriptor {
  return {
    id: "host:wasi",
    name: "WASI host binder",
    kind: "host",
    enabled: false,
    health: "blocked",
    executionProfile: {
      placement: "local",
      interactivity: "background",
      isolation: "host",
      network: "restricted",
      authority: "service",
    },
    tags: ["component-model", "wit", "host"],
    metadata: {
      pluginSource: "wasi_host",
      bindingState: "unbound",
      contractFormat: "wit",
      contractBoundary: "world-imports",
      interfaceId: "wasi:*/*",
      worldId: "hugecode:runtime/plugin-host",
      contractSurfaces: [
        {
          id: "hugecode:runtime/plugin-host",
          kind: "world",
          direction: "import",
          summary:
            "Reserved component-model world that the runtime host binder is expected to satisfy.",
        },
        {
          id: "wasi:*/*",
          kind: "interface",
          direction: "import",
          summary: "Semver-qualified WIT interface imports published by the runtime host binder.",
        },
      ],
      summary:
        "Runtime-published component-model host slot reserved for future WIT/world bindings.",
      reason: "Runtime host binder is not currently connected.",
    },
    ...overrides,
  };
}

function createRuntimeProviderCatalogEntry(
  overrides: Partial<RuntimeProviderCatalogEntry> = {}
): RuntimeProviderCatalogEntry {
  return {
    providerId: "openai",
    displayName: "OpenAI",
    pool: "codex",
    oauthProviderId: "codex",
    aliases: [],
    defaultModelId: "gpt-5.4",
    available: true,
    supportsNative: true,
    supportsOpenaiCompat: true,
    readinessKind: "ready",
    readinessMessage: null,
    executionKind: "cloud",
    registryVersion: "1",
    capabilityMatrix: {
      supportsTools: "supported",
      supportsReasoningEffort: "supported",
      supportsVision: "supported",
      supportsJsonSchema: "supported",
      maxContextTokens: 200_000,
      supportedReasoningEfforts: ["low", "medium", "high"],
    },
    ...overrides,
  };
}

function createOAuthAccountSummary(
  overrides: Partial<OAuthAccountSummary> = {}
): OAuthAccountSummary {
  return {
    accountId: "acct-1",
    provider: "codex",
    externalAccountId: null,
    email: "operator@example.com",
    displayName: "Operator",
    status: "enabled",
    disabledReason: null,
    routeConfig: {
      schedulable: true,
    },
    routingState: {
      credentialReady: true,
    },
    metadata: {},
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

function createOAuthPoolSummary(overrides: Partial<OAuthPoolSummary> = {}): OAuthPoolSummary {
  return {
    poolId: "pool-1",
    provider: "codex",
    name: "Primary pool",
    strategy: "round_robin",
    stickyMode: "cache_first",
    preferredAccountId: null,
    enabled: true,
    metadata: {},
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

describe("runtimeKernelPlugins", () => {
  beforeEach(() => {
    readRuntimeWorkspaceSkillManifestsMock.mockReset();
    readRuntimeExtensionResourceMock.mockReset();
    evaluateRuntimeExtensionPermissionsMock.mockReset();
    listRuntimeKernelCapabilitiesMock.mockReset();
    runRuntimeLiveSkillMock.mockReset();
    getProvidersCatalogMock.mockReset();
    listOAuthAccountsMock.mockReset();
    listOAuthPoolsMock.mockReset();
    getProvidersCatalogMock.mockResolvedValue([]);
    listOAuthAccountsMock.mockResolvedValue([]);
    listOAuthPoolsMock.mockResolvedValue([]);
  });

  it("normalizes runtime extensions, live skills, and repo manifests into unified plugin descriptors", async () => {
    const plugins = await import("./runtimeKernelPlugins");

    expect(
      plugins.normalizeRuntimeExtensionPluginDescriptor(
        createExtensionRecord(),
        {
          extensionId: "ext-1",
          permissions: ["workspace:read"],
          decision: "ask",
          warnings: [],
        },
        {
          extensionId: "ext-1",
          lifecycleState: "enabled",
          healthy: true,
          warnings: [],
          checkedAt: 10,
        }
      )
    ).toMatchObject({
      id: "ext-1",
      source: "runtime_extension",
      transport: "runtime_extension",
      runtimeBacked: true,
      enabled: true,
      binding: expect.objectContaining({
        state: "bound",
        contractFormat: "runtime_extension",
      }),
    });

    expect(plugins.normalizeLiveSkillPluginDescriptor(createLiveSkillSummary())).toMatchObject({
      id: "review-agent",
      source: "live_skill",
      transport: "live_skill",
      runtimeBacked: true,
      permissions: [],
      executionBoundaries: expect.arrayContaining(["runtime"]),
      binding: expect.objectContaining({
        state: "bound",
        contractFormat: "live_skill",
      }),
    });

    expect(
      plugins.normalizeRepoManifestPluginDescriptor({
        id: "review-agent",
        name: "Review Agent",
        version: "1.0.0",
        kind: "skill",
        trustLevel: "local",
        entrypoint: "review-agent",
        permissions: ["workspace:read"],
        compatibility: {
          minRuntime: "1.0.0",
          maxRuntime: null,
          minApp: "1.0.0",
          maxApp: null,
        },
        manifestPath: ".hugecode/skills/review-agent/manifest.json",
      })
    ).toMatchObject({
      id: "review-agent",
      source: "repo_manifest",
      transport: "repo_manifest",
      runtimeBacked: false,
      binding: expect.objectContaining({
        state: "declaration_only",
        contractFormat: "manifest",
      }),
    });
  });

  it("prefers runtime-backed truth when repo manifests collide with runtime plugins", async () => {
    const plugins = await import("./runtimeKernelPlugins");

    const merged = plugins.mergeRuntimeKernelPluginDescriptors([
      plugins.normalizeRepoManifestPluginDescriptor({
        id: "review-agent",
        name: "Review Agent",
        version: "1.0.0",
        kind: "skill",
        trustLevel: "local",
        entrypoint: "review-agent",
        permissions: ["workspace:read"],
        compatibility: {
          minRuntime: "1.0.0",
          maxRuntime: null,
          minApp: "1.0.0",
          maxApp: null,
        },
        manifestPath: ".hugecode/skills/review-agent/manifest.json",
      }),
      plugins.normalizeLiveSkillPluginDescriptor(createLiveSkillSummary()),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: "review-agent",
      source: "live_skill",
      runtimeBacked: true,
      metadata: expect.objectContaining({
        manifestPath: ".hugecode/skills/review-agent/manifest.json",
      }),
    });
  });

  it("publishes reserved WASI and RPC host slots as explicit unsupported plugin descriptors", async () => {
    const plugins = await import("./runtimeKernelPlugins");

    expect(plugins.createReservedHostPluginDescriptors()).toEqual([
      expect.objectContaining({
        id: "host:rpc",
        source: "rpc_host",
        transport: "rpc_host",
        enabled: false,
        permissionDecision: "unsupported",
        metadata: expect.objectContaining({
          bindingState: "unbound",
          contractFormat: "rpc",
        }),
        health: expect.objectContaining({
          state: "unsupported",
        }),
      }),
      expect.objectContaining({
        id: "host:wasi",
        source: "wasi_host",
        transport: "wasi_host",
        enabled: false,
        permissionDecision: "unsupported",
        metadata: expect.objectContaining({
          bindingState: "unbound",
          contractFormat: "wit",
          semverQualifiedImports: true,
        }),
        health: expect.objectContaining({
          state: "unsupported",
        }),
      }),
    ]);
  });

  it("normalizes runtime host capabilities into runtime-backed host descriptors", async () => {
    const plugins = await import("./runtimeKernelPlugins");

    expect(
      plugins.normalizeRuntimeHostCapabilityPluginDescriptor(createHostCapabilityDescriptor())
    ).toMatchObject({
      id: "host:wasi",
      source: "wasi_host",
      runtimeBacked: true,
      enabled: false,
      binding: {
        state: "unbound",
        contractFormat: "wit",
        contractBoundary: "world-imports",
        interfaceId: "wasi:*/*",
        surfaces: [
          {
            id: "hugecode:runtime/plugin-host",
            kind: "world",
            direction: "import",
            summary:
              "Reserved component-model world that the runtime host binder is expected to satisfy.",
          },
          {
            id: "wasi:*/*",
            kind: "interface",
            direction: "import",
            summary: "Semver-qualified WIT interface imports published by the runtime host binder.",
          },
        ],
      },
      health: {
        state: "unsupported",
        warnings: ["Runtime host binder is not currently connected."],
      },
    });
  });

  it("distinguishes binding state from execution availability", async () => {
    const plugins = await import("./runtimeKernelPlugins");

    expect(
      plugins.resolveRuntimeKernelPluginExecutionAvailability(
        plugins.normalizeLiveSkillPluginDescriptor(createLiveSkillSummary())
      )
    ).toMatchObject({
      executable: true,
      mode: "live_skill",
      reason: null,
    });

    expect(
      plugins.resolveRuntimeKernelPluginExecutionAvailability(
        plugins.normalizeRuntimeExtensionPluginDescriptor(
          createExtensionRecord(),
          {
            extensionId: "ext-1",
            permissions: ["workspace:read"],
            decision: "ask",
            warnings: [],
          },
          {
            extensionId: "ext-1",
            lifecycleState: "enabled",
            healthy: true,
            warnings: [],
            checkedAt: 10,
          }
        )
      )
    ).toMatchObject({
      executable: false,
      mode: "none",
    });

    expect(
      plugins.resolveRuntimeKernelPluginResourceAvailability(
        plugins.normalizeRepoManifestPluginDescriptor({
          id: "review-agent",
          name: "Review Agent",
          version: "1.0.0",
          kind: "skill",
          trustLevel: "local",
          entrypoint: "review-agent",
          permissions: ["workspace:read"],
          compatibility: {
            minRuntime: "1.0.0",
            maxRuntime: null,
            minApp: "1.0.0",
            maxApp: null,
          },
          manifestPath: ".hugecode/skills/review-agent/manifest.json",
        }),
        "manifest"
      )
    ).toMatchObject({
      readable: true,
      mode: "repo_manifest_resource",
      reason: null,
    });

    expect(
      plugins.resolveRuntimeKernelPluginPermissionsAvailability(
        plugins.normalizeLiveSkillPluginDescriptor(createLiveSkillSummary())
      )
    ).toMatchObject({
      evaluable: true,
      mode: "live_skill_permissions",
    });
  });

  it("returns explicit unbound execution errors for reserved host slots", async () => {
    const plugins = await import("./runtimeKernelPlugins");
    const facade = plugins.createRuntimeKernelPluginCatalogFacade({
      workspaceId: "ws-1",
      catalogProvider: {
        listPluginDescriptors: async () => plugins.createReservedHostPluginDescriptors(),
      },
    });

    await expect(
      facade.executePlugin("host:wasi", {
        skillId: "host:wasi",
        input: "",
      })
    ).rejects.toThrow("currently unbound in the runtime host binder");

    await expect(
      facade.executePlugin("host:rpc", {
        skillId: "host:rpc",
        input: "",
      })
    ).rejects.toThrow("currently unbound in the runtime host binder");
  });

  it("returns explicit non-executable errors for bound runtime extensions", async () => {
    const plugins = await import("./runtimeKernelPlugins");
    const descriptor = plugins.normalizeRuntimeExtensionPluginDescriptor(
      createExtensionRecord(),
      {
        extensionId: "ext-1",
        permissions: ["workspace:read"],
        decision: "ask",
        warnings: [],
      },
      {
        extensionId: "ext-1",
        lifecycleState: "enabled",
        healthy: true,
        warnings: [],
        checkedAt: 10,
      }
    );
    const facade = plugins.createRuntimeKernelPluginCatalogFacade({
      workspaceId: "ws-1",
      catalogProvider: {
        listPluginDescriptors: async () => [descriptor],
      },
    });

    await expect(
      facade.executePlugin("ext-1", {
        skillId: "ext-1",
        input: "",
      })
    ).rejects.toThrow("catalog/resource access only");
  });

  it("reads repository manifests through the unified plugin resource provider", async () => {
    const plugins = await import("./runtimeKernelPlugins");
    readRuntimeWorkspaceSkillManifestsMock.mockResolvedValue([
      {
        id: "review-agent",
        name: "Review Agent",
        version: "1.0.0",
        kind: "skill",
        trustLevel: "local",
        entrypoint: "review-agent",
        permissions: ["workspace:read"],
        compatibility: {
          minRuntime: "1.0.0",
          maxRuntime: null,
          minApp: "1.0.0",
          maxApp: null,
        },
        manifestPath: ".hugecode/skills/review-agent/manifest.json",
      },
    ]);
    const descriptor = plugins.normalizeRepoManifestPluginDescriptor({
      id: "review-agent",
      name: "Review Agent",
      version: "1.0.0",
      kind: "skill",
      trustLevel: "local",
      entrypoint: "review-agent",
      permissions: ["workspace:read"],
      compatibility: {
        minRuntime: "1.0.0",
        maxRuntime: null,
        minApp: "1.0.0",
        maxApp: null,
      },
      manifestPath: ".hugecode/skills/review-agent/manifest.json",
    });
    const facade = plugins.createRuntimeKernelPluginCatalogFacade({
      workspaceId: "ws-1",
      catalogProvider: {
        listPluginDescriptors: async () => [descriptor],
      },
    });

    await expect(facade.readPluginResource("review-agent", "manifest")).resolves.toMatchObject({
      extensionId: "review-agent",
      resourceId: "manifest",
      contentType: "application/json",
      metadata: expect.objectContaining({
        source: "repo_manifest",
        manifestPath: ".hugecode/skills/review-agent/manifest.json",
      }),
    });
  });

  it("returns explicit unsupported errors for plugin operations without provider support", async () => {
    const plugins = await import("./runtimeKernelPlugins");
    const hostDescriptor = plugins.createReservedHostPluginDescriptors()[0];
    const facade = plugins.createRuntimeKernelPluginCatalogFacade({
      workspaceId: "ws-1",
      catalogProvider: {
        listPluginDescriptors: async () => [hostDescriptor],
      },
    });

    await expect(facade.readPluginResource(hostDescriptor.id, "manifest")).rejects.toThrow(
      "does not expose readable resources"
    );
    await expect(facade.evaluatePluginPermissions(hostDescriptor.id)).rejects.toThrow(
      "does not publish runtime-evaluable permission state"
    );
  });

  it("evaluates live-skill and repo-manifest permissions through plugin-specific truth", async () => {
    const plugins = await import("./runtimeKernelPlugins");
    const liveSkillDescriptor = plugins.normalizeLiveSkillPluginDescriptor(
      createLiveSkillSummary({
        permissions: ["network", "workspace:read"],
      })
    );
    const repoManifestDescriptor = plugins.normalizeRepoManifestPluginDescriptor({
      id: "review-manifest",
      name: "Review Manifest",
      version: "1.0.0",
      kind: "skill",
      trustLevel: "local",
      entrypoint: "review-manifest",
      permissions: ["workspace:read"],
      compatibility: {
        minRuntime: "1.0.0",
        maxRuntime: null,
        minApp: "1.0.0",
        maxApp: null,
      },
      manifestPath: ".hugecode/skills/review-manifest/manifest.json",
    });
    const facade = plugins.createRuntimeKernelPluginCatalogFacade({
      workspaceId: "ws-1",
      catalogProvider: {
        listPluginDescriptors: async () => [liveSkillDescriptor, repoManifestDescriptor],
      },
    });

    await expect(facade.evaluatePluginPermissions(liveSkillDescriptor.id)).resolves.toMatchObject({
      pluginId: liveSkillDescriptor.id,
      permissions: ["network", "workspace:read"],
      decision: "allow",
      authority: "runtime_live_skill",
      evaluationMode: "live_skill_permissions",
    });
    await expect(
      facade.evaluatePluginPermissions(repoManifestDescriptor.id)
    ).resolves.toMatchObject({
      pluginId: repoManifestDescriptor.id,
      permissions: ["workspace:read"],
      decision: "ask",
      authority: "repo_manifest",
      evaluationMode: "repo_manifest_permissions",
    });
  });

  it("normalizes provider routing into unified routing plugin descriptors", async () => {
    const plugins = await import("./runtimeKernelPlugins");

    const descriptors = plugins.createRuntimeProviderRoutePluginDescriptors({
      providers: [
        createRuntimeProviderCatalogEntry(),
        createRuntimeProviderCatalogEntry({
          providerId: "local",
          displayName: "Native runtime",
          pool: null,
          oauthProviderId: null,
          defaultModelId: null,
          executionKind: "local",
          capabilityMatrix: null,
        }),
      ],
      accounts: [],
      pools: [],
    });

    expect(descriptors.map((descriptor) => descriptor.id)).toEqual([
      "route:auto",
      "route:local",
      "route:openai",
    ]);
    expect(descriptors[0]).toMatchObject({
      source: "execution_route",
      transport: "execution_route",
      binding: {
        contractFormat: "route",
        surfaces: [
          {
            kind: "route",
            direction: "export",
          },
        ],
      },
      metadata: expect.objectContaining({
        routeKind: "combined_execution",
        routeValue: "auto",
        readiness: "attention",
      }),
    });
    expect(descriptors[2]).toMatchObject({
      source: "provider_route",
      transport: "provider_route",
      operations: {
        execution: {
          executable: false,
          mode: "none",
        },
      },
      metadata: expect.objectContaining({
        routeKind: "provider_family",
        providerId: "openai",
        oauthProviderId: "codex",
        readiness: "blocked",
        enabledPoolCount: 0,
        credentialReadyAccountCount: 0,
        capabilityMatrix: expect.objectContaining({
          supportsTools: "supported",
        }),
      }),
    });
  });

  it("builds selected routing state from plugin descriptors instead of the legacy routing facade", async () => {
    const plugins = await import("./runtimeKernelPlugins");

    const selection = plugins.resolveRuntimeKernelRouteSelection({
      plugins: [
        ...plugins.createRuntimeProviderRoutePluginDescriptors({
          providers: [createRuntimeProviderCatalogEntry()],
          accounts: [createOAuthAccountSummary()],
          pools: [createOAuthPoolSummary()],
        }),
      ],
      selectedRoute: "openai",
      preferredBackendIds: ["backend-primary", "backend-primary"],
      resolvedBackendId: "backend-primary",
      provenance: "backend_preference",
    });

    expect(selection.normalizedValue).toBe("openai");
    expect(selection.selected).toMatchObject({
      value: "openai",
      ready: true,
      readiness: "ready",
      detail: expect.stringContaining("backend-primary"),
      provenance: expect.objectContaining({
        source: "backend_preference",
      }),
      plugin: expect.objectContaining({
        source: "execution_route",
        transport: "execution_route",
        metadata: expect.objectContaining({
          preferredBackendIds: ["backend-primary"],
          resolvedBackendId: "backend-primary",
        }),
      }),
    });
  });

  it("defaults missing route selection to automatic routing instead of the first provider alphabetically", async () => {
    const plugins = await import("./runtimeKernelPlugins");

    const selection = plugins.resolveRuntimeKernelRouteSelection({
      plugins: plugins.createRuntimeProviderRoutePluginDescriptors({
        providers: [
          createRuntimeProviderCatalogEntry({
            providerId: "anthropic",
            displayName: "Anthropic",
            pool: "claude",
            oauthProviderId: "claude",
          }),
          createRuntimeProviderCatalogEntry(),
        ],
        accounts: [createOAuthAccountSummary()],
        pools: [createOAuthPoolSummary()],
      }),
    });

    expect(selection.normalizedValue).toBe("auto");
    expect(selection.selected.value).toBe("auto");
    expect(selection.options.map((option) => option.value)).toEqual([
      "anthropic",
      "auto",
      "openai",
    ]);
  });
});
