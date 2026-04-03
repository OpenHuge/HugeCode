import { describe, expect, it, vi } from "vitest";
import type {
  RuntimeCompositionSnapshotPublishResponse,
  RuntimeCompositionProfile,
  RuntimeCompositionResolveV2Response,
} from "@ku0/code-runtime-host-contract";
import {
  createRuntimeKernelCompositionFacade,
  type RuntimeKernelCompositionAuthorityFacade,
} from "./runtimeKernelComposition";
import { createRuntimeKernelPluginRegistryFacade } from "./runtimeKernelPluginRegistry";
import type { RuntimeKernelPluginDescriptor } from "./runtimeKernelPlugins";

function createRuntimePluginCatalog() {
  const plugins: RuntimeKernelPluginDescriptor[] = [
    {
      id: "route.openai",
      name: "OpenAI Route",
      version: "1.0.0",
      summary: null,
      source: "provider_route",
      transport: "provider_route",
      hostProfile: {
        kind: "routing",
        executionBoundaries: ["runtime"],
      },
      workspaceId: "workspace-1",
      enabled: true,
      runtimeBacked: true,
      capabilities: [],
      permissions: [],
      resources: [],
      executionBoundaries: ["runtime"],
      binding: {
        state: "bound",
        contractFormat: "route",
        contractBoundary: "provider-routing",
        interfaceId: "route.openai",
        surfaces: [
          {
            id: "route.openai",
            kind: "route",
            direction: "export",
            summary: "OpenAI provider route.",
          },
        ],
      },
      operations: {
        execution: {
          executable: true,
          mode: "provider_route",
          reason: null,
        },
        resources: {
          readable: false,
          mode: "none",
          reason: "n/a",
        },
        permissions: {
          evaluable: false,
          mode: "none",
          reason: "n/a",
        },
      },
      metadata: {
        routeKind: "provider_family",
        routeValue: "openai",
        readiness: "ready",
        launchAllowed: true,
        providerId: "openai",
        preferredBackendIds: ["backend-openai", "backend-fallback"],
      },
      permissionDecision: null,
      health: {
        state: "healthy",
        checkedAt: 1,
        warnings: [],
      },
    },
    {
      id: "ext.runtime",
      name: "Runtime Extension",
      version: "1.0.0",
      summary: null,
      source: "runtime_extension",
      transport: "runtime_extension",
      hostProfile: {
        kind: "runtime",
        executionBoundaries: ["runtime"],
      },
      workspaceId: "workspace-1",
      enabled: true,
      runtimeBacked: true,
      capabilities: [],
      permissions: ["network"],
      resources: [],
      executionBoundaries: ["runtime"],
      binding: {
        state: "bound",
        contractFormat: "runtime_extension",
        contractBoundary: "runtime-extension-record",
        interfaceId: "ext.runtime",
        surfaces: [
          {
            id: "ext.runtime",
            kind: "extension",
            direction: "export",
            summary: "Runtime extension.",
          },
        ],
      },
      operations: {
        execution: {
          executable: false,
          mode: "none",
          reason: "n/a",
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
    },
  ];
  return {
    listPlugins: vi.fn(async () => plugins),
  };
}

function createUnavailableCompositionSnapshot(): RuntimeCompositionResolveV2Response {
  return {
    activeProfile: null,
    authorityState: "unavailable",
    authorityRevision: null,
    publishedAt: null,
    publisherSessionId: null,
    provenance: {
      activeProfileId: null,
      appliedLayerOrder: [],
      selectorDecisions: {},
    },
    pluginEntries: [],
    selectedRouteCandidates: [],
    selectedBackendCandidates: [],
    blockedPlugins: [],
    trustDecisions: [],
  };
}

function createRuntimeCompositionAuthority(): RuntimeKernelCompositionAuthorityFacade {
  let published: {
    workspaceId: string;
    profiles: RuntimeCompositionProfile[];
    snapshot: RuntimeCompositionResolveV2Response;
  } | null = null;

  return {
    listProfilesV2: vi.fn(async ({ workspaceId }) => {
      if (!published || published.workspaceId !== workspaceId) {
        return [];
      }
      const activeProfileId = published.snapshot.provenance.activeProfileId;
      return published.profiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
        scope: profile.scope,
        enabled: profile.enabled,
        active: profile.id === activeProfileId,
      }));
    }),
    getProfileV2: vi.fn(async ({ workspaceId, profileId }) => {
      if (!published || published.workspaceId !== workspaceId) {
        return null;
      }
      return published.profiles.find((profile) => profile.id === profileId) ?? null;
    }),
    resolveV2: vi.fn(async ({ workspaceId }) => {
      if (!published || published.workspaceId !== workspaceId) {
        return createUnavailableCompositionSnapshot();
      }
      return published.snapshot;
    }),
    publishSnapshotV1: vi.fn(
      async (request): Promise<RuntimeCompositionSnapshotPublishResponse> => {
        const publishedAt = request.publishedAt ?? 1;
        published = {
          workspaceId: request.workspaceId,
          profiles: request.profiles.map((profile: RuntimeCompositionProfile) =>
            structuredClone(profile)
          ),
          snapshot: {
            ...request.snapshot,
            authorityState: "published",
            authorityRevision: request.authorityRevision,
            publishedAt,
            publisherSessionId: request.publisherSessionId ?? null,
          },
        };
        return {
          authorityState: "published",
          authorityRevision: request.authorityRevision,
          publishedAt,
          publisherSessionId: request.publisherSessionId ?? null,
        };
      }
    ),
  };
}

