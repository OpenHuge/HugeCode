import { describe, expect, it, vi } from "vitest";
import type { RuntimeExtensionRecord } from "@ku0/code-runtime-host-contract";
import type { RuntimeClient } from "@ku0/code-runtime-client/runtimeClientTypes";
import {
  evaluateRuntimeExtensionPermissionsWithFallback,
  installRuntimeExtensionWithFallback,
  listRuntimeExtensionRegistrySourcesWithFallback,
  listRuntimeExtensionToolsWithFallback,
  listRuntimeExtensionsWithFallback,
  readRuntimeExtensionHealthWithFallback,
  readRuntimeExtensionResourceWithFallback,
  readRuntimeExtensionsConfigWithFallback,
  removeRuntimeExtensionWithFallback,
  searchRuntimeExtensionRegistryWithFallback,
  setRuntimeExtensionStateWithFallback,
  updateRuntimeExtensionWithFallback,
} from "./runtimeClientExtensions";

function createExtensionRecord(
  overrides: Partial<RuntimeExtensionRecord> = {}
): RuntimeExtensionRecord {
  return {
    extensionId: "ext-1",
    version: "1.0.0",
    displayName: "Extension One",
    publisher: "HugeCode",
    summary: "Unified extension record",
    kind: "mcp",
    distribution: "workspace",
    name: "Extension One",
    transport: "mcp-http",
    lifecycleState: "enabled",
    enabled: true,
    workspaceId: "ws-1",
    capabilities: ["tools"],
    permissions: [],
    uiApps: [],
    provenance: { sourceId: "workspace" },
    config: {},
    installedAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

function asRuntimeClient(partial: Partial<RuntimeClient>): RuntimeClient {
  return partial as RuntimeClient;
}

describe("runtimeClientExtensions", () => {
  it("routes extension reads and mutations through v2 methods", async () => {
    const extension = createExtensionRecord();
    const client = asRuntimeClient({
      extensionCatalogListV2: vi.fn(async () => [extension]),
      extensionInstallV2: vi.fn(async () => extension),
      extensionUpdateV2: vi.fn(async () => extension),
      extensionSetStateV2: vi.fn(async () => extension),
      extensionRemoveV2: vi.fn(async () => true),
    });

    await expect(listRuntimeExtensionsWithFallback(client, "ws-1")).resolves.toEqual([extension]);
    await expect(
      installRuntimeExtensionWithFallback(client, {
        workspaceId: "ws-1",
        extensionId: "ext-1",
        name: "Extension One",
        transport: "mcp-http",
      })
    ).resolves.toEqual(extension);
    await expect(
      updateRuntimeExtensionWithFallback(client, {
        workspaceId: "ws-1",
        extensionId: "ext-1",
        displayName: "Extension One Updated",
      })
    ).resolves.toEqual(extension);
    await expect(
      setRuntimeExtensionStateWithFallback(client, {
        workspaceId: "ws-1",
        extensionId: "ext-1",
        enabled: false,
      })
    ).resolves.toEqual(extension);
    await expect(
      removeRuntimeExtensionWithFallback(client, {
        workspaceId: "ws-1",
        extensionId: "ext-1",
      })
    ).resolves.toBe(true);
  });

  it("routes registry, permissions, health, tools, and resources through v2 methods", async () => {
    const extension = createExtensionRecord({
      uiApps: [{ appId: "app-1", title: "App One", route: "/extensions/app-one" }],
    });
    const registrySources = [
      {
        sourceId: "workspace",
        displayName: "Workspace",
        kind: "workspace" as const,
        public: false,
        installSupported: true,
        searchSupported: true,
      },
    ];
    const tool = {
      extensionId: "ext-1",
      toolName: "tool.one",
      description: "Tool One",
      inputSchema: null,
      readOnly: true,
    };
    const resource = {
      extensionId: "ext-1",
      resourceId: "body",
      contentType: "text/plain",
      content: "hello",
      metadata: null,
    };
    const client = asRuntimeClient({
      extensionRegistrySearchV2: vi.fn(async () => ({
        query: "ext",
        results: [extension],
        sources: registrySources,
      })),
      extensionRegistrySourcesV2: vi.fn(async () => registrySources),
      extensionPermissionsEvaluateV2: vi.fn(async () => ({
        extensionId: "ext-1",
        permissions: ["network"],
        decision: "ask",
        warnings: [],
      })),
      extensionHealthReadV2: vi.fn(async () => ({
        extensionId: "ext-1",
        lifecycleState: "enabled",
        healthy: true,
        warnings: [],
        checkedAt: 123,
      })),
      extensionToolsListV2: vi.fn(async () => [tool]),
      extensionResourceReadV2: vi.fn(async () => resource),
    });

    await expect(
      searchRuntimeExtensionRegistryWithFallback(client, {
        workspaceId: "ws-1",
        query: "ext",
      })
    ).resolves.toEqual({
      query: "ext",
      results: [extension],
      sources: registrySources,
    });
    await expect(listRuntimeExtensionRegistrySourcesWithFallback(client, "ws-1")).resolves.toEqual(
      registrySources
    );
    await expect(
      evaluateRuntimeExtensionPermissionsWithFallback(client, {
        workspaceId: "ws-1",
        extensionId: "ext-1",
      })
    ).resolves.toEqual({
      extensionId: "ext-1",
      permissions: ["network"],
      decision: "ask",
      warnings: [],
    });
    await expect(
      readRuntimeExtensionHealthWithFallback(client, {
        workspaceId: "ws-1",
        extensionId: "ext-1",
      })
    ).resolves.toEqual({
      extensionId: "ext-1",
      lifecycleState: "enabled",
      healthy: true,
      warnings: [],
      checkedAt: 123,
    });
    await expect(
      listRuntimeExtensionToolsWithFallback(client, {
        workspaceId: "ws-1",
        extensionId: "ext-1",
      })
    ).resolves.toEqual([tool]);
    await expect(
      readRuntimeExtensionResourceWithFallback(client, {
        workspaceId: "ws-1",
        extensionId: "ext-1",
        resourceId: "body",
      })
    ).resolves.toEqual(resource);
  });

  it("derives extension config from the unified v2 catalog and registry sources", async () => {
    const extension = createExtensionRecord();
    const registrySources = [
      {
        sourceId: "workspace",
        displayName: "Workspace",
        kind: "workspace" as const,
        public: false,
        installSupported: true,
        searchSupported: true,
      },
    ];
    const client = asRuntimeClient({
      extensionCatalogListV2: vi.fn(async () => [extension]),
      extensionRegistrySourcesV2: vi.fn(async () => registrySources),
    });

    await expect(readRuntimeExtensionsConfigWithFallback(client, "ws-1")).resolves.toEqual({
      extensions: [extension],
      warnings: [],
      registrySources,
    });
  });
});
