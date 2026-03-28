// @vitest-environment jsdom
import { useEffect, useState } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getConfigModel, getModelList } from "../../../application/runtime/ports/tauriModels";
import { getProvidersCatalog } from "../../../application/runtime/ports/tauriOauth";
import {
  subscribeScopedRuntimeUpdatedEvents,
  type ScopedRuntimeUpdatedEventSnapshot,
  type RuntimeUpdatedEvent,
  useScopedRuntimeUpdatedEvent,
} from "../../../application/runtime/ports/runtimeUpdatedEvents";
import { createRuntimeUpdatedEventFixture } from "../../../test/runtimeUpdatedEventFixtures";
import type { WorkspaceInfo } from "../../../types";
import { useModels } from "./useModels";

vi.mock("../../../application/runtime/ports/tauriModels", () => ({
  getModelList: vi.fn(),
  getConfigModel: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/tauriOauth", () => ({
  getProvidersCatalog: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/runtimeUpdatedEvents", () => ({
  subscribeScopedRuntimeUpdatedEvents: vi.fn(),
  useScopedRuntimeUpdatedEvent: vi.fn(),
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "CodexMonitor",
  path: "/tmp/codex",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const secondaryWorkspace: WorkspaceInfo = {
  id: "workspace-2",
  name: "CodexMonitor Secondary",
  path: "/tmp/codex-secondary",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const disconnectedWorkspace: WorkspaceInfo = {
  id: "workspace-disconnected",
  name: "Disconnected Workspace",
  path: "/tmp/disconnected",
  connected: false,
  settings: { sidebarCollapsed: false },
};

const BOOTSTRAP_MODEL_SLUGS = [
  "gpt-5.4",
  "gpt-5.3-codex",
  "gpt-5.3-codex-spark",
  "gpt-5.2-codex",
  "gpt-5.2",
] as const;

describe("useModels", () => {
  const getProvidersCatalogMock = vi.mocked(getProvidersCatalog);
  let listener: ((event: RuntimeUpdatedEvent) => void) | null = null;
  let runtimeUpdatedRevisionCounter = 0;
  const EMPTY_RUNTIME_UPDATED_SNAPSHOT: ScopedRuntimeUpdatedEventSnapshot = {
    revision: 0,
    lastEvent: null,
  };

  beforeEach(() => {
    getProvidersCatalogMock.mockResolvedValue([]);
    listener = null;
    runtimeUpdatedRevisionCounter = 0;
    vi.mocked(subscribeScopedRuntimeUpdatedEvents).mockImplementation((_options, cb) => {
      listener = cb;
      return () => undefined;
    });
    vi.mocked(useScopedRuntimeUpdatedEvent).mockImplementation(() => {
      const [snapshot, setSnapshot] = useState<ScopedRuntimeUpdatedEventSnapshot>(
        EMPTY_RUNTIME_UPDATED_SNAPSHOT
      );

      useEffect(() => {
        const currentListener = (event: RuntimeUpdatedEvent) => {
          runtimeUpdatedRevisionCounter += 1;
          setSnapshot({
            revision: runtimeUpdatedRevisionCounter,
            lastEvent: event,
          });
        };
        listener = currentListener;
        return () => {
          if (listener === currentListener) {
            listener = null;
          }
        };
      }, []);

      return snapshot;
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("shows bootstrap composer models before async account model refresh completes", async () => {
    vi.mocked(getModelList).mockReturnValueOnce(new Promise(() => undefined));
    vi.mocked(getConfigModel).mockResolvedValue(null);

    const { result } = renderHook(() => useModels({ activeWorkspace: null }));

    expect(result.current.models.map((model) => model.model)).toEqual(BOOTSTRAP_MODEL_SLUGS);
  });

  it("keeps newer runtime models and sorts preferred composer models first", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "openai::gpt-5.4",
            model: "gpt-5.4",
            displayName: "GPT-5.4",
            available: true,
            supportedReasoningEfforts: [{ reasoningEffort: "high", description: "High" }],
            defaultReasoningEffort: "high",
            isDefault: true,
          },
          {
            id: "openai",
            model: "gpt-5.3-codex",
            displayName: "GPT-5.3 Codex",
            available: true,
            supportedReasoningEfforts: [{ reasoningEffort: "low", description: "Low" }],
            defaultReasoningEffort: "low",
            isDefault: false,
          },
          {
            id: "openai::gpt-5.3-codex-spark",
            model: "gpt-5.3-codex-spark",
            displayName: "GPT-5.3 Codex Spark",
            available: true,
            supportedReasoningEfforts: [{ reasoningEffort: "medium", description: "Medium" }],
            defaultReasoningEffort: "medium",
            isDefault: false,
          },
          {
            id: "openai::gpt-5.2",
            model: "gpt-5.2",
            displayName: "GPT-5.2",
            available: true,
            supportedReasoningEfforts: [{ reasoningEffort: "medium", description: "Medium" }],
            defaultReasoningEffort: "medium",
            isDefault: false,
          },
          {
            id: "openai::gpt-4.1-mini",
            model: "gpt-4.1-mini",
            displayName: "GPT-4.1 Mini",
            available: true,
            supportedReasoningEfforts: [],
            defaultReasoningEffort: null,
            isDefault: false,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce(null);

    const { result } = renderHook(() => useModels({ activeWorkspace: null }));

    await waitFor(() =>
      expect(result.current.models.map((model) => model.model)).toEqual([
        "gpt-5.4",
        "gpt-5.3-codex",
        "gpt-5.3-codex-spark",
        "gpt-5.2",
        "gpt-4.1-mini",
      ])
    );
    expect(result.current.models.map((model) => model.displayName)).toEqual([
      "GPT-5.4",
      "GPT-5.3 Codex",
      "GPT-5.3 Codex Spark",
      "GPT-5.2",
      "GPT-4.1 Mini",
    ]);
  });

  it("preserves distinct runtime selector options when multiple routes expose the same model slug", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "openai-primary",
            model: "gpt-5.3-codex",
            displayName: "GPT-5.3 Codex",
            provider: "openai",
            pool: "codex-primary",
            source: "oauth-account",
            available: true,
            supportedReasoningEfforts: [{ reasoningEffort: "high", description: "High" }],
            defaultReasoningEffort: "high",
            isDefault: true,
          },
          {
            id: "openai-secondary",
            model: "gpt-5.3-codex",
            displayName: "GPT-5.3 Codex",
            provider: "openai",
            pool: "codex-secondary",
            source: "oauth-account",
            available: true,
            supportedReasoningEfforts: [{ reasoningEffort: "medium", description: "Medium" }],
            defaultReasoningEffort: "medium",
            isDefault: false,
          },
          {
            id: "openai-spark",
            model: "gpt-5.3-codex-spark",
            displayName: "GPT-5.3 Codex Spark",
            provider: "openai",
            pool: "codex-primary",
            source: "oauth-account",
            available: true,
            supportedReasoningEfforts: [{ reasoningEffort: "medium", description: "Medium" }],
            defaultReasoningEffort: "medium",
            isDefault: false,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce(null);

    const { result } = renderHook(() => useModels({ activeWorkspace: null }));

    await waitFor(() =>
      expect(result.current.models.map((model) => model.id)).toEqual([
        "openai-primary",
        "openai-secondary",
        "openai-spark",
      ])
    );
    expect(result.current.selectedModelId).toBe("openai-primary");
  });

  it("adds an antigravity-branded selector option for gemini-backed models", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "google::gemini-3.1-pro",
            model: "gemini-3.1-pro",
            displayName: "Gemini 3.1 Pro",
            provider: "google",
            pool: "gemini",
            source: "oauth-account",
            available: true,
            supportedReasoningEfforts: [{ reasoningEffort: "high", description: "High" }],
            defaultReasoningEffort: "high",
            isDefault: true,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce(null);

    const { result } = renderHook(() => useModels({ activeWorkspace: null }));

    await waitFor(() =>
      expect(result.current.models.map((model) => model.id)).toEqual([
        "google::gemini-3.1-pro",
        "google::gemini-3.1-pro::brand:antigravity",
      ])
    );
    expect(result.current.models.map((model) => model.displayName)).toEqual([
      "Gemini 3.1 Pro",
      "Antigravity 3.1 Pro",
    ]);
    expect(result.current.selectedModelId).toBe("google::gemini-3.1-pro");
  });

  it("does not add a workspace-only config model when it is missing from model/list", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "remote-1",
            model: "gpt-5.1",
            displayName: "GPT-5.1",
            supportedReasoningEfforts: [],
            defaultReasoningEffort: null,
            isDefault: true,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce("custom-model");

    const { result } = renderHook(() => useModels({ activeWorkspace: workspace }));

    await waitFor(() =>
      expect(result.current.models.map((model) => model.id)).toEqual(["remote-1"])
    );

    expect(getConfigModel).toHaveBeenCalledWith("workspace-1");
    expect(result.current.selectedModel?.id).toBe("remote-1");
    expect(result.current.reasoningSupported).toBe(false);
  });

  it("prefers the provider entry when the config model matches by slug", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "provider-id",
            model: "custom-model",
            displayName: "Provider Custom",
            supportedReasoningEfforts: [
              { reasoningEffort: "medium", description: "Medium" },
              { reasoningEffort: "high", description: "High" },
            ],
            defaultReasoningEffort: "medium",
            isDefault: false,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce("custom-model");

    const { result } = renderHook(() => useModels({ activeWorkspace: workspace }));

    await waitFor(() => expect(result.current.selectedModelId).toBe("provider-id"));

    expect(result.current.models).toHaveLength(1);
    expect(result.current.selectedModel?.id).toBe("provider-id");
    expect(result.current.reasoningSupported).toBe(true);
  });

  it("falls back to an available model when the default model is unavailable", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "unavailable-default",
            model: "gpt-5.3-codex",
            displayName: "GPT-5.3 Codex",
            available: false,
            supportedReasoningEfforts: [{ reasoningEffort: "low", description: "Low" }],
            defaultReasoningEffort: "low",
            isDefault: true,
          },
          {
            id: "available-fallback",
            model: "gpt-5.2-codex",
            displayName: "gpt-5.2-codex",
            available: true,
            supportedReasoningEfforts: [{ reasoningEffort: "medium", description: "Medium" }],
            defaultReasoningEffort: "medium",
            isDefault: false,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce(null);

    const { result } = renderHook(() => useModels({ activeWorkspace: workspace }));

    await waitFor(() => expect(result.current.selectedModelId).toBe("available-fallback"));
    expect(result.current.selectedModel?.available).toBe(true);
  });

  it("auto-selects a healthy fallback family when the preferred provider family is unavailable", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "openai::gpt-5.4",
            model: "gpt-5.4",
            displayName: "GPT-5.4",
            provider: "openai",
            pool: "codex",
            available: true,
            supportedReasoningEfforts: [{ reasoningEffort: "high", description: "High" }],
            defaultReasoningEffort: "high",
            isDefault: true,
          },
          {
            id: "anthropic::claude-sonnet-4-5",
            model: "claude-sonnet-4-5",
            displayName: "Claude Sonnet 4.5",
            provider: "anthropic",
            pool: "claude",
            available: true,
            supportedReasoningEfforts: [{ reasoningEffort: "high", description: "High" }],
            defaultReasoningEffort: "high",
            isDefault: false,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce(null);
    getProvidersCatalogMock.mockResolvedValueOnce([
      {
        providerId: "anthropic",
        displayName: "Claude Code",
        pool: "claude",
        oauthProviderId: "claude_code",
        aliases: ["claude", "claude_code"],
        defaultModelId: "anthropic::claude-sonnet-4-5",
        available: false,
        supportsNative: true,
        supportsOpenaiCompat: true,
        readinessKind: "not_authenticated",
        readinessMessage: "Sign in to Claude Code to use this route.",
        executionKind: "cloud",
        registryVersion: "test",
      },
      {
        providerId: "openai",
        displayName: "Codex",
        pool: "codex",
        oauthProviderId: "codex",
        aliases: ["openai", "codex"],
        defaultModelId: "openai::gpt-5.4",
        available: true,
        supportsNative: true,
        supportsOpenaiCompat: true,
        readinessKind: "ready",
        readinessMessage: null,
        executionKind: "cloud",
        registryVersion: "test",
      },
    ]);

    const { result } = renderHook(() =>
      useModels({
        activeWorkspace: workspace,
        preferredProviderId: "claude",
        selectionMode: "auto",
      })
    );

    await waitFor(() => expect(result.current.selectedModelId).toBe("openai::gpt-5.4"));
    expect(result.current.selectedModel?.provider).toBe("openai");
  });

  it("suppresses reasoning options when provider compatibility marks reasoning unsupported", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "openai::gpt-5.4",
            model: "gpt-5.4",
            displayName: "GPT-5.4",
            provider: "openai",
            pool: "codex",
            available: true,
            supportedReasoningEfforts: [{ reasoningEffort: "high", description: "High" }],
            defaultReasoningEffort: "high",
            isDefault: true,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce(null);
    getProvidersCatalogMock.mockResolvedValueOnce([
      {
        providerId: "openai",
        displayName: "Codex",
        pool: "codex",
        oauthProviderId: "codex",
        aliases: ["openai", "codex"],
        defaultModelId: "openai::gpt-5.4",
        available: true,
        supportsNative: true,
        supportsOpenaiCompat: true,
        readinessKind: "ready",
        readinessMessage: null,
        executionKind: "cloud",
        registryVersion: "test",
        capabilityMatrix: {
          supportsTools: "supported",
          supportsReasoningEffort: "unsupported",
          supportsVision: "supported",
          supportsJsonSchema: "unknown",
          maxContextTokens: 128000,
          supportedReasoningEfforts: [],
        },
      },
    ]);

    const { result } = renderHook(() => useModels({ activeWorkspace: workspace }));

    await waitFor(() => expect(result.current.selectedModelId).toBe("openai::gpt-5.4"));
    expect(result.current.reasoningSupported).toBe(false);
    expect(result.current.reasoningOptions).toEqual([]);
    expect(result.current.selectedEffort).toBeNull();
  });

  it("avoids auto-selecting providers whose models explicitly do not support tools", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "openai::gpt-5.4",
            model: "gpt-5.4",
            displayName: "GPT-5.4",
            provider: "openai",
            pool: "codex",
            available: true,
            supportedReasoningEfforts: [{ reasoningEffort: "high", description: "High" }],
            defaultReasoningEffort: "high",
            isDefault: true,
          },
          {
            id: "anthropic::claude-sonnet-4-5",
            model: "claude-sonnet-4-5",
            displayName: "Claude Sonnet 4.5",
            provider: "anthropic",
            pool: "claude",
            available: true,
            supportedReasoningEfforts: [{ reasoningEffort: "high", description: "High" }],
            defaultReasoningEffort: "high",
            isDefault: false,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce(null);
    getProvidersCatalogMock.mockResolvedValueOnce([
      {
        providerId: "openai",
        displayName: "Codex",
        pool: "codex",
        oauthProviderId: "codex",
        aliases: ["openai", "codex"],
        defaultModelId: "openai::gpt-5.4",
        available: true,
        supportsNative: true,
        supportsOpenaiCompat: true,
        readinessKind: "ready",
        readinessMessage: null,
        executionKind: "cloud",
        registryVersion: "test",
        capabilityMatrix: {
          supportsTools: "unsupported",
          supportsReasoningEffort: "supported",
          supportsVision: "supported",
          supportsJsonSchema: "unknown",
          maxContextTokens: 128000,
          supportedReasoningEfforts: ["high"],
        },
      },
      {
        providerId: "anthropic",
        displayName: "Claude Code",
        pool: "claude",
        oauthProviderId: "claude_code",
        aliases: ["claude", "claude_code"],
        defaultModelId: "anthropic::claude-sonnet-4-5",
        available: true,
        supportsNative: true,
        supportsOpenaiCompat: true,
        readinessKind: "ready",
        readinessMessage: null,
        executionKind: "cloud",
        registryVersion: "test",
        capabilityMatrix: {
          supportsTools: "supported",
          supportsReasoningEffort: "supported",
          supportsVision: "supported",
          supportsJsonSchema: "unknown",
          maxContextTokens: 128000,
          supportedReasoningEfforts: ["high"],
        },
      },
    ]);

    const { result } = renderHook(() =>
      useModels({
        activeWorkspace: workspace,
        selectionMode: "auto",
      })
    );

    await waitFor(() =>
      expect(result.current.selectedModelId).toBe("anthropic::claude-sonnet-4-5")
    );
    expect(result.current.selectedModel?.provider).toBe("anthropic");
  });

  it("avoids auto-selecting providers whose models explicitly do not support vision", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "openai::gpt-5.4",
            model: "gpt-5.4",
            displayName: "GPT-5.4",
            provider: "openai",
            pool: "codex",
            available: true,
            supportedReasoningEfforts: [{ reasoningEffort: "high", description: "High" }],
            defaultReasoningEffort: "high",
            isDefault: true,
          },
          {
            id: "anthropic::claude-sonnet-4-5",
            model: "claude-sonnet-4-5",
            displayName: "Claude Sonnet 4.5",
            provider: "anthropic",
            pool: "claude",
            available: true,
            supportedReasoningEfforts: [{ reasoningEffort: "high", description: "High" }],
            defaultReasoningEffort: "high",
            isDefault: false,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce(null);
    getProvidersCatalogMock.mockResolvedValueOnce([
      {
        providerId: "openai",
        displayName: "Codex",
        pool: "codex",
        oauthProviderId: "codex",
        aliases: ["openai", "codex"],
        defaultModelId: "openai::gpt-5.4",
        available: true,
        supportsNative: true,
        supportsOpenaiCompat: true,
        readinessKind: "ready",
        readinessMessage: null,
        executionKind: "cloud",
        registryVersion: "test",
        capabilityMatrix: {
          supportsTools: "supported",
          supportsReasoningEffort: "supported",
          supportsVision: "unsupported",
          supportsJsonSchema: "unknown",
          maxContextTokens: 128000,
          supportedReasoningEfforts: ["high"],
        },
      },
      {
        providerId: "anthropic",
        displayName: "Claude Code",
        pool: "claude",
        oauthProviderId: "claude_code",
        aliases: ["claude", "claude_code"],
        defaultModelId: "anthropic::claude-sonnet-4-5",
        available: true,
        supportsNative: true,
        supportsOpenaiCompat: true,
        readinessKind: "ready",
        readinessMessage: null,
        executionKind: "cloud",
        registryVersion: "test",
        capabilityMatrix: {
          supportsTools: "supported",
          supportsReasoningEffort: "supported",
          supportsVision: "supported",
          supportsJsonSchema: "unknown",
          maxContextTokens: 200000,
          supportedReasoningEfforts: ["high"],
        },
      },
    ]);

    const { result } = renderHook(() =>
      useModels({
        activeWorkspace: workspace,
        selectionMode: "auto",
      })
    );

    await waitFor(() =>
      expect(result.current.selectedModelId).toBe("anthropic::claude-sonnet-4-5")
    );
    expect(result.current.selectedModel?.provider).toBe("anthropic");
  });

  it("overrides the preferred provider in auto mode when the current task requires vision", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "openai::gpt-5.4",
            model: "gpt-5.4",
            displayName: "GPT-5.4",
            provider: "openai",
            pool: "codex",
            available: true,
            supportedReasoningEfforts: [{ reasoningEffort: "high", description: "High" }],
            defaultReasoningEffort: "high",
            isDefault: true,
          },
          {
            id: "anthropic::claude-sonnet-4-5",
            model: "claude-sonnet-4-5",
            displayName: "Claude Sonnet 4.5",
            provider: "anthropic",
            pool: "claude",
            available: true,
            supportedReasoningEfforts: [{ reasoningEffort: "high", description: "High" }],
            defaultReasoningEffort: "high",
            isDefault: false,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce(null);
    getProvidersCatalogMock.mockResolvedValueOnce([
      {
        providerId: "openai",
        displayName: "Codex",
        pool: "codex",
        oauthProviderId: "codex",
        aliases: ["openai", "codex"],
        defaultModelId: "openai::gpt-5.4",
        available: true,
        supportsNative: true,
        supportsOpenaiCompat: true,
        readinessKind: "ready",
        readinessMessage: null,
        executionKind: "cloud",
        registryVersion: "test",
        capabilityMatrix: {
          supportsTools: "supported",
          supportsReasoningEffort: "supported",
          supportsVision: "unsupported",
          supportsJsonSchema: "unknown",
          maxContextTokens: 128000,
          supportedReasoningEfforts: ["high"],
        },
      },
      {
        providerId: "anthropic",
        displayName: "Claude Code",
        pool: "claude",
        oauthProviderId: "claude_code",
        aliases: ["claude", "claude_code"],
        defaultModelId: "anthropic::claude-sonnet-4-5",
        available: true,
        supportsNative: true,
        supportsOpenaiCompat: true,
        readinessKind: "ready",
        readinessMessage: null,
        executionKind: "cloud",
        registryVersion: "test",
        capabilityMatrix: {
          supportsTools: "supported",
          supportsReasoningEffort: "supported",
          supportsVision: "supported",
          supportsJsonSchema: "unknown",
          maxContextTokens: 200000,
          supportedReasoningEfforts: ["high"],
        },
      },
    ]);

    const { result } = renderHook(() =>
      useModels({
        activeWorkspace: workspace,
        selectionMode: "auto",
        preferredProviderId: "codex",
        autoSelectionRequirements: {
          requiresVision: true,
        },
      })
    );

    await waitFor(() =>
      expect(result.current.selectedModelId).toBe("anthropic::claude-sonnet-4-5")
    );
    expect(result.current.selectedModel?.provider).toBe("anthropic");
  });

  it("keeps the selected reasoning effort when switching models", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "remote-1",
            model: "gpt-5.1",
            displayName: "GPT-5.1",
            supportedReasoningEfforts: [
              { reasoningEffort: "low", description: "Low" },
              { reasoningEffort: "medium", description: "Medium" },
            ],
            defaultReasoningEffort: "medium",
            isDefault: true,
          },
          {
            id: "remote-2",
            model: "gpt-5.2-codex",
            displayName: "GPT-5.2 Codex",
            supportedReasoningEfforts: [
              { reasoningEffort: "medium", description: "Medium" },
              { reasoningEffort: "high", description: "High" },
            ],
            defaultReasoningEffort: "medium",
            isDefault: false,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce(null);

    const { result } = renderHook(() => useModels({ activeWorkspace: workspace }));

    await waitFor(() =>
      expect(result.current.models.map((model) => model.id)).toEqual(["remote-2", "remote-1"])
    );

    act(() => {
      result.current.setSelectedEffort("high");
      result.current.setSelectedModelId("remote-2");
    });

    await waitFor(() => {
      expect(result.current.selectedModelId).toBe("remote-2");
      expect(result.current.selectedEffort).toBe("high");
    });
  });

  it("clamps the selected reasoning effort when the next model does not support it", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "remote-openai",
            model: "gpt-5.4",
            displayName: "GPT-5.4",
            supportedReasoningEfforts: [
              { reasoningEffort: "medium", description: "Medium" },
              { reasoningEffort: "high", description: "High" },
              { reasoningEffort: "xhigh", description: "Extra High" },
            ],
            defaultReasoningEffort: "high",
            isDefault: true,
          },
          {
            id: "remote-anthropic",
            model: "claude-sonnet-4-5",
            displayName: "Claude Sonnet 4.5",
            supportedReasoningEfforts: [
              { reasoningEffort: "medium", description: "Medium" },
              { reasoningEffort: "high", description: "High" },
            ],
            defaultReasoningEffort: "medium",
            isDefault: false,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce(null);

    const { result } = renderHook(() => useModels({ activeWorkspace: workspace }));

    await waitFor(() =>
      expect(result.current.models.map((model) => model.id)).toEqual([
        "remote-openai",
        "remote-anthropic",
      ])
    );

    act(() => {
      result.current.setSelectedModelId("remote-openai");
      result.current.setSelectedEffort("xhigh");
    });

    await waitFor(() => {
      expect(result.current.selectedModelId).toBe("remote-openai");
      expect(result.current.selectedEffort).toBe("xhigh");
    });

    act(() => {
      result.current.setSelectedModelId("remote-anthropic");
    });

    await waitFor(() => {
      expect(result.current.selectedModelId).toBe("remote-anthropic");
      expect(result.current.selectedEffort).toBe("medium");
    });
  });

  it("restores the user's reasoning preference after switching through a non-reasoning model", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "remote-openai",
            model: "gpt-5.4",
            displayName: "GPT-5.4",
            supportedReasoningEfforts: [
              { reasoningEffort: "medium", description: "Medium" },
              { reasoningEffort: "high", description: "High" },
              { reasoningEffort: "xhigh", description: "Extra High" },
            ],
            defaultReasoningEffort: "high",
            isDefault: true,
          },
          {
            id: "remote-gemini",
            model: "gemini-2.5-pro",
            displayName: "Gemini 2.5 Pro",
            supportedReasoningEfforts: [],
            defaultReasoningEffort: null,
            capabilityMatrix: {
              supportsReasoningEffort: "unsupported",
              supportedReasoningEfforts: [],
            },
            isDefault: false,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce(null);

    const { result } = renderHook(() => useModels({ activeWorkspace: workspace }));

    await waitFor(() =>
      expect(result.current.models.map((model) => model.id)).toEqual([
        "remote-openai",
        "remote-gemini",
      ])
    );

    act(() => {
      result.current.setSelectedModelId("remote-openai");
      result.current.setSelectedEffort("xhigh");
    });

    await waitFor(() => {
      expect(result.current.selectedModelId).toBe("remote-openai");
      expect(result.current.selectedEffort).toBe("xhigh");
    });

    act(() => {
      result.current.setSelectedModelId("remote-gemini");
    });

    await waitFor(() => {
      expect(result.current.selectedModelId).toBe("remote-gemini");
      expect(result.current.reasoningSupported).toBe(false);
      expect(result.current.selectedEffort).toBeNull();
    });

    act(() => {
      result.current.setSelectedModelId("remote-openai");
    });

    await waitFor(() => {
      expect(result.current.selectedModelId).toBe("remote-openai");
      expect(result.current.selectedEffort).toBe("xhigh");
    });
  });

  it("ignores stale model responses after switching workspaces during in-flight fetch", async () => {
    let resolveFirstModels: (value: { result: { data: Array<Record<string, unknown>> } }) => void;
    let resolveSecondModels: (value: { result: { data: Array<Record<string, unknown>> } }) => void;
    let resolveFirstConfig: (value: string | null) => void;
    let resolveSecondConfig: (value: string | null) => void;

    const firstModelsPromise = new Promise<{ result: { data: Array<Record<string, unknown>> } }>(
      (resolve) => {
        resolveFirstModels = resolve;
      }
    );
    const secondModelsPromise = new Promise<{ result: { data: Array<Record<string, unknown>> } }>(
      (resolve) => {
        resolveSecondModels = resolve;
      }
    );
    const firstConfigPromise = new Promise<string | null>((resolve) => {
      resolveFirstConfig = resolve;
    });
    const secondConfigPromise = new Promise<string | null>((resolve) => {
      resolveSecondConfig = resolve;
    });

    vi.mocked(getModelList)
      .mockReturnValueOnce(firstModelsPromise)
      .mockReturnValueOnce(secondModelsPromise);
    vi.mocked(getConfigModel)
      .mockReturnValueOnce(firstConfigPromise)
      .mockReturnValueOnce(secondConfigPromise);

    const { result, rerender } = renderHook(
      ({ active }: { active: WorkspaceInfo | null }) => useModels({ activeWorkspace: active }),
      { initialProps: { active: workspace } }
    );

    rerender({ active: secondaryWorkspace });

    await waitFor(() => {
      expect(getModelList).toHaveBeenCalledWith("workspace-1");
      expect(getConfigModel).toHaveBeenCalledWith("workspace-1");
    });

    await act(async () => {
      resolveFirstModels({
        result: {
          data: [
            {
              id: "workspace-1-model",
              model: "workspace-1-model",
              displayName: "Workspace 1 Model",
              supportedReasoningEfforts: [],
              defaultReasoningEffort: null,
              isDefault: true,
            },
          ],
        },
      });
      resolveFirstConfig(null);
      await Promise.resolve();
    });

    expect(result.current.models.map((model) => model.model)).toEqual(BOOTSTRAP_MODEL_SLUGS);

    await waitFor(() => {
      expect(getModelList).toHaveBeenCalledWith("workspace-2");
      expect(getConfigModel).toHaveBeenCalledWith("workspace-2");
    });

    await act(async () => {
      resolveSecondModels({
        result: {
          data: [
            {
              id: "workspace-2-model",
              model: "workspace-2-model",
              displayName: "Workspace 2 Model",
              supportedReasoningEfforts: [],
              defaultReasoningEffort: null,
              isDefault: true,
            },
          ],
        },
      });
      resolveSecondConfig(null);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.models.map((model) => model.id)).toEqual(["workspace-2-model"]);
      expect(result.current.selectedModel?.id).toBe("workspace-2-model");
    });
  });

  it("refreshes models on runtime/updated models scope even when workspace is workspace-local", async () => {
    vi.mocked(getModelList)
      .mockResolvedValueOnce({
        result: {
          data: [
            {
              id: "before-model",
              model: "before-model",
              displayName: "Before Model",
              supportedReasoningEfforts: [],
              defaultReasoningEffort: null,
              isDefault: true,
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        result: {
          data: [
            {
              id: "after-model",
              model: "after-model",
              displayName: "After Model",
              supportedReasoningEfforts: [],
              defaultReasoningEffort: null,
              isDefault: true,
            },
          ],
        },
      });
    vi.mocked(getConfigModel).mockResolvedValue(null);

    const { result } = renderHook(() => useModels({ activeWorkspace: workspace }));

    await waitFor(() => {
      expect(result.current.models.map((model) => model.id)).toEqual(["before-model"]);
      expect(getModelList).toHaveBeenCalledTimes(1);
    });

    act(() => {
      listener?.(
        createRuntimeUpdatedEventFixture({
          revision: "46",
          scope: ["models", "oauth"],
          reason: "event_stream_lagged",
        })
      );
    });

    await waitFor(() => {
      expect(getModelList).toHaveBeenCalledTimes(2);
      expect(result.current.models.map((model) => model.id)).toEqual(["after-model"]);
    });
  });

  it("loads runtime models on home before a workspace is selected", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "home-model",
            model: "gpt-5.3-codex",
            displayName: "GPT-5.3 Codex",
            supportedReasoningEfforts: [{ reasoningEffort: "low", description: "Low" }],
            defaultReasoningEffort: "low",
            isDefault: true,
          },
        ],
      },
    });

    const { result } = renderHook(() => useModels({ activeWorkspace: null }));

    await waitFor(() =>
      expect(result.current.models.map((model) => model.id)).toEqual(["home-model"])
    );
    expect(getModelList).toHaveBeenCalledWith("__global__");
    expect(getConfigModel).not.toHaveBeenCalled();
    expect(result.current.selectedModelId).toBe("home-model");
  });

  it("loads models even when the selected workspace is disconnected", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "disconnected-model",
            model: "gpt-5.3-codex",
            displayName: "GPT-5.3 Codex",
            supportedReasoningEfforts: [],
            defaultReasoningEffort: null,
            isDefault: true,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce(null);

    const { result } = renderHook(() => useModels({ activeWorkspace: disconnectedWorkspace }));

    await waitFor(() =>
      expect(result.current.models.map((model) => model.id)).toEqual(["disconnected-model"])
    );
    expect(getModelList).toHaveBeenCalledWith("workspace-disconnected");
    expect(getConfigModel).toHaveBeenCalledWith("workspace-disconnected");
  });

  it("retries model loading after an initial startup failure", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(getModelList)
        .mockRejectedValueOnce(new Error("runtime not ready"))
        .mockResolvedValueOnce({
          result: {
            data: [
              {
                id: "recovered-model",
                model: "gpt-5.3-codex",
                displayName: "GPT-5.3 Codex",
                supportedReasoningEfforts: [{ reasoningEffort: "low", description: "Low" }],
                defaultReasoningEffort: "low",
                isDefault: true,
              },
            ],
          },
        });
      vi.mocked(getConfigModel).mockResolvedValue(null);

      const { result } = renderHook(() => useModels({ activeWorkspace: null }));

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(getModelList).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(650);
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(getModelList).toHaveBeenCalledTimes(2);
      expect(result.current.models.map((model) => model.id)).toEqual(["recovered-model"]);
    } finally {
      vi.useRealTimers();
    }
  });
});
