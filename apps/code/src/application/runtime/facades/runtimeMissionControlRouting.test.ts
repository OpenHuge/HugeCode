import { describe, expect, it } from "vitest";
import type { AgentTaskSummary } from "@ku0/code-runtime-host-contract";
import { buildProfileReadiness, buildRoutingSummary } from "./runtimeMissionControlRouting";

function createTask(overrides: Partial<AgentTaskSummary> = {}): AgentTaskSummary {
  return {
    taskId: "task-1",
    workspaceId: "ws-1",
    threadId: null,
    requestId: null,
    title: "Task",
    status: "queued",
    accessMode: "on-request",
    executionMode: "single",
    provider: "openai",
    modelId: "gpt-5.3-codex",
    routedProvider: "openai",
    routedModelId: "gpt-5.3-codex",
    routedPool: "codex",
    routedSource: "workspace-default",
    currentStep: 0,
    createdAt: 1,
    updatedAt: 1,
    startedAt: null,
    completedAt: null,
    errorCode: null,
    errorMessage: null,
    pendingApprovalId: null,
    steps: [],
    ...overrides,
  };
}

describe("runtimeMissionControlRouting", () => {
  it("marks missing provider catalog entries as routing attention instead of local-ready", () => {
    expect(buildRoutingSummary(createTask())).toEqual({
      backendId: null,
      provider: "openai",
      providerLabel: "openai",
      pool: "codex",
      routeLabel: "openai",
      routeHint:
        "Runtime has not confirmed a concrete backend placement yet. Runtime routed provider openai is not present in the current provider catalog.",
      health: "attention",
      enabledAccountCount: 0,
      readyAccountCount: 0,
      enabledPoolCount: 0,
    });
  });

  it("keeps local or non-OAuth providers in a ready state without workspace OAuth routing", () => {
    expect(
      buildRoutingSummary(
        createTask({ provider: "native", routedProvider: "native", routedPool: null }),
        {
          providers: [
            {
              providerId: "native",
              oauthProviderId: null,
              displayName: "Native runtime",
              pool: null,
              defaultModelId: null,
              available: true,
              supportsNative: true,
              supportsOpenaiCompat: false,
              aliases: [],
            },
          ],
        }
      )
    ).toEqual({
      backendId: null,
      provider: "native",
      providerLabel: "Native runtime",
      pool: null,
      routeLabel: "Native runtime",
      routeHint:
        "Runtime has not confirmed a concrete backend placement yet. This run does not require workspace OAuth routing.",
      health: "ready",
      enabledAccountCount: 0,
      readyAccountCount: 0,
      enabledPoolCount: 0,
    });
  });

  it("projects ready routing health from provider, account, and pool context", () => {
    const routing = buildRoutingSummary(createTask(), {
      providers: [
        {
          providerId: "openai",
          oauthProviderId: "codex",
          displayName: "OpenAI",
          pool: "codex",
          defaultModelId: "gpt-5.3-codex",
          available: true,
          supportsNative: true,
          supportsOpenaiCompat: true,
          aliases: ["openai"],
        },
      ],
      accounts: [
        {
          accountId: "acct-1",
          provider: "codex",
          externalAccountId: null,
          email: null,
          displayName: "acct-1",
          status: "enabled",
          disabledReason: null,
          metadata: {},
          routeConfig: {
            compatBaseUrl: "https://example.test",
            proxyId: null,
            priority: null,
            concurrencyLimit: null,
            schedulable: true,
          },
          routingState: {
            credentialReady: true,
            lastRoutingError: null,
            rateLimitedUntil: null,
            overloadedUntil: null,
            tempUnschedulableUntil: null,
            tempUnschedulableReason: null,
          },
          chatgptWorkspaces: null,
          defaultChatgptWorkspaceId: null,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      pools: [
        {
          poolId: "codex",
          provider: "codex",
          name: "Codex Pool",
          strategy: "round_robin",
          stickyMode: "cache_first",
          preferredAccountId: null,
          enabled: true,
          metadata: {},
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    expect(routing).toMatchObject({
      providerLabel: "OpenAI",
      routeLabel: "OpenAI / codex",
      routeHint: expect.stringContaining(
        "Runtime has not confirmed a concrete backend placement yet."
      ),
      health: "ready",
      enabledAccountCount: 1,
      readyAccountCount: 1,
      enabledPoolCount: 1,
    });
    expect(buildProfileReadiness(routing)).toEqual({
      ready: true,
      health: "ready",
      summary: "Profile is ready for delegated execution.",
      issues: [],
    });
  });

  it("marks fallback placement explicitly in routing hints", () => {
    const routing = buildRoutingSummary(
      createTask({
        backendId: "backend-fallback-b",
        preferredBackendIds: ["backend-request-a"],
      }),
      {
        providers: [
          {
            providerId: "openai",
            oauthProviderId: "codex",
            displayName: "OpenAI",
            pool: "codex",
            defaultModelId: "gpt-5.3-codex",
            available: true,
            supportsNative: true,
            supportsOpenaiCompat: true,
            aliases: ["openai"],
          },
        ],
      }
    );

    expect(routing.routeHint).toContain(
      "Runtime confirmed fallback placement on backend backend-fallback-b."
    );
  });

  it("preserves runtime-published routing lifecycle and backend truth when available", () => {
    const routing = buildRoutingSummary(
      createTask({
        backendId: "backend-task-level",
        routing: {
          backendId: "backend-runtime-resolved",
          provider: "openai",
          providerLabel: "OpenAI",
          pool: "codex",
          routeLabel: "OpenAI / codex",
          routeHint: "Runtime attached provider route context.",
          health: "attention",
          resolutionSource: "workspace_default",
          lifecycleState: "resolved",
          enabledAccountCount: 1,
          readyAccountCount: 0,
          enabledPoolCount: 1,
        },
      })
    );

    expect(routing).toMatchObject({
      backendId: "backend-runtime-resolved",
      health: "attention",
    });
    expect(routing.routeHint).toContain(
      "Runtime resolved backend backend-runtime-resolved, but confirmation details are incomplete."
    );
    expect(routing.routeHint).toContain("Runtime attached provider route context.");
  });

  it("prefers runtime-published profile readiness over locally derived messaging", () => {
    const routing = buildRoutingSummary(
      createTask({
        routing: {
          backendId: "backend-runtime-resolved",
          provider: "openai",
          providerLabel: "OpenAI",
          pool: "codex",
          routeLabel: "OpenAI / codex",
          routeHint: "Runtime attached provider route context.",
          health: "attention",
          resolutionSource: "workspace_default",
          lifecycleState: "resolved",
          enabledAccountCount: 1,
          readyAccountCount: 0,
          enabledPoolCount: 1,
        },
      })
    );

    expect(
      buildProfileReadiness(routing, {
        ready: false,
        health: "attention",
        summary: "Runtime is still attaching backend registry evidence for this profile.",
        issues: ["awaiting_backend_confirmation"],
      })
    ).toEqual({
      ready: false,
      health: "attention",
      summary: "Runtime is still attaching backend registry evidence for this profile.",
      issues: ["awaiting_backend_confirmation"],
    });
  });
});
