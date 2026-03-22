import { describe, expect, it } from "vitest";
import {
  appendRuntimeOperatorTranscriptItem,
  buildRuntimeOperatorTranscriptAuditSnapshot,
  extractWebMcpExecutionContextAudit,
  hydrateRuntimeOperatorTranscriptItem,
  normalizeWebMcpConsoleTranscriptItem,
} from "./runtimeOperatorTranscript";

describe("runtimeOperatorTranscript", () => {
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

  it("hydrates audit snapshots without leaking result payloads", () => {
    const item = normalizeWebMcpConsoleTranscriptItem({
      id: "exec-1",
      at: 1_710_000_000_000,
      action: "tool",
      status: "success",
      durationMs: 420,
      summary: "Fetched runtime replay sample",
      result: "result payload",
      dryRun: false,
      effectiveLimits: {
        payloadLimitBytes: 1024,
        computerObserveRateLimitPerMinute: 12,
      },
      input: {
        context: {
          provider: "openai",
          model_id: "gpt-5.3-codex",
        },
      },
      response: null,
    });

    const hydrated = hydrateRuntimeOperatorTranscriptItem(item);
    const snapshot = buildRuntimeOperatorTranscriptAuditSnapshot(item);

    expect(hydrated.callerSourceFilter).toBe("request_context");
    expect(hydrated.callerProviderFilter).toBe("openai");
    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      execution: {
        id: "exec-1",
        action: "tool",
        status: "success",
        dryRun: false,
      },
      callerContext: {
        source: "request_context",
        provider: "openai",
        modelId: "gpt-5.3-codex",
      },
      guardrails: {
        payloadLimitBytes: 1024,
        computerObserveRateLimitPerMinute: 12,
      },
    });
    expect(JSON.stringify(snapshot)).not.toContain("result payload");
  });

  it("keeps dry-run and error variants representable", () => {
    const item = normalizeWebMcpConsoleTranscriptItem({
      action: "tool",
      status: "error",
      durationMs: 51.8,
      summary: "Runtime rejected payload",
      result: "previous result",
      dryRun: true,
      input: {
        context: {
          provider: " google ",
          model_id: " gemini-2.5-pro ",
        },
      },
      response: null,
    });

    expect(item.status).toBe("error");
    expect(item.dryRun).toBe(true);
    expect(item.durationMs).toBe(51);
    expect(item.contextAudit).toEqual({
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

  it("appends newest-first history with a retention cap", () => {
    const first = normalizeWebMcpConsoleTranscriptItem({
      id: "first",
      action: "tool",
      status: "success",
      durationMs: 10,
      summary: "first",
      result: "first-result",
    });
    const second = normalizeWebMcpConsoleTranscriptItem({
      id: "second",
      action: "createMessage",
      status: "success",
      durationMs: 20,
      summary: "second",
      result: "second-result",
    });
    const third = normalizeWebMcpConsoleTranscriptItem({
      id: "third",
      action: "elicitInput",
      status: "error",
      durationMs: 30,
      summary: "third",
      result: "third-result",
    });

    const history = appendRuntimeOperatorTranscriptItem(
      appendRuntimeOperatorTranscriptItem([first], second, 2),
      third,
      2
    );

    expect(history.map((entry) => entry.id)).toEqual(["third", "second"]);
  });
});
