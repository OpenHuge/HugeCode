import { describe, expect, it, vi } from "vitest";
import type {
  LiveSkillSummary,
  RuntimeRegistryPackageDescriptor,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeKernelPluginDescriptor } from "./runtimeKernelPluginTypes";
import type { RuntimeWorkspaceSkillManifest } from "./runtimeWorkspaceSkillManifests";
import {
  compileRuntimeBehaviorAsset,
  createRuntimeExtensionActivationService,
} from "./runtimeExtensionActivation";

function createRuntimePlugin(
  overrides: Partial<RuntimeKernelPluginDescriptor> = {}
): RuntimeKernelPluginDescriptor {
  return {
    id: "ext.shell",
    name: "Shell Tools",
    version: "1.0.0",
    summary: "Runtime shell helpers",
    source: "runtime_extension",
    transport: "runtime_extension",
    hostProfile: {
      kind: "runtime",
      executionBoundaries: ["runtime"],
    },
    workspaceId: "workspace-1",
    enabled: true,
    runtimeBacked: true,
    capabilities: [{ id: "shell.exec", enabled: true }],
    permissions: ["workspace:read"],
    resources: [{ id: "manifest", contentType: "application/json" }],
    executionBoundaries: ["runtime"],
    binding: {
      state: "bound",
      contractFormat: "runtime_extension",
      contractBoundary: "runtime-extension-record",
      interfaceId: "ext.shell",
      surfaces: [
        {
          id: "ext.shell",
          kind: "extension",
          direction: "export",
          summary: "Runtime extension.",
        },
      ],
    },
    operations: {
      execution: {
        executable: true,
        mode: "none",
        reason: null,
      },
      resources: {
        readable: true,
        mode: "runtime_extension_resource",
        reason: null,
      },
      permissions: {
        evaluable: true,
        mode: "runtime_extension_permissions",
        reason: null,
      },
    },
    metadata: null,
    permissionDecision: "allow",
    health: {
      state: "healthy",
      checkedAt: 1,
      warnings: [],
    },
    ...overrides,
  };
}

function createWorkspaceSkillManifest(
  overrides: Partial<RuntimeWorkspaceSkillManifest> = {}
): RuntimeWorkspaceSkillManifest {
  return {
    id: "repo.review",
    name: "Repository Review",
    version: "1.0.0",
    kind: "skill",
    trustLevel: "verified",
    entrypoint: ".hugecode/skills/repo.review/index.ts",
    permissions: ["workspace:read"],
    compatibility: {
      minRuntime: "1.0.0",
      maxRuntime: null,
      minApp: null,
      maxApp: null,
    },
    manifestPath: ".hugecode/skills/repo.review/manifest.json",
    ...overrides,
  };
}

function createLiveSkillSummary(overrides: Partial<LiveSkillSummary> = {}): LiveSkillSummary {
  return {
    id: "repo.review",
    name: "Repository Review",
    description: "Repository-backed review skill",
    kind: "research_orchestration",
    source: "workspace",
    version: "1.0.0",
    enabled: true,
    supportsNetwork: false,
    permissions: ["workspace:read"],
    tags: ["review"],
    ...overrides,
  };
}

function createInstalledPackage(
  overrides: Partial<RuntimeRegistryPackageDescriptor> = {}
): RuntimeRegistryPackageDescriptor {
  return {
    packageRef: "hugecode.mcp.search@1.0.0",
    packageId: "hugecode.mcp.search",
    version: "1.0.0",
    publisher: "HugeCode Labs",
    summary: "Remote search package",
    transport: "mcp_remote",
    source: "installed",
    installed: true,
    installedPluginId: "pkg.search.remote",
    manifest: {
      packageId: "hugecode.mcp.search",
      version: "1.0.0",
      publisher: "HugeCode Labs",
      transport: "mcp_remote",
      entry: {
        pluginId: "pkg.search.remote",
        displayName: "Remote Search",
        summary: "Remote search package",
        interfaceId: "pkg.search.remote",
      },
      contractSurfaces: [
        {
          id: "pkg.search.remote.tools",
          kind: "procedure_set",
          direction: "export",
          summary: "Remote MCP tools",
        },
      ],
      compatibility: {
        status: "compatible",
        minimumHostContractVersion: "1.0.0",
        supportedRuntimeProtocolVersions: ["1.0.0"],
        supportedCapabilityKeys: ["plugins.catalog"],
        optionalTransportFeatures: [],
        blockers: [],
      },
      dependencies: [],
      permissions: ["network"],
      defaultConfig: {},
      attestations: [],
    },
    compatibility: {
      status: "compatible",
      minimumHostContractVersion: "1.0.0",
      supportedRuntimeProtocolVersions: ["1.0.0"],
      supportedCapabilityKeys: ["plugins.catalog"],
      optionalTransportFeatures: [],
      blockers: [],
    },
    trust: {
      status: "verified",
      verificationStatus: "verified",
      publisher: "HugeCode Labs",
      attestationSource: "sigstore",
      blockedReason: null,
      packageRef: "hugecode.mcp.search@1.0.0",
      pluginId: "pkg.search.remote",
    },
    ...overrides,
  };
}

