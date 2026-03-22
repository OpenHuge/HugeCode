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
    expect(projection.routeSelection.selected.ready).toBe(true);
    expect(projection.launchReadiness.headline).toBe("Launch readiness confirmed");
    expect(projection.routeSelection.selected.detail).toContain(
      "local/native routing remains available"
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
        recommendedAction: "Open Review Pack.",
      },
      missionLinkage: {
        summary: "Continue from Review Pack.",
        navigationTarget: {
          kind: "review_pack",
          workspaceId: "ws-approval",
          runId: "runtime-review-1",
          reviewPackId: "review-pack:runtime-review-1",
        },
        recoveryPath: null,
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
});
