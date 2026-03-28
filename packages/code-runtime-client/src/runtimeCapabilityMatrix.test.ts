import { describe, expect, it } from "vitest";

import {
  clampReasoningEffortToCapabilityMatrix,
  clampRuntimeModelCapabilityMatrixByProvider,
  normalizeRuntimeModelCapabilityMatrix,
  normalizeRuntimeProviderCapabilityMatrix,
} from "./runtimeCapabilityMatrix";

describe("runtimeCapabilityMatrix", () => {
  it("normalizes model capability matrices from legacy runtime fields", () => {
    const matrix = normalizeRuntimeModelCapabilityMatrix({
      supportsReasoning: true,
      supportsVision: true,
      reasoningEfforts: [" low ", "HIGH", "medium", "high"],
      capabilities: ["chat", "coding", "vision"],
    });

    expect(matrix).toEqual({
      supportsTools: "unknown",
      supportsReasoningEffort: "supported",
      supportsVision: "supported",
      supportsJsonSchema: "unknown",
      maxContextTokens: null,
      supportedReasoningEfforts: ["low", "high", "medium"],
    });
  });

  it("prefers explicit capability-matrix payloads and clamps unsupported reasoning effort", () => {
    const matrix = normalizeRuntimeModelCapabilityMatrix({
      supportsReasoning: true,
      reasoningEfforts: ["low", "medium", "high", "xhigh"],
      capability_matrix: {
        supports_reasoning_effort: "supported",
        supported_reasoning_efforts: ["medium", "high"],
        supports_tools: "supported",
        supports_vision: "unsupported",
        supports_json_schema: "supported",
        max_context_tokens: 128000,
      },
    });

    expect(matrix).toEqual({
      supportsTools: "supported",
      supportsReasoningEffort: "supported",
      supportsVision: "unsupported",
      supportsJsonSchema: "supported",
      maxContextTokens: 128000,
      supportedReasoningEfforts: ["medium", "high"],
    });
    expect(clampReasoningEffortToCapabilityMatrix("xhigh", matrix, "high")).toBe("high");
  });

  it("normalizes provider matrices without dropping unknown compatibility state", () => {
    const matrix = normalizeRuntimeProviderCapabilityMatrix({
      capabilityMatrix: {
        supportsTools: "supported",
        supportsReasoningEffort: "unknown",
        supportsVision: "supported",
        supportsJsonSchema: "unknown",
        maxContextTokens: null,
        supportedReasoningEfforts: ["low", "medium", "high"],
      },
    });

    expect(matrix).toEqual({
      supportsTools: "supported",
      supportsReasoningEffort: "unknown",
      supportsVision: "supported",
      supportsJsonSchema: "unknown",
      maxContextTokens: null,
      supportedReasoningEfforts: ["low", "medium", "high"],
    });
  });

  it("clamps model capability matrices by provider compatibility limits", () => {
    const matrix = clampRuntimeModelCapabilityMatrixByProvider(
      {
        capabilityMatrix: {
          supportsTools: "supported",
          supportsReasoningEffort: "supported",
          supportsVision: "supported",
          supportsJsonSchema: "supported",
          maxContextTokens: 200000,
          supportedReasoningEfforts: ["medium", "high"],
        },
      },
      {
        capabilityMatrix: {
          supportsTools: "unknown",
          supportsReasoningEffort: "unsupported",
          supportsVision: "unknown",
          supportsJsonSchema: "unknown",
          maxContextTokens: 64000,
          supportedReasoningEfforts: [],
        },
      }
    );

    expect(matrix).toEqual({
      supportsTools: "supported",
      supportsReasoningEffort: "unsupported",
      supportsVision: "supported",
      supportsJsonSchema: "supported",
      maxContextTokens: 64000,
      supportedReasoningEfforts: [],
    });
  });
});
