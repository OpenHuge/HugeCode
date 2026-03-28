import { describe, expect, it } from "vitest";
import { adaptRuntimeRpcPayload, withCanonicalFields } from "./runtimeClientRpcPayloads";

describe("runtimeClientRpcPayloads", () => {
  it("keeps simple payloads canonical-only", () => {
    expect(withCanonicalFields({ workspaceId: "ws-1", displayName: "Demo" })).toEqual({
      workspaceId: "ws-1",
      displayName: "Demo",
    });
  });

  it("preserves turn send optional fields without emitting compat aliases", () => {
    expect(
      adaptRuntimeRpcPayload("turnSend", {
        workspaceId: "ws-1",
        threadId: "thread-1",
        requestId: "req-1",
        provider: "openai",
        modelId: "gpt-5",
        reasonEffort: "medium",
        accessMode: "on-request",
        executionMode: "runtime",
        content: "hello",
        queue: false,
        attachments: [],
        contextPrefix: "prefix",
        missionMode: "delegate",
        executionProfileId: "balanced-delegate",
        preferredBackendIds: ["backend-a", "backend-b"],
        collaborationMode: { mode: "plan" },
      })
    ).toEqual(
      expect.objectContaining({
        workspaceId: "ws-1",
        threadId: "thread-1",
        requestId: "req-1",
        modelId: "gpt-5",
        reasonEffort: "medium",
        accessMode: "on-request",
        executionMode: "runtime",
        contextPrefix: "prefix",
        missionMode: "delegate",
        executionProfileId: "balanced-delegate",
        preferredBackendIds: ["backend-a", "backend-b"],
        collaborationMode: { mode: "plan" },
      })
    );
  });

  it("preserves task source in canonical shape for runtime run start v2 payloads", () => {
    expect(
      adaptRuntimeRpcPayload("runtimeRunStartV2", {
        workspaceId: "ws-1",
        title: "Delegate issue #42",
        accessMode: "on-request",
        executionMode: "single",
        taskSource: {
          kind: "github_issue",
          label: "GitHub issue #42",
          title: "Delegate issue #42",
          externalId: "openai/hugecode#42",
          canonicalUrl: "https://github.com/openai/hugecode/issues/42",
          sourceTaskId: "issue-42",
          sourceRunId: null,
        },
        reviewProfileId: "issue-review",
        validationPresetId: "standard",
        steps: [{ kind: "read", input: "Resolve the linked GitHub issue." }],
      })
    ).toEqual(
      expect.objectContaining({
        workspaceId: "ws-1",
        taskSource: expect.objectContaining({
          kind: "github_issue",
          externalId: "openai/hugecode#42",
        }),
        reviewProfileId: "issue-review",
        validationPresetId: "standard",
      })
    );
  });

  it("keeps interrupt and runtime run list payloads canonical-only", () => {
    expect(adaptRuntimeRpcPayload("turnInterrupt", { turnId: "turn-1", reason: null })).toEqual({
      turnId: "turn-1",
      reason: null,
    });

    const payload = { workspaceId: "ws-1" } as const;
    expect(adaptRuntimeRpcPayload("runtimeRunsList", payload)).toEqual({
      workspaceId: "ws-1",
    });
  });

  it("keeps sub-agent wait payload canonical-only", () => {
    expect(
      adaptRuntimeRpcPayload("subAgentWait", {
        sessionId: "session-1",
        timeoutMs: 5000,
        pollIntervalMs: 250,
      })
    ).toEqual(
      expect.objectContaining({
        sessionId: "session-1",
        timeoutMs: 5000,
        pollIntervalMs: 250,
      })
    );
  });

  it("keeps nested runtime run start v2 payloads canonical-only", () => {
    const payload = adaptRuntimeRpcPayload("runtimeRunStartV2", {
      workspaceId: "ws-1",
      accessMode: "on-request",
      executionMode: "distributed",
      missionBrief: {
        objective: "Stabilize runtime compat payloads",
        preferredBackendIds: ["backend-a"],
        maxSubtasks: 2,
      },
      steps: [
        {
          kind: "read",
          input: "Inspect runtime compat alias generation.",
          timeoutMs: 1_000,
          requiresApproval: true,
          approvalReason: "operator checkpoint",
        },
      ],
    });

    expect(payload).toEqual(
      expect.objectContaining({
        workspaceId: "ws-1",
        missionBrief: {
          objective: "Stabilize runtime compat payloads",
          preferredBackendIds: ["backend-a"],
          maxSubtasks: 2,
        },
        steps: [
          expect.objectContaining({
            timeoutMs: 1_000,
            requiresApproval: true,
            approvalReason: "operator checkpoint",
          }),
        ],
      })
    );
    expect(payload).not.toHaveProperty("mission_brief");
  });

  it("keeps runtime kernel v2 payloads canonical-only", () => {
    expect(
      adaptRuntimeRpcPayload("runtimeRunPrepareV2", {
        workspaceId: "ws-1",
        threadId: "thread-1",
        requestId: "req-prepare",
        accessMode: "on-request",
        executionMode: "single",
        steps: [{ kind: "read", input: "Inspect runtime." }],
      })
    ).toEqual(
      expect.objectContaining({
        workspaceId: "ws-1",
        threadId: "thread-1",
        requestId: "req-prepare",
        steps: [expect.objectContaining({ kind: "read", input: "Inspect runtime." })],
      })
    );

    expect(adaptRuntimeRpcPayload("runtimeRunGetV2", { runId: "run-1" })).toEqual({
      runId: "run-1",
    });

    expect(adaptRuntimeRpcPayload("runtimeRunSubscribeV2", { runId: "run-1" })).toEqual({
      runId: "run-1",
    });

    expect(adaptRuntimeRpcPayload("runtimeReviewGetV2", { runId: "run-1" })).toEqual({
      runId: "run-1",
    });
  });

  it("keeps runtime run cancel v2 payloads canonical-only", () => {
    expect(adaptRuntimeRpcPayload("runtimeRunCancelV2", { runId: "run-1", reason: null })).toEqual({
      runId: "run-1",
      reason: null,
    });
  });
});
