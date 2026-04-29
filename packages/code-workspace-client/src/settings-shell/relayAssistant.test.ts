import { describe, expect, it } from "vitest";
import { buildRelayAssistantGeneratedConfig, createRelayAssistantDraft } from "./relayAssistant";

describe("relayAssistant", () => {
  it("normalizes New API into runtime provider-extension exports", () => {
    const draft = createRelayAssistantDraft("new-api");
    const generated = buildRelayAssistantGeneratedConfig({
      ...draft,
      baseUrl: "https://relay.example.com/",
      tokenEnvKey: "code runtime service relay key",
    });

    expect(generated.diagnostics).toEqual([]);
    expect(generated.providerExtension).toMatchObject({
      providerId: "relay_new_api",
      compatBaseUrl: "https://relay.example.com/v1",
      apiKeyEnv: "CODE_RUNTIME_SERVICE_RELAY_KEY",
    });
    expect(generated.providerExtensionsJson).toContain('"providerId":"relay_new_api"');
    expect(generated.codexConfigToml).toContain('model_provider = "relay_new_api"');
    expect(generated.codexConfigToml).toContain('wire_api = "responses"');
    expect(generated.shellExports).toContain("CODE_RUNTIME_SERVICE_PROVIDER_EXTENSIONS_JSON=");
    expect(generated.shellExports).toContain("export CODE_RUNTIME_SERVICE_RELAY_KEY=");
    expect(generated.qualityPlugin).toMatchObject({
      pluginId: "relay_new_api_relay_quality",
      capabilities: expect.arrayContaining(["relay.quality.responses"]),
    });
    expect(generated.qualityPlugin.manifestJson).toContain('"kind": "relay-quality"');
    expect(generated.qualityProbeScript).toContain("BASE_URL='https://relay.example.com/v1'");
    expect(generated.qualityProbeScript).toContain("$BASE_URL/models");
    expect(generated.qualityProbeScript).toContain("${CODE_RUNTIME_SERVICE_RELAY_KEY:-}");
    expect(generated.qualityProbeScript).toContain("$BASE_URL/responses");
  });

  it("keeps nonstandard paths visible as diagnostics instead of silently rewriting them", () => {
    const generated = buildRelayAssistantGeneratedConfig({
      ...createRelayAssistantDraft("sub2api"),
      baseUrl: "https://sub2api.example.com/openai",
    });

    expect(generated.providerExtension.compatBaseUrl).toBe("https://sub2api.example.com/openai");
    expect(generated.diagnostics).toContain(
      "Confirm the relay's OpenAI-compatible base path; most deployments use /v1."
    );
  });

  it("reports missing required local setup fields", () => {
    const generated = buildRelayAssistantGeneratedConfig({
      ...createRelayAssistantDraft("one-api"),
      baseUrl: "",
      providerId: "",
      defaultModelId: "",
      tokenEnvKey: "",
    });

    expect(generated.diagnostics).toContain("Gateway base URL is required.");
    expect(generated.diagnostics).toContain("Provider id is required.");
    expect(generated.diagnostics).toContain("Default model id is required.");
    expect(generated.diagnostics).toContain("Token environment variable is required.");
  });
});
