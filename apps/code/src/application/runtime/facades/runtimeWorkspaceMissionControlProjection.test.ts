import { describe, expect, it } from "vitest";
import type {
  AgentTaskSummary,
  RuntimeProviderCatalogEntry,
} from "@ku0/code-runtime-host-contract";
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
  return {
    workspaceId: "ws-approval",
    runtimeTasks: [],
    runtimeProviders: [],
    runtimeAccounts: [],
    runtimePools: [],
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
    runtimePlugins: [],
    runtimePluginsError: null,
    runtimePluginsProjectionBacked: false,
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
            permissions: [],
            resources: [],
            executionBoundaries: ["runtime"],
            binding: {
              state: "bound",
              contractFormat: "live_skill",
              contractBoundary: "runtime-live-skill",
              interfaceId: "skill-1",
            },
            metadata: null,
            permissionDecision: null,
            health: {
              state: "degraded",
              checkedAt: 2,
              warnings: ["quota"],
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
            permissions: [],
            resources: [],
            executionBoundaries: ["repository"],
            binding: {
              state: "declaration_only",
              contractFormat: "manifest",
              contractBoundary: "repository-manifest",
              interfaceId: "repo-manifest-1",
            },
            metadata: null,
            permissionDecision: "unsupported",
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
      total: 3,
      enabled: 3,
      runtimeBacked: 2,
      executableCount: 1,
      nonExecutableCount: 2,
      boundCount: 2,
      declarationOnlyCount: 1,
      unboundCount: 0,
      runtimeExtensionCount: 1,
      liveSkillCount: 1,
      repoManifestCount: 1,
      healthyCount: 1,
      degradedCount: 1,
      unsupportedCount: 1,
      projectionBacked: true,
      error: "catalog degraded",
    });
    expect(projection.pluginCatalog.plugins.map((plugin) => plugin.id)).toEqual([
      "ext-1",
      "skill-1",
      "repo-manifest-1",
    ]);
  });
});
