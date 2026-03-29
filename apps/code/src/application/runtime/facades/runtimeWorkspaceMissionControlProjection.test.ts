import { describe, expect, it } from "vitest";
import type {
  AgentTaskSummary,
  RuntimePolicySnapshot,
  RuntimeProviderCatalogEntry,
} from "@ku0/code-runtime-host-contract";
import { createRuntimeProviderRoutePluginDescriptors } from "../kernel/runtimeKernelPlugins";
import { buildWorkspaceRuntimeMissionControlProjection } from "./runtimeWorkspaceMissionControlProjection";

function buildTask(
  taskId: string,
  status: AgentTaskSummary["status"],
  title: string
): AgentTaskSummary {
  const now = Date.now();
  return {
    taskId,
    workspaceId: "ws-approval",
    threadId: null,
    requestId: null,
    title,
    status,
    accessMode: "on-request",
    provider: null,
    modelId: null,
    routedProvider: null,
    routedModelId: null,
    routedPool: null,
    routedSource: null,
    distributedStatus: null,
    currentStep: 1,
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    completedAt: status === "completed" ? now : null,
    errorCode: null,
    errorMessage: null,
    pendingApprovalId: status === "awaiting_approval" ? `${taskId}-approval` : null,
    steps: [],
  } satisfies AgentTaskSummary;
}

function buildRuntimeProjectionInput(
  overrides: Partial<Parameters<typeof buildWorkspaceRuntimeMissionControlProjection>[0]> = {}
): Parameters<typeof buildWorkspaceRuntimeMissionControlProjection>[0] {
  const runtimeProviders = overrides.runtimeProviders ?? [];
  const runtimeAccounts = overrides.runtimeAccounts ?? [];
  const runtimePools = overrides.runtimePools ?? [];
  const runtimePlugins =
    overrides.runtimePlugins ??
    createRuntimeProviderRoutePluginDescriptors({
      providers: runtimeProviders,
      accounts: runtimeAccounts,
      pools: runtimePools,
    });
  const runtimePolicy =
    overrides.runtimePolicy ??
    ({
      mode: "balanced",
      updatedAt: 1_700_000_000_000,
      state: {
        readiness: "ready",
        summary:
          "Runtime policy is ready in Balanced mode for standard mission control operations.",
        activeConstraintCount: 0,
        blockedCapabilityCount: 0,
        capabilities: [
          {
            capabilityId: "guardrail_channel",
            label: "Guardrail channel",
            readiness: "ready",
            effect: "allow",
            activeConstraint: false,
            summary: "Runtime guardrail channel is healthy.",
            detail: null,
          },
        ],
      },
    } satisfies RuntimePolicySnapshot);
  return {
    workspaceId: "ws-approval",
    runtimeTasks: [],
    runtimeProviders,
    runtimeAccounts,
    runtimePools,
    runtimeCapabilities: {
      mode: "tauri",
      methods: ["code_health"],
      features: [],
      wsEndpointPath: "/ws",
      error: null,
    },
    runtimeHealth: {
      app: "hugecode-runtime",
      version: "1.0.0",
      status: "ok",
    },
    runtimeHealthError: null,
    runtimeToolMetrics: {
      totals: {
        attemptedTotal: 10,
        startedTotal: 10,
        completedTotal: 10,
        successTotal: 10,
        validationFailedTotal: 0,
        runtimeFailedTotal: 0,
        timeoutTotal: 0,
        blockedTotal: 0,
      },
      byTool: {},
      recent: [],
      updatedAt: 1_700_000_000_000,
      windowSize: 500,
      channelHealth: {
        status: "healthy",
        reason: null,
        lastErrorCode: null,
        updatedAt: 1_700_000_000_000,
      },
      circuitBreakers: [],
    },
    runtimeToolGuardrails: {
      windowSize: 500,
      payloadLimitBytes: 65_536,
      computerObserveRateLimitPerMinute: 12,
      circuitWindowSize: 50,
      circuitMinCompleted: 20,
      circuitOpenMs: 600_000,
      halfOpenMaxProbes: 3,
      halfOpenRequiredSuccesses: 2,
      channelHealth: {
        status: "healthy",
        reason: null,
        lastErrorCode: null,
        updatedAt: 1_700_000_000_000,
      },
      circuitBreakers: [],
      updatedAt: 1_700_000_000_000,
    },
    runtimePolicy,
    runtimePolicyError: null,
    runtimePlugins,
    runtimePluginsError: null,
    runtimePluginsProjectionBacked: false,
    runtimePluginRegistryPackages: [],
    runtimePluginRegistryError: null,
    runtimeCompositionProfiles: [],
    runtimeCompositionActiveProfileId: null,
    runtimeCompositionActiveProfile: null,
    runtimeCompositionResolution: null,
    runtimeCompositionError: null,
    selectedProviderRoute: "auto",
    runtimeStatusFilter: "all",
    runtimeDurabilityWarning: null,
    ...overrides,
  };
}

