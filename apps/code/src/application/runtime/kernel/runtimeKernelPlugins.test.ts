import { describe, expect, it } from "vitest";
import type { LiveSkillSummary, RuntimeExtensionRecord } from "@ku0/code-runtime-host-contract";

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
    tags: ["review"],
    ...overrides,
  };
}

describe("runtimeKernelPlugins", () => {
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
    ).rejects.toThrow("currently unbound in apps/code");

    await expect(
      facade.executePlugin("host:rpc", {
        skillId: "host:rpc",
        input: "",
      })
    ).rejects.toThrow("currently unbound in apps/code");
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
});
