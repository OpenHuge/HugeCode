import { describe, expect, it } from "vitest";

import {
  deriveRuntimeToolLifecycleHookCheckpoint,
  RUNTIME_TOOL_LIFECYCLE_PHASE_SEQUENCE,
  filterRuntimeToolLifecycleSnapshot,
  isRuntimeToolLifecycleTerminalEvent,
  normalizeRuntimeToolLifecycleAppEvent,
  shouldAcceptRuntimeToolLifecycleTransition,
} from "./runtimeToolLifecycle";

describe("@ku0/code-runtime-client runtime tool lifecycle", () => {
  it("normalizes runtime summary events into the shared lifecycle vocabulary", () => {
    const turnStarted = normalizeRuntimeToolLifecycleAppEvent({
      workspaceId: "workspace-1",
      requestId: "req-turn-1",
      method: "turn/started",
      receivedAt: 100,
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
      },
    });
    const toolStarted = normalizeRuntimeToolLifecycleAppEvent({
      workspaceId: "workspace-1",
      requestId: "req-tool-1",
      method: "item/started",
      receivedAt: 200,
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "tool-call-1",
        item: {
          id: "tool-call-1",
          type: "mcpToolCall",
          tool: "bash",
          status: "inProgress",
        },
      },
    });
    const approvalResolved = normalizeRuntimeToolLifecycleAppEvent({
      workspaceId: "workspace-1",
      requestId: "approval-1",
      method: "runtime/approvalResolved",
      receivedAt: 300,
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        approvalId: "approval-1",
        status: "approved",
        action: "bash",
      },
    });

    expect(turnStarted).toMatchObject({
      kind: "turn",
      phase: "started",
      source: "app-event",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      turnId: "turn-1",
      status: "in_progress",
    });
    expect(toolStarted).toMatchObject({
      kind: "tool",
      phase: "started",
      source: "app-event",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      turnId: "turn-1",
      toolCallId: "tool-call-1",
      toolName: "bash",
      status: "in_progress",
    });
    expect(approvalResolved).toMatchObject({
      kind: "approval",
      phase: "resolved",
      source: "app-event",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      turnId: "turn-1",
      toolName: "bash",
      approvalId: "approval-1",
      status: "approved",
    });
  });

  it("treats only the defined lifecycle phases as terminal", () => {
    expect(RUNTIME_TOOL_LIFECYCLE_PHASE_SEQUENCE).toMatchObject({
      turn: ["started", "completed", "failed"],
      tool: ["attempted", "started", "updated", "progress", "completed"],
      approval: ["requested", "resolved"],
      guardrail: ["evaluated", "outcome"],
    });

    expect(
      isRuntimeToolLifecycleTerminalEvent({
        id: "turn-completed",
        kind: "turn",
        phase: "completed",
        source: "app-event",
        workspaceId: "workspace-1",
        threadId: "thread-1",
        turnId: "turn-1",
        toolCallId: null,
        toolName: null,
        scope: null,
        status: "completed",
        at: 400,
        errorCode: null,
      })
    ).toBe(true);

    expect(
      isRuntimeToolLifecycleTerminalEvent({
        id: "approval-requested",
        kind: "approval",
        phase: "requested",
        source: "app-event",
        workspaceId: "workspace-1",
        threadId: "thread-1",
        turnId: "turn-1",
        toolCallId: null,
        toolName: "bash",
        scope: null,
        status: "pending",
        at: 401,
        errorCode: null,
        approvalId: "approval-1",
      })
    ).toBe(false);
  });

  it("ignores non-tool item events and keeps workspace filtering coherent", () => {
    const ignored = normalizeRuntimeToolLifecycleAppEvent({
      workspaceId: "workspace-1",
      requestId: "req-msg-1",
      method: "item/started",
      receivedAt: 500,
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "message-1",
        item: {
          id: "message-1",
          type: "agentMessage",
          status: "inProgress",
        },
      },
    });

    expect(ignored).toBeNull();

    const filtered = filterRuntimeToolLifecycleSnapshot(
      {
        revision: 2,
        lastEvent: {
          id: "workspace-2-completed",
          kind: "turn",
          phase: "completed",
          source: "app-event",
          workspaceId: "workspace-2",
          threadId: "thread-2",
          turnId: "turn-2",
          toolCallId: null,
          toolName: null,
          scope: null,
          status: "completed",
          at: 601,
          errorCode: null,
        },
        recentEvents: [
          {
            id: "workspace-1-started",
            kind: "turn",
            phase: "started",
            source: "app-event",
            workspaceId: "workspace-1",
            threadId: "thread-1",
            turnId: "turn-1",
            toolCallId: null,
            toolName: null,
            scope: null,
            status: "in_progress",
            at: 600,
            errorCode: null,
          },
          {
            id: "workspace-2-completed",
            kind: "turn",
            phase: "completed",
            source: "app-event",
            workspaceId: "workspace-2",
            threadId: "thread-2",
            turnId: "turn-2",
            toolCallId: null,
            toolName: null,
            scope: null,
            status: "completed",
            at: 601,
            errorCode: null,
          },
        ],
      },
      "workspace-1"
    );

    expect(filtered).toMatchObject({
      revision: 2,
      lastEvent: {
        id: "workspace-1-started",
      },
      recentEvents: [
        expect.objectContaining({
          id: "workspace-1-started",
        }),
      ],
    });
  });

  it("derives hook checkpoints from approval, guardrail, and tool lifecycle events", () => {
    const approvalRequested = deriveRuntimeToolLifecycleHookCheckpoint({
      id: "approval-requested",
      kind: "approval",
      phase: "requested",
      source: "app-event",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      turnId: "turn-1",
      toolCallId: null,
      toolName: "bash",
      scope: null,
      status: "pending",
      at: 700,
      errorCode: null,
      approvalId: "approval-1",
    });
    const guardrailBlocked = deriveRuntimeToolLifecycleHookCheckpoint({
      id: "guardrail-evaluated",
      kind: "guardrail",
      phase: "evaluated",
      source: "telemetry",
      workspaceId: "workspace-1",
      threadId: null,
      turnId: null,
      toolCallId: null,
      toolName: "bash",
      scope: "write",
      status: "blocked",
      at: 701,
      errorCode: "runtime.validation.payload_too_large",
      guardrailDecision: "blocked",
    });
    const toolCompleted = deriveRuntimeToolLifecycleHookCheckpoint({
      id: "tool-completed",
      kind: "tool",
      phase: "completed",
      source: "telemetry",
      workspaceId: "workspace-1",
      threadId: null,
      turnId: null,
      toolCallId: null,
      toolName: "bash",
      scope: "write",
      status: "success",
      at: 702,
      errorCode: null,
    });

    expect(approvalRequested).toMatchObject({
      point: "post_validation_pre_execution",
      status: "pending",
      toolName: "bash",
      lifecycleEventId: "approval-requested",
    });
    expect(guardrailBlocked).toMatchObject({
      point: "post_validation_pre_execution",
      status: "blocked",
      toolName: "bash",
      reason: "runtime.validation.payload_too_large",
    });
    expect(toolCompleted).toMatchObject({
      point: "post_execution_pre_publication",
      status: "ready",
      toolName: "bash",
      lifecycleEventId: "tool-completed",
    });
  });

  it("rejects retrograde lifecycle transitions while allowing repeated progress updates", () => {
    const previousCompleted = {
      id: "tool-completed",
      kind: "tool",
      phase: "completed",
      source: "telemetry",
      workspaceId: "workspace-1",
      threadId: null,
      turnId: null,
      toolCallId: null,
      toolName: "bash",
      scope: "write",
      status: "success",
      at: 800,
      errorCode: null,
      correlationKey: "req-tool-1",
    } as const;
    const retrogradeStarted = {
      id: "tool-started",
      kind: "tool",
      phase: "started",
      source: "telemetry",
      workspaceId: "workspace-1",
      threadId: null,
      turnId: null,
      toolCallId: null,
      toolName: "bash",
      scope: "write",
      status: "in_progress",
      at: 801,
      errorCode: null,
      correlationKey: "req-tool-1",
    } as const;
    const repeatedProgress = {
      id: "tool-progress",
      kind: "tool",
      phase: "progress",
      source: "app-event",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      turnId: "turn-1",
      toolCallId: "tool-call-1",
      toolName: "bash",
      scope: null,
      status: "in_progress",
      at: 803,
      errorCode: null,
      correlationKey: "tool-call-1",
    } as const;
    const repeatedProgressLater = {
      ...repeatedProgress,
      id: "tool-progress-2",
      at: 804,
    };

    expect(shouldAcceptRuntimeToolLifecycleTransition(previousCompleted, retrogradeStarted)).toBe(
      false
    );
    expect(
      shouldAcceptRuntimeToolLifecycleTransition(repeatedProgress, repeatedProgressLater)
    ).toBe(true);
  });
});
