import { describe, expect, it } from "vitest";
import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import {
  buildLatestMissionRunsFromProjection,
  buildMissionOverviewCountsFromProjection,
  buildMissionOverviewItemsFromProjection,
  buildMissionReviewEntriesFromProjection,
  formatMissionOverviewStateLabel,
} from "./missionControlPresentation";

function createProjection(): HugeCodeMissionControlSnapshot {
  return {
    source: "runtime_snapshot_v1",
    generatedAt: 3_000,
    workspaces: [
      {
        id: "ws-1",
        name: "Workspace One",
        rootPath: "/tmp/workspace-one",
        connected: true,
        defaultProfileId: null,
      },
    ],
    tasks: [
      {
        id: "task-1",
        workspaceId: "ws-1",
        title: "Refactor review routing",
        objective: "Refactor review routing",
        origin: {
          kind: "thread",
          threadId: "thread-1",
          runId: "run-1",
          requestId: null,
        },
        mode: "pair",
        modeSource: "execution_profile",
        status: "review_ready",
        createdAt: 1_000,
        updatedAt: 3_000,
        currentRunId: null,
        latestRunId: "run-1",
        latestRunState: "review_ready",
        nextAction: {
          label: "Review the evidence",
          action: "review",
          detail: null,
        },
      },
    ],
    runs: [
      {
        id: "run-1",
        taskId: "task-1",
        workspaceId: "ws-1",
        state: "review_ready",
        title: "Refactor review routing",
        summary: "Runtime evidence is ready for review.",
        startedAt: 1_500,
        finishedAt: 3_000,
        updatedAt: 3_000,
        currentStepIndex: 0,
        warnings: [],
        validations: [],
        artifacts: [],
        reviewPackId: "review-pack:run-1",
      },
    ],
    reviewPacks: [
      {
        id: "review-pack:run-1",
        runId: "run-1",
        taskId: "task-1",
        workspaceId: "ws-1",
        summary: "Runtime evidence is ready for review.",
        reviewStatus: "ready",
        evidenceState: "confirmed",
        validationOutcome: "passed",
        warningCount: 0,
        warnings: [],
        validations: [],
        artifacts: [],
        checksPerformed: [],
        recommendedNextAction: "Open Review and inspect the pack.",
        createdAt: 3_000,
      },
    ],
  };
}

