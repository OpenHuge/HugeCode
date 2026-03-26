import { afterEach, describe, expect, it, vi } from "vitest";
import { getModelList } from "./tauriRuntimeCatalogBridge";

const { modelsMock, invokeWebRuntimeDirectRpcMock } = vi.hoisted(() => ({
  modelsMock: vi.fn(),
  invokeWebRuntimeDirectRpcMock: vi.fn(),
}));

vi.mock("./runtimeClient", () => ({
  getRuntimeClient: () => ({
    models: modelsMock,
  }),
}));

vi.mock("./runtimeWebDirectRpc", () => ({
  invokeWebRuntimeDirectRpc: invokeWebRuntimeDirectRpcMock,
}));

describe("tauriRuntimeCatalogBridge.getModelList", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    modelsMock.mockReset();
    invokeWebRuntimeDirectRpcMock.mockReset();
  });

  it("uses runtime client models when available", async () => {
    modelsMock.mockResolvedValueOnce([
      {
        id: "gpt-5.3-codex",
        displayName: "GPT-5.3 Codex",
        provider: "openai",
        pool: "codex",
        source: "local-codex",
        available: true,
        capabilities: ["chat", "coding"],
        reasoningEfforts: ["low", "medium"],
      },
    ]);

    const result = await getModelList("ws-1");
    const data = ((result.result as { data: unknown[] }).data as Array<Record<string, unknown>>)[0];
    expect(data).toMatchObject({
      id: "openai::gpt-5.3-codex",
      model: "gpt-5.3-codex",
      displayName: "GPT-5.3 Codex",
      provider: "openai",
      pool: "codex",
      source: "local-codex",
      available: true,
    });
    expect(invokeWebRuntimeDirectRpcMock).not.toHaveBeenCalled();
  });

  it("expands provider modelIds payloads into individual model entries", async () => {
    modelsMock.mockResolvedValueOnce([
      {
        id: "openai",
        displayName: "OpenAI Codex",
        provider: "openai",
        pool: "codex",
        source: "oauth-account",
        available: true,
        defaultModelId: "gpt-5.3-codex",
        modelIds: ["gpt-5.3-codex", "gpt-5.2-codex", "gpt-5.1-codex"],
        reasoningEfforts: ["low", "medium", "high"],
        capabilities: ["chat", "coding"],
      },
    ]);

    const result = await getModelList("ws-1");
    const data = (result.result as { data: Array<Record<string, unknown>> }).data;
    expect(data).toHaveLength(3);
    expect(data.map((entry) => entry.model)).toEqual([
      "gpt-5.3-codex",
      "gpt-5.2-codex",
      "gpt-5.1-codex",
    ]);
    expect(data.map((entry) => entry.id)).toEqual([
      "openai",
      "openai::gpt-5.2-codex",
      "openai::gpt-5.1-codex",
    ]);
    expect(data.map((entry) => entry.displayName)).toEqual([
      "GPT-5.3 Codex",
      "GPT-5.2 Codex",
      "GPT-5.1 Codex",
    ]);
  });

  it("falls back to direct web gateway rpc when runtime client models fail", async () => {
    modelsMock.mockRejectedValueOnce(new Error("Runtime RPC compatFieldAliases mismatch"));
    invokeWebRuntimeDirectRpcMock.mockResolvedValueOnce([
      {
        id: "gpt-5.3-codex",
        displayName: "GPT-5.3 Codex",
        provider: "openai",
        pool: "codex",
        source: "local-codex",
        available: true,
        capabilities: ["chat", "coding"],
        reasoningEfforts: ["low", "medium", "high"],
      },
    ]);

    const result = await getModelList("ws-1");
    const data = ((result.result as { data: unknown[] }).data as Array<Record<string, unknown>>)[0];
    expect(data).toMatchObject({
      id: "openai::gpt-5.3-codex",
      model: "gpt-5.3-codex",
      provider: "openai",
      available: true,
    });
    expect(invokeWebRuntimeDirectRpcMock).toHaveBeenCalledWith("code_models_pool", {});
  });

  it("derives distinct route ids when multiple providers expose the same model slug", async () => {
    modelsMock.mockResolvedValueOnce([
      {
        id: "gpt-5.3-codex",
        displayName: "GPT-5.3 Codex",
        provider: "openai",
        pool: "codex",
        source: "oauth-account",
        available: true,
      },
      {
        id: "gpt-5.3-codex",
        displayName: "GPT-5.3 Codex",
        provider: "google",
        pool: "gemini",
        source: "oauth-account",
        available: true,
      },
    ]);

    const result = await getModelList("ws-1");
    const data = (result.result as { data: Array<Record<string, unknown>> }).data;

    expect(data.map((entry) => entry.id)).toEqual([
      "openai::gpt-5.3-codex",
      "google::gpt-5.3-codex",
    ]);
  });

  it("rethrows runtime error when fallback endpoint is unavailable", async () => {
    const runtimeError = new Error("Runtime RPC compatFieldAliases mismatch");
    modelsMock.mockRejectedValueOnce(runtimeError);
    invokeWebRuntimeDirectRpcMock.mockRejectedValueOnce(new Error("endpoint unavailable"));

    await expect(getModelList("ws-1")).rejects.toBe(runtimeError);
  });
});