describe("runtimeWorkspaceMissionControlProjection", () => {
  it("blocks launch when automatic routing has no ready provider route", () => {
    const providers: RuntimeProviderCatalogEntry[] = [
      {
        providerId: "openai",
        displayName: "OpenAI",
        pool: "codex",
        oauthProviderId: "codex",
        aliases: [],
        defaultModelId: null,
        available: true,
        supportsNative: true,
        supportsOpenaiCompat: true,
        registryVersion: "1",
      },
    ];

    const projection = buildWorkspaceRuntimeMissionControlProjection(
      buildRuntimeProjectionInput({
        runtimeProviders: providers,
      })
    );

    expect(projection.routeSelection.selected.value).toBe("auto");
    expect(projection.routeSelection.selected.ready).toBe(false);
    expect(projection.launchReadiness.headline).toBe("Launch readiness blocked");
    expect(projection.launchReadiness.route.detail).toContain("0/1 provider routes ready");
  });

  it("projects runtime-published policy state into a governance indicator", () => {
    const projection = buildWorkspaceRuntimeMissionControlProjection(
      buildRuntimeProjectionInput({
        runtimePolicy: {
          mode: "strict",
          updatedAt: 1_700_000_001_000,
          state: {
            readiness: "attention",
            summary: "Runtime policy is active in Strict mode with 2 operator-visible constraints.",
            activeConstraintCount: 2,
            blockedCapabilityCount: 1,
            capabilities: [
              {
                capabilityId: "tool_preflight",
                label: "Tool preflight",
                readiness: "attention",
                effect: "approval",
                activeConstraint: true,
                summary: "Strict mode gates medium and high-risk actions.",
                detail: "Operator approval is required before risky tool execution can continue.",
              },
              {
                capabilityId: "network_analysis",
                label: "Network analysis",
                readiness: "attention",
                effect: "blocked",
                activeConstraint: true,
                summary: "Network-backed analysis is disabled by runtime policy.",
                detail:
                  "Enable live-skills network access to restore remote search and fetch paths.",
              },
            ],
          },
        },
      })
    );

    expect(projection.policy.statusLabel).toBe("Attention");
    expect(projection.policy.mode).toBe("Strict");
    expect(projection.policy.activeConstraintCount).toBe(2);
    expect(projection.policy.blockedCapabilityCount).toBe(1);
    expect(projection.policy.capabilities[0]?.effectLabel).toBe("Approval gated");
    expect(projection.policy.capabilities[1]?.effectLabel).toBe("Blocked");
  });

  it("surfaces policy read errors without inventing policy truth", () => {
    const projection = buildWorkspaceRuntimeMissionControlProjection(
      buildRuntimeProjectionInput({
        runtimePolicy: null,
        runtimePolicyError: "Runtime policy RPC unavailable.",
      })
    );

    expect(projection.policy.statusLabel).toBe("Attention");
    expect(projection.policy.error).toBe("Runtime policy RPC unavailable.");
    expect(projection.policy.capabilities).toEqual([]);
    expect(projection.policy.headline).toContain("waiting for runtime truth");
  });

  it("summarizes control-plane profile, trust, and backend selection state", () => {
    const projection = buildWorkspaceRuntimeMissionControlProjection(
      buildRuntimeProjectionInput({
        runtimePlugins: [
          {
            id: "pkg:hugecode.mcp.search@1.0.0",
            name: "Remote Search Tools",
            version: "1.0.0",
            summary: "Registry package",
            source: "mcp_remote",
            transport: "mcp_remote",
            hostProfile: {
              kind: "remote",
              executionBoundaries: ["registry"],
            },
            workspaceId: null,
            enabled: true,
            runtimeBacked: false,
            capabilities: [],
            permissions: ["network"],
            resources: [],
            executionBoundaries: ["registry"],
            binding: {
              state: "declaration_only",
              contractFormat: "mcp",
              contractBoundary: "registry:mcp_remote",
              interfaceId: "pkg.search.remote",
              surfaces: [
                {
                  id: "pkg.search.remote.routes",
                  kind: "route",
                  direction: "export",
                  summary: "Remote route",
                },
              ],
            },
            operations: {
              execution: {
                executable: false,
                mode: "none",
                reason: "Registry package is not runtime-bound.",
              },
              resources: {
                readable: false,
                mode: "none",
                reason: "Registry package is not runtime-bound.",
              },
              permissions: {
                evaluable: false,
                mode: "none",
                reason: "Registry package is not runtime-bound.",
              },
            },
            metadata: {
              pluginRegistry: {
                packageRef: "hugecode.mcp.search@1.0.0",
                transport: "mcp_remote",
                source: "installed",
                installed: true,
                installedPluginId: null,
                publisher: "HugeCode Labs",
                trust: {
                  status: "verified",
                  verificationStatus: "verified",
                  publisher: "HugeCode Labs",
                  attestationSource: "sigstore",
                  blockedReason: null,
                  packageRef: "hugecode.mcp.search@1.0.0",
                  pluginId: "pkg.search.remote",
                },
                compatibility: {
                  status: "compatible",
                  minimumHostContractVersion: "2026-03-25",
                  supportedRuntimeProtocolVersions: ["2026-03-25"],
                  supportedCapabilityKeys: ["plugins.catalog", "plugins.registry"],
                  optionalTransportFeatures: [],
                  blockers: [],
                },
              },
              composition: {
                activeProfileId: "workspace-default",
                activeProfileName: "Workspace Default",
                selectedInActiveProfile: true,
                blockedInActiveProfile: false,
                blockedReason: null,
                selectedRouteCandidate: false,
                selectedBackendCandidateIds: [],
                layerOrder: ["built_in", "user", "workspace", "launch_override"],
              },
            },
            permissionDecision: null,
            health: null,
          },
        ],
        runtimePluginRegistryPackages: [
          {
            packageRef: "hugecode.mcp.search@1.0.0",
            packageId: "hugecode.mcp.search",
            version: "1.0.0",
            publisher: "HugeCode Labs",
            summary: "Registry package",
            transport: "mcp_remote",
            source: "installed",
            installed: true,
            installedPluginId: null,
            manifest: {
              packageId: "hugecode.mcp.search",
              version: "1.0.0",
              publisher: "HugeCode Labs",
              transport: "mcp_remote",
              entry: {
                pluginId: "pkg.search.remote",
                displayName: "Remote Search Tools",
                summary: "Registry package",
                interfaceId: "pkg.search.remote",
              },
              contractSurfaces: [],
              compatibility: {
                status: "compatible",
                minimumHostContractVersion: "2026-03-25",
                supportedRuntimeProtocolVersions: ["2026-03-25"],
                supportedCapabilityKeys: ["plugins.catalog", "plugins.registry"],
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
              minimumHostContractVersion: "2026-03-25",
              supportedRuntimeProtocolVersions: ["2026-03-25"],
              supportedCapabilityKeys: ["plugins.catalog", "plugins.registry"],
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
          },
        ],
        runtimeCompositionProfiles: [
          {
            id: "workspace-default",
            name: "Workspace Default",
            scope: "workspace",
            enabled: true,
            pluginSelectors: [],
            routePolicy: {
              preferredRoutePluginIds: [],
              providerPreference: [],
              allowRuntimeFallback: true,
            },
            backendPolicy: {
              preferredBackendIds: ["backend-primary"],
              resolvedBackendId: null,
            },
            trustPolicy: {
              requireVerifiedSignatures: true,
              allowDevOverrides: false,
              blockedPublishers: [],
            },
            executionPolicyRefs: [],
            observabilityPolicy: {
              emitStableEvents: true,
              emitOtelAlignedTelemetry: true,
            },
            configLayers: [],
          },
        ],
        runtimeCompositionActiveProfileId: "workspace-default",
        runtimeCompositionActiveProfile: {
          id: "workspace-default",
          name: "Workspace Default",
          scope: "workspace",
          enabled: true,
          pluginSelectors: [],
          routePolicy: {
            preferredRoutePluginIds: [],
            providerPreference: [],
            allowRuntimeFallback: true,
          },
          backendPolicy: {
            preferredBackendIds: ["backend-primary"],
            resolvedBackendId: null,
          },
          trustPolicy: {
            requireVerifiedSignatures: true,
            allowDevOverrides: false,
            blockedPublishers: [],
          },
          executionPolicyRefs: [],
          observabilityPolicy: {
            emitStableEvents: true,
            emitOtelAlignedTelemetry: true,
          },
          configLayers: [],
        },
        runtimeCompositionResolution: {
          selectedPlugins: [
            {
              pluginId: "pkg:hugecode.mcp.search@1.0.0",
              packageRef: "hugecode.mcp.search@1.0.0",
              source: "mcp_remote",
              reason: null,
            },
          ],
          selectedRouteCandidates: [],
          selectedBackendCandidates: [{ backendId: "backend-primary", sourcePluginId: null }],
          blockedPlugins: [],
          trustDecisions: [
            {
              status: "verified",
              verificationStatus: "verified",
              publisher: "HugeCode Labs",
              attestationSource: "sigstore",
              blockedReason: null,
              packageRef: "hugecode.mcp.search@1.0.0",
              pluginId: "pkg.search.remote",
            },
          ],
          provenance: {
            activeProfileId: "workspace-default",
            activeProfileName: "Workspace Default",
            appliedLayerOrder: ["built_in", "user", "workspace", "launch_override"],
            selectorDecisions: {},
          },
        },
      })
    );

    expect(projection.pluginCatalog.externalPackageCount).toBe(1);
    expect(projection.pluginCatalog.verifiedPackageCount).toBe(1);
    expect(projection.pluginCatalog.selectedInActiveProfileCount).toBe(1);
    expect(projection.pluginCatalog.readinessSections).toEqual([
      expect.objectContaining({
        id: "needs_action",
      }),
      expect.objectContaining({
        id: "selected_now",
      }),
      expect.objectContaining({
        id: "inventory",
      }),
    ]);
    expect(projection.composition).toMatchObject({
      activeProfileId: "workspace-default",
      activeProfileName: "Workspace Default",
      verifiedPluginCount: 1,
      blockedPluginCount: 0,
      selectedBackendCount: 1,
    });
  });

  it("keeps launch ready when local routing remains available", () => {
    const providers: RuntimeProviderCatalogEntry[] = [
      {
        providerId: "local",
        displayName: "Native runtime",
        pool: null,
        oauthProviderId: null,
        aliases: [],
        defaultModelId: null,
        available: true,
        supportsNative: true,
        supportsOpenaiCompat: false,
        registryVersion: "1",
      },
      {
        providerId: "openai",
        displayName: "OpenAI",
        pool: "codex",
        oauthProviderId: "codex",
        aliases: [],
        defaultModelId: null,
        available: true,
        supportsNative: true,
        supportsOpenaiCompat: true,
        registryVersion: "1",
      },
    ];

    const projection = buildWorkspaceRuntimeMissionControlProjection(
      buildRuntimeProjectionInput({
        runtimeProviders: providers,
      })
    );

    expect(projection.routeSelection.selected.value).toBe("auto");
    expect(projection.routeSelection.selected.ready).toBe(false);
    expect(projection.routeSelection.selected.readiness).toBe("attention");
    expect(projection.launchReadiness.headline).toBe("Launch readiness needs attention");
    expect(projection.routeSelection.selected.detail).toContain(
      "fall back to local/native execution"
    );
    expect(projection.routeSelection.selected.fallbackDetail).toContain(
      "fall back to local/native execution"
    );
  });

  it("derives route selection from routing plugins without requiring legacy provider routing inputs", () => {
    const projection = buildWorkspaceRuntimeMissionControlProjection(
      buildRuntimeProjectionInput({
        runtimeProviders: [],
        runtimeAccounts: [],
        runtimePools: [],
        runtimePlugins: [
          {
            id: "route:auto",
            name: "Automatic workspace routing",
            version: "routing",
            summary: "Automatic route.",
            source: "execution_route",
            transport: "execution_route",
            hostProfile: {
              kind: "routing",
              executionBoundaries: ["routing", "runtime"],
            },
            workspaceId: null,
            enabled: true,
            runtimeBacked: true,
            capabilities: [],
            permissions: [],
            resources: [],
            executionBoundaries: ["routing", "runtime"],
            binding: {
              state: "bound",
              contractFormat: "route",
              contractBoundary: "runtime-routing",
              interfaceId: "route:auto",
              surfaces: [
                {
                  id: "route:auto",
                  kind: "route",
                  direction: "export",
                  summary: "Automatic route selection surface.",
                },
              ],
            },
            operations: {
              execution: {
                executable: true,
                mode: "execution_route",
                reason: null,
              },
              resources: {
                readable: false,
                mode: "none",
                reason:
                  "Route plugins do not expose readable resources through the runtime kernel.",
              },
              permissions: {
                evaluable: false,
                mode: "none",
                reason: "Route plugins do not publish runtime-evaluable permission state.",
              },
            },
            metadata: {
              routeKind: "combined_execution",
              routeValue: "auto",
              readiness: "attention",
              launchAllowed: true,
              detail:
                "No OAuth-backed provider routes are ready, but local/native routing remains available.",
              fallbackDetail:
                "No OAuth-backed provider routes are ready, so automatic routing will fall back to local/native execution.",
              recommendedAction:
                "Launch can continue on local/native routing, or restore a ready remote provider route before launching.",
              providerId: null,
              pool: "auto",
              provenance: "auto",
            },
            permissionDecision: "unsupported",
            health: {
              state: "degraded",
              checkedAt: null,
              warnings: [],
            },
          },
          {
            id: "route:openai",
            name: "OpenAI",
            version: "routing",
            summary: "OpenAI route.",
            source: "provider_route",
            transport: "provider_route",
            hostProfile: {
              kind: "routing",
              executionBoundaries: ["routing", "runtime"],
            },
            workspaceId: null,
            enabled: true,
            runtimeBacked: true,
            capabilities: [],
            permissions: [],
            resources: [],
            executionBoundaries: ["routing", "runtime"],
            binding: {
              state: "bound",
              contractFormat: "route",
              contractBoundary: "runtime-routing",
              interfaceId: "route:openai",
              surfaces: [
                {
                  id: "route:openai",
                  kind: "route",
                  direction: "export",
                  summary: "Provider route selection surface.",
                },
              ],
            },
            operations: {
              execution: {
                executable: false,
                mode: "none",
                reason: "Provider route is blocked until credentials and pools are ready.",
              },
              resources: {
                readable: false,
                mode: "none",
                reason:
                  "Route plugins do not expose readable resources through the runtime kernel.",
              },
              permissions: {
                evaluable: false,
                mode: "none",
                reason: "Route plugins do not publish runtime-evaluable permission state.",
              },
            },
            metadata: {
              routeKind: "provider_family",
              routeValue: "openai",
              readiness: "blocked",
              launchAllowed: false,
              detail:
                "Enable at least one pool and one credential-ready account for this provider.",
              blockingReason:
                "Enable at least one pool and one credential-ready account for this provider.",
              recommendedAction:
                "Sign in for this provider or choose another ready route before launching.",
              providerId: "openai",
              oauthProviderId: "codex",
              pool: "codex",
              provenance: "explicit_route",
            },
            permissionDecision: "unsupported",
            health: {
              state: "degraded",
              checkedAt: null,
              warnings: ["No credential-ready accounts."],
            },
          },
        ],
        selectedProviderRoute: "openai",
      })
    );

    expect(projection.routeSelection.selected.value).toBe("openai");
    expect(projection.routeSelection.selected.ready).toBe(false);
    expect(projection.routeSelection.selected.readiness).toBe("blocked");
    expect(projection.routeSelection.selected.detail).toContain("credential-ready account");
    expect(projection.routeSelection.options.map((option) => option.value)).toEqual([
      "auto",
      "openai",
    ]);
    expect(projection.launchReadiness.route.detail).toContain("credential-ready account");
  });

  it("preserves the composition-selected resolved backend on the chosen route", () => {
    const providers: RuntimeProviderCatalogEntry[] = [
      {
        providerId: "openai",
        displayName: "OpenAI",
        pool: "codex",
        oauthProviderId: "codex",
        aliases: [],
        defaultModelId: null,
        available: true,
        supportsNative: true,
        supportsOpenaiCompat: true,
        registryVersion: "1",
      },
    ];

    const projection = buildWorkspaceRuntimeMissionControlProjection(
      buildRuntimeProjectionInput({
        runtimeProviders: providers,
        runtimeAccounts: [
          {
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
          },
        ],
        runtimePools: [
          {
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
          },
        ],
        runtimeCompositionActiveProfileId: "workspace-default",
        runtimeCompositionActiveProfile: {
          id: "workspace-default",
          name: "Workspace Default",
          scope: "workspace",
          enabled: true,
          pluginSelectors: [],
          routePolicy: {
            preferredRoutePluginIds: [],
            providerPreference: [],
            allowRuntimeFallback: true,
          },
          backendPolicy: {
            preferredBackendIds: ["backend-primary"],
            resolvedBackendId: "backend-profile",
          },
          trustPolicy: {
            requireVerifiedSignatures: false,
            allowDevOverrides: false,
            blockedPublishers: [],
          },
          executionPolicyRefs: [],
          observabilityPolicy: {
            emitStableEvents: true,
            emitOtelAlignedTelemetry: true,
          },
          configLayers: [],
        },
        runtimeCompositionResolution: {
          selectedPlugins: [],
          selectedRouteCandidates: [
            {
              pluginId: "route:openai",
              routeKind: "provider_family",
              providerId: "openai",
              preferredBackendIds: ["backend-primary"],
              resolvedBackendId: "backend-route",
            },
          ],
          selectedBackendCandidates: [
            {
              backendId: "backend-primary",
              sourcePluginId: "route:openai",
            },
            {
              backendId: "backend-route",
              sourcePluginId: "route:openai",
            },
          ],
          blockedPlugins: [],
          trustDecisions: [],
          provenance: {
            activeProfileId: "workspace-default",
            activeProfileName: "Workspace Default",
            appliedLayerOrder: ["workspace"],
            selectorDecisions: {},
          },
        },
        selectedProviderRoute: "openai",
      })
    );

    expect(projection.routeSelection.selected.value).toBe("openai");
    expect(projection.routeSelection.selected.preferredBackendIds).toEqual([
      "backend-primary",
      "backend-route",
    ]);
    expect(projection.routeSelection.selected.resolvedBackendId).toBe("backend-route");
    expect(projection.routeSelection.selected.provenance.source).toBe("backend_preference");
  });

  it("keeps a profile-resolved backend on automatic routing when no route-specific override exists", () => {
    const projection = buildWorkspaceRuntimeMissionControlProjection(
      buildRuntimeProjectionInput({
        runtimeCompositionActiveProfileId: "workspace-default",
        runtimeCompositionActiveProfile: {
          id: "workspace-default",
          name: "Workspace Default",
          scope: "workspace",
          enabled: true,
          pluginSelectors: [],
          routePolicy: {
            preferredRoutePluginIds: [],
            providerPreference: [],
            allowRuntimeFallback: true,
          },
          backendPolicy: {
            preferredBackendIds: ["backend-primary"],
            resolvedBackendId: "backend-profile",
          },
          trustPolicy: {
            requireVerifiedSignatures: false,
            allowDevOverrides: false,
            blockedPublishers: [],
          },
          executionPolicyRefs: [],
          observabilityPolicy: {
            emitStableEvents: true,
            emitOtelAlignedTelemetry: true,
          },
          configLayers: [],
        },
        runtimeCompositionResolution: {
          selectedPlugins: [],
          selectedRouteCandidates: [],
          selectedBackendCandidates: [
            {
              backendId: "backend-primary",
              sourcePluginId: null,
            },
            {
              backendId: "backend-profile",
              sourcePluginId: null,
            },
          ],
          blockedPlugins: [],
          trustDecisions: [],
          provenance: {
            activeProfileId: "workspace-default",
            activeProfileName: "Workspace Default",
            appliedLayerOrder: ["workspace"],
            selectorDecisions: {},
          },
        },
        selectedProviderRoute: "auto",
      })
    );

    expect(projection.routeSelection.selected.value).toBe("auto");
    expect(projection.routeSelection.selected.preferredBackendIds).toEqual([
      "backend-primary",
      "backend-profile",
    ]);
    expect(projection.routeSelection.selected.resolvedBackendId).toBe("backend-profile");
    expect(projection.routeSelection.selected.provenance.source).toBe("backend_preference");
  });

  it("projects continuity readiness from runtime task truth instead of page-local guesses", () => {
    const task = {
      ...buildTask("runtime-review-1", "completed", "Reviewable task"),
      checkpointId: "checkpoint-1",
      traceId: "trace-1",
      routing: {
        backendId: "backend-primary",
        provider: "openai",
        providerLabel: "OpenAI",
        pool: "codex",
        routeLabel: "Primary backend",
        routeHint: "Runtime confirmed backend placement.",
        health: "ready",
        resolutionSource: "workspace_default",
        lifecycleState: "confirmed",
        enabledAccountCount: 1,
        readyAccountCount: 1,
        enabledPoolCount: 1,
      },
      profileReadiness: {
        ready: true,
        health: "ready",
        summary: "Profile ready.",
        issues: [],
      },
      reviewActionability: {
        state: "ready",
        summary: "Review Pack is actionable.",
        degradedReasons: [],
        actions: [],
      },
      missionLinkage: {
        workspaceId: "ws-approval",
        taskId: "runtime-review-1",
        runId: "runtime-review-1",
        reviewPackId: "review-pack:runtime-review-1",
        checkpointId: "checkpoint-1",
        traceId: "trace-1",
        missionTaskId: "runtime:runtime-review-1",
        taskEntityKind: "run",
        recoveryPath: "run",
        summary: "Continue from Review Pack.",
        navigationTarget: {
          kind: "run",
          workspaceId: "ws-approval",
          taskId: "runtime-review-1",
          runId: "runtime-review-1",
          reviewPackId: "review-pack:runtime-review-1",
        },
      },
    } satisfies AgentTaskSummary;

    const projection = buildWorkspaceRuntimeMissionControlProjection(
      buildRuntimeProjectionInput({
        runtimeTasks: [task],
      })
    );

    expect(projection.continuity.summary.recoverableRunCount).toBe(0);
    expect(projection.continuity.summary.reviewBlockedCount).toBe(0);
    expect(projection.continuity.itemsByTaskId.get("runtime-review-1")?.pathKind).toBe("review");
    expect(projection.runList.visibleRuntimeRuns).toHaveLength(1);
  });

  it("summarizes the unified runtime plugin catalog for mission control consumers", () => {
    const projection = buildWorkspaceRuntimeMissionControlProjection(
      buildRuntimeProjectionInput({
        runtimePlugins: [
          {
            id: "ext-1",
            name: "Shell Tools",
            version: "1.0.0",
            summary: null,
            source: "runtime_extension",
            transport: "runtime_extension",
            hostProfile: {
              kind: "runtime",
              executionBoundaries: ["runtime"],
            },
            workspaceId: "ws-approval",
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
              interfaceId: "ext-1",
              surfaces: [
                {
                  id: "ext-1",
                  kind: "extension",
                  direction: "export",
                  summary: "Runtime extension record exported through the kernel plugin catalog.",
                },
              ],
            },
            operations: {
              execution: {
                executable: false,
                mode: "none",
                reason:
                  "Plugin `ext-1` is bound for catalog/resource access only and does not expose an execution provider.",
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
          {
            id: "skill-1",
            name: "Repo Review",
            version: "0.1.0",
            summary: null,
            source: "live_skill",
            transport: "live_skill",
            hostProfile: {
              kind: "runtime",
              executionBoundaries: ["runtime"],
            },
            workspaceId: null,
            enabled: true,
            runtimeBacked: true,
            capabilities: [],
            permissions: ["network"],
            resources: [],
            executionBoundaries: ["runtime"],
            binding: {
              state: "bound",
              contractFormat: "live_skill",
              contractBoundary: "runtime-live-skill",
              interfaceId: "skill-1",
              surfaces: [
                {
                  id: "skill-1",
                  kind: "skill",
                  direction: "export",
                  summary: "Live skill execution surface exported by the runtime.",
                },
              ],
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
                reason:
                  "Plugin `skill-1` does not expose readable resources through the runtime kernel.",
              },
              permissions: {
                evaluable: true,
                mode: "live_skill_permissions",
                reason: null,
              },
            },
            metadata: null,
            permissionDecision: "allow",
            health: {
              state: "degraded",
              checkedAt: 2,
              warnings: ["quota"],
            },
          },
          {
            id: "route:auto",
            name: "Automatic workspace routing",
            version: "routing",
            summary: null,
            source: "execution_route",
            transport: "execution_route",
            hostProfile: {
              kind: "routing",
              executionBoundaries: ["routing", "runtime"],
            },
            workspaceId: null,
            enabled: true,
            runtimeBacked: true,
            capabilities: [],
            permissions: [],
            resources: [],
            executionBoundaries: ["routing", "runtime"],
            binding: {
              state: "bound",
              contractFormat: "route",
              contractBoundary: "runtime-routing",
              interfaceId: "route:auto",
              surfaces: [
                {
                  id: "route:auto",
                  kind: "route",
                  direction: "export",
                  summary: "Automatic route selection surface.",
                },
              ],
            },
            operations: {
              execution: {
                executable: true,
                mode: "execution_route",
                reason: null,
              },
              resources: {
                readable: false,
                mode: "none",
                reason:
                  "Route plugins do not expose readable resources through the runtime kernel.",
              },
              permissions: {
                evaluable: false,
                mode: "none",
                reason: "Route plugins do not publish runtime-evaluable permission state.",
              },
            },
            metadata: {
              routeKind: "combined_execution",
              routeValue: "auto",
              readiness: "ready",
              launchAllowed: true,
              detail: "Automatic routing is ready for launch.",
              providerId: null,
              pool: "auto",
              provenance: "auto",
            },
            permissionDecision: "unsupported",
            health: {
              state: "healthy",
              checkedAt: 3,
              warnings: [],
            },
          },
          {
            id: "repo-manifest-1",
            name: "Review Manifest",
            version: "0.0.1",
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
            capabilities: [],
            permissions: ["workspace:read"],
            resources: [],
            executionBoundaries: ["repository"],
            binding: {
              state: "declaration_only",
              contractFormat: "manifest",
              contractBoundary: "repository-manifest",
              interfaceId: "repo-manifest-1",
              surfaces: [
                {
                  id: "repo-manifest-1",
                  kind: "manifest",
                  direction: "export",
                  summary:
                    "Repository manifest declaration exported through the workspace plugin catalog.",
                },
              ],
            },
            operations: {
              execution: {
                executable: false,
                mode: "none",
                reason:
                  "Plugin `repo-manifest-1` is declaration-only and does not expose a bound execution provider.",
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
            permissionDecision: "ask",
            health: {
              state: "unsupported",
              checkedAt: null,
              warnings: [],
            },
          },
        ],
        runtimePluginsError: "catalog degraded",
        runtimePluginsProjectionBacked: true,
      })
    );

    expect(projection.pluginCatalog).toMatchObject({
      total: 4,
      enabled: 4,
      runtimeBacked: 3,
      executableCount: 2,
      nonExecutableCount: 2,
      readableResourceCount: 2,
      permissionEvaluableCount: 3,
      contractSurfaceCount: 4,
      contractImportSurfaceCount: 0,
      contractExportSurfaceCount: 4,
      boundCount: 3,
      declarationOnlyCount: 1,
      unboundCount: 0,
      runtimeExtensionCount: 1,
      liveSkillCount: 1,
      repoManifestCount: 1,
      routingCount: 1,
      providerRouteCount: 0,
      backendRouteCount: 0,
      executionRouteCount: 1,
      readyRouteCount: 1,
      attentionRouteCount: 0,
      blockedRouteCount: 0,
      healthyCount: 2,
      degradedCount: 1,
      unsupportedCount: 1,
      readyCount: 2,
      attentionCount: 2,
      blockedCount: 0,
      projectionBacked: true,
      error: "catalog degraded",
    });
    expect(projection.pluginCatalog.plugins.map((plugin) => plugin.id)).toEqual([
      "ext-1",
      "skill-1",
      "route:auto",
      "repo-manifest-1",
    ]);
    expect(projection.pluginCatalog.readinessEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ext-1",
          sourceLabel: "Runtime extension",
          readiness: expect.objectContaining({
            state: "ready",
          }),
          selectionState: expect.objectContaining({
            label: "Available inventory",
          }),
          trustState: expect.objectContaining({
            label: "Runtime-published",
          }),
          permissionState: expect.objectContaining({
            state: "ready",
          }),
        }),
        expect.objectContaining({
          id: "repo-manifest-1",
          sourceLabel: "Repo manifest",
          readiness: expect.objectContaining({
            state: "attention",
          }),
          permissionState: expect.objectContaining({
            state: "attention",
          }),
          selectionState: expect.objectContaining({
            label: "Repository declaration",
          }),
          trustState: expect.objectContaining({
            label: "Repository-local",
          }),
          remediationSummary:
            "Bind or install a runtime-backed implementation so this manifest can move beyond declaration-only readiness.",
        }),
        expect.objectContaining({
          id: "skill-1",
          sourceLabel: "Live skill",
          readiness: expect.objectContaining({
            state: "attention",
          }),
          capabilitySupport: expect.objectContaining({
            state: "ready",
          }),
          trustState: expect.objectContaining({
            label: "Runtime-published",
          }),
          remediationSummary: "Inspect runtime health warnings before relying on this live skill.",
        }),
        expect.objectContaining({
          id: "route:auto",
          sourceLabel: "Execution route",
          readiness: expect.objectContaining({
            state: "ready",
          }),
          permissionState: expect.objectContaining({
            label: "Runtime-managed",
            state: "ready",
          }),
          selectionState: expect.objectContaining({
            label: "Published route",
          }),
          trustState: expect.objectContaining({
            label: "Runtime-published",
          }),
        }),
      ])
    );
    expect(projection.pluginCatalog.readinessSections).toEqual([
      expect.objectContaining({
        id: "needs_action",
        entries: [
          expect.objectContaining({ id: "repo-manifest-1" }),
          expect.objectContaining({ id: "skill-1" }),
        ],
      }),
      expect.objectContaining({
        id: "selected_now",
        entries: [],
      }),
      expect.objectContaining({
        id: "inventory",
        entries: [
          expect.objectContaining({ id: "route:auto" }),
          expect.objectContaining({ id: "ext-1" }),
        ],
      }),
    ]);
  });

  it("marks runtime-published host binders as blocked until the binder is connected", () => {
    const projection = buildWorkspaceRuntimeMissionControlProjection(
      buildRuntimeProjectionInput({
        runtimePlugins: [
          {
            id: "host:wasi",
            name: "WASI host binder",
            version: "unbound",
            summary:
              "Runtime-published component-model host slot reserved for future WIT/world bindings.",
            source: "wasi_host",
            transport: "wasi_host",
            hostProfile: {
              kind: "wasi",
              executionBoundaries: ["wasi_host"],
            },
            workspaceId: null,
            enabled: false,
            runtimeBacked: true,
            capabilities: [],
            permissions: [],
            resources: [],
            executionBoundaries: ["wasi_host"],
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
              ],
            },
            operations: {
              execution: {
                executable: false,
                mode: "none",
                reason:
                  "Plugin `host:wasi` reserves a WIT/component-model host slot and is currently unbound in the runtime host binder.",
              },
              resources: {
                readable: false,
                mode: "none",
                reason:
                  "Plugin `host:wasi` does not expose readable resources through the runtime kernel.",
              },
              permissions: {
                evaluable: false,
                mode: "none",
                reason: "Plugin `host:wasi` does not publish runtime-evaluable permission state.",
              },
            },
            metadata: null,
            permissionDecision: "unsupported",
            health: {
              state: "unsupported",
              checkedAt: null,
              warnings: ["Runtime host binder is not currently connected."],
            },
          },
        ],
      })
    );

    expect(projection.pluginCatalog).toMatchObject({
      readyCount: 0,
      attentionCount: 0,
      blockedCount: 1,
    });
    expect(projection.pluginCatalog.readinessEntries).toEqual([
      expect.objectContaining({
        id: "host:wasi",
        sourceLabel: "WASI host",
        readiness: expect.objectContaining({
          state: "blocked",
        }),
        selectionState: expect.objectContaining({
          label: "Available inventory",
        }),
        trustState: expect.objectContaining({
          label: "Runtime-published",
        }),
        permissionState: expect.objectContaining({
          label: "Runtime-managed",
          state: "ready",
        }),
        remediationSummary:
          "Connect the WASI host binder so runtime can satisfy the published WIT imports.",
      }),
    ]);
    expect(projection.pluginCatalog.readinessSections[0]).toEqual(
      expect.objectContaining({
        id: "needs_action",
        entries: [expect.objectContaining({ id: "host:wasi" })],
      })
    );
  });

  it("surfaces plugins blocked by the active profile as action-required readiness", () => {
    const projection = buildWorkspaceRuntimeMissionControlProjection(
      buildRuntimeProjectionInput({
        runtimePlugins: [
          {
            id: "ext.blocked",
            name: "Blocked Extension",
            version: "1.0.0",
            summary: "Healthy extension blocked by the active profile",
            source: "runtime_extension",
            transport: "runtime_extension",
            hostProfile: {
              kind: "runtime",
              executionBoundaries: ["runtime"],
            },
            workspaceId: null,
            enabled: true,
            runtimeBacked: true,
            capabilities: [
              {
                id: "tools.exec",
                enabled: true,
              },
            ],
            permissions: [],
            resources: [],
            executionBoundaries: ["runtime"],
            binding: {
              state: "bound",
              contractFormat: "runtime_extension",
              contractBoundary: "runtime-extension",
              interfaceId: "ext.blocked",
              surfaces: [],
            },
            operations: {
              execution: {
                executable: true,
                mode: "none",
                reason: null,
              },
              resources: {
                readable: false,
                mode: "none",
                reason: null,
              },
              permissions: {
                evaluable: true,
                mode: "runtime_extension_permissions",
                reason: null,
              },
            },
            metadata: {
              composition: {
                activeProfileId: "workspace-default",
                activeProfileName: "Workspace Default",
                selectedInActiveProfile: false,
                blockedInActiveProfile: true,
                blockedReason: "Workspace Default currently excludes this plugin from launch.",
                selectedRouteCandidate: false,
                selectedBackendCandidateIds: [],
                layerOrder: ["built_in", "workspace"],
              },
            },
            permissionDecision: "allow",
            health: {
              state: "healthy",
              checkedAt: null,
              warnings: [],
            },
          },
        ],
      })
    );

    expect(projection.pluginCatalog).toMatchObject({
      readyCount: 0,
      attentionCount: 0,
      blockedCount: 1,
    });
    expect(projection.pluginCatalog.readinessEntries).toEqual([
      expect.objectContaining({
        id: "ext.blocked",
        readiness: expect.objectContaining({
          state: "blocked",
          detail: "Workspace Default currently excludes this plugin from launch.",
        }),
        selectionState: expect.objectContaining({
          kind: "blocked_in_active_profile",
          label: "Blocked in active profile",
          state: "blocked",
        }),
        remediationSummary:
          "Adjust the active runtime profile or remove the blocking rule before relying on this plugin.",
      }),
    ]);
    expect(projection.pluginCatalog.readinessSections[0]).toEqual(
      expect.objectContaining({
        id: "needs_action",
        entries: [expect.objectContaining({ id: "ext.blocked" })],
      })
    );
  });
});
