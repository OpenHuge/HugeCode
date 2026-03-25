// @vitest-environment jsdom
import type {
  HugeCodeMissionControlSnapshot,
  HugeCodeReviewPackSummary,
  HugeCodeRunSummary,
  HugeCodeTaskSummary,
} from "@ku0/code-runtime-host-contract";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendNotification } from "../../../application/runtime/ports/tauriNotifications";
import { useMissionControlAttentionNotifications } from "./useMissionControlAttentionNotifications";

vi.mock("../../../application/runtime/ports/tauriNotifications", () => ({
  sendNotification: vi.fn(),
}));

function createTask(taskId = "task-1"): HugeCodeTaskSummary {
  return {
    id: taskId,
    workspaceId: "ws-1",
    title: "Implement flow",
    objective: null,
    origin: {
      kind: "thread",
      threadId: "thread-1",
      runId: null,
      requestId: null,
    },
    mode: "delegate",
    modeSource: "execution_profile",
    status: "running",
    createdAt: Date.now() - 120_000,
    updatedAt: Date.now(),
    currentRunId: "run-1",
    latestRunId: "run-1",
    latestRunState: "running",
    nextAction: null,
  };
}

function createRun(overrides: Partial<HugeCodeRunSummary> = {}): HugeCodeRunSummary {
  return {
    id: "run-1",
    taskId: "task-1",
    workspaceId: "ws-1",
    state: "running",
    title: "Implement flow",
    summary: null,
    startedAt: Date.now() - 120_000,
    finishedAt: null,
    updatedAt: Date.now(),
    currentStepIndex: 2,
    pendingIntervention: null,
    approval: {
      status: "not_required",
      approvalId: null,
      label: "No pending approval",
      summary: "This run does not currently require an approval decision.",
    },
    reviewDecision: null,
    operatorState: null,
    operatorSnapshot: null,
    nextAction: null,
    ...overrides,
  };
}

