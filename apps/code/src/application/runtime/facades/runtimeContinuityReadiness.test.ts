import { describe, expect, it } from "vitest";
import { buildRuntimeContinuityReadiness } from "./runtimeContinuityReadiness";
import {
  buildRuntimeContinuationAggregate,
  type HugeCodeRunSummary,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeAgentTaskSummary } from "../types/webMcpBridge";

function buildRun(overrides: Partial<HugeCodeRunSummary> = {}): HugeCodeRunSummary {
  return {
    id: "run-1",
    taskId: "task-1",
    workspaceId: "workspace-1",
    state: "running",
    title: "Runtime continuity",
    summary: null,
    startedAt: 1,
    finishedAt: null,
    updatedAt: 2,
    currentStepIndex: 0,
    ...overrides,
  };
}

function buildTask(overrides: Partial<RuntimeAgentTaskSummary> = {}): RuntimeAgentTaskSummary {
  return {
    taskId: "task-1",
    workspaceId: "workspace-1",
    threadId: "thread-1",
    title: "Runtime continuity",
    status: "running",
    accessMode: "full-access",
    distributedStatus: "running",
    currentStep: 0,
    createdAt: 1,
    updatedAt: 2,
    startedAt: 1,
    completedAt: null,
    errorCode: null,
    errorMessage: null,
    pendingApprovalId: null,
    checkpointId: null,
    traceId: null,
    recovered: false,
    ...overrides,
  };
}

