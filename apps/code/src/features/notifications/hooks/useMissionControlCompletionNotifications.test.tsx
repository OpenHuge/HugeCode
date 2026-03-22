// @vitest-environment jsdom
import type {
  HugeCodeMissionControlSnapshot,
  HugeCodeRunSummary,
  HugeCodeTaskSummary,
} from "@ku0/code-runtime-host-contract";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendNotification } from "../../../application/runtime/ports/tauriNotifications";
import { useMissionControlCompletionNotifications } from "./useMissionControlCompletionNotifications";

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

describe("useMissionControlCompletionNotifications", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-14T12:00:00.000Z"));
    vi.mocked(sendNotification).mockReset();
    vi.mocked(sendNotification).mockResolvedValue();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("does not notify for terminal runs that already existed on initial mount", async () => {
    renderHook(() =>
      useMissionControlCompletionNotifications({
        enabled: true,
        isWindowFocused: false,
        missionControlProjection: createSnapshot({
          run: createRun({
            state: "review_ready",
            summary: "Ready for review",
            finishedAt: Date.now(),
          }),
        }),
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("notifies when a runtime run transitions from running to review_ready", async () => {
    const onThreadNotificationSent = vi.fn();
    const onMissionNotificationSent = vi.fn();
    const { rerender } = renderHook(
      ({ projection }: { projection: HugeCodeMissionControlSnapshot | null }) =>
        useMissionControlCompletionNotifications({
          enabled: true,
          isWindowFocused: false,
          missionControlProjection: projection,
          getWorkspaceName: () => "Workspace One",
          onThreadNotificationSent,
          onMissionNotificationSent,
        }),
      {
        initialProps: {
          projection: createSnapshot({
            run: createRun({
              state: "running",
              finishedAt: null,
            }),
          }),
        },
      }
    );

    rerender({
      projection: createSnapshot({
        run: createRun({
          state: "review_ready",
          summary: "Review pack is ready.",
          finishedAt: Date.now(),
        }),
      }),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(sendNotification).toHaveBeenCalledWith(
      "Workspace One",
      "Review pack is ready.",
      expect.objectContaining({
        extra: expect.objectContaining({
          kind: "mission_run",
          state: "review_ready",
          runId: "run-1",
          taskId: "task-1",
          reviewPackId: null,
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

  it("suppresses notifications when window is focused", async () => {
    const { rerender } = renderHook(
      ({ projection }: { projection: HugeCodeMissionControlSnapshot | null }) =>
        useMissionControlCompletionNotifications({
          enabled: true,
          isWindowFocused: true,
          missionControlProjection: projection,
        }),
      {
        initialProps: {
          projection: createSnapshot({
            run: createRun({ state: "running", finishedAt: null }),
          }),
        } as {
          projection: HugeCodeMissionControlSnapshot | null;
        },
      }
    );

    rerender({
      projection: createSnapshot({
        run: createRun({
          state: "review_ready",
          summary: "Ready",
          finishedAt: Date.now(),
        }),
      }),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("derives reviewPackId from the mission snapshot when the run summary does not include it", async () => {
    const onMissionNotificationSent = vi.fn();
    const { rerender } = renderHook(
      ({ projection }: { projection: HugeCodeMissionControlSnapshot | null }) =>
        useMissionControlCompletionNotifications({
          enabled: true,
          isWindowFocused: false,
          missionControlProjection: projection,
          onMissionNotificationSent,
        }),
      {
        initialProps: {
          projection: createSnapshot({
            run: createRun({ state: "running", finishedAt: null, reviewPackId: null }),
          }),
        },
      }
    );

    rerender({
      projection: createSnapshot({
        run: createRun({
          state: "review_ready",
          summary: "Ready",
          finishedAt: Date.now(),
          reviewPackId: null,
        }),
        reviewPacks: [
          {
            id: "review-pack:run-1",
            runId: "run-1",
            taskId: "task-1",
            workspaceId: "ws-1",
            summary: "Ready",
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
          },
        ],
      }),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendNotification).toHaveBeenCalledWith(
      "Agent Complete",
      "Ready",
      expect.objectContaining({
        extra: expect.objectContaining({
          reviewPackId: "review-pack:run-1",
        }),
      })
    );
    expect(onMissionNotificationSent).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewPackId: "review-pack:run-1",
      })
    );
  });

  it("resets observed state when the mission control snapshot disconnects", async () => {
    type HookProps = {
      projection: HugeCodeMissionControlSnapshot | null;
    };

    const { rerender } = renderHook<
      ReturnType<typeof useMissionControlCompletionNotifications>,
      HookProps
    >(
      ({ projection }: HookProps) =>
        useMissionControlCompletionNotifications({
          enabled: true,
          isWindowFocused: false,
          missionControlProjection: projection,
        }),
      {
        initialProps: {
          projection: createSnapshot({
            run: createRun({ state: "running", finishedAt: null }),
          }),
        } satisfies HookProps,
      }
    );

    rerender({ projection: null } satisfies HookProps);

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendNotification).not.toHaveBeenCalled();
  });
});
