// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceRuntimeAgentControl } from "../../../application/runtime/ports/runtimeAgentControl";
import { useReviewPackDecisionActions } from "./useReviewPackDecisionActions";

vi.mock("../../../application/runtime/ports/runtimeAgentControl", () => ({
  useWorkspaceRuntimeAgentControl: vi.fn(),
}));

const useWorkspaceRuntimeAgentControlMock = vi.mocked(useWorkspaceRuntimeAgentControl);

describe("useReviewPackDecisionActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits runtime-backed review decisions and refreshes mission control", async () => {
    const actionRequiredSubmitV2 = vi.fn().mockResolvedValue("approved");
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    useWorkspaceRuntimeAgentControlMock.mockReturnValue({
      actionRequiredSubmitV2,
    } as ReturnType<typeof useWorkspaceRuntimeAgentControl>);

    const { result } = renderHook(() =>
      useReviewPackDecisionActions({
        workspaceId: "ws-1",
        onRefresh,
      })
    );

    await act(async () => {
      await result.current.submitDecision({
        reviewPackId: "review-pack:run-1",
        action: {
          id: "accept",
          label: "Accept result",
          detail: "Accept this runtime review pack.",
          enabled: true,
          disabledReason: null,
          navigationTarget: null,
          actionTarget: {
            kind: "review_decision",
            requestId: "review-pack:run-1",
            status: "approved",
          },
        },
      });
    });

    expect(actionRequiredSubmitV2).toHaveBeenCalledWith({
      requestId: "review-pack:run-1",
      kind: "review_decision",
      status: "approved",
      reason: null,
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(result.current.submission).toMatchObject({
      reviewPackId: "review-pack:run-1",
      actionId: "accept",
      phase: "recorded",
      recordedStatus: "approved",
      error: null,
    });
  });

  it("keeps the recorded decision visible when refresh fails after runtime accepts it", async () => {
    const actionRequiredSubmitV2 = vi.fn().mockResolvedValue("rejected");
    const onRefresh = vi.fn().mockRejectedValue(new Error("refresh failed"));
    useWorkspaceRuntimeAgentControlMock.mockReturnValue({
      actionRequiredSubmitV2,
    } as ReturnType<typeof useWorkspaceRuntimeAgentControl>);

    const { result } = renderHook(() =>
      useReviewPackDecisionActions({
        workspaceId: "ws-1",
        onRefresh,
      })
    );

    await act(async () => {
      await result.current.submitDecision({
        reviewPackId: "review-pack:run-3",
        action: {
          id: "reject",
          label: "Reject result",
          detail: "Reject this runtime review pack.",
          enabled: true,
          disabledReason: null,
          navigationTarget: null,
          actionTarget: {
            kind: "review_decision",
            requestId: "review-pack:run-3",
            status: "rejected",
          },
        },
      });
    });

    expect(actionRequiredSubmitV2).toHaveBeenCalledWith({
      requestId: "review-pack:run-3",
      kind: "review_decision",
      status: "rejected",
      reason: null,
    });
    expect(result.current.submission).toMatchObject({
      reviewPackId: "review-pack:run-3",
      actionId: "reject",
      phase: "recorded",
      recordedStatus: "rejected",
      error: null,
      warning: "Decision recorded, but mission control could not be refreshed yet.",
    });
  });

  it("surfaces an unsupported-runtime error when review decisions cannot be submitted", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    useWorkspaceRuntimeAgentControlMock.mockReturnValue({
      actionRequiredSubmitV2: undefined,
    } as ReturnType<typeof useWorkspaceRuntimeAgentControl>);

    const { result } = renderHook(() =>
      useReviewPackDecisionActions({
        workspaceId: "ws-1",
        onRefresh,
      })
    );

    await act(async () => {
      await result.current.submitDecision({
        reviewPackId: "review-pack:run-2",
        action: {
          id: "reject",
          label: "Reject result",
          detail: "Reject this runtime review pack.",
          enabled: true,
          disabledReason: null,
          navigationTarget: null,
          actionTarget: {
            kind: "review_decision",
            requestId: "review-pack:run-2",
            status: "rejected",
          },
        },
      });
    });

    expect(onRefresh).not.toHaveBeenCalled();
    expect(result.current.submission).toMatchObject({
      reviewPackId: "review-pack:run-2",
      actionId: "reject",
      error: "Review decisions are not supported by this runtime.",
    });
  });
});