describe("missionControlPresentation", () => {
  it("formats mission overview state labels through one shared helper", () => {
    expect(formatMissionOverviewStateLabel("running")).toBe("Running");
    expect(formatMissionOverviewStateLabel("needsAction")).toBe("Waiting");
    expect(formatMissionOverviewStateLabel("reviewReady")).toBe("Review ready");
    expect(formatMissionOverviewStateLabel("ready")).toBe("Ready");
  });

  it("routes thread-backed review-ready missions into the review surface", () => {
    const [item] = buildMissionOverviewItemsFromProjection(createProjection(), {
      workspaceId: "ws-1",
      activeThreadId: "thread-1",
      limit: 6,
    });

    expect(item).toMatchObject({
      threadId: "thread-1",
      isActive: true,
      navigationTarget: {
        kind: "mission",
        workspaceId: "ws-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack:run-1",
        threadId: "thread-1",
        limitation: null,
      },
    });
  });

  it("surfaces task source labels alongside mission state metadata", () => {
    const projection: HugeCodeMissionControlSnapshot = {
      ...createProjection(),
      tasks: [
        {
          ...createProjection().tasks[0],
          taskSource: {
            kind: "github_issue",
            label: "GitHub issue #42 · ku0/hugecode",
            shortLabel: "Issue #42",
            title: "Refactor review routing",
            reference: "#42",
            url: "https://github.com/ku0/hugecode/issues/42",
          },
        },
      ],
    };

    const [item] = buildMissionOverviewItemsFromProjection(projection, {
      workspaceId: "ws-1",
      activeThreadId: null,
      limit: 6,
    });

    expect(item.secondaryLabel).toBe("Issue #42");
  });

  it("projects operator signals and review risks into mission overview items", () => {
    const projection: HugeCodeMissionControlSnapshot = {
      ...createProjection(),
      tasks: [
        {
          ...createProjection().tasks[0],
          id: "task-running",
          title: "Prepare migration",
          latestRunId: "run-running",
          latestRunState: "running",
        },
      ],
      runs: [
        {
          ...createProjection().runs[0],
          id: "run-running",
          taskId: "task-running",
          state: "running",
          reviewPackId: "review-pack:run-running",
          operatorSnapshot: {
            summary: "OpenAI gpt-5.3-codex is running on backend-review-a.",
            runtimeLabel: "remote sandbox",
            provider: "openai",
            modelId: "gpt-5.3-codex",
            reasoningEffort: "high",
            backendId: "backend-review-a",
            machineId: null,
            machineSummary: "backend known, machine not published",
            workspaceRoot: "/tmp/workspace-one",
            currentActivity: "Running validation command",
            blocker: "Awaiting approval before write step.",
            recentEvents: [
              {
                kind: "approval_wait",
                label: "Approval wait",
                detail: "Runtime paused for an operator decision.",
                at: 2_900,
              },
            ],
          },
          approval: {
            status: "pending_decision",
            approvalId: "approval-1",
            label: "Approval pending",
            summary: "Runtime paused for an operator decision.",
          },
        },
      ],
      reviewPacks: [
        {
          ...createProjection().reviewPacks[0],
          id: "review-pack:run-running",
          runId: "run-running",
          taskId: "task-running",
          reviewStatus: "incomplete_evidence",
          placement: {
            resolvedBackendId: "backend-review-b",
            requestedBackendIds: ["backend-review-a"],
            resolutionSource: "runtime_fallback",
            lifecycleState: "fallback",
            readiness: "ready",
            healthSummary: "placement_attention",
            attentionReasons: ["fallback_backend_selected"],
            summary: "Runtime confirmed fallback placement on backend backend-review-b.",
            rationale: "Fallback route.",
          },
        },
      ],
    };

    const [item] = buildMissionOverviewItemsFromProjection(projection, {
      workspaceId: "ws-1",
      activeThreadId: null,
      limit: 6,
    });

    expect(item).toMatchObject({
      operatorSignal: "Running validation command",
      attentionSignals: ["Approval pending", "Blocked", "Fallback route", "Evidence incomplete"],
    });
  });

  it("surfaces checkpoint and handoff truth in mission overview actions and signals", () => {
    const projection: HugeCodeMissionControlSnapshot = {
      ...createProjection(),
      tasks: [
        {
          ...createProjection().tasks[0],
          id: "task-resume",
          title: "Resume runtime handoff",
          latestRunId: "run-resume",
          latestRunState: "running",
        },
      ],
      runs: [
        {
          ...createProjection().runs[0],
          id: "run-resume",
          taskId: "task-resume",
          state: "running",
          reviewPackId: "review-pack:run-resume",
          checkpoint: {
            state: "interrupted",
            lifecycleState: "interrupted",
            checkpointId: "checkpoint-run-resume",
            traceId: "trace-run-resume",
            recovered: true,
            updatedAt: 2_950,
            resumeReady: true,
            recoveredAt: 2_900,
            summary: "Runtime recovered the run from a checkpoint. Resume to continue.",
          },
        },
      ],
      reviewPacks: [
        {
          ...createProjection().reviewPacks[0],
          id: "review-pack:run-resume",
          runId: "run-resume",
          taskId: "task-resume",
          summary: "Recovered runtime handoff is ready for supervision.",
        },
      ],
    };

    const [item] = buildMissionOverviewItemsFromProjection(projection, {
      workspaceId: "ws-1",
      activeThreadId: null,
      limit: 6,
    });

    expect(item.summary).toBe("Runtime recovered the run from a checkpoint. Resume to continue.");
    expect(item.attentionSignals).toContain(
      "Runtime recovered the run from a checkpoint. Resume to continue."
    );
    expect(item.operatorActionLabel).toBe("Open review");
    expect(item.operatorActionDetail).toBe(
      "Runtime recovered the run from a checkpoint. Resume to continue."
    );
  });

  it("prefers takeover approval truth for mission overview actions and continuation copy", () => {
    const projection: HugeCodeMissionControlSnapshot = {
      ...createProjection(),
      tasks: [
        {
          ...createProjection().tasks[0],
          id: "task-approval",
          title: "Approve review continuation",
          latestRunId: "run-approval",
          latestRunState: "review_ready",
        },
      ],
      runs: [
        {
          ...createProjection().runs[0],
          id: "run-approval",
          taskId: "task-approval",
          state: "review_ready",
          reviewPackId: "review-pack:run-approval",
          takeoverBundle: {
            pathKind: "approval",
            primaryAction: "approve",
            state: "ready",
            summary: "Approval is the first required continuation step.",
            recommendedAction: "Open the pending approval before reopening review.",
            target: {
              kind: "run",
              workspaceId: "ws-1",
              taskId: "task-approval",
              runId: "run-approval",
              reviewPackId: "review-pack:run-approval",
            },
          },
        },
      ],
      reviewPacks: [
        {
          ...createProjection().reviewPacks[0],
          id: "review-pack:run-approval",
          runId: "run-approval",
          taskId: "task-approval",
          recommendedNextAction: "Legacy review follow-up",
        },
      ],
    };

    const [item] = buildMissionOverviewItemsFromProjection(projection, {
      workspaceId: "ws-1",
      activeThreadId: null,
      limit: 6,
    });

    expect(item.operatorActionLabel).toBe("Open approval");
    expect(item.operatorActionDetail).toBe("Open the pending approval before reopening review.");
    expect(item.continuationLabel).toBe("Approval is the first required continuation step.");
    expect(item.continuePathLabel).toBe("Mission run");
  });

  it("builds latest mission entries that open review-pack detail for thread-backed review packs", () => {
    const [entry] = buildLatestMissionRunsFromProjection(createProjection(), {
      getWorkspaceGroupName: () => null,
      limit: 3,
    });

    expect(entry).toMatchObject({
      threadId: "thread-1",
      taskId: "task-1",
      runId: "run-1",
      statusKind: "review_ready",
      navigationTarget: {
        kind: "mission",
        workspaceId: "ws-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack:run-1",
        threadId: "thread-1",
        limitation: null,
      },
      operatorActionLabel: "Open review",
      operatorActionTarget: {
        kind: "review",
        workspaceId: "ws-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack:run-1",
        limitation: null,
      },
    });
  });

  it("prefers takeover handoff truth for latest mission actions", () => {
    const projection: HugeCodeMissionControlSnapshot = {
      ...createProjection(),
      tasks: [
        {
          ...createProjection().tasks[0],
          id: "task-handoff",
          title: "Cross-device handoff",
          latestRunId: "run-handoff",
          latestRunState: "review_ready",
        },
      ],
      runs: [
        {
          ...createProjection().runs[0],
          id: "run-handoff",
          taskId: "task-handoff",
          reviewPackId: "review-pack:run-handoff",
          takeoverBundle: {
            pathKind: "handoff",
            primaryAction: "open_handoff",
            state: "ready",
            summary: "Continue from the mission thread on another control device.",
            recommendedAction: "Open the handoff target on the mission thread.",
            target: {
              kind: "thread",
              workspaceId: "ws-1",
              threadId: "thread-1",
            },
          },
        },
      ],
      reviewPacks: [
        {
          ...createProjection().reviewPacks[0],
          id: "review-pack:run-handoff",
          runId: "run-handoff",
          taskId: "task-handoff",
        },
      ],
    };

    const [entry] = buildLatestMissionRunsFromProjection(projection, {
      getWorkspaceGroupName: () => null,
      limit: 3,
    });

    expect(entry.operatorActionLabel).toBe("Open handoff");
    expect(entry.operatorActionDetail).toBe("Open the handoff target on the mission thread.");
    expect(entry.operatorActionTarget).toEqual({
      kind: "thread",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });
  });
  it("uses runtime-inspection language for runtime-managed latest mission fallbacks", () => {
    const projection: HugeCodeMissionControlSnapshot = {
      ...createProjection(),
      tasks: [
        {
          ...createProjection().tasks[0],
          id: "runtime-task:task-2",
          title: "Runtime-only approval flow",
          origin: {
            kind: "run",
            threadId: null,
            runId: "run-2",
            requestId: null,
          },
          latestRunId: "run-2",
          latestRunState: "paused",
        },
      ],
      runs: [
        {
          ...createProjection().runs[0],
          id: "run-2",
          taskId: "runtime-task:task-2",
          state: "paused",
          reviewPackId: null,
        },
      ],
      reviewPacks: [],
    };

    const [entry] = buildLatestMissionRunsFromProjection(projection, {
      getWorkspaceGroupName: () => null,
      limit: 3,
    });

    expect(entry.operatorActionLabel).toBe("Inspect runtime");
  });

  it("orders review queue items by in-review entry time and excludes done items", () => {
    const projection: HugeCodeMissionControlSnapshot = {
      ...createProjection(),
      tasks: [
        {
          ...createProjection().tasks[0],
          id: "task-in-review",
          title: "Newest review",
          latestRunId: "run-in-review",
          updatedAt: 5_000,
          accountability: {
            lifecycle: "in_review",
            claimedBy: "local-operator",
            claimedAt: 2_000,
            lifecycleUpdatedAt: 4_900,
          },
        },
        {
          ...createProjection().tasks[0],
          id: "task-fallback",
          title: "Fallback route review",
          latestRunId: "run-fallback",
          updatedAt: 4_000,
          accountability: {
            lifecycle: "in_review",
            claimedBy: "local-operator",
            claimedAt: 1_500,
            lifecycleUpdatedAt: 4_500,
          },
        },
        {
          ...createProjection().tasks[0],
          id: "task-done",
          title: "Accepted review",
          latestRunId: "run-done",
          updatedAt: 6_000,
          accountability: {
            lifecycle: "done",
            claimedBy: "local-operator",
            claimedAt: 1_000,
            lifecycleUpdatedAt: 5_900,
          },
        },
      ],
      runs: [
        {
          ...createProjection().runs[0],
          id: "run-in-review",
          taskId: "task-in-review",
          reviewPackId: "review-pack:run-in-review",
        },
        {
          ...createProjection().runs[0],
          id: "run-fallback",
          taskId: "task-fallback",
          reviewPackId: "review-pack:run-fallback",
          placement: {
            resolvedBackendId: "backend-b",
            requestedBackendIds: ["backend-a"],
            resolutionSource: "runtime_fallback",
            lifecycleState: "fallback",
            readiness: "ready",
            healthSummary: "placement_attention",
            attentionReasons: ["fallback_backend_selected"],
            summary: "Runtime confirmed fallback placement on backend backend-b.",
            rationale: "Fallback route.",
          },
          subAgents: [
            {
              sessionId: "agent-2",
              status: "awaiting_approval",
              summary: "Waiting for operator review",
            },
          ],
        },
        {
          ...createProjection().runs[0],
          id: "run-done",
          taskId: "task-done",
          reviewDecision: {
            status: "accepted",
            reviewPackId: "review-pack:run-done",
            label: "Accepted",
            summary: "Accepted in review.",
            decidedAt: 5_900,
          },
          reviewPackId: "review-pack:run-done",
        },
      ],
      reviewPacks: [
        {
          ...createProjection().reviewPacks[0],
          id: "review-pack:run-in-review",
          runId: "run-in-review",
          taskId: "task-in-review",
          createdAt: 4_200,
        },
        {
          ...createProjection().reviewPacks[0],
          id: "review-pack:run-fallback",
          runId: "run-fallback",
          taskId: "task-fallback",
          reviewStatus: "incomplete_evidence",
          createdAt: 4_000,
          placement: {
            resolvedBackendId: "backend-b",
            requestedBackendIds: ["backend-a"],
            resolutionSource: "runtime_fallback",
            lifecycleState: "fallback",
            readiness: "ready",
            healthSummary: "placement_attention",
            attentionReasons: ["fallback_backend_selected"],
            summary: "Runtime confirmed fallback placement on backend backend-b.",
            rationale: "Fallback route.",
          },
          subAgentSummary: [
            {
              sessionId: "agent-2",
              status: "awaiting_approval",
              summary: "Waiting for operator review",
            },
          ],
        },
        {
          ...createProjection().reviewPacks[0],
          id: "review-pack:run-done",
          runId: "run-done",
          taskId: "task-done",
          reviewDecision: {
            status: "accepted",
            reviewPackId: "review-pack:run-done",
            label: "Accepted",
            summary: "Accepted in review.",
            decidedAt: 5_900,
          },
          createdAt: 5_800,
        },
      ],
    };

    const entries = buildMissionReviewEntriesFromProjection(projection, {
      workspaceId: "ws-1",
      limit: 8,
    });

    expect(entries.map((entry) => entry.id)).toEqual([
      "review-pack:run-fallback",
      "review-pack:run-in-review",
    ]);
    expect(entries[0]).toMatchObject({
      accountabilityLifecycle: "in_review",
      filterTags: expect.arrayContaining([
        "incomplete_evidence",
        "fallback_routing",
        "sub_agent_blocked",
      ]),
    });
  });

  it("adds run-only triage entries and prioritizes blocked missions ahead of incomplete evidence", () => {
    const projection: HugeCodeMissionControlSnapshot = {
      ...createProjection(),
      tasks: [
        {
          ...createProjection().tasks[0],
          id: "task-blocked-run",
          title: "Blocked runtime mission",
          latestRunId: "run-blocked",
          latestRunState: "needs_input",
          accountability: {
            lifecycle: "in_review",
            claimedBy: "local-operator",
            claimedAt: 1_000,
            lifecycleUpdatedAt: 5_000,
          },
        },
        {
          ...createProjection().tasks[0],
          id: "task-review-pack",
          title: "Review pack mission",
          latestRunId: "run-review-pack",
          latestRunState: "review_ready",
          accountability: {
            lifecycle: "in_review",
            claimedBy: "local-operator",
            claimedAt: 1_000,
            lifecycleUpdatedAt: 4_000,
          },
        },
      ],
      runs: [
        {
          ...createProjection().runs[0],
          id: "run-blocked",
          taskId: "task-blocked-run",
          reviewPackId: null,
          state: "needs_input",
          updatedAt: 5_100,
          approval: {
            status: "pending_decision",
            approvalId: "approval-1",
            label: "Approval pending",
            summary: "Operator confirmation required before continuing.",
          },
          operatorSnapshot: {
            summary: "Runtime paused on backend-review-a.",
            runtimeLabel: "remote sandbox",
            provider: "openai",
            modelId: "gpt-5.3-codex",
            reasoningEffort: "high",
            backendId: "backend-review-a",
            machineId: null,
            machineSummary: "backend known, machine not published",
            workspaceRoot: "/tmp/workspace-one",
            currentActivity: "Awaiting approval",
            blocker: "Waiting for operator confirmation.",
            recentEvents: [],
          },
          subAgents: [
            {
              sessionId: "agent-1",
              status: "awaiting_approval",
              summary: "Sub-agent is waiting for approval.",
            },
          ],
          publishHandoff: {
            jsonPath: ".hugecode/runs/task-publish/publish/handoff.json",
            markdownPath: ".hugecode/runs/task-publish/publish/handoff.md",
            summary: "Publish handoff ready",
            details: [],
          },
        },
        {
          ...createProjection().runs[0],
          id: "run-review-pack",
          taskId: "task-review-pack",
          reviewPackId: "review-pack:run-review-pack",
          updatedAt: 4_500,
        },
      ],
      reviewPacks: [
        {
          ...createProjection().reviewPacks[0],
          id: "review-pack:run-review-pack",
          runId: "run-review-pack",
          taskId: "task-review-pack",
          reviewStatus: "incomplete_evidence",
          createdAt: 4_500,
          failureClass: "validation_failed",
          relaunchOptions: {
            sourceRunId: "run-review-pack",
            summary: "Retry with a narrower prompt.",
            primaryAction: "continue_with_clarification",
            recommendedActions: ["continue_with_clarification"],
            availableActions: [
              {
                action: "continue_with_clarification",
                label: "Clarify",
                enabled: true,
                supported: true,
                reason: null,
              },
            ],
          },
        },
      ],
    };

    const entries = buildMissionReviewEntriesFromProjection(projection, {
      workspaceId: "ws-1",
      limit: 8,
    });

    expect(entries.map((entry) => entry.id)).toEqual([
      "run-blocked",
      "review-pack:run-review-pack",
    ]);
    expect(entries[0]).toMatchObject({
      kind: "mission_run",
      reviewPackId: null,
      operatorSignal: "Awaiting approval",
      attentionSignals: expect.arrayContaining(["Approval pending", "Blocked"]),
      subAgentSignal: "Sub-agent awaiting approval",
      publishHandoffLabel: "Publish handoff ready",
    });
    expect(entries[1]).toMatchObject({
      kind: "review_pack",
      reviewPackId: "review-pack:run-review-pack",
      failureClassLabel: "Validation failure",
      relaunchLabel: "Relaunch available",
      filterTags: expect.arrayContaining(["incomplete_evidence"]),
    });
  });

  it("uses the short failure label style in mission review entries", () => {
    const projection: HugeCodeMissionControlSnapshot = {
      ...createProjection(),
      reviewPacks: [
        {
          ...createProjection().reviewPacks[0],
          id: "review-pack:run-1",
          runId: "run-1",
          taskId: "task-1",
          failureClass: "timed_out",
        },
      ],
    };

    const [entry] = buildMissionReviewEntriesFromProjection(projection, {
      workspaceId: "ws-1",
      limit: 4,
    });

    expect(entry.failureClassLabel).toBe("Timed out");
  });

  it("counts review-ready missions from runtime review truth instead of latest run state only", () => {
    const projection: HugeCodeMissionControlSnapshot = {
      ...createProjection(),
      tasks: [
        {
          ...createProjection().tasks[0],
          id: "task-ready",
          latestRunId: "run-ready",
          latestRunState: "review_ready",
        },
        {
          ...createProjection().tasks[0],
          id: "task-action-required",
          latestRunId: "run-action-required",
          latestRunState: "review_ready",
        },
        {
          ...createProjection().tasks[0],
          id: "task-running",
          latestRunId: "run-running",
          latestRunState: "running",
        },
      ],
      runs: [
        {
          ...createProjection().runs[0],
          id: "run-ready",
          taskId: "task-ready",
          reviewPackId: "review-pack:run-ready",
        },
        {
          ...createProjection().runs[0],
          id: "run-action-required",
          taskId: "task-action-required",
          reviewPackId: "review-pack:run-action-required",
          state: "review_ready",
          operatorSnapshot: {
            summary: "Runtime is waiting for a retry decision.",
            runtimeLabel: "remote sandbox",
            provider: "openai",
            modelId: "gpt-5.3-codex",
            reasoningEffort: "high",
            backendId: "backend-review-a",
            machineId: null,
            machineSummary: "backend known, machine not published",
            workspaceRoot: "/tmp/workspace-one",
            currentActivity: null,
            blocker: "Waiting for operator retry guidance.",
            recentEvents: [],
          },
        },
        {
          ...createProjection().runs[0],
          id: "run-running",
          taskId: "task-running",
          reviewPackId: null,
          state: "running",
        },
      ],
      reviewPacks: [
        {
          ...createProjection().reviewPacks[0],
          id: "review-pack:run-ready",
          runId: "run-ready",
          taskId: "task-ready",
          reviewStatus: "ready",
        },
        {
          ...createProjection().reviewPacks[0],
          id: "review-pack:run-action-required",
          runId: "run-action-required",
          taskId: "task-action-required",
          reviewStatus: "action_required",
        },
      ],
    };

    expect(buildMissionOverviewCountsFromProjection(projection, "ws-1")).toEqual({
      active: 1,
      needsAction: 1,
      reviewReady: 1,
      ready: 0,
    });
  });
});