function createReviewPack(
  overrides: Partial<HugeCodeReviewPackSummary> = {}
): HugeCodeReviewPackSummary {
  return {
    id: "review-pack:run-1",
    runId: "run-1",
    taskId: "task-1",
    workspaceId: "ws-1",
    summary: "Ready for review",
    reviewStatus: "ready",
    evidenceState: "confirmed",
    validationOutcome: "passed",
    warningCount: 0,
    warnings: [],
    validations: [],
    artifacts: [],
    checksPerformed: [],
    recommendedNextAction: null,
    reviewDecision: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

function createSnapshot(params: {
  source?: HugeCodeMissionControlSnapshot["source"];
  task?: HugeCodeTaskSummary;
  run?: HugeCodeRunSummary;
  reviewPacks?: HugeCodeMissionControlSnapshot["reviewPacks"];
}): HugeCodeMissionControlSnapshot {
  const task = params.task ?? createTask();
  const run = params.run ?? createRun();
  return {
    source: params.source ?? "runtime_snapshot_v1",
    generatedAt: Date.now(),
    workspaces: [
      {
        id: "ws-1",
        name: "Workspace One",
        rootPath: "/tmp/ws-1",
        connected: true,
        defaultProfileId: null,
      },
    ],
    tasks: [task],
    runs: [run],
    reviewPacks: params.reviewPacks ?? [],
  };
}

describe("useMissionControlAttentionNotifications", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-17T12:00:00.000Z"));
    vi.mocked(sendNotification).mockReset();
    vi.mocked(sendNotification).mockResolvedValue();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("does not notify for approval waits that already existed on initial mount", async () => {
    renderHook(() =>
      useMissionControlAttentionNotifications({
        enabled: true,
        isWindowFocused: false,
        missionControlProjection: createSnapshot({
          run: createRun({
            state: "needs_input",
            approval: {
              status: "pending_decision",
              approvalId: "approval-1",
              label: "Awaiting approval",
              summary: "Waiting for approval.",
            },
          }),
        }),
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("notifies when a run transitions into approval wait", async () => {
    const onThreadNotificationSent = vi.fn();
    const onMissionNotificationSent = vi.fn();
    const { rerender } = renderHook(
      ({ projection }: { projection: HugeCodeMissionControlSnapshot | null }) =>
        useMissionControlAttentionNotifications({
          enabled: true,
          isWindowFocused: false,
          missionControlProjection: projection,
          getWorkspaceName: () => "Workspace One",
          onThreadNotificationSent,
          onMissionNotificationSent,
        }),
      {
        initialProps: {
          projection: createSnapshot({ run: createRun({ state: "running" }) }),
        },
      }
    );

    rerender({
      projection: createSnapshot({
        run: createRun({
          state: "needs_input",
          approval: {
            status: "pending_decision",
            approvalId: "approval-1",
            label: "Awaiting approval",
            summary: "Waiting for approval.",
          },
        }),
      }),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendNotification).toHaveBeenCalledWith(
      "Approval needed — Workspace One",
      "Waiting for approval.",
      expect.objectContaining({
        extra: expect.objectContaining({
          kind: "mission_attention",
          type: "approval_wait",
          workspaceId: "ws-1",
          taskId: "task-1",
          runId: "run-1",
          threadId: "thread-1",
        }),
      })
    );
    expect(onThreadNotificationSent).toHaveBeenCalledWith("ws-1", "thread-1");
    expect(onMissionNotificationSent).toHaveBeenCalledWith({
      kind: "mission",
      workspaceId: "ws-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: null,
      threadId: "thread-1",
      limitation: null,
    });
  });

  it("notifies when a run becomes blocked by environment state", async () => {
    const { rerender } = renderHook(
      ({ projection }: { projection: HugeCodeMissionControlSnapshot | null }) =>
        useMissionControlAttentionNotifications({
          enabled: true,
          isWindowFocused: false,
          missionControlProjection: projection,
          getWorkspaceName: () => "Workspace One",
        }),
      {
        initialProps: {
          projection: createSnapshot({ run: createRun({ state: "running" }) }),
        },
      }
    );

    rerender({
      projection: createSnapshot({
        run: createRun({
          state: "running",
          operatorState: {
            health: "blocked",
            headline: "Environment blocked",
            detail: "Credentials are missing.",
          },
          operatorSnapshot: {
            summary: "Run blocked on environment setup.",
            runtimeLabel: "Codex",
            provider: null,
            modelId: "gpt-5",
            reasoningEffort: "medium",
            backendId: "backend-a",
            machineId: null,
            machineSummary: "Backend known, machine not published",
            workspaceRoot: "/tmp/ws-1",
            currentActivity: "Waiting for credentials",
            blocker: "Credentials are missing.",
            recentEvents: [],
          },
        }),
      }),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendNotification).toHaveBeenCalledWith(
      "Mission blocked — Workspace One",
      "Credentials are missing.",
      expect.objectContaining({
        extra: expect.objectContaining({
          kind: "mission_attention",
          type: "environment_blocked",
          runId: "run-1",
        }),
      })
    );
  });

  it("notifies when review changes are requested", async () => {
    const onMissionNotificationSent = vi.fn();
    const { rerender } = renderHook(
      ({ projection }: { projection: HugeCodeMissionControlSnapshot | null }) =>
        useMissionControlAttentionNotifications({
          enabled: true,
          isWindowFocused: false,
          missionControlProjection: projection,
          getWorkspaceName: () => "Workspace One",
          onMissionNotificationSent,
        }),
      {
        initialProps: {
          projection: createSnapshot({
            reviewPacks: [createReviewPack()],
          }),
        },
      }
    );

    rerender({
      projection: createSnapshot({
        reviewPacks: [
          createReviewPack({
            reviewDecision: {
              status: "rejected",
              reviewPackId: "review-pack:run-1",
              label: "Changes requested",
              summary: "Reviewer asked for follow-up fixes.",
              decidedAt: Date.now(),
            },
          }),
        ],
      }),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendNotification).toHaveBeenCalledWith(
      "Changes requested — Workspace One",
      "Reviewer asked for follow-up fixes.",
      expect.objectContaining({
        extra: expect.objectContaining({
          kind: "mission_attention",
          type: "review_rejected",
          reviewPackId: "review-pack:run-1",
        }),
      })
    );
    expect(onMissionNotificationSent).toHaveBeenCalledWith({
      kind: "review",
      workspaceId: "ws-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack:run-1",
      limitation: null,
    });
  });

  it("uses canonical continuation guidance when rejected review detail lacks a summary", async () => {
    const { rerender } = renderHook(
      ({ projection }: { projection: HugeCodeMissionControlSnapshot | null }) =>
        useMissionControlAttentionNotifications({
          enabled: true,
          isWindowFocused: false,
          missionControlProjection: projection,
          getWorkspaceName: () => "Workspace One",
        }),
      {
        initialProps: {
          projection: createSnapshot({
            reviewPacks: [createReviewPack()],
          }),
        },
      }
    );

    rerender({
      projection: createSnapshot({
        run: createRun({
          state: "review_ready",
          takeoverBundle: {
            pathKind: "review",
            primaryAction: "open_review_pack",
            state: "blocked",
            summary: "Runtime blocked continuation until the review pack is resolved.",
            recommendedAction: "Open the review pack and resolve the runtime-blocked follow-up.",
            reviewPackId: "review-pack:run-1",
          },
        }),
        reviewPacks: [
          createReviewPack({
            reviewDecision: {
              status: "rejected",
              reviewPackId: "review-pack:run-1",
              label: "Changes requested",
              summary: "",
              decidedAt: Date.now(),
            },
            recommendedNextAction: "Legacy rejected follow-up.",
          }),
        ],
      }),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendNotification).toHaveBeenCalledWith(
      "Changes requested — Workspace One",
      "Open the review pack and resolve the runtime-blocked follow-up.",
      expect.any(Object)
    );
  });

  it("suppresses attention notifications while the window is focused", async () => {
    const { rerender } = renderHook(
      ({ projection }: { projection: HugeCodeMissionControlSnapshot | null }) =>
        useMissionControlAttentionNotifications({
          enabled: true,
          isWindowFocused: true,
          missionControlProjection: projection,
        }),
      {
        initialProps: {
          projection: createSnapshot({ run: createRun({ state: "running" }) }),
        },
      }
    );

    rerender({
      projection: createSnapshot({
        run: createRun({
          state: "needs_input",
          approval: {
            status: "pending_decision",
            approvalId: "approval-1",
            label: "Awaiting approval",
            summary: "Waiting for approval.",
          },
        }),
      }),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendNotification).not.toHaveBeenCalled();
  });
});
