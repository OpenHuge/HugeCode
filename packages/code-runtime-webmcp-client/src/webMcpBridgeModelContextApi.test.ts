import { afterEach, describe, expect, it } from "vitest";
import { buildCapabilityMatrix, listWebMcpCatalogAsync } from "./webMcpBridgeModelContextApi";

function setModelContext(modelContext: object | null): void {
  const currentNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: modelContext === null ? currentNavigator : { modelContext },
  });
}

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: undefined,
  });
});

describe("@ku0/code-runtime-webmcp-client model context API", () => {
  it("marks WebMCP supported when granular registration APIs are present", () => {
    const matrix = buildCapabilityMatrix({
      registerTool: () => ({ dispose: () => {} }),
      unregisterTool: () => {},
      listTools: async () => [],
      registerResource: () => ({ dispose: () => {} }),
      unregisterResource: () => {},
      listResources: async () => [],
      listResourceTemplates: async () => [],
      registerPrompt: () => ({ dispose: () => {} }),
      unregisterPrompt: () => {},
      listPrompts: async () => [],
    } as never);

    expect(matrix.supported).toBe(true);
    expect(matrix.missingRequired).toEqual([]);
    expect(matrix.tools.registerTool).toBe(true);
    expect(matrix.resources.registerResource).toBe(true);
    expect(matrix.prompts.registerPrompt).toBe(true);
  });

  it("lists registered catalog entries through the active model context", async () => {
    setModelContext({
      registerTool: () => ({ dispose: () => {} }),
      unregisterTool: () => {},
      listTools: async () => [{ name: "tool-a" }],
      registerResource: () => ({ dispose: () => {} }),
      unregisterResource: () => {},
      listResources: async () => [{ uri: "resource://a" }],
      listResourceTemplates: async () => [{ uriTemplate: "resource://{id}" }],
      registerPrompt: () => ({ dispose: () => {} }),
      unregisterPrompt: () => {},
      listPrompts: async () => [{ name: "prompt-a" }],
    });

    await expect(listWebMcpCatalogAsync()).resolves.toEqual({
      tools: [{ name: "tool-a" }],
      resources: [{ uri: "resource://a" }],
      resourceTemplates: [{ uriTemplate: "resource://{id}" }],
      prompts: [{ name: "prompt-a" }],
      capabilities: expect.objectContaining({
        supported: true,
        tools: expect.objectContaining({ listTools: true }),
        resources: expect.objectContaining({ listResources: true }),
        prompts: expect.objectContaining({ listPrompts: true }),
      }),
    });
  });
});