describe("runtimeKernelComposition", () => {
  it("applies profile layers deterministically", async () => {
    const pluginCatalog = createRuntimePluginCatalog();
    const pluginRegistry = createRuntimeKernelPluginRegistryFacade({
      workspaceId: "workspace-1",
      pluginCatalog,
    });
    await pluginRegistry.installPackage({ packageRef: "hugecode.mcp.search@1.0.0" });
    const composition = createRuntimeKernelCompositionFacade({
      workspaceId: "workspace-1",
      pluginCatalog,
      pluginRegistry,
      authority: createRuntimeCompositionAuthority(),
    });

    const resolution = await composition.getActiveResolution();

    expect(resolution.provenance.activeProfileId).toBe("workspace-default");
    expect(resolution.provenance.appliedLayerOrder).toEqual([
      "built_in",
      "user",
      "workspace",
      "launch_override",
    ]);
    expect(resolution.selectedBackendCandidates.map((entry) => entry.backendId)).toEqual(
      expect.arrayContaining(["backend-primary", "backend-fallback", "backend-openai"])
    );
  });

  it("publishes a composition snapshot with canonical binding and publication truth", async () => {
    const pluginCatalog = createRuntimePluginCatalog();
    const pluginRegistry = createRuntimeKernelPluginRegistryFacade({
      workspaceId: "workspace-1",
      pluginCatalog,
    });
    await pluginRegistry.installPackage({ packageRef: "hugecode.mcp.search@1.0.0" });
    const composition = createRuntimeKernelCompositionFacade({
      workspaceId: "workspace-1",
      pluginCatalog,
      pluginRegistry,
      authority: createRuntimeCompositionAuthority(),
    });

    const snapshot = await composition.getActiveResolutionV2();
    const runtimeExtension = snapshot.pluginEntries.find(
      (entry) => entry.pluginId === "ext.runtime"
    );
    const installedRemote = snapshot.pluginEntries.find(
      (entry) => entry.pluginId === "pkg.search.remote"
    );

    expect(snapshot.activeProfile?.id).toBe("workspace-default");
    expect(snapshot.authorityState).toBe("published");
    expect(snapshot.authorityRevision).toBe(1);
    expect(snapshot.provenance.appliedLayerOrder).toEqual([
      "built_in",
      "user",
      "workspace",
      "launch_override",
    ]);
    expect(runtimeExtension).toMatchObject({
      bindingState: "bound",
      publicationState: "hidden",
      selectedInActiveProfile: true,
      routeCandidate: false,
    });
    expect(installedRemote).toMatchObject({
      installed: true,
      bindingState: "unbound",
      publicationState: "declaration_only",
      selectedInActiveProfile: true,
      blockedReason: null,
    });
  });

  it("uses first-match selector resolution and does not mutate stored profiles during preview", async () => {
    const pluginCatalog = createRuntimePluginCatalog();
    const pluginRegistry = createRuntimeKernelPluginRegistryFacade({
      workspaceId: "workspace-1",
      pluginCatalog,
    });
    const composition = createRuntimeKernelCompositionFacade({
      workspaceId: "workspace-1",
      pluginCatalog,
      pluginRegistry,
      authority: createRuntimeCompositionAuthority(),
    });

    const preview = await composition.previewResolution({
      launchOverride: {
        pluginSelectors: [
          {
            matchBy: "source",
            matchValue: "runtime_extension",
            action: "exclude",
            reason: "Launch override excludes runtime extensions.",
          },
          {
            matchBy: "pluginId",
            matchValue: "ext.runtime",
            action: "include",
            reason: "This should be ignored because first match wins.",
          },
        ],
      },
    });

    expect(preview.blockedPlugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pluginId: "ext.runtime",
          stage: "selector",
        }),
      ])
    );
    const storedProfile = await composition.getProfile("workspace-default");
    expect(storedProfile?.pluginSelectors).toEqual([]);
  });

  it("keeps declaration-only publication distinct from binding state", async () => {
    const pluginCatalog = {
      listPlugins: vi.fn(
        async () =>
          [
            {
              id: "repo.skill",
              name: "Repo Skill",
              version: "1.0.0",
              summary: null,
              source: "repo_manifest",
              transport: "repo_manifest",
              hostProfile: {
                kind: "repository",
                executionBoundaries: ["workspace"],
              },
              workspaceId: "workspace-1",
              enabled: true,
              runtimeBacked: false,
              capabilities: [],
              permissions: [],
              resources: [],
              executionBoundaries: ["workspace"],
              binding: {
                state: "declaration_only",
                contractFormat: "manifest",
                contractBoundary: "repo-manifest",
                interfaceId: "repo.skill",
                surfaces: [],
              },
              operations: {
                execution: {
                  executable: false,
                  mode: "none",
                  reason: "Declaration-only manifest.",
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
              metadata: null,
              permissionDecision: null,
              health: null,
            },
          ] satisfies RuntimeKernelPluginDescriptor[]
      ),
    };
    const pluginRegistry = createRuntimeKernelPluginRegistryFacade({
      workspaceId: "workspace-1",
      pluginCatalog,
    });
    const composition = createRuntimeKernelCompositionFacade({
      workspaceId: "workspace-1",
      pluginCatalog,
      pluginRegistry,
      authority: createRuntimeCompositionAuthority(),
    });

    const snapshot = await composition.getActiveResolutionV2();

    expect(snapshot.pluginEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pluginId: "repo.skill",
          bindingState: "unbound",
          publicationState: "declaration_only",
        }),
      ])
    );
  });

  it("can exclude verified packages through trust policy", async () => {
    const pluginCatalog = createRuntimePluginCatalog();
    const pluginRegistry = createRuntimeKernelPluginRegistryFacade({
      workspaceId: "workspace-1",
      pluginCatalog,
    });
    await pluginRegistry.installPackage({ packageRef: "hugecode.mcp.search@1.0.0" });
    const composition = createRuntimeKernelCompositionFacade({
      workspaceId: "workspace-1",
      pluginCatalog,
      pluginRegistry,
      authority: createRuntimeCompositionAuthority(),
    });

    const resolution = await composition.applyProfile({
      profileId: "workspace-default",
      updates: {
        trustPolicy: {
          requireVerifiedSignatures: true,
          allowDevOverrides: false,
          blockedPublishers: ["HugeCode Labs"],
        },
      },
    });

    expect(resolution.blockedPlugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pluginId: "pkg.search.remote",
          stage: "trust",
        }),
      ])
    );
  });

  it("marks trust-blocked packages as blocked in the v2 snapshot while preserving active profile provenance", async () => {
    const pluginCatalog = createRuntimePluginCatalog();
    const pluginRegistry = createRuntimeKernelPluginRegistryFacade({
      workspaceId: "workspace-1",
      pluginCatalog,
    });
    await pluginRegistry.installPackage({ packageRef: "hugecode.mcp.search@1.0.0" });
    const composition = createRuntimeKernelCompositionFacade({
      workspaceId: "workspace-1",
      pluginCatalog,
      pluginRegistry,
      authority: createRuntimeCompositionAuthority(),
    });

    await composition.applyProfile({
      profileId: "workspace-default",
      updates: {
        trustPolicy: {
          requireVerifiedSignatures: true,
          allowDevOverrides: false,
          blockedPublishers: ["HugeCode Labs"],
        },
      },
    });
    const snapshot = await composition.getActiveResolutionV2();

    expect(snapshot.provenance.activeProfileId).toBe("workspace-default");
    expect(snapshot.pluginEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pluginId: "pkg.search.remote",
          bindingState: "blocked",
          publicationState: "blocked",
          blockedReason: "Publisher HugeCode Labs is blocked by trust policy.",
        }),
      ])
    );
  });

  it("keeps preview resolution local-only until a publish-backed active read occurs", async () => {
    const pluginCatalog = createRuntimePluginCatalog();
    const pluginRegistry = createRuntimeKernelPluginRegistryFacade({
      workspaceId: "workspace-1",
      pluginCatalog,
    });
    const authority = createRuntimeCompositionAuthority();
    const composition = createRuntimeKernelCompositionFacade({
      workspaceId: "workspace-1",
      pluginCatalog,
      pluginRegistry,
      authority,
    });

    const preview = await composition.previewResolutionV2({
      profileId: "workspace-default",
    });

    expect(preview.authorityState).toBe("unavailable");
    expect(authority.publishSnapshotV1).not.toHaveBeenCalled();

    const snapshot = await composition.getActiveResolutionV2();

    expect(authority.publishSnapshotV1).toHaveBeenCalledTimes(1);
    expect(snapshot.authorityState).toBe("published");
    expect(snapshot.authorityRevision).toBe(1);
  });
});
