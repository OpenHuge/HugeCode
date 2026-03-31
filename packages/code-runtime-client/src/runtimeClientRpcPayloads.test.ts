import { describe, expect, it } from "vitest";
import { adaptRuntimeRpcPayload, withCanonicalFields } from "./runtimeClientRpcPayloads";

describe("@ku0/code-runtime-client runtimeClientRpcPayloads", () => {
  it("keeps simple canonical fields unchanged", () => {
    expect(withCanonicalFields({ workspaceId: "ws-1", displayName: "Demo" })).toEqual({
      workspaceId: "ws-1",
      displayName: "Demo",
    });
  });

  it("preserves canonical runtime run payloads without compat aliases", () => {
    expect(
      adaptRuntimeRpcPayload("runtimeRunPrepareV2", {
        workspaceId: "ws-1",
        threadId: "thread-1",
        requestId: "req-1",
        accessMode: "on-request",
        executionMode: "single",
        steps: [{ kind: "read", input: "Inspect runtime." }],
      })
    ).toEqual(
      expect.objectContaining({
        workspaceId: "ws-1",
        threadId: "thread-1",
        requestId: "req-1",
        steps: [expect.objectContaining({ kind: "read", input: "Inspect runtime." })],
      })
    );
  });

  it("keeps turn send payloads canonical without legacy snake_case aliases", () => {
    const payload = adaptRuntimeRpcPayload("turnSend", {
      workspaceId: "ws-1",
      threadId: null,
      requestId: "req-1",
      content: "Inspect runtime payload handling.",
      contextPrefix: "context",
      provider: "openai",
      modelId: "gpt-5.4",
      reasonEffort: "high",
      accessMode: "on-request",
      executionMode: "runtime",
      preferredBackendIds: ["backend-a"],
      queue: false,
      attachments: [],
      collaborationMode: { mode: "plan" },
      autonomyRequest: null,
    });

    expect(payload).toEqual(
      expect.objectContaining({
        workspaceId: "ws-1",
        requestId: "req-1",
        contextPrefix: "context",
        preferredBackendIds: ["backend-a"],
      })
    );
    expect(payload).not.toHaveProperty("workspace_id");
    expect(payload).not.toHaveProperty("request_id");
    expect(payload).not.toHaveProperty("context_prefix");
    expect(payload).not.toHaveProperty("preferred_backend_ids");
  });

  it("rejects legacy alias fields for turnSend hot-path payloads", () => {
    expect(() =>
      adaptRuntimeRpcPayload("turnSend", {
        workspaceId: "ws-1",
        content: "Inspect runtime contract drift.",
        request_id: "req-legacy-1",
      })
    ).toThrow(/Legacy snake_case RPC fields are forbidden/);
  });

  it("rejects legacy collaboration-mode aliases for turnSend hot-path payloads", () => {
    expect(() =>
      adaptRuntimeRpcPayload("turnSend", {
        workspaceId: "ws-1",
        content: "Inspect runtime contract drift.",
        collaboration_mode: "plan",
      })
    ).toThrow(/Legacy snake_case RPC fields are forbidden/);

    expect(() =>
      adaptRuntimeRpcPayload("turnSend", {
        workspaceId: "ws-1",
        content: "Inspect runtime contract drift.",
        collaborationMode: {
          mode_id: "plan",
          settings: { id: "plan" },
        },
      })
    ).toThrow(/Legacy snake_case RPC fields are forbidden/);
  });

  it("rejects legacy alias fields for runtimeRunPrepareV2 payloads", () => {
    expect(() =>
      adaptRuntimeRpcPayload("runtimeRunPrepareV2", {
        workspaceId: "ws-1",
        threadId: "thread-1",
        requestId: "req-1",
        accessMode: "on-request",
        executionMode: "single",
        preferred_backend_ids: ["backend-a"],
        steps: [{ kind: "read", input: "Inspect runtime." }],
      })
    ).toThrow(/Legacy snake_case RPC fields are forbidden/);
  });

  it("rejects legacy alias fields for runtimeRunStartV2 nested step payloads", () => {
    expect(() =>
      adaptRuntimeRpcPayload("runtimeRunStartV2", {
        workspaceId: "ws-1",
        threadId: "thread-1",
        requestId: "req-1",
        approvedPlanVersion: "plan-v1",
        accessMode: "on-request",
        executionMode: "single",
        steps: [{ kind: "read", input: "Inspect runtime.", timeout_ms: 1000 }],
      })
    ).toThrow(/Legacy snake_case RPC fields are forbidden/);
  });

  it("rejects legacy alias fields for runtimeRunIntervention payloads", () => {
    expect(() =>
      adaptRuntimeRpcPayload("runtimeRunInterveneV2", {
        runId: "run-1",
        action: "switch_profile_and_retry",
        instruction_patch: "Retry with explicit validation.",
      })
    ).toThrow(/Legacy snake_case RPC fields are forbidden/);
  });
});
