import { describe, expect, it } from "vitest";

import { resolveRuntimeToolExposurePolicy } from "./runtimeToolExposurePolicy";

describe("runtimeToolExposurePolicy", () => {
  it("returns a slim catalog for anthropic providers while preserving core runtime entrypoints", () => {
    const decision = resolveRuntimeToolExposurePolicy({
      provider: "anthropic",
      modelId: "claude-sonnet-4-5",
      toolNames: [
        "get-project-overview",
        "read-workspace-file",
        "search-workspace-files",
        "get-runtime-settings",
        "run-runtime-live-skill",
        "start-runtime-run",
      ],
      runtimeToolNames: [
        "read-workspace-file",
        "search-workspace-files",
        "get-runtime-settings",
        "run-runtime-live-skill",
        "start-runtime-run",
      ],
    });

    expect(decision.provider).toBe("anthropic");
    expect(decision.mode).toBe("slim");
    expect(decision.visibleToolNames).toEqual([
      "get-project-overview",
      "read-workspace-file",
      "search-workspace-files",
      "run-runtime-live-skill",
      "start-runtime-run",
    ]);
    expect(decision.hiddenToolNames).toEqual(["get-runtime-settings"]);
    expect(decision.reasonCodes).toContain("provider-prefers-slim-tool-catalog");
  });

  it("keeps the full catalog for openai providers", () => {
    const decision = resolveRuntimeToolExposurePolicy({
      provider: "openai",
      modelId: "gpt-5.4",
      toolNames: ["read-workspace-file", "get-runtime-settings"],
      runtimeToolNames: ["read-workspace-file", "get-runtime-settings"],
    });

    expect(decision.provider).toBe("openai");
    expect(decision.mode).toBe("full");
    expect(decision.visibleToolNames).toEqual(["read-workspace-file", "get-runtime-settings"]);
    expect(decision.hiddenToolNames).toEqual([]);
    expect(decision.reasonCodes).toContain("provider-keeps-full-tool-catalog");
  });
});
