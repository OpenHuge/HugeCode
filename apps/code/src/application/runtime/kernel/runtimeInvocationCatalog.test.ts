import { describe, expect, it, vi } from "vitest";
import type {
  KernelCapabilityDescriptor,
  KernelExtensionBundle,
  PromptLibraryEntry,
  RuntimeExtensionToolSummary,
} from "@ku0/code-runtime-host-contract";

import { createRuntimeInvocationCatalogFacade } from "./runtimeInvocationCatalog";
import type { RuntimeKernelPluginDescriptor } from "./runtimeKernelPluginTypes";

function createPluginDescriptor(
  overrides: Partial<RuntimeKernelPluginDescriptor>
): RuntimeKernelPluginDescriptor {
  return {
    id: "review-agent",
    name: "Review Agent",
    version: "1.0.0",
    summary: "Structured review skill",
    source: "live_skill",
    transport: "live_skill",
    hostProfile: {
      kind: "runtime",
      executionBoundaries: ["runtime"],
    },
    workspaceId: null,
    enabled: true,
    runtimeBacked: true,
    capabilities: [{ id: "review", enabled: true }],
    permissions: [],
    resources: [],
    executionBoundaries: ["runtime"],
    binding: {
      state: "bound",
      contractFormat: "live_skill",
      contractBoundary: "runtime-live-skill",
      interfaceId: "review-agent",
      surfaces: [],
    },
    operations: {
      execution: {
        executable: true,
        mode: "live_skill",
        reason: null,
      },
      resources: {
        readable: false,
        mode: "none",
        reason: "No resources.",
      },
      permissions: {
        evaluable: true,
        mode: "live_skill_permissions",
        reason: null,
      },
    },
    metadata: {
      kind: "research_orchestration",
    },
    permissionDecision: "allow",
    health: {
      state: "healthy",
      checkedAt: null,
      warnings: [],
    },
    ...overrides,
  };
}

function createExtensionBundle(
  overrides: Partial<KernelExtensionBundle> = {}
): KernelExtensionBundle {
  return {
    id: "ext.review",
    name: "Projection Review Extension",
    enabled: true,
    transport: "mcp-stdio",
    workspaceId: "ws-1",
    toolCount: 1,
    resourceCount: 1,
    surfaces: ["tools"],
    installedAt: 10,
    updatedAt: 20,
    metadata: {
      version: "2.0.0",
      summary: "Projection-backed extension bundle",
    },
    ...overrides,
  };
}

function createRuntimeExtensionToolSummary(
  overrides: Partial<RuntimeExtensionToolSummary> = {}
): RuntimeExtensionToolSummary {
  return {
    extensionId: "ext.review",
    toolName: "ext.review.search",
    description: "Search review artifacts exposed by the extension runtime.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
    readOnly: true,
    ...overrides,
  };
}

function createPromptLibraryEntry(overrides: Partial<PromptLibraryEntry> = {}): PromptLibraryEntry {
  return {
    id: "prompt.summarize",
    title: "summarize",
    description: "Summarize a target",
    content: "Summarize $TARGET",
    scope: "workspace",
    ...overrides,
  };
}

