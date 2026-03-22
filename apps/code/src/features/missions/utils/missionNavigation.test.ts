import { describe, expect, it, vi } from "vitest";
import {
  buildReviewPackSelectionRequestFromMissionTarget,
  openMissionTargetFromDesktopShell,
  resolveMissionEntryActionLabel,
  resolveMissionEntryFallbackSummary,
} from "./missionNavigation";

describe("missionNavigation", () => {
  it("builds review-pack selections with desktop source markers", () => {
    expect(
      buildReviewPackSelectionRequestFromMissionTarget({
        target: {
          kind: "mission",
          workspaceId: "workspace-1",
          taskId: "task-1",
          runId: "run-1",
          reviewPackId: "review-pack-1",
          threadId: null,
          limitation: "thread_unavailable",
        },
        source: "sidebar",
      })
    ).toEqual({
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack-1",
      source: "sidebar",
    });
  });

  it("routes runtime mission targets into the review surface and preserves source", () => {
    const onOpenReviewPack = vi.fn();
    const onSelectWorkspace = vi.fn();
    const onSelectThread = vi.fn();
    const onSelectReviewTab = vi.fn();

    openMissionTargetFromDesktopShell({
      target: {
        kind: "review",
        workspaceId: "workspace-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack-1",
        limitation: "thread_unavailable",
      },
      source: "approval_toast",
      onOpenReviewPack,
      onSelectWorkspace,
      onSelectThread,
      onSelectReviewTab,
    });

    expect(onOpenReviewPack).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack-1",
      source: "approval_toast",
    });
    expect(onSelectWorkspace).toHaveBeenCalledWith("workspace-1");
    expect(onSelectReviewTab).toHaveBeenCalledTimes(1);
    expect(onSelectThread).not.toHaveBeenCalled();
  });

  it("routes thread targets back into mission threads without opening review", () => {
    const onOpenReviewPack = vi.fn();
    const onSelectWorkspace = vi.fn();
    const onSelectThread = vi.fn();
    const onSelectReviewTab = vi.fn();
    const onSelectThreadTab = vi.fn();

    openMissionTargetFromDesktopShell({
      target: {
        kind: "thread",
        workspaceId: "workspace-1",
        threadId: "thread-1",
      },
      source: "review_queue",
      onOpenReviewPack,
      onSelectWorkspace,
      onSelectThread,
      onSelectReviewTab,
      onSelectThreadTab,
    });

    expect(onSelectWorkspace).toHaveBeenCalledWith("workspace-1");
    expect(onSelectThread).toHaveBeenCalledWith("workspace-1", "thread-1");
    expect(onSelectThreadTab).toHaveBeenCalledTimes(1);
    expect(onOpenReviewPack).not.toHaveBeenCalled();
    expect(onSelectReviewTab).not.toHaveBeenCalled();
  });

  it("resolves stable default action labels across thread, review, and mission targets", () => {
    expect(
      resolveMissionEntryActionLabel({
        navigationTarget: {
          kind: "thread",
          workspaceId: "workspace-1",
          threadId: "thread-1",
        },
      })
    ).toBe("Open mission");

    expect(
      resolveMissionEntryActionLabel({
        navigationTarget: {
          kind: "review",
          workspaceId: "workspace-1",
          taskId: "task-1",
          runId: "run-1",
          reviewPackId: "review-pack-1",
          limitation: "thread_unavailable",
        },
      })
    ).toBe("Open review");

    expect(
      resolveMissionEntryActionLabel({
        navigationTarget: {
          kind: "mission",
          workspaceId: "workspace-1",
          taskId: "task-1",
          runId: "run-1",
          reviewPackId: "review-pack-1",
          threadId: null,
          limitation: "thread_unavailable",
        },
      })
    ).toBe("Open action center");
  });

  it("uses shared fallback summaries for runtime-managed review and mission targets", () => {
    expect(
      resolveMissionEntryFallbackSummary({
        kind: "review",
        workspaceId: "workspace-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack-1",
        limitation: "thread_unavailable",
      })
    ).toBe(
      "Thread detail is unavailable. Open the review surface to inspect runtime evidence, validation, and the next decision."
    );

    expect(
      resolveMissionEntryFallbackSummary({
        kind: "mission",
        workspaceId: "workspace-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack-1",
        threadId: null,
        limitation: "thread_unavailable",
      })
    ).toBe(
      "Thread detail is unavailable. Open the action center to supervise runtime evidence, handoff, and recovery."
    );
  });
});