describe("buildRuntimeContinuityReadiness", () => {
  it("is ready when a recovered run can resume from a checkpoint", () => {
    const summary = buildRuntimeContinuityReadiness({
      candidates: [
        {
          run: buildRun({
            checkpoint: {
              state: "interrupted",
              lifecycleState: "interrupted",
              checkpointId: "checkpoint-1",
              traceId: "trace-1",
              recovered: true,
              updatedAt: 2,
              resumeReady: true,
              recoveredAt: 2,
              summary: "Run can resume from checkpoint-1.",
            },
          }),
          task: buildTask({
            status: "interrupted",
            recovered: true,
            checkpointId: "checkpoint-1",
            traceId: "trace-1",
          }),
        },
      ],
    });

    expect(summary.state).toBe("ready");
    expect(summary.recoverableRunCount).toBe(1);
    expect(summary.items[0]?.pathKind).toBe("resume");
    expect(summary.items[0]?.truthSourceLabel).toBe("Runtime checkpoint");
  });

  it("blocks when a recovered run lacks resume, handoff, and navigation truth", () => {
    const summary = buildRuntimeContinuityReadiness({
      candidates: [
        {
          run: buildRun({
            checkpoint: {
              state: "interrupted",
              lifecycleState: "interrupted",
              checkpointId: "checkpoint-1",
              traceId: "trace-1",
              recovered: true,
              updatedAt: 2,
              resumeReady: false,
              recoveredAt: 2,
              summary: "Recovered run missing a canonical continue path.",
            },
          }),
          task: buildTask({
            status: "interrupted",
            recovered: true,
            checkpointId: "checkpoint-1",
            traceId: "trace-1",
          }),
        },
      ],
    });

    expect(summary.state).toBe("blocked");
    expect(summary.blockingReason).toContain("canonical continue path");
    expect(summary.missingPathCount).toBe(1);
    expect(summary.items[0]?.pathKind).toBe("missing");
  });

  it("blocks when runtime review actionability is blocked", () => {
    const summary = buildRuntimeContinuityReadiness({
      candidates: [
        {
          run: buildRun({
            state: "review_ready",
            actionability: {
              state: "blocked",
              summary: "Review cannot continue until missing evidence is restored.",
              degradedReasons: ["runtime_evidence_incomplete"],
              actions: [],
            },
          }),
          task: buildTask({
            status: "completed",
          }),
        },
      ],
    });

    expect(summary.state).toBe("blocked");
    expect(summary.reviewBlockedCount).toBe(1);
    expect(summary.items[0]?.pathKind).toBe("review");
  });

  it("prefers takeover approval truth before review-ready continuation", () => {
    const summary = buildRuntimeContinuityReadiness({
      candidates: [
        {
          run: buildRun({
            state: "review_ready",
            actionability: {
              state: "ready",
              summary: "Review can continue from the Review Pack.",
              degradedReasons: [],
              actions: [],
            },
            takeoverBundle: {
              pathKind: "approval",
              primaryAction: "approve",
              state: "ready",
              summary: "Operator approval is required before the run can continue.",
              recommendedAction: "Open the pending approval and decide before continuing.",
              target: {
                kind: "run",
                workspaceId: "workspace-1",
                taskId: "task-1",
                runId: "run-1",
              },
            },
          }),
          task: buildTask({
            status: "completed",
          }),
        },
      ],
    });

    expect(summary.state).toBe("attention");
    expect(summary.reviewBlockedCount).toBe(0);
    expect(summary.items[0]).toMatchObject({
      pathKind: "approval",
      detail: "Operator approval is required before the run can continue.",
      recommendedAction: "Open the pending approval and decide before continuing.",
      truthSourceLabel: "Runtime takeover bundle",
    });
  });

  it("does not reconstruct checkpoint truth from execution graph when runtime omits it", () => {
    const summary = buildRuntimeContinuityReadiness({
      candidates: [
        {
          run: buildRun({
            executionGraph: {
              graphId: "graph-task-1",
              nodes: [
                {
                  id: "graph-task-1:root",
                  kind: "plan",
                  resolvedBackendId: "backend-1",
                  checkpoint: {
                    state: "interrupted",
                    lifecycleState: "interrupted",
                    checkpointId: "checkpoint-graph-1",
                    traceId: "trace-graph-1",
                    recovered: true,
                    updatedAt: 2,
                    resumeReady: true,
                    recoveredAt: 2,
                    summary: "Graph root can resume from checkpoint-graph-1.",
                  },
                },
              ],
              edges: [],
            },
          }),
          task: buildTask(),
        },
      ],
    });

    expect(summary.state).toBe("ready");
    expect(summary.recoverableRunCount).toBe(0);
    expect(summary.items).toHaveLength(0);
  });

  it("keeps continuity at attention when review actionability is degraded", () => {
    const summary = buildRuntimeContinuityReadiness({
      candidates: [
        {
          run: buildRun({
            state: "review_ready",
            actionability: {
              state: "degraded",
              summary: "Review can continue, but placement confirmation is incomplete.",
              degradedReasons: ["placement_unconfirmed"],
              actions: [],
            },
          }),
          task: buildTask({
            status: "completed",
          }),
        },
      ],
    });

    expect(summary.state).toBe("attention");
    expect(summary.blockingReason).toBeNull();
    expect(summary.items[0]?.pathKind).toBe("review");
  });

  it("requires runtime-published review actionability for review-ready runs", () => {
    const summary = buildRuntimeContinuityReadiness({
      candidates: [
        {
          run: buildRun({
            state: "review_ready",
            executionGraph: {
              graphId: "graph-task-1",
              nodes: [
                {
                  id: "graph-task-1:root",
                  kind: "plan",
                  resolvedBackendId: "backend-1",
                  reviewActionability: {
                    state: "blocked",
                    summary: "Review is blocked until graph-linked evidence is restored.",
                    degradedReasons: ["runtime_evidence_incomplete"],
                    actions: [],
                  },
                },
              ],
              edges: [],
            },
          }),
          task: buildTask({
            status: "completed",
          }),
        },
      ],
    });

    expect(summary.state).toBe("attention");
    expect(summary.blockingReason).toBeNull();
    expect(summary.reviewBlockedCount).toBe(0);
    expect(summary.items[0]).toMatchObject({
      pathKind: "missing",
      truthSourceLabel: "Runtime truth unavailable",
    });
  });

  it("accepts runtime review actionability even when the run state has not flipped to review_ready", () => {
    const summary = buildRuntimeContinuityReadiness({
      candidates: [
        {
          run: buildRun({
            state: "validating",
            actionability: {
              state: "blocked",
              summary: "Runtime blocked follow-up until validation evidence is repaired.",
              degradedReasons: ["runtime_evidence_incomplete"],
              actions: [],
            },
          }),
          task: buildTask({
            status: "running",
          }),
        },
      ],
    });

    expect(summary.state).toBe("blocked");
    expect(summary.reviewBlockedCount).toBe(1);
    expect(summary.items[0]).toMatchObject({
      pathKind: "review",
      truthSourceLabel: "Runtime review actionability",
    });
  });

  it("recognizes canonical handoff when publish handoff or mission linkage is present", () => {
    const summary = buildRuntimeContinuityReadiness({
      candidates: [
        {
          run: buildRun({
            publishHandoff: {
              jsonPath: ".hugecode/runs/task-1/publish/handoff.json",
              markdownPath: ".hugecode/runs/task-1/publish/handoff.md",
              reason: "completed",
              summary: "AutoDrive prepared publish handoff.",
              at: 2,
              branchName: "autodrive/runtime-truth-task-1",
              reviewTitle: "Ship runtime truth",
            },
            missionLinkage: {
              workspaceId: "workspace-1",
              taskId: "task-1",
              runId: "run-1",
              reviewPackId: "review-pack:run-1",
              checkpointId: "checkpoint-1",
              traceId: "trace-1",
              threadId: "thread-1",
              requestId: "request-1",
              missionTaskId: "runtime-task:task-1",
              taskEntityKind: "thread",
              recoveryPath: "thread",
              navigationTarget: {
                kind: "thread",
                workspaceId: "workspace-1",
                threadId: "thread-1",
              },
              summary: "Open thread-1 on another control device.",
            },
          }),
          task: buildTask({
            status: "completed",
          }),
        },
      ],
    });

    expect(summary.state).toBe("attention");
    expect(summary.handoffReadyCount).toBe(1);
    expect(summary.items[0]?.state).toBe("attention");
    expect(summary.items[0]?.pathKind).toBe("handoff");
    expect(summary.missingPathCount).toBe(0);
  });

  it("prefers takeover bundles over checkpoint and mission linkage fragments", () => {
    const summary = buildRuntimeContinuityReadiness({
      candidates: [
        {
          run: buildRun({
            checkpoint: {
              state: "interrupted",
              lifecycleState: "interrupted",
              checkpointId: "checkpoint-1",
              traceId: "trace-1",
              recovered: true,
              updatedAt: 2,
              resumeReady: false,
              recoveredAt: 2,
              summary: "Recovered run missing a local resume path.",
            },
            missionLinkage: {
              workspaceId: "workspace-1",
              taskId: "task-1",
              runId: "run-1",
              reviewPackId: "review-pack:run-1",
              checkpointId: "checkpoint-1",
              traceId: "trace-1",
              threadId: "thread-1",
              requestId: "request-1",
              missionTaskId: "runtime-task:task-1",
              taskEntityKind: "thread",
              recoveryPath: "thread",
              navigationTarget: {
                kind: "thread",
                workspaceId: "workspace-1",
                threadId: "thread-1",
              },
              summary: "Open thread-1 on another control device.",
            },
            takeoverBundle: {
              state: "ready",
              pathKind: "resume",
              primaryAction: "resume",
              summary: "Runtime takeover bundle published a canonical resume path.",
              recommendedAction: "Resume this run from takeover.",
              checkpointId: "checkpoint-1",
              traceId: "trace-1",
            },
          }),
          task: buildTask({
            status: "interrupted",
            recovered: true,
            checkpointId: "checkpoint-1",
            traceId: "trace-1",
          }),
        },
      ],
    });

    expect(summary.state).toBe("ready");
    expect(summary.recoverableRunCount).toBe(1);
    expect(summary.handoffReadyCount).toBe(0);
    expect(summary.items[0]).toMatchObject({
      pathKind: "resume",
      detail: "Runtime takeover bundle published a canonical resume path.",
      recommendedAction: "Resume this run from takeover.",
      truthSourceLabel: "Runtime takeover bundle",
    });
  });

  it("uses takeover-bundle review guidance before top-level review actionability", () => {
    const summary = buildRuntimeContinuityReadiness({
      candidates: [
        {
          run: buildRun({
            state: "review_ready",
            actionability: {
              state: "blocked",
              summary: "Top-level review actionability is stale.",
              degradedReasons: ["runtime_evidence_incomplete"],
              actions: [],
            },
            takeoverBundle: {
              state: "ready",
              pathKind: "review",
              primaryAction: "open_review_pack",
              summary: "Takeover bundle says review can continue.",
              recommendedAction: "Open Review Pack from takeover guidance.",
              reviewActionability: {
                state: "ready",
                summary: "Takeover review actionability is canonical.",
                degradedReasons: [],
                actions: [],
              },
            },
          }),
          task: buildTask({
            status: "completed",
          }),
        },
      ],
    });

    expect(summary.state).toBe("ready");
    expect(summary.items[0]).toMatchObject({
      pathKind: "review",
      detail: "Takeover review actionability is canonical.",
      recommendedAction: "Open Review Pack from takeover guidance.",
      truthSourceLabel: "Runtime takeover bundle",
    });
  });

  it("stays in parity with the shared canonical continuation aggregate", () => {
    const run = buildRun({
      state: "review_ready",
      takeoverBundle: {
        state: "ready",
        pathKind: "review",
        primaryAction: "open_review_pack",
        summary: "Takeover bundle published the canonical review path.",
        recommendedAction: "Open Review Pack from takeover truth.",
        reviewPackId: "review-pack:run-1",
      },
      actionability: {
        state: "blocked",
        summary: "Stale top-level actionability should not win.",
        degradedReasons: [],
        actions: [],
      },
    });

    const summary = buildRuntimeContinuityReadiness({
      candidates: [{ run, task: buildTask({ status: "completed" }) }],
    });
    const aggregate = buildRuntimeContinuationAggregate({
      candidates: [
        {
          runId: run.id,
          taskId: run.taskId,
          runState: run.state,
          checkpoint: run.checkpoint ?? null,
          missionLinkage: run.missionLinkage ?? null,
          actionability: run.actionability ?? null,
          publishHandoff: run.publishHandoff ?? null,
          takeoverBundle: run.takeoverBundle ?? null,
          nextAction: run.nextAction ?? null,
          reviewPackId: "review-pack:run-1",
        },
      ],
    });

    expect(summary.state).toBe(aggregate.state);
    expect(summary.items[0]?.pathKind).toBe(aggregate.items[0]?.pathKind);
    expect(summary.items[0]?.detail).toBe(aggregate.items[0]?.summary);
    expect(summary.items[0]?.recommendedAction).toBe(aggregate.items[0]?.recommendedAction);
  });

  it("keeps continuity at attention when checkpoint durability degraded recently", () => {
    const summary = buildRuntimeContinuityReadiness({
      candidates: [],
      durabilityWarning: {
        degraded: true,
      },
    });

    expect(summary.state).toBe("attention");
    expect(summary.durabilityDegraded).toBe(true);
  });
});
