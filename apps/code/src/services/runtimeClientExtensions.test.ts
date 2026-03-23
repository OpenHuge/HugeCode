import { describe, expect, it, vi } from "vitest";
import type { RuntimeExtensionRecord } from "@ku0/code-runtime-host-contract";
import type { RuntimeClient } from "@ku0/code-runtime-client/runtimeClientTypes";
import {
  evaluateRuntimeExtensionPermissionsWithFallback,
  installRuntimeExtensionWithFallback,
  listRuntimeExtensionRegistrySourcesWithFallback,
  listRuntimeExtensionUiAppsWithFallback,
  readRuntimeExtensionHealthWithFallback,
  removeRuntimeExtensionWithFallback,
  searchRuntimeExtensionRegistryWithFallback,
  setRuntimeExtensionStateWithFallback,
  updateRuntimeExtensionWithFallback,
} from "./runtimeClientExtensions";

const unsupportedError = {
  name: "RuntimeRpcMethodUnsupportedError",
  code: "METHOD_NOT_FOUND",
  message: "method not found",
};

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
  it("falls back from missing v2 mutation methods to legacy install/remove methods", async () => {
    const installed = createExtensionRecord();
    const legacyInstall = vi.fn(async () => installed);
    const legacyRemove = vi.fn(async () => true);
    const client = asRuntimeClient({
      extensionInstallV1: legacyInstall,
      extensionRemoveV1: legacyRemove,
    });

    await expect(
      installRuntimeExtensionWithFallback(client, {
        workspaceId: "ws-1",
        extensionId: "ext-1",
        name: "Extension One",
        transport: "mcp-http",
      })
    ).resolves.toEqual(installed);
    await expect(
      removeRuntimeExtensionWithFallback(client, {
        workspaceId: "ws-1",
        extensionId: "ext-1",
      })
    ).resolves.toBe(true);

    expect(legacyInstall).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      extensionId: "ext-1",
      name: "Extension One",
      transport: "mcp-http",
    });
    expect(legacyRemove).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      extensionId: "ext-1",
    });
  });

  it("maps update and state changes through legacy install when v2 methods are unsupported", async () => {
    const legacyInstall = vi.fn(async (request: Record<string, unknown>) =>
      createExtensionRecord({
        displayName: String(request.displayName ?? "Extension One"),
        enabled: Boolean(request.enabled),
      })
    );
    const client = asRuntimeClient({
      extensionUpdateV2: vi.fn(async () => {
        throw unsupportedError;
      }),
      extensionSetStateV2: vi.fn(async () => {
        throw unsupportedError;
      }),
      extensionGetV2: vi.fn(async () => {
        throw unsupportedError;
      }),
      extensionsListV1: vi.fn(async () => [createExtensionRecord()]),
      extensionInstallV1: legacyInstall,
    });

    await expect(
      updateRuntimeExtensionWithFallback(client, {
        workspaceId: "ws-1",
        extensionId: "ext-1",
        displayName: "Extension One Updated",
        enabled: false,
        transport: "repo-manifest",
        config: { profile: "strict" },
      })
    ).resolves.toMatchObject({
      displayName: "Extension One Updated",
      enabled: false,
    });
    await expect(
      setRuntimeExtensionStateWithFallback(client, {
        workspaceId: "ws-1",
        extensionId: "ext-1",
        enabled: false,
      })
    ).resolves.toMatchObject({
      enabled: false,
    });

    expect(legacyInstall).toHaveBeenNthCalledWith(1, {
      workspaceId: "ws-1",
      extensionId: "ext-1",
      displayName: "Extension One Updated",
      name: "Extension One Updated",
      transport: "repo-manifest",
      enabled: false,
      config: { profile: "strict" },
    });
    expect(legacyInstall).toHaveBeenNthCalledWith(2, {
      workspaceId: "ws-1",
      extensionId: "ext-1",
      displayName: "Extension One",
      name: "Extension One",
      transport: "mcp-http",
      enabled: false,
      config: {},
    });
  });

  it("derives registry search and registry sources from the legacy catalog", async () => {
    const extension = createExtensionRecord({
      extensionId: "ext-public",
      displayName: "Public Search",
      summary: "Public registry extension",
      distribution: "public-registry",
      provenance: { registrySourceId: "public-registry" },
    });
    const client = asRuntimeClient({
      extensionRegistrySearchV2: vi.fn(async () => {
        throw unsupportedError;
      }),
      extensionCatalogListV2: vi.fn(async () => {
        throw unsupportedError;
      }),
      extensionRegistrySourcesV2: vi.fn(async () => {
        throw unsupportedError;
      }),
      extensionsListV1: vi.fn(async () => [extension]),
      extensionsConfigV1: vi.fn(async () => ({
        extensions: [extension],
        warnings: [],
      })),
    });

    await expect(
      searchRuntimeExtensionRegistryWithFallback(client, {
        workspaceId: "ws-1",
        query: "public",
        sourceIds: ["public-registry"],
      })
    ).resolves.toEqual(
      expect.objectContaining({
        query: "public",
        results: expect.arrayContaining([expect.objectContaining({ extensionId: "ext-public" })]),
        sources: expect.arrayContaining([
          expect.objectContaining({ sourceId: "workspace" }),
          expect.objectContaining({ sourceId: "public-registry" }),
        ]),
      })
    );
    await expect(listRuntimeExtensionRegistrySourcesWithFallback(client, "ws-1")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceId: "workspace" }),
        expect.objectContaining({ sourceId: "public-registry" }),
      ])
    );
  });

  it("derives permissions, health, and ui apps from local extension metadata when v2 reads are unsupported", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T12:00:00Z"));
    const extension = createExtensionRecord({
      lifecycleState: "degraded",
      enabled: false,
      permissions: ["network"],
      uiApps: [{ appId: "app-1", title: "App One", route: "/extensions/app-one" }],
    });
    const client = asRuntimeClient({
      extensionPermissionsEvaluateV2: vi.fn(async () => {
        throw unsupportedError;
      }),
      extensionHealthReadV2: vi.fn(async () => {
        throw unsupportedError;
      }),
      extensionUiAppsListV2: vi.fn(async () => {
        throw unsupportedError;
      }),
      extensionGetV2: vi.fn(async () => {
        throw unsupportedError;
      }),
      extensionCatalogListV2: vi.fn(async () => {
        throw unsupportedError;
      }),
      extensionsListV1: vi.fn(async () => [extension]),
    });

    await expect(
      evaluateRuntimeExtensionPermissionsWithFallback(client, {
        workspaceId: "ws-1",
        extensionId: "ext-1",
      })
    ).resolves.toEqual({
      extensionId: "ext-1",
      permissions: ["network"],
      decision: "ask",
      warnings: ["Permissions decision was derived from local extension metadata."],
    });
    await expect(
      readRuntimeExtensionHealthWithFallback(client, {
        workspaceId: "ws-1",
        extensionId: "ext-1",
      })
    ).resolves.toMatchObject({
      extensionId: "ext-1",
      lifecycleState: "degraded",
      healthy: false,
      checkedAt: new Date("2026-03-23T12:00:00Z").getTime(),
      warnings: expect.arrayContaining([
        "Health state was derived from local extension lifecycle metadata.",
        "Extension is currently disabled.",
        "Extension lifecycle is degraded.",
      ]),
    });
    await expect(
      listRuntimeExtensionUiAppsWithFallback(client, {
        workspaceId: "ws-1",
        extensionId: "ext-1",
      })
    ).resolves.toEqual({
      workspaceId: "ws-1",
      extensionId: "ext-1",
      apps: [{ appId: "app-1", title: "App One", route: "/extensions/app-one" }],
    });
    vi.useRealTimers();
  });

  it("returns neutral fallbacks when neither v2 nor legacy mutation methods exist", async () => {
    const client = asRuntimeClient({
      extensionInstallV1: vi.fn(async () => {
        throw unsupportedError;
      }),
      extensionRemoveV1: vi.fn(async () => {
        throw unsupportedError;
      }),
    });

    await expect(
      installRuntimeExtensionWithFallback(client, {
        workspaceId: "ws-1",
        extensionId: "ext-1",
        name: "Extension One",
        transport: "mcp-http",
      })
    ).resolves.toBeNull();
    await expect(
      removeRuntimeExtensionWithFallback(client, {
        workspaceId: "ws-1",
        extensionId: "ext-1",
      })
    ).resolves.toBe(false);
  });
});
