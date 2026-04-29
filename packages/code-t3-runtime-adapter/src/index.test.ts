import type { ModelPoolEntry, RuntimeBackendSummary } from "@ku0/code-runtime-host-contract";
import {
  buildT3ProviderCatalog,
  buildHugeCodeAgentTaskStartRequest,
  buildT3CodexGatewayProviderProfile,
  createT3CodexGatewayProviderRoute,
  mapHugeRouterCommercialSnapshotToT3ProviderRoute,
  mapHugeCodeBackendPoolToT3ProviderRoutes,
  mapHugeCodeModelPoolToT3ProviderModels,
  mapHugeCodeRuntimeEventToT3TimelineEvent,
  mapT3ProviderRoutesToServerProviders,
  mapT3ServerProvidersToModelOptionsByProvider,
  normalizeT3CodexGatewayBaseUrl,
  resolveModelProviderForT3Selection,
  resolvePreferredBackendIdsForT3Selection,
} from "./index";

function backend(overrides: Partial<RuntimeBackendSummary>): RuntimeBackendSummary {
  return {
    backendId: "local-codex",
    displayName: "Local Codex CLI",
    capabilities: ["codex", "code"],
    maxConcurrency: 1,
    costTier: "local",
    latencyClass: "local",
    rolloutState: "current",
    status: "active",
    healthy: true,
    healthScore: 1,
    failures: 0,
    queueDepth: 0,
    runningTasks: 0,
    createdAt: 1,
    updatedAt: 2,
    lastHeartbeatAt: 2,
    readiness: {
      state: "ready",
      summary: "Codex app-server is ready.",
      reasons: [],
      authState: "verified",
    },
    operability: {
      state: "ready",
      placementEligible: true,
      summary: "Codex is placement-ready.",
      reasons: [],
    },
    ...overrides,
  };
}

function model(overrides: Partial<ModelPoolEntry>): ModelPoolEntry {
  return {
    id: "gpt-5.4",
    displayName: "GPT-5.4",
    provider: "openai",
    pool: "codex",
    source: "oauth-account",
    available: true,
    supportsReasoning: true,
    supportsVision: true,
    reasoningEfforts: ["medium", "high", "xhigh"],
    capabilities: ["chat", "coding", "reasoning", "vision"],
    ...overrides,
  };
}

