// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MissionSurfaceDetailModel } from "../utils/reviewPackSurfaceModel";
import {
  DEFAULT_REVIEW_BACKEND_OPTION,
  useReviewPackSurfaceController,
} from "./useReviewPackSurfaceController";

vi.mock("../../shared/productAnalytics", () => ({
  trackProductAnalyticsEvent: vi.fn(async () => undefined),
}));

function createDetail(id: string): MissionSurfaceDetailModel {
  return {
    kind: "review_pack",
    id,
  } as unknown as MissionSurfaceDetailModel;
}

describe("useReviewPackSurfaceController", () => {
  afterEach(() => {
    cleanup();
  });

  it("seeds prepared intervention state from the selected draft", async () => {
    const onPrepareInterventionDraft = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useReviewPackSurfaceController({
        detail: createDetail("review-pack:1"),
        defaultInterventionBackendId: "backend-a",
        interventionBackendOptions: [{ value: "backend-b", label: "Backend B" }],
        onPrepareInterventionDraft,
        onLaunchInterventionDraft: vi.fn(async () => undefined),
      })
    );

    await act(async () => {
      await result.current.handlePrepareInterventionDraft({
        workspaceId: "workspace-1",
        navigationTarget: null,
        actionId: "retry",
        draft: {
          intent: "retry",
          title: "Retry review",
          instruction: "Retry with a tighter scope.",
          profileId: "operator-review",
          reviewProfileId: null,
          validationPresetId: null,
          accessMode: "on-request",
          taskSource: null,
          sourceMappingKind: null,
          fieldOrigins: {
            executionProfileId: "runtime_fallback",
            preferredBackendIds: "runtime_fallback",
            accessMode: "runtime_fallback",
            validationPresetId: "runtime_fallback",
            reviewProfileId: "runtime_fallback",
          },
          preferredBackendIds: ["backend-b"],
          sourceTaskId: "task-1",
          sourceRunId: "run-1",
          sourceReviewPackId: "review-pack:1",
        },
      });
    });

    expect(result.current.interventionTitle).toBe("Retry review");
    expect(result.current.interventionProfileId).toBe("operator-review");
    expect(result.current.interventionBackendValue).toBe("backend-b");
    expect(onPrepareInterventionDraft).toHaveBeenCalledTimes(1);
  });

  it("clears prepared intervention when detail switches to a different review pack", async () => {
    const { result, rerender } = renderHook(
      ({ detail }) =>
        useReviewPackSurfaceController({
          detail,
          defaultInterventionBackendId: null,
          interventionBackendOptions: [],
          onPrepareInterventionDraft: vi.fn(async () => undefined),
          onLaunchInterventionDraft: vi.fn(async () => undefined),
        }),
      {
        initialProps: { detail: createDetail("review-pack:1") },
      }
    );

    await act(async () => {
      await result.current.handlePrepareInterventionDraft({
        workspaceId: "workspace-1",
        navigationTarget: null,
        actionId: "retry",
        draft: {
          intent: "retry",
          title: "Retry review",
          instruction: "Retry with a tighter scope.",
          profileId: "operator-review",
          reviewProfileId: null,
          validationPresetId: null,
          accessMode: "on-request",
          taskSource: null,
          sourceMappingKind: null,
          fieldOrigins: {
            executionProfileId: "runtime_fallback",
            preferredBackendIds: "runtime_fallback",
            accessMode: "runtime_fallback",
            validationPresetId: "runtime_fallback",
            reviewProfileId: "runtime_fallback",
          },
          sourceTaskId: "task-1",
          sourceRunId: "run-1",
          sourceReviewPackId: "review-pack:1",
        },
      });
    });

    rerender({ detail: createDetail("review-pack:2") });

    expect(result.current.preparedIntervention).toBeNull();
    expect(result.current.interventionBackendValue).toBe(DEFAULT_REVIEW_BACKEND_OPTION);
  });

  it("exposes a helper to drop the prepared intervention", async () => {
    const { result } = renderHook(() =>
      useReviewPackSurfaceController({
        detail: createDetail("review-pack:1"),
        defaultInterventionBackendId: null,
        interventionBackendOptions: [],
        onPrepareInterventionDraft: vi.fn(async () => undefined),
        onLaunchInterventionDraft: vi.fn(async () => undefined),
      })
    );

    await act(async () => {
      await result.current.handlePrepareInterventionDraft({
        workspaceId: "workspace-1",
        navigationTarget: null,
        actionId: "retry",
        draft: {
          intent: "retry",
          title: "Retry review",
          instruction: "Retry with a tighter scope.",
          profileId: "operator-review",
          reviewProfileId: null,
          validationPresetId: null,
          accessMode: "on-request",
          taskSource: null,
          sourceMappingKind: null,
          fieldOrigins: {
            executionProfileId: "runtime_fallback",
            preferredBackendIds: "runtime_fallback",
            accessMode: "runtime_fallback",
            validationPresetId: "runtime_fallback",
            reviewProfileId: "runtime_fallback",
          },
          sourceTaskId: "task-1",
          sourceRunId: "run-1",
          sourceReviewPackId: "review-pack:1",
        },
      });
    });

    expect(result.current.preparedIntervention).not.toBeNull();
    await act(async () => {
      result.current.resetPreparedIntervention();
    });

    expect(result.current.preparedIntervention).toBeNull();
    expect(result.current.launchingIntervention).toBe(false);
  });

  it("forwards review-agent launch requests through the controller", async () => {
    let resolveRunReviewAgent: (() => void) | null = null;
    const onRunReviewAgent = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRunReviewAgent = resolve;
        })
    );
    const { result } = renderHook(() =>
      useReviewPackSurfaceController({
        detail: createDetail("review-pack:1"),
        defaultInterventionBackendId: null,
        interventionBackendOptions: [],
        onPrepareInterventionDraft: vi.fn(async () => undefined),
        onLaunchInterventionDraft: vi.fn(async () => undefined),
        onRunReviewAgent,
      })
    );

    await act(async () => {
      const pending = result.current.handleRunReviewAgent({
        workspaceId: "workspace-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack:1",
      });
      resolveRunReviewAgent?.();
      await pending;
    });
    expect(onRunReviewAgent).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack:1",
    });
  });

  it("rethrows autofix launch errors from the controller", async () => {
    const { result } = renderHook(() =>
      useReviewPackSurfaceController({
        detail: createDetail("review-pack:1"),
        defaultInterventionBackendId: null,
        interventionBackendOptions: [],
        onPrepareInterventionDraft: vi.fn(async () => undefined),
        onLaunchInterventionDraft: vi.fn(async () => undefined),
        onApplyReviewAutofix: vi.fn(async () => {
          throw new Error("Runtime blocked autofix");
        }),
      })
    );

    let thrownError: unknown = null;
    await act(async () => {
      try {
        await result.current.handleApplyReviewAutofix({
          workspaceId: "workspace-1",
          taskId: "task-1",
          runId: "run-1",
          reviewPackId: "review-pack:1",
          autofixCandidate: {
            id: "autofix-1",
            summary: "Apply validation fix",
            status: "available",
          },
        });
      } catch (error) {
        thrownError = error;
      }
    });

    expect(thrownError).toBeInstanceOf(Error);
    expect((thrownError as Error).message).toBe("Runtime blocked autofix");
  });
});