describe("runtimeExtensionActivation", () => {
  it("compiles workspace behavior assets into typed live descriptors", () => {
    const compiled = compileRuntimeBehaviorAsset({
      manifest: createWorkspaceSkillManifest(),
      runtimeSkill: createLiveSkillSummary({
        aliases: ["repo-review", "review"],
      }),
      sourceScope: "workspace",
      runtimeVersion: "1.0.0",
      appVersion: "1.0.0",
    });

    expect(compiled.compileState).toBe("compiled");
    expect(compiled.readiness.state).toBe("ready");
    expect(compiled.runtimeBinding).toMatchObject({
      bindingState: "bound",
      liveDescriptorId: "repo.review",
      runtimeSkillId: "repo.review",
    });
    expect(compiled.contributions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "skill",
          id: "repo.review",
          bindingStage: "runtime_binding",
          metadata: expect.objectContaining({
            runtimeSkillId: "repo.review",
            aliases: ["repo-review", "review"],
          }),
        }),
        expect.objectContaining({
          kind: "invocation",
          id: "repo.review:invoke",
          bindingStage: "runtime_binding",
          metadata: expect.objectContaining({
            skillId: "repo.review",
            runtimeSkillId: "repo.review",
            aliases: ["repo-review", "review"],
          }),
        }),
        expect.objectContaining({
          kind: "policy",
          id: "repo.review:policy",
          bindingStage: "compile_time_descriptor",
        }),
      ])
    );
  });

  it("publishes runtime activation truth with active and degraded contributions", async () => {
    const pluginCatalog = {
      listPlugins: vi.fn(async () => [createRuntimePlugin()]),
    };
    const pluginRegistry = {
      listInstalledPackages: vi.fn(async () => [createInstalledPackage()]),
      verifyPackage: vi.fn(),
      installPackage: vi.fn(),
      uninstallPackage: vi.fn(),
      updatePackage: vi.fn(),
    };
    const service = createRuntimeExtensionActivationService({
      workspaceId: "workspace-1",
      pluginCatalog,
      pluginRegistry,
      readWorkspaceSkillManifests: vi.fn(async () => [createWorkspaceSkillManifest()]),
      listRuntimeLiveSkills: vi.fn(async () => [createLiveSkillSummary()]),
      now: () => 100,
      runtimeVersion: "1.0.0",
      appVersion: "1.0.0",
    });

    const snapshot = await service.readSnapshot();

    expect(snapshot.summary).toMatchObject({
      total: 3,
      active: 2,
      degraded: 1,
      failed: 0,
    });
    expect(snapshot.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activationId: "plugin:ext.shell",
          state: "active",
        }),
        expect.objectContaining({
          activationId: "behavior:workspace:repo.review",
          state: "active",
        }),
        expect.objectContaining({
          activationId: "package:hugecode.mcp.search@1.0.0",
          state: "degraded",
          diagnostics: expect.arrayContaining([
            expect.objectContaining({
              phase: "bind",
              code: "binding_unavailable",
            }),
          ]),
        }),
      ])
    );
    expect(snapshot.activeContributions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "behavior:workspace:repo.review",
          kind: "skill",
        }),
        expect.objectContaining({
          sourceId: "plugin:ext.shell",
          kind: "resource",
        }),
      ])
    );
  });

  it("keeps cache-only refresh stable and re-discovers on full refresh", async () => {
    const pluginCatalog = {
      listPlugins: vi
        .fn()
        .mockResolvedValueOnce([
          createRuntimePlugin({
            version: "1.0.0",
          }),
        ])
        .mockResolvedValueOnce([
          createRuntimePlugin({
            version: "2.0.0",
          }),
        ]),
    };
    const pluginRegistry = {
      listInstalledPackages: vi.fn(async () => []),
      verifyPackage: vi.fn(),
      installPackage: vi.fn(),
      uninstallPackage: vi.fn(),
      updatePackage: vi.fn(),
    };
    const service = createRuntimeExtensionActivationService({
      workspaceId: "workspace-1",
      pluginCatalog,
      pluginRegistry,
      readWorkspaceSkillManifests: vi.fn(async () => []),
      listRuntimeLiveSkills: vi.fn(async () => []),
      now: () => 200,
      runtimeVersion: "1.0.0",
      appVersion: "1.0.0",
    });

    const first = await service.refresh({ mode: "full" });
    const cached = await service.refresh({ mode: "cache_only" });
    const refreshed = await service.refresh({ mode: "full" });

    expect(first.records[0]?.version).toBe("1.0.0");
    expect(cached.records[0]?.version).toBe("1.0.0");
    expect(refreshed.records[0]?.version).toBe("2.0.0");
  });

  it("supports bounded session overlays and retrying failed overlay activation", async () => {
    const pluginCatalog = {
      listPlugins: vi.fn(async () => []),
    };
    const pluginRegistry = {
      listInstalledPackages: vi.fn(async () => []),
      verifyPackage: vi.fn(),
      installPackage: vi.fn(),
      uninstallPackage: vi.fn(),
      updatePackage: vi.fn(),
    };
    const service = createRuntimeExtensionActivationService({
      workspaceId: "workspace-1",
      pluginCatalog,
      pluginRegistry,
      readWorkspaceSkillManifests: vi.fn(async () => []),
      listRuntimeLiveSkills: vi.fn(async () => []),
      now: () => 300,
      runtimeVersion: "1.0.0",
      appVersion: "1.0.0",
    });

    await service.upsertSessionOverlay({
      sessionId: "session-1",
      overlayId: "overlay.future",
      asset: {
        id: "overlay.future",
        name: "Overlay Future Skill",
        version: "1.0.0",
        kind: "skill",
        trustLevel: "local",
        entrypoint: "overlay://future",
        permissions: ["workspace:read"],
        compatibility: {
          minRuntime: "999.0.0",
          maxRuntime: null,
          minApp: null,
          maxApp: null,
        },
      },
    });

    let overlaySnapshot = await service.readSnapshot({
      sessionId: "session-1",
    });
    expect(overlaySnapshot.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activationId: "overlay:session-1:overlay.future",
          state: "failed",
        }),
      ])
    );

    await service.upsertSessionOverlay({
      sessionId: "session-1",
      overlayId: "overlay.future",
      asset: {
        id: "overlay.future",
        name: "Overlay Future Skill",
        version: "1.0.1",
        kind: "skill",
        trustLevel: "local",
        entrypoint: "overlay://future",
        permissions: ["workspace:read"],
        compatibility: {
          minRuntime: "1.0.0",
          maxRuntime: null,
          minApp: null,
          maxApp: null,
        },
      },
    });

    overlaySnapshot = await service.retryActivation({
      activationId: "overlay:session-1:overlay.future",
      sessionId: "session-1",
    });
    expect(overlaySnapshot.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activationId: "overlay:session-1:overlay.future",
          state: "active",
        }),
      ])
    );

    await service.deactivate({
      activationId: "overlay:session-1:overlay.future",
      sessionId: "session-1",
    });
    overlaySnapshot = await service.readSnapshot({
      sessionId: "session-1",
    });
    expect(overlaySnapshot.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activationId: "overlay:session-1:overlay.future",
          state: "deactivated",
        }),
      ])
    );

    await service.removeSessionOverlay({
      sessionId: "session-1",
      overlayId: "overlay.future",
    });
    overlaySnapshot = await service.readSnapshot({
      sessionId: "session-1",
    });
    expect(
      overlaySnapshot.records.find(
        (record) => record.activationId === "overlay:session-1:overlay.future"
      )
    ).toMatchObject({
      state: "uninstalled",
    });

    const baseSnapshot = await service.readSnapshot();
    expect(
      baseSnapshot.records.find(
        (record) => record.activationId === "overlay:session-1:overlay.future"
      )
    ).toBeUndefined();
  });
});