describe("code-t3-runtime-adapter", () => {
  it("builds a Hugerouter commercial Codex gateway profile without persisting the route key", () => {
    const profile = buildT3CodexGatewayProviderProfile({
      apiKey: "hgrt_secret_route_token",
      baseUrl: "https://router.openhuge.example/v1/",
      commercial: {
        capacitySource: "provider_authorized_pool",
        planId: "hugerouter-pro",
        projectId: "proj_core",
        tenantId: "tenant_acme",
      },
      modelAlias: "agent-coding-default",
    });

    expect(profile).toMatchObject({
      apiKeyEnvKey: "HUGEROUTER_ROUTE_TOKEN",
      authMode: "env_api_key",
      baseUrl: "https://router.openhuge.example/v1",
      displayName: "HugeRouter",
      executionTarget: "embedded_app_server",
      modelAlias: "agent-coding-default",
      profileKind: "hugerouter_commercial",
      providerId: "hugerouter",
      wireApi: "responses",
      commercial: {
        capacitySource: "provider_authorized_pool",
        commercialServiceEnabled: true,
        planId: "hugerouter-pro",
        projectId: "proj_core",
        routeReceiptRequired: true,
        tenantId: "tenant_acme",
      },
    });
    expect(profile.environment).toEqual({
      HUGEROUTER_ROUTE_TOKEN: "hgrt_secret_route_token",
    });
    expect(profile.configToml).toContain('wire_api = "responses"');
    expect(profile.configToml).toContain('base_url = "https://router.openhuge.example/v1"');
    expect(profile.configToml).not.toContain("hgrt_secret_route_token");
  });

  it("builds an arbitrary gateway profile for local Codex CLI fallback", () => {
    const profile = buildT3CodexGatewayProviderProfile({
      apiKey: "relay-key",
      apiKeyEnvKey: "CUSTOM_RELAY_KEY",
      baseUrl: "http://127.0.0.1:8080/v1",
      displayName: "Local Relay",
      executionTarget: "local_cli",
      modelAlias: "coding-proxy",
      profileKind: "custom_gateway",
      providerId: "local_relay",
    });

    expect(profile.commercial).toBeNull();
    expect(profile.environment).toEqual({ CUSTOM_RELAY_KEY: "relay-key" });
    expect(profile.configToml).toContain('model_provider = "local_relay"');
    expect(profile.configToml).toContain('env_key = "CUSTOM_RELAY_KEY"');
  });

  it("rejects gateway operation endpoints instead of storing a broken Codex base URL", () => {
    expect(() => normalizeT3CodexGatewayBaseUrl("https://router.example/v1/responses")).toThrow(
      "operation endpoint"
    );
    expect(() =>
      normalizeT3CodexGatewayBaseUrl("https://router.example/v1/chat/completions")
    ).toThrow("operation endpoint");
  });

  it("projects a Codex gateway profile into a t3 provider route", () => {
    const route = createT3CodexGatewayProviderRoute(
      buildT3CodexGatewayProviderProfile({
        apiKey: "token",
        baseUrl: "https://router.openhuge.example/v1",
        commercial: {
          capacitySource: "hugerouter_native_credits",
        },
        modelAlias: "agent-coding-default",
      })
    );

    expect(route).toMatchObject({
      authState: "authenticated",
      backendId: "codex-app-server-hugerouter",
      backendLabel: "Embedded Codex app-server via HugeRouter",
      modelId: "agent-coding-default",
      provider: "codex",
      status: "ready",
      reasons: [
        "hugerouter_commercial_service_enabled",
        "capacity_source:hugerouter_native_credits",
        "route_receipt_required",
      ],
    });
  });

  it("promotes an active HugeRouter route token into the t3 provider catalog", () => {
    const hugeRouterRoute = mapHugeRouterCommercialSnapshotToT3ProviderRoute({
      availablePlans: [],
      capacity: {
        burstCapacityEligible: true,
        capacityKind: "reserved",
        concurrencyLimit: 8,
        includedMonthlyCredits: 1_000_000,
        planId: "hugerouter-pro",
        planName: "Hugerouter Pro",
        remainingCredits: 900_000,
        resetsAt: null,
        sharedCapacityEligible: true,
      },
      connection: {
        accountLabel: "Acme",
        dashboardUrl: "https://hugerouter.openhuge.example/dashboard",
        diagnostics: [],
        projectId: "proj_core",
        routeBaseUrl: "https://router.openhuge.example/v1",
        status: "connected",
        tenantId: "tenant_acme",
      },
      order: {
        checkoutUrl: null,
        manageUrl: "https://hugerouter.openhuge.example/orders",
        nextBillingAt: null,
        orderId: "order_1",
        planId: "hugerouter-pro",
        status: "active",
      },
      routeToken: {
        envKey: "HUGEROUTER_ROUTE_TOKEN",
        expiresAt: null,
        lastFour: "t3v1",
        lastIssuedAt: 1,
        scopes: ["route:codex"],
        status: "active",
        tokenId: "rt_1",
      },
    });

    expect(hugeRouterRoute).toEqual(
      expect.objectContaining({
        backendId: "codex-app-server-hugerouter",
        backendLabel: "Embedded Codex app-server via HugeRouter",
        provider: "codex",
        status: "ready",
        summary: expect.stringContaining("HUGEROUTER_ROUTE_TOKEN"),
      })
    );

    const catalog = buildT3ProviderCatalog([backend({})], [model({})], "now", {
      hugeRouterCommercialService: {
        availablePlans: [],
        capacity: null,
        connection: {
          accountLabel: "Acme",
          dashboardUrl: null,
          diagnostics: [],
          projectId: null,
          routeBaseUrl: "https://router.openhuge.example/v1",
          status: "connected",
          tenantId: null,
        },
        order: null,
        routeToken: {
          envKey: "HUGEROUTER_ROUTE_TOKEN",
          expiresAt: null,
          lastFour: "t3v1",
          lastIssuedAt: 1,
          scopes: ["route:codex"],
          status: "active",
          tokenId: "rt_1",
        },
      },
    });

    expect(catalog.routes[0]).toEqual(
      expect.objectContaining({
        backendId: "codex-app-server-hugerouter",
        provider: "codex",
      })
    );
    expect(JSON.stringify(catalog)).not.toContain("hgrt_secret");
  });

  it("maps HugeCode local CLI backends to t3 provider routes", () => {
    const routes = mapHugeCodeBackendPoolToT3ProviderRoutes([
      backend({}),
      backend({
        backendId: "local-claude",
        displayName: "Local Claude Code CLI",
        capabilities: ["claude", "code"],
      }),
      backend({
        backendId: "remote-generic",
        displayName: "Remote generic worker",
        capabilities: ["code"],
      }),
    ]);

    expect(routes.map((route) => route.provider)).toEqual(["claudeAgent", "codex"]);
    expect(routes.find((route) => route.provider === "codex")?.authState).toBe("authenticated");
  });

  it("maps HugeCode model pool entries into t3 provider model options", () => {
    const models = mapHugeCodeModelPoolToT3ProviderModels([
      model({ id: "gpt-5.4", displayName: "GPT-5.4", pool: "codex", provider: "openai" }),
      model({
        id: "claude-opus-4-6",
        displayName: "Claude Opus 4.6",
        pool: "claude",
        provider: "anthropic",
        supportsVision: false,
      }),
      model({
        id: "gemini-2.5-pro",
        displayName: "Gemini 2.5 Pro",
        pool: "gemini",
        provider: "google",
      }),
    ]);

    expect(models.codex).toEqual([
      expect.objectContaining({
        slug: "gpt-5.4",
        name: "GPT-5.4",
        subProvider: "OpenAI",
      }),
    ]);
    expect(models.claudeAgent).toEqual([
      expect.objectContaining({
        slug: "claude-opus-4-6",
        name: "Claude Opus 4.6",
        subProvider: "Anthropic",
      }),
    ]);
  });

  it("attaches runtime model options to provider routes", () => {
    const routes = mapHugeCodeBackendPoolToT3ProviderRoutes(
      [backend({ backendId: "local-codex-a" })],
      [model({ id: "gpt-5.4", displayName: "GPT-5.4" })]
    );

    expect(routes.find((route) => route.provider === "codex")).toMatchObject({
      modelId: "gpt-5.4",
      models: [
        expect.objectContaining({
          slug: "gpt-5.4",
          name: "GPT-5.4",
        }),
      ],
    });
  });

  it("synthesizes a local Claude route from model pool entries when no backend is active", () => {
    const routes = mapHugeCodeBackendPoolToT3ProviderRoutes(
      [backend({ backendId: "local-codex-a" })],
      [
        model({ id: "gpt-5.4", displayName: "GPT-5.4" }),
        model({
          id: "claude-sonnet-4-5",
          displayName: "Claude Sonnet 4.5",
          pool: "claude_code_local",
          provider: "claude_code_local",
          available: false,
        }),
      ]
    );

    expect(routes.find((route) => route.provider === "claudeAgent")).toMatchObject({
      backendId: "local-claude-code-cli",
      backendLabel: "Local Claude Code CLI",
      status: "blocked",
      authState: "unauthenticated",
      installed: true,
      modelId: "claude-sonnet-4-5",
      models: [
        expect.objectContaining({
          runtimeProvider: "claude_code_local",
          slug: "claude-sonnet-4-5",
        }),
      ],
    });
  });

  it("marks an available local Claude model-pool route as ready", () => {
    const routes = mapHugeCodeBackendPoolToT3ProviderRoutes(
      [backend({ backendId: "local-codex-a" })],
      [
        model({
          id: "claude-sonnet-4-5",
          displayName: "Claude Sonnet 4.5",
          pool: "claude_code_local",
          provider: "claude_code_local",
          available: true,
        }),
      ]
    );

    expect(routes.find((route) => route.provider === "claudeAgent")).toMatchObject({
      backendId: "local-claude-code-cli",
      status: "ready",
      authState: "authenticated",
      installed: true,
      summary: "Local Claude Code CLI is configured and ready for local execution.",
      reasons: ["local_claude_ready"],
    });
  });

  it("projects provider routes into the t3 server provider shape", () => {
    const routes = mapHugeCodeBackendPoolToT3ProviderRoutes(
      [backend({ backendId: "local-codex-a" })],
      [model({ id: "gpt-5.4", displayName: "GPT-5.4" })]
    );

    expect(mapT3ProviderRoutesToServerProviders(routes, "2026-01-01T00:00:00.000Z")).toEqual([
      expect.objectContaining({
        provider: "codex",
        displayName: "Codex",
        enabled: true,
        auth: { status: "authenticated" },
        checkedAt: "2026-01-01T00:00:00.000Z",
        models: [
          expect.objectContaining({
            slug: "gpt-5.4",
            name: "GPT-5.4",
            capabilities: {
              optionDescriptors: [
                expect.objectContaining({
                  id: "reasoningEffort",
                  label: "Reasoning",
                  type: "select",
                }),
              ],
            },
          }),
        ],
        slashCommands: [],
        skills: [],
      }),
    ]);
  });

  it("builds a t3 provider catalog for upstream picker integration", () => {
    const catalog = buildT3ProviderCatalog(
      [backend({ backendId: "local-codex-a" })],
      [model({ id: "gpt-5.4", displayName: "GPT-5.4" })],
      "2026-01-01T00:00:00.000Z"
    );

    expect(catalog.checkedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(catalog.routes).toHaveLength(1);
    expect(catalog.serverProviders).toEqual([
      expect.objectContaining({
        provider: "codex",
        models: [
          expect.objectContaining({
            slug: "gpt-5.4",
          }),
        ],
      }),
    ]);
    expect(catalog.modelOptionsByProvider.codex).toEqual([
      expect.objectContaining({
        slug: "gpt-5.4",
        name: "GPT-5.4",
      }),
    ]);
  });

  it("maps t3 server providers into upstream model picker options", () => {
    const routes = mapHugeCodeBackendPoolToT3ProviderRoutes(
      [
        backend({
          backendId: "local-claude",
          displayName: "Local Claude Code CLI",
          capabilities: ["claude", "code"],
        }),
      ],
      [
        model({
          id: "claude-sonnet-4.5",
          displayName: "Claude Sonnet 4.5",
          pool: "claude",
          provider: "anthropic",
        }),
      ]
    );

    expect(
      mapT3ServerProvidersToModelOptionsByProvider(
        mapT3ProviderRoutesToServerProviders(routes, "2026-01-01T00:00:00.000Z")
      )
    ).toMatchObject({
      claudeAgent: [
        {
          name: "Claude Sonnet 4.5",
          shortName: "Claude Sonnet 4.5",
          slug: "claude-sonnet-4.5",
          subProvider: "Anthropic",
        },
      ],
      codex: [],
    });
  });

  it("resolves explicit backend selection before provider default", () => {
    const routes = mapHugeCodeBackendPoolToT3ProviderRoutes([
      backend({ backendId: "local-codex-a" }),
    ]);

    expect(
      resolvePreferredBackendIdsForT3Selection(
        { provider: "codex", backendId: "local-codex-b" },
        routes
      )
    ).toEqual(["local-codex-b"]);
  });

  it("builds local Codex task start requests from t3 launches", () => {
    const routes = mapHugeCodeBackendPoolToT3ProviderRoutes([
      backend({ backendId: "local-codex-a" }),
    ]);

    const request = buildHugeCodeAgentTaskStartRequest(
      {
        workspaceId: "workspace-1",
        prompt: "Implement the task",
        selection: { provider: "codex" },
      },
      routes
    );

    expect(request.executionMode).toBe("single");
    expect(request.executionProfileId).toBe("runtime-default");
    expect(request.preferredBackendIds).toEqual(["local-codex-a"]);
    expect(request.provider).toBe("openai");
    expect(request.steps[0]?.input).toBe("Implement the task");
  });

  it("routes local Claude Code selections to the local CLI provider", () => {
    const routes = mapHugeCodeBackendPoolToT3ProviderRoutes(
      [
        backend({
          backendId: "local-claude-code-cli",
          displayName: "Local Claude Code CLI",
          capabilities: ["claude", "code"],
        }),
      ],
      [
        model({
          id: "claude-sonnet-4-5",
          displayName: "Claude Sonnet 4.5",
          pool: "claude_code_local",
          provider: "claude_code_local",
        }),
      ]
    );

    expect(
      resolveModelProviderForT3Selection(
        {
          provider: "claudeAgent",
          modelId: "claude-sonnet-4-5",
        },
        routes
      )
    ).toBe("claude_code_local");

    const request = buildHugeCodeAgentTaskStartRequest(
      {
        workspaceId: "workspace-1",
        prompt: "Use local Claude",
        selection: {
          provider: "claudeAgent",
          modelId: "claude-sonnet-4-5",
        },
      },
      routes
    );

    expect(request.provider).toBe("claude_code_local");
    expect(request.modelId).toBe("claude-sonnet-4-5");
    expect(request.preferredBackendIds).toEqual(["local-claude-code-cli"]);
  });

  it("keeps cloud Claude selections on Anthropic", () => {
    const routes = mapHugeCodeBackendPoolToT3ProviderRoutes(
      [
        backend({
          backendId: "cloud-anthropic",
          displayName: "Anthropic",
          capabilities: ["claude", "code"],
        }),
      ],
      [
        model({
          id: "claude-sonnet-4-5",
          displayName: "Claude Sonnet 4.5",
          pool: "claude",
          provider: "anthropic",
        }),
      ]
    );

    expect(
      resolveModelProviderForT3Selection(
        {
          provider: "claudeAgent",
          modelId: "claude-sonnet-4-5",
        },
        routes
      )
    ).toBe("anthropic");
  });

  it("normalizes HugeCode runtime events into t3 timeline events", () => {
    const event = mapHugeCodeRuntimeEventToT3TimelineEvent({
      kind: "item.agentMessage.delta",
      id: "event-1",
      payload: {
        delta: "hello",
        createdAt: 123,
      },
    });

    expect(event).toMatchObject({
      id: "item.agentMessage.delta:event-1",
      kind: "assistant.delta",
      body: "hello",
      createdAt: 123,
    });
  });

  it("drops runtime heartbeat update events from the visible t3 timeline", () => {
    expect(
      mapHugeCodeRuntimeEventToT3TimelineEvent({
        kind: "runtime.updated",
        payload: {
          updatedAt: Date.now(),
        },
      })
    ).toBeNull();
  });
});
