// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeRunGetV2Response } from "@ku0/code-runtime-host-contract";
import { createRuntimeUpdatedEventFixture } from "../../../test/runtimeUpdatedEventFixtures";
import { useRuntimeReviewPackRuntimeTruth } from "./runtimeReviewPackRuntimeTruth";
import { useRuntimeRunRecordTruth } from "./runtimeRunRecordTruth";
import { __resetRuntimeRunTruthStoreForTests } from "./runtimeRunTruthStore";

const { getRuntimeRunV2Mock, subscribeRuntimeRunV2Mock, runtimeUpdatedHarness } = vi.hoisted(
  () => ({
    getRuntimeRunV2Mock: vi.fn(),
    subscribeRuntimeRunV2Mock: vi.fn(),
    runtimeUpdatedHarness: (() => {
      const registrations: Array<{
        options: {
          workspaceId?: string | null | (() => string | null);
          scopes?: readonly string[];
        };
        listener: (event: {
          scope: string[];
          eventWorkspaceId: string;
          paramsWorkspaceId: string | null;
          isWorkspaceLocalEvent: boolean;
        }) => void;
      }> = [];
      return {
        subscribeScopedRuntimeUpdatedEvents(
          options: {
            workspaceId?: string | null | (() => string | null);
            scopes?: readonly string[];
          },
          listener: (event: {
            scope: string[];
            eventWorkspaceId: string;
            paramsWorkspaceId: string | null;
            isWorkspaceLocalEvent: boolean;
          }) => void
        ) {
          const registration = { options, listener };
          registrations.push(registration);
          return () => {
            const index = registrations.indexOf(registration);
            if (index >= 0) {
              registrations.splice(index, 1);
            }
          };
        },
        emitRuntimeUpdated(event: {
          scope: string[];
          eventWorkspaceId: string;
          paramsWorkspaceId: string | null;
          isWorkspaceLocalEvent: boolean;
        }) {
          for (const registration of registrations) {
            const workspaceId =
              typeof registration.options.workspaceId === "function"
                ? registration.options.workspaceId()
                : (registration.options.workspaceId ?? null);
            if (
              workspaceId &&
              !(
                event.eventWorkspaceId === workspaceId ||
                event.paramsWorkspaceId === workspaceId ||
                (event.isWorkspaceLocalEvent &&
                  (event.paramsWorkspaceId === null || event.paramsWorkspaceId === workspaceId))
              )
            ) {
              continue;
            }
            const scopes = new Set(
              (registration.options.scopes ?? [])
                .map((scope) => scope.trim())
                .filter((scope) => scope.length > 0)
            );
            if (scopes.size > 0 && !event.scope.some((scope) => scopes.has(scope))) {
              continue;
            }
            registration.listener(event);
          }
        },
        reset() {
          registrations.splice(0, registrations.length);
        },
      };
    })(),
  })
);

vi.mock("../ports/tauriRuntimeJobs", () => ({
  getRuntimeRunV2: getRuntimeRunV2Mock,
  subscribeRuntimeRunV2: subscribeRuntimeRunV2Mock,
}));

vi.mock("../ports/runtimeUpdatedEvents", () => ({
  subscribeScopedRuntimeUpdatedEvents: runtimeUpdatedHarness.subscribeScopedRuntimeUpdatedEvents,
}));

