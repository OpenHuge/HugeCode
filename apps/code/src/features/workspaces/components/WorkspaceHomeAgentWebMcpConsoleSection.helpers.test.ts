import { describe, expect, it } from "vitest";
import { extractWebMcpExecutionContextAudit } from "../../../application/runtime/facades/runtimeOperatorTranscript";

describe("WorkspaceHomeAgentWebMcpConsoleSection.helpers context audit extraction", () => {
  it("prefers runtime provider diagnostics for caller context", () => {
    const result = extractWebMcpExecutionContextAudit(
      {
        provider: "anthropic",
        modelId: "claude-3-7-sonnet",
      },
      {
        data: {
          result: {
            metadata: {
              providerDiagnostics: {
                callerProvider: "openai",
                callerModelId: "gpt-5.3-codex",
                policySource: "caller_context",
              },
            },
          },
        },
      }
    );

    expect(result).toEqual({
      callerContext: {
        provider: "openai",
        modelId: "gpt-5.3-codex",
        policySource: "caller_context",
        source: "runtime_metadata",
      },
      agentMetadata: {
        provider: "anthropic",
        modelId: "claude-3-7-sonnet",
        source: "request_input",
      },
    });
  });

  it("falls back to request context for dry-run/error paths without runtime metadata", () => {
    const result = extractWebMcpExecutionContextAudit(
      {
        context: {
          provider: " google ",
          model_id: " gemini-2.5-pro ",
        },
      },
      null
    );

    expect(result).toEqual({
      callerContext: {
        provider: "google",
        modelId: "gemini-2.5-pro",
        policySource: null,
        source: "request_context",
      },
      agentMetadata: {
        provider: "google",
        modelId: "gemini-2.5-pro",
        source: "request_context",
      },
    });
  });

  it("returns unavailable context safely when provider/model are missing", () => {
    const result = extractWebMcpExecutionContextAudit(
      {
        query: "status",
      },
      {
        ok: true,
      }
    );

    expect(result).toEqual({
      callerContext: {
        provider: null,
        modelId: null,
        policySource: null,
        source: "unavailable",
      },
      agentMetadata: {
        provider: null,
        modelId: null,
        source: "unavailable",
      },
    });
  });
});