describe("runtimeInvocationCatalog", () => {
  it("publishes a minimal active catalog with stable ids and source summaries", async () => {
    const pluginCatalog = {
      listPlugins: vi.fn(async () => [
        createPluginDescriptor(),
        createPluginDescriptor({
          id: "repo.skill",
          name: "Repository Skill Manifest",
          source: "repo_manifest",
          transport: "repo_manifest",
          runtimeBacked: false,
          operations: {
            execution: {
              executable: false,
              mode: "none",
              reason: "Manifest only.",
            },
            resources: {
              readable: true,
              mode: "repo_manifest_resource",
              reason: null,
            },
            permissions: {
              evaluable: true,
              mode: "repo_manifest_permissions",
              reason: null,
            },
          },
          binding: {
            state: "declaration_only",
            contractFormat: "manifest",
            contractBoundary: "repository-manifest",
            interfaceId: "repo.skill",
            surfaces: [],
          },
          health: {
            state: "unsupported",
            checkedAt: null,
            warnings: [],
          },
        }),
      ]),
    };

    const facade = createRuntimeInvocationCatalogFacade({
      workspaceId: "ws-1",
      pluginCatalog,
    });

    const catalog = await facade.readActiveCatalog();

    expect(pluginCatalog.listPlugins).toHaveBeenCalledTimes(1);
    expect(catalog.catalogId).toBe("workspace:ws-1");
    expect(catalog.items.map((entry) => entry.id)).toEqual([
      "plugin:repo.skill",
      "plugin:review-agent",
      "session:respond-to-approval",
      "session:send-message",
      "tool:run-runtime-live-skill",
      "tool:start-runtime-run",
    ]);
    expect(catalog.sources).toEqual([
      { kind: "runtime_tool", count: 2 },
      { kind: "plugin", count: 2 },
      { kind: "session_command", count: 2 },
    ]);

    const runtimeTool = catalog.items.find((entry) => entry.id === "tool:start-runtime-run");
    expect(runtimeTool).toMatchObject({
      title: "Start Runtime Run",
      kind: "runtime_tool",
      source: {
        kind: "runtime_tool",
        contributionType: "built_in",
      },
      runtimeTool: {
        toolName: "start-runtime-run",
        scope: "runtime",
      },
      readiness: {
        state: "ready",
        available: true,
      },
    });

    const repoManifest = catalog.items.find((entry) => entry.id === "plugin:repo.skill");
    expect(repoManifest).toMatchObject({
      kind: "plugin",
      source: {
        kind: "workspace_skill_manifest",
        contributionType: "skill_derived",
      },
      readiness: {
        state: "unsupported",
        available: false,
      },
    });
  });

  it("supports search, resolve, and audience publication without exposing session commands to models", async () => {
    const facade = createRuntimeInvocationCatalogFacade({
      workspaceId: "ws-1",
      pluginCatalog: {
        listPlugins: vi.fn(async () => [
          createPluginDescriptor({
            id: "review-agent",
            name: "Review Agent",
            summary: "Run the review agent skill",
          }),
        ]),
      },
    });

    await expect(facade.searchActiveCatalog("review")).resolves.toEqual([
      expect.objectContaining({
        id: "plugin:review-agent",
      }),
    ]);
    await expect(facade.getInvocationDescriptor("session:send-message")).resolves.toMatchObject({
      id: "session:send-message",
      exposure: {
        operatorVisible: true,
        modelVisible: false,
      },
    });
    await expect(
      facade.getInvocationDescriptor("session:send-message", { audience: "model" })
    ).resolves.toBeNull();
    await expect(facade.searchActiveCatalog("send", { audience: "model" })).resolves.toEqual([]);
    await expect(facade.resolveInvocationDescriptor("session:send-message")).resolves.toMatchObject(
      {
        id: "session:send-message",
      }
    );

    const modelCatalog = await facade.publishActiveCatalog({
      audience: "model",
    });

    expect(modelCatalog.items.map((entry) => entry.id)).toEqual([
      "plugin:review-agent",
      "tool:run-runtime-live-skill",
      "tool:start-runtime-run",
    ]);
  });

  it("prefers projection-backed runtime extensions over fallback plugin rows and publishes extension tools through runtime tool descriptors", async () => {
    const pluginCatalog = {
      listPlugins: vi.fn(async () => [
        createPluginDescriptor({
          id: "ext.review",
          name: "Catalog Review Extension",
          summary: "Fallback plugin catalog entry",
          source: "runtime_extension",
          transport: "runtime_extension",
          enabled: false,
          operations: {
            execution: {
              executable: false,
              mode: "none",
              reason: "Fallback runtime extension row.",
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
          binding: {
            state: "bound",
            contractFormat: "runtime_extension",
            contractBoundary: "runtime-extension-record",
            interfaceId: "ext.review",
            surfaces: [],
          },
          metadata: {
            version: "1.0.0",
            summary: "Fallback plugin catalog entry",
          },
        }),
      ]),
    };
    const readProjection = vi.fn(async () => ({
      projectionBacked: true,
      extensionBundles: [
        createExtensionBundle({
          id: "ext.review",
          name: "Projection Review Extension",
          metadata: {
            version: "2.0.0",
            summary: "Projection-backed extension bundle",
          },
        }),
      ],
      capabilities: null as KernelCapabilityDescriptor[] | null,
    }));
    const listRuntimeExtensionTools = vi.fn(async () => [
      createRuntimeExtensionToolSummary({
        extensionId: "ext.review",
        toolName: "ext.review.search",
      }),
    ]);

    const facade = createRuntimeInvocationCatalogFacade({
      workspaceId: "ws-1",
      pluginCatalog,
      readProjection,
      listRuntimeExtensionTools,
    });

    const catalog = await facade.readActiveCatalog();

    expect(readProjection).toHaveBeenCalledTimes(1);
    expect(listRuntimeExtensionTools).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      extensionId: "ext.review",
    });
    expect(catalog.items.map((entry) => entry.id)).toContain("plugin:ext.review");
    expect(catalog.items.map((entry) => entry.id)).toContain("tool:ext.review.search");

    expect(catalog.items.find((entry) => entry.id === "plugin:ext.review")).toMatchObject({
      title: "Projection Review Extension",
      source: {
        kind: "runtime_extension",
        contributionType: "extension_contributed",
      },
      readiness: {
        state: "blocked",
        available: false,
      },
      metadata: {
        kernelExtensionBundle: {
          toolCount: 1,
        },
        invocationPlane: {
          winningSource: "projection_extension_bundle",
        },
      },
    });

    expect(catalog.items.find((entry) => entry.id === "tool:ext.review.search")).toMatchObject({
      kind: "runtime_tool",
      source: {
        kind: "runtime_extension",
        contributionType: "extension_contributed",
      },
      runtimeTool: {
        toolName: "ext.review.search",
        scope: "runtime",
      },
      argumentSchema: {
        type: "object",
      },
      safety: {
        level: "read",
        readOnly: true,
      },
    });

    const modelCatalog = await facade.publishActiveCatalog({ audience: "model" });

    expect(modelCatalog.items.map((entry) => entry.id)).toContain("tool:ext.review.search");
    expect(modelCatalog.items.map((entry) => entry.id)).not.toContain("plugin:ext.review");
  });

  it("resolves invocation id collisions deterministically and records shadowed sources on the winner", async () => {
    const facade = createRuntimeInvocationCatalogFacade({
      workspaceId: "ws-1",
      pluginCatalog: {
        listPlugins: vi.fn(async () => [
          createPluginDescriptor({
            id: "ext.review",
            source: "runtime_extension",
            transport: "runtime_extension",
            operations: {
              execution: {
                executable: false,
                mode: "none",
                reason: "Runtime extension row.",
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
          }),
        ]),
      },
      listRuntimeExtensionTools: vi.fn(async () => [
        createRuntimeExtensionToolSummary({
          extensionId: "ext.review",
          toolName: "start-runtime-run",
          description: "Conflicting extension tool name.",
          readOnly: false,
        }),
      ]),
    });

    const catalog = await facade.readActiveCatalog();
    const collisions = catalog.items.filter((entry) => entry.id === "tool:start-runtime-run");

    expect(collisions).toHaveLength(1);
    expect(collisions[0]).toMatchObject({
      title: "Start Runtime Run",
      source: {
        kind: "runtime_tool",
      },
      metadata: {
        invocationPlane: {
          winningSource: "built_in_runtime_tool",
          shadowed: [
            {
              sourceKind: "runtime_extension",
              sourceId: "ext.review",
            },
          ],
        },
      },
    });
  });

  it("keeps catalog revisions stable for unchanged snapshots and increments them after source changes", async () => {
    const plugins: RuntimeKernelPluginDescriptor[] = [createPluginDescriptor()];
    const facade = createRuntimeInvocationCatalogFacade({
      workspaceId: "ws-1",
      pluginCatalog: {
        listPlugins: vi.fn(async () => plugins),
      },
    });

    const firstCatalog = await facade.readActiveCatalog();
    const secondCatalog = await facade.readActiveCatalog();

    expect(secondCatalog.revision).toBe(firstCatalog.revision);
    expect(secondCatalog.generatedAt).toBe(firstCatalog.generatedAt);

    plugins.push(
      createPluginDescriptor({
        id: "rewrite-agent",
        name: "Rewrite Agent",
      })
    );

    const thirdCatalog = await facade.readActiveCatalog();

    expect(thirdCatalog.revision).toBe(firstCatalog.revision + 1);
    expect(thirdCatalog.generatedAt).toBeGreaterThanOrEqual(firstCatalog.generatedAt);
    expect(thirdCatalog.items.map((entry) => entry.id)).toContain("plugin:rewrite-agent");
  });

  it("degrades to fallback publication when projection or extension tool reads fail", async () => {
    const facade = createRuntimeInvocationCatalogFacade({
      workspaceId: "ws-1",
      pluginCatalog: {
        listPlugins: vi.fn(async () => [
          createPluginDescriptor({
            id: "ext.review",
            name: "Fallback Review Extension",
            source: "runtime_extension",
            transport: "runtime_extension",
            operations: {
              execution: {
                executable: false,
                mode: "none",
                reason: "Fallback runtime extension row.",
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
          }),
        ]),
      },
      readProjection: vi.fn(async () => {
        throw new Error("projection unavailable");
      }),
      listRuntimeExtensionTools: vi.fn(async () => {
        throw new Error("tool listing unavailable");
      }),
    });

    const catalog = await facade.readActiveCatalog();

    expect(catalog.items.map((entry) => entry.id)).toContain("plugin:ext.review");
    expect(catalog.items.map((entry) => entry.id)).not.toContain("tool:ext.review.search");
  });

  it("publishes runtime prompt-library overlays through invocation descriptors with slash metadata", async () => {
    const facade = createRuntimeInvocationCatalogFacade({
      workspaceId: "ws-1",
      pluginCatalog: {
        listPlugins: vi.fn(async () => []),
      },
      listRuntimePrompts: vi.fn(async () => [
        createPromptLibraryEntry({
          id: "prompt.summarize",
          title: "summarize",
          description: "Summarize a target",
          content: "Summarize $TARGET",
          scope: "workspace",
        }),
        createPromptLibraryEntry({
          id: "prompt.review",
          title: "review",
          description: "Custom review prompt",
          content: "Review $TARGET",
          scope: "workspace",
        }),
      ]),
    });

    const catalog = await facade.readActiveCatalog();

    expect(
      catalog.items.find((entry) => entry.id === "session:prompt:prompt.summarize")
    ).toMatchObject({
      kind: "session_command",
      source: {
        kind: "session_command",
        contributionType: "session_scoped",
      },
      exposure: {
        operatorVisible: true,
        modelVisible: false,
      },
      metadata: {
        invocationPlane: {
          winningSource: "runtime_prompt_overlay",
        },
        slashCommand: {
          primaryTrigger: "/summarize",
          insertText: 'summarize TARGET=""',
          hint: "TARGET=",
          shadowedByBuiltin: false,
        },
      },
    });

    expect(
      catalog.items.find((entry) => entry.id === "session:prompt:prompt.review")
    ).toMatchObject({
      metadata: {
        slashCommand: {
          primaryTrigger: "/review",
          insertText: 'prompts:review TARGET=""',
          shadowedByBuiltin: true,
          legacyAliases: ["/prompts:review"],
        },
      },
    });
  });
});
