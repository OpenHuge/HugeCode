import { describe, expect, it } from "vitest";
import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import type { RuntimeMissionRunSummary } from "../types/webMcpBridge";
import {
  CONTROL_PLANE_KERNEL_PROJECTION_SCOPES,
  projectMissionControlSnapshotToRuntimeTasks,
  resolveRuntimeCapabilitiesValue,
} from "./runtimeMissionControlSnapshot";

function createMissionControlSnapshot(
  overrides?: Partial<RuntimeMissionRunSummary>
): HugeCodeMissionControlSnapshot {
  return {
    source: "runtime_snapshot_v1",
    generatedAt: 1,
    workspaces: [],
    tasks: [
      {
        id: "mission-task-1",
        workspaceId: "ws-1",
        title: "Inspect runtime truth",
        objective: "Inspect runtime truth",
        origin: "runtime_run",
        taskSource: null,
        mode: null,
        modeSource: "missing",
        status: "running",
        createdAt: 1,
        updatedAt: 2,
        currentRunId: "run-1",
        latestRunId: "run-1",
        latestRunState: "running",
        nextAction: null,
        lineage: null,
        accountability: null,
        executionGraph: null,
      },
    ],
    runs: [
      {
        id: "run-1",
        taskId: "mission-task-1",
        workspaceId: "ws-1",
        state: "running",
        title: "Inspect runtime truth",
        summary: "Runtime-published run",
        taskSource: null,
        startedAt: 1,
        finishedAt: null,
        updatedAt: 2,
        currentStepIndex: 0,
        pendingIntervention: null,
        executionProfile: {
          id: "balanced-delegate",
          name: "Balanced",
          description: "Balanced profile",
          executionMode: "remote_sandbox",
          autonomy: "delegated",
          supervisionLabel: "Delegated",
          accessMode: "on-request",
          networkPolicy: "default",
          routingStrategy: "default",
          toolPosture: "default",
          approvalSensitivity: "standard",
          identitySource: null,
          validationPresetId: null,
        },
        reviewProfileId: null,
        profileReadiness: {
          ready: true,
          health: "ready",
          summary: "Profile ready.",
          issues: [],
        },
        routing: {
          backendId: "backend-a",
          provider: "openai",
          providerLabel: "OpenAI",
          pool: "codex",
          routeLabel: "Backend A",
          routeHint: "Runtime-selected backend.",
          health: "ready",
          enabledAccountCount: 1,
          readyAccountCount: 1,
          enabledPoolCount: 1,
        },
        approval: {
          status: "pending",
          approvalId: "approval-1",
          label: "Needs approval",
          summary: "Runtime is waiting for approval.",
        },
        reviewDecision: null,
        intervention: null,
        operatorState: null,
        nextAction: null,
        warnings: [],
        validations: [],
        artifacts: [],
        changedPaths: [],
        autoDrive: null,
        completionReason: null,
        reviewPackId: null,
        lineage: {
          objective: "Inspect runtime truth",
          taskSource: null,
          threadId: "thread-1",
          requestId: "request-1",
          executionProfileId: "balanced-delegate",
          taskMode: null,
          rootTaskId: null,
          parentTaskId: null,
          childTaskIds: [],
          autoDrive: null,
          reviewDecision: null,
        },
        ledger: null,
        checkpoint: {
          state: "ready",
          lifecycleState: "confirmed",
          checkpointId: "checkpoint-1",
          traceId: "trace-1",
          recovered: false,
          updatedAt: 2,
          resumeReady: true,
          recoveredAt: null,
          summary: "Checkpoint available.",
        },
        missionLinkage: null,
        actionability: {
          state: "degraded",
          summary: "Review will be available when the run completes.",
          degradedReasons: ["run_in_progress"],
          actions: [],
        },
        reviewGate: null,
        reviewFindings: null,
        reviewRunId: null,
        skillUsage: null,
        autofixCandidate: null,
        governance: null,
        placement: {
          resolvedBackendId: "backend-a",
          requestedBackendIds: ["backend-a"],
          resolutionSource: "workspace_default",
          lifecycleState: "resolved",
          readiness: "ready",
          healthSummary: "placement_ready",
          attentionReasons: [],
          summary: "Runtime resolved placement.",
          rationale: "Workspace default backend.",
        },
        operatorSnapshot: null,
        workspaceEvidence: null,
        missionBrief: null,
        relaunchContext: null,
        subAgents: [],
        publishHandoff: null,
        takeoverBundle: {
          state: "ready",
          pathKind: "resume",
          primaryAction: "resume_run",
          summary: "Resume from checkpoint.",
          recommendedAction: "Resume the run.",
          checkpointId: "checkpoint-1",
          traceId: "trace-1",
        },
        executionGraph: null,
        ...overrides,
      },
    ],
    reviewPacks: [],
  } as unknown as HugeCodeMissionControlSnapshot;
}