function createRunRecord(summary: string): RuntimeRunGetV2Response {
  return {
    run: {
      taskId: "run-1",
      workspaceId: "workspace-1",
      threadId: null,
      requestId: null,
      title: "Runtime task",
      status: "running",
      accessMode: "on-request",
      executionMode: "single",
      provider: null,
      modelId: null,
      routedProvider: null,
      routedModelId: null,
      routedPool: null,
      routedSource: null,
      currentStep: 1,
      createdAt: 1,
      updatedAt: 1,
      startedAt: 1,
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      pendingApprovalId: null,
      executionProfileId: null,
      executionProfile: null,
      profileReadiness: null,
      routing: null,
      approvalState: null,
      reviewDecision: null,
      reviewPackId: "review-pack:1",
      intervention: null,
      operatorState: null,
      nextAction: null,
      missionBrief: null,
      relaunchContext: null,
      publishHandoff: null,
      autoDrive: null,
      checkpointId: null,
      traceId: null,
      recovered: null,
      checkpointState: null,
      missionLinkage: null,
      reviewActionability: null,
      takeoverBundle: null,
      executionGraph: null,
      runSummary: null,
      reviewPackSummary: null,
      backendId: null,
      preferredBackendIds: null,
      taskSource: null,
      rootTaskId: null,
      parentTaskId: null,
      childTaskIds: [],
      steps: [],
    },
    missionRun: {
      id: "run-1",
      taskId: "run-1",
      workspaceId: "workspace-1",
      title: "Runtime task",
      state: "running",
      summary,
      startedAt: 1,
      updatedAt: 1,
      reviewPackId: "review-pack:1",
    },
    reviewPack: {
      id: "review-pack:1",
      workspaceId: "workspace-1",
      taskId: "run-1",
      runId: "run-1",
      summary,
      createdAt: 1,
      reviewStatus: "ready",
      evidenceState: "confirmed",
      validationOutcome: "passed",
      warningCount: 0,
      warnings: [],
      validations: [],
      artifacts: [],
      checksPerformed: [],
      recommendedNextAction: null,
      reviewDecision: {
        status: "pending",
        reviewPackId: "review-pack:1",
        label: "Decision pending",
        summary: "Accept or reject this result from the review surface.",
        decidedAt: null,
      },
      reviewFindings: [],
      skillUsage: [],
      assumptions: [],
      reproductionGuidance: [],
      rollbackGuidance: [],
      limitations: [],
      relaunchOptions: [],
      subAgentSummary: [],
      emptySectionLabels: {},
    },
  } as RuntimeRunGetV2Response;
}

describe("runtimeRunTruthStore", () => {
  beforeEach(() => {
    getRuntimeRunV2Mock.mockReset();
    subscribeRuntimeRunV2Mock.mockReset();
    runtimeUpdatedHarness.reset();
    __resetRuntimeRunTruthStoreForTests();
  });

  afterEach(() => {
    cleanup();
    __resetRuntimeRunTruthStoreForTests();
  });

  it("deduplicates concurrent run truth hydration for the same run", async () => {
    getRuntimeRunV2Mock.mockResolvedValue(createRunRecord("Initial summary"));

    const first = renderHook(() =>
      useRuntimeRunRecordTruth({
        runId: "run-1",
        workspaceId: "workspace-1",
      })
    );
    const second = renderHook(() =>
      useRuntimeRunRecordTruth({
        runId: "run-1",
        workspaceId: "workspace-1",
      })
    );

    await waitFor(() =>
      expect(first.result.current.record?.missionRun.summary).toBe("Initial summary")
    );
    await waitFor(() =>
      expect(second.result.current.record?.missionRun.summary).toBe("Initial summary")
    );

    expect(getRuntimeRunV2Mock).toHaveBeenCalledTimes(1);

    first.unmount();
    second.unmount();
  });

  it("refreshes subscribed run truth when runtime publishes an agents update", async () => {
    getRuntimeRunV2Mock.mockResolvedValue(createRunRecord("Initial summary"));
    subscribeRuntimeRunV2Mock.mockResolvedValue(createRunRecord("Updated summary"));

    const { result } = renderHook(() =>
      useRuntimeRunRecordTruth({
        runId: "run-1",
        workspaceId: "workspace-1",
      })
    );

    await waitFor(() => expect(result.current.record?.missionRun.summary).toBe("Initial summary"));

    runtimeUpdatedHarness.emitRuntimeUpdated(
      createRuntimeUpdatedEventFixture({
        paramsWorkspaceId: "workspace-1",
        scope: ["agents"],
        reason: "runUpsert",
      })
    );

    await waitFor(() => expect(subscribeRuntimeRunV2Mock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.record?.missionRun.summary).toBe("Updated summary"));
  });

  it("shares review truth hydration with the run truth store", async () => {
    getRuntimeRunV2Mock.mockResolvedValue(createRunRecord("Review summary"));

    const review = renderHook(() =>
      useRuntimeReviewPackRuntimeTruth({
        projection: {} as never,
        selection: {
          request: null,
          status: "selected",
          detailKind: "review_pack",
          source: null,
          selectedWorkspaceId: "workspace-1",
          selectedTaskId: "run-1",
          selectedRunId: "run-1",
          selectedReviewPackId: "review-pack:1",
          fallbackReason: null,
        },
      })
    );
    const run = renderHook(() =>
      useRuntimeRunRecordTruth({
        runId: "run-1",
        workspaceId: "workspace-1",
      })
    );

    await waitFor(() => expect(review.result.current.reviewPack?.summary).toBe("Review summary"));
    await waitFor(() =>
      expect(run.result.current.record?.missionRun.summary).toBe("Review summary")
    );

    expect(getRuntimeRunV2Mock).toHaveBeenCalledTimes(1);
  });
});
