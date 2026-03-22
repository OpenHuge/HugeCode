import { describe, expect, it } from "vitest";
import type { ConversationItem, ThreadSummary } from "../../../types";
import { deriveSidebarThreadStatusMap } from "./SidebarThreadStatus.logic";

const thread: ThreadSummary = {
  id: "thread-1",
  name: "Thread 1",
  updatedAt: Date.now(),
};

describe("deriveSidebarThreadStatusMap", () => {
  it("marks a thread as awaiting input when request-user-input is pending", () => {
    const result = deriveSidebarThreadStatusMap({
      threadsByWorkspace: { "ws-1": [thread] },
      baseStatusById: {},
      approvals: [],
      userInputRequests: [
        {
          workspace_id: "ws-1",
          request_id: "request-1",
          params: {
            thread_id: "thread-1",
            turn_id: "turn-1",
            item_id: "item-1",
            questions: [],
          },
        },
      ],
      toolCallRequests: [],
      itemsByThread: {},
    });

    expect(result["thread-1"]?.timelineState).toBe("awaitingInput");
  });

  it("marks a thread as plan-ready when a completed plan is waiting for follow-up", () => {
    const items: ConversationItem[] = [
      {
        id: "plan-1",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "- Step 1",
      },
    ];

    const result = deriveSidebarThreadStatusMap({
      threadsByWorkspace: { "ws-1": [thread] },
      baseStatusById: {},
      approvals: [],
      userInputRequests: [],
      toolCallRequests: [],
      itemsByThread: { "thread-1": items },
    });

    expect(result["thread-1"]?.timelineState).toBe("planReady");
  });

  it("marks a recent finished thread as completed", () => {
    const result = deriveSidebarThreadStatusMap({
      threadsByWorkspace: { "ws-1": [thread] },
      baseStatusById: {
        "thread-1": {
          isProcessing: false,
          hasUnread: false,
          isReviewing: false,
          lastDurationMs: 1200,
        },
      },
      approvals: [],
      userInputRequests: [],
      toolCallRequests: [],
      itemsByThread: {},
      now: thread.updatedAt + 2_000,
    });

    expect(result["thread-1"]?.timelineState).toBe("completed");
  });

  it("does not mark an interrupted thread as completed when the latest assistant status is an error", () => {
    const result = deriveSidebarThreadStatusMap({
      threadsByWorkspace: { "ws-1": [thread] },
      baseStatusById: {
        "thread-1": {
          isProcessing: false,
          hasUnread: false,
          isReviewing: false,
          lastDurationMs: 1200,
        },
      },
      approvals: [],
      userInputRequests: [],
      toolCallRequests: [],
      itemsByThread: {
        "thread-1": [
          {
            id: "assistant-stopped",
            kind: "message",
            role: "assistant",
            text: "Session stopped.",
          },
          {
            id: "assistant-failed",
            kind: "message",
            role: "assistant",
            text: "Turn failed: Turn interrupted by operator.",
          },
        ],
      },
      now: thread.updatedAt + 2_000,
    });

    expect(result["thread-1"]?.timelineState).toBeNull();
  });

  it("overlays runtime-governed review and action-required states from mission control", () => {
    const result = deriveSidebarThreadStatusMap({
      threadsByWorkspace: { "ws-1": [thread] },
      baseStatusById: {},
      approvals: [],
      userInputRequests: [],
      toolCallRequests: [],
      itemsByThread: {},
      missionControlProjection: {
        source: "runtime_snapshot_v1",
        generatedAt: 1,
        workspaces: [
          {
            id: "ws-1",
            name: "Workspace",
            rootPath: "/tmp/workspace",
            connected: true,
            defaultProfileId: null,
          },
        ],
        tasks: [
          {
            id: "thread-1",
            workspaceId: "ws-1",
            title: "Thread 1",
            objective: "Thread 1",
            origin: {
              kind: "thread",
              threadId: "thread-1",
              runId: "run-1",
              requestId: null,
            },
            mode: "delegate",
            modeSource: "execution_profile",
            status: "review_ready",
            createdAt: 1,
            updatedAt: 10,
            currentRunId: null,
            latestRunId: "run-1",
            latestRunState: "review_ready",
            nextAction: null,
          },
        ],
        runs: [
          {
            id: "run-1",
            taskId: "thread-1",
            workspaceId: "ws-1",
            state: "review_ready",
            title: "Thread 1",
            summary: "Ready for operator review.",
            startedAt: 1,
            finishedAt: 10,
            updatedAt: 10,
            currentStepIndex: 0,
            warnings: [],
            validations: [],
            artifacts: [],
            reviewPackId: "review-pack:run-1",
            governance: {
              state: "awaiting_review",
              label: "Awaiting review decision",
              summary: "Accept or reject this result from the review surface.",
              blocking: true,
              suggestedAction: "review_result",
              availableActions: ["review_result", "accept_result", "reject_result"],
            },
          },
        ],
        reviewPacks: [],
      },
    });

    expect(result["thread-1"]).toMatchObject({
      isReviewing: true,
      timelineState: "reviewReady",
    });
  });

  it("treats runtime approval payload as awaiting approval even when governance state is missing", () => {
    const result = deriveSidebarThreadStatusMap({
      threadsByWorkspace: { "ws-1": [thread] },
      baseStatusById: {},
      approvals: [],
      userInputRequests: [],
      toolCallRequests: [],
      itemsByThread: {},
      missionControlProjection: {
        source: "runtime_snapshot_v1",
        generatedAt: 1,
        workspaces: [
          {
            id: "ws-1",
            name: "Workspace",
            rootPath: "/tmp/workspace",
            connected: true,
            defaultProfileId: null,
          },
        ],
        tasks: [
          {
            id: "thread-1",
            workspaceId: "ws-1",
            title: "Thread 1",
            objective: "Thread 1",
            origin: {
              kind: "thread",
              threadId: "thread-1",
              runId: "run-1",
              requestId: null,
            },
            mode: "delegate",
            modeSource: "execution_profile",
            status: "running",
            createdAt: 1,
            updatedAt: 10,
            currentRunId: "run-1",
            latestRunId: "run-1",
            latestRunState: "running",
            nextAction: null,
          },
        ],
        runs: [
          {
            id: "run-1",
            taskId: "thread-1",
            workspaceId: "ws-1",
            state: "running",
            title: "Thread 1",
            summary: "Waiting for approval.",
            startedAt: 1,
            finishedAt: null,
            updatedAt: 10,
            currentStepIndex: 0,
            warnings: [],
            validations: [],
            artifacts: [],
            reviewPackId: null,
            governance: null,
            approval: {
              status: "pending_decision",
              approvalId: "approval-1",
              label: "Approval pending",
              summary: "Operator must approve the next step.",
            },
          },
        ],
        reviewPacks: [],
      },
    });

    expect(result["thread-1"]).toMatchObject({
      isReviewing: false,
      isProcessing: false,
      executionState: "awaitingApproval",
      timelineState: "awaitingApproval",
    });
  });
});