describe("runtimeMissionControlSnapshot", () => {
  it("pins the control-plane projection to the stable runtime slices", () => {
    expect(CONTROL_PLANE_KERNEL_PROJECTION_SCOPES).toEqual([
      "mission_control",
      "continuity",
      "diagnostics",
      "capabilities",
      "extensions",
    ]);
  });

  it("prefers projection-backed capabilities truth when kernel projection is available", () => {
    const projectionCapabilities = [
      {
        id: "runtime-control",
        name: "Runtime Control",
        kind: "control_plane",
        enabled: true,
        health: "ready",
        executionProfile: "default",
        tags: ["projection"],
        metadata: {
          source: "projection",
        },
      },
    ] as const;

    expect(
      resolveRuntimeCapabilitiesValue({
        kernelProjectionEnabled: true,
        projectionCapabilities: projectionCapabilities as never,
        fallbackCapabilities: {
          mode: "connected",
          features: ["legacy"],
        },
      })
    ).toEqual(projectionCapabilities);
  });

  it("does not retain legacy capabilities fallback once kernel projection is enabled", () => {
    expect(
      resolveRuntimeCapabilitiesValue({
        kernelProjectionEnabled: true,
        projectionCapabilities: null,
        fallbackCapabilities: {
          mode: "connected",
          features: ["legacy"],
        },
      })
    ).toBeNull();
  });

  it("projects mission-control runs into runtime task summaries with runtime-owned truth", () => {
    const tasks = projectMissionControlSnapshotToRuntimeTasks(createMissionControlSnapshot());

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      taskId: "run-1",
      threadId: "thread-1",
      requestId: "request-1",
      status: "running",
      pendingApprovalId: "approval-1",
      preferredBackendIds: ["backend-a"],
      checkpointId: "checkpoint-1",
      traceId: "trace-1",
    });
    expect(tasks[0]?.reviewActionability?.state).toBe("degraded");
    expect(tasks[0]?.runSummary?.placement?.requestedBackendIds).toEqual(["backend-a"]);
  });

  it("maps review-ready mission runs to completed runtime tasks", () => {
    const tasks = projectMissionControlSnapshotToRuntimeTasks(
      createMissionControlSnapshot({
        state: "review_ready",
        finishedAt: 3,
        updatedAt: 3,
        summary: "Review Pack ready.",
        reviewPackId: "review-pack:run-1",
      })
    );

    expect(tasks[0]?.status).toBe("completed");
    expect(tasks[0]?.reviewPackId).toBe("review-pack:run-1");
    expect(tasks[0]?.runSummary?.summary).toBe("Review Pack ready.");
  });

  it("preserves runtime context boundary and projection truth when mapping runs back to tasks", () => {
    const tasks = projectMissionControlSnapshotToRuntimeTasks(
      createMissionControlSnapshot({
        contextBoundary: {
          boundaryId: "boundary-1",
          trigger: "session_length",
          phase: "pre_turn",
          status: "projected",
          preTokens: 4096,
          postTokens: 1024,
          preservedRangeIds: ["run-1:step-1"],
          summaryRef: "summary://boundary-1",
          offloadRefs: ["turn://tool-1/output"],
          projectionFingerprint: "fingerprint-1",
          updatedAt: 3,
        },
        contextProjection: {
          projectionId: "projection-1",
          boundaryId: "boundary-1",
          sourceTaskId: "mission-task-1",
          sourceRunId: "run-1",
          phase: "pre_turn",
          status: "active",
          preservedRangeIds: ["run-1:step-1"],
          summaryRef: "summary://projection-1",
          offloadRefs: ["turn://tool-1/output"],
          projectionFingerprint: "fingerprint-1",
          updatedAt: 3,
        },
        compactionSummary: {
          triggered: true,
          executed: true,
          source: "session_length",
          compressedSteps: 1,
          bytesReduced: 512,
          keepRecentSteps: 3,
          summaryMaxChars: 240,
          executionError: null,
        },
      })
    );

    expect(tasks[0]?.contextBoundary).toMatchObject({
      boundaryId: "boundary-1",
      trigger: "session_length",
    });
    expect(tasks[0]?.contextProjection).toMatchObject({
      projectionId: "projection-1",
      sourceRunId: "run-1",
    });
    expect(tasks[0]?.compactionSummary).toMatchObject({
      triggered: true,
      source: "session_length",
    });
    expect(tasks[0]?.runSummary).toMatchObject({
      contextBoundary: {
        boundaryId: "boundary-1",
      },
      contextProjection: {
        projectionId: "projection-1",
      },
      compactionSummary: {
        triggered: true,
        executed: true,
      },
    });
  });
});
