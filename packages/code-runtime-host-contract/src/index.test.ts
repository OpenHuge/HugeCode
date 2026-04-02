import { describe, expect, it } from "vitest";
import { expectTypeOf } from "vitest";

import {
  CODE_RUNTIME_RPC_INVOCATION_COMPLETION_MODES,
  HUGECODE_INTERVENTION_ACTIONS,
  HUGECODE_RUN_STATES,
  type RuntimeExtensionActivationSnapshot,
  RUNTIME_COMPOSITION_APPLIED_LAYER_ORDER,
  RUNTIME_COMPOSITION_PROFILE_SCOPES,
  type HugeCodeExecutionGraphSummary,
  type HugeCodeReviewPackSummary,
  type HugeCodeRunPlacementEvidence,
  type HugeCodeTaskSummary,
  type RuntimeCompositionProfile,
  type RuntimeCompositionResolution,
  parseCodeRuntimeHostEventEnvelope,
  validateCodeRuntimeHostEventEnvelope,
} from "./index";
import type { RuntimeExtensionActivationSnapshot as RuntimeExtensionActivationSnapshotModule } from "./runtimeActivationPlane";
import type { RuntimeCompositionProfile as RuntimeCompositionProfileModule } from "./runtimeCompositionProfiles";
import type { RuntimeCompositionResolution as RuntimeCompositionResolutionModule } from "./runtimeCompositionPlane";

describe("code runtime host event envelope", () => {
  it("re-exports runtime composition profile and resolution types from dedicated modules", () => {
    expectTypeOf<RuntimeCompositionProfileModule>().toEqualTypeOf<RuntimeCompositionProfile>();
    expectTypeOf<RuntimeCompositionResolutionModule>().toEqualTypeOf<RuntimeCompositionResolution>();
  });

  it("re-exports activation snapshot types from the dedicated activation module", () => {
    expectTypeOf<RuntimeExtensionActivationSnapshotModule>().toEqualTypeOf<RuntimeExtensionActivationSnapshot>();
  });

  it("re-exports runtime composition profile scopes from the dedicated composition module", () => {
    expect(RUNTIME_COMPOSITION_PROFILE_SCOPES).toEqual(["built_in", "user", "workspace"]);
  });

  it("re-exports the canonical runtime composition applied layer order", () => {
    expect(RUNTIME_COMPOSITION_APPLIED_LAYER_ORDER).toEqual([
      "built_in",
      "user",
      "workspace",
      "launch_override",
    ]);
  });

  it("re-exports rpc invocation completion modes from the public contract entrypoint", () => {
    expect(CODE_RUNTIME_RPC_INVOCATION_COMPLETION_MODES).toEqual({
      RPC: "rpc",
      EVENTS: "events",
    });
  });

  it("re-exports canonical HugeCode mission-control enums", () => {
    expect(HUGECODE_RUN_STATES).toEqual([
      "draft",
      "queued",
      "preparing",
      "running",
      "paused",
      "needs_input",
      "validating",
      "review_ready",
      "failed",
      "cancelled",
    ]);
    expect(HUGECODE_INTERVENTION_ACTIONS).toContain("switch_profile_and_retry");
  });

  it("accepts turn.completed payloads with responseModelId metadata", () => {
    const result = parseCodeRuntimeHostEventEnvelope({
      kind: "turn.completed",
      payload: {
        turnId: "turn-1",
        output: "done",
        responseModelId: "gpt-5.4-2026-03-01",
      },
    });

    expect(result.ok).toBe(true);
  });

  it("rejects turn.completed payloads with a non-string responseModelId", () => {
    const errors = validateCodeRuntimeHostEventEnvelope({
      kind: "turn.completed",
      payload: {
        turnId: "turn-1",
        responseModelId: 42,
      },
    });

    expect(errors).toEqual(
      expect.arrayContaining(["responseModelId must be a string when provided."])
    );
  });

  it("supports runtime-native review-pack file and evidence summaries", () => {
    const placement: HugeCodeRunPlacementEvidence = {
      resolvedBackendId: "worker-b",
      requestedBackendIds: ["worker-b"],
      resolutionSource: "explicit_preference",
      lifecycleState: "confirmed",
      readiness: "ready",
      healthSummary: "placement_ready",
      attentionReasons: [],
      summary: "Runtime confirmed the requested backend worker-b.",
      rationale: "Mission Control requested worker-b and runtime confirmed that placement.",
      backendContract: null,
    };
    const reviewPack: HugeCodeReviewPackSummary = {
      id: "review-pack:run-1",
      runId: "run-1",
      taskId: "task-1",
      workspaceId: "ws-1",
      summary: "Review pack ready.",
      reviewStatus: "ready",
      evidenceState: "confirmed",
      validationOutcome: "passed",
      warningCount: 0,
      warnings: [],
      validations: [],
      artifacts: [],
      checksPerformed: [],
      recommendedNextAction: "Accept the result.",
      fileChanges: {
        paths: ["apps/code/src/features/review/utils/reviewPackSurfaceModel.ts"],
        totalCount: 1,
        summary: "1 runtime-recorded file change",
        missingReason: null,
      },
      evidenceRefs: {
        traceId: "trace-1",
        checkpointId: "checkpoint-1",
        diffArtifactIds: ["diff:run-1"],
        validationArtifactIds: ["run-1:artifact:2"],
        logArtifactIds: ["trace:trace-1"],
        commandArtifactIds: ["run-1:command:3"],
      },
      createdAt: 1,
      reviewDecision: null,
      lineage: null,
      ledger: null,
      checkpoint: {
        state: "completed",
        lifecycleState: "completed",
        checkpointId: "checkpoint-1",
        traceId: "trace-1",
        recovered: false,
        updatedAt: 1,
        resumeReady: false,
        recoveredAt: null,
        summary: "Checkpoint checkpoint-1 is the latest runtime recovery marker.",
      },
      governance: null,
      placement,
    };

    expect(reviewPack.fileChanges?.totalCount).toBe(1);
    expect(reviewPack.evidenceRefs?.traceId).toBe("trace-1");
    expect(reviewPack.checkpoint?.checkpointId).toBe("checkpoint-1");
    expect(reviewPack.placement?.healthSummary).toBe("placement_ready");
    expect(reviewPack.placement?.attentionReasons).toEqual([]);
  });

  it("re-exports graph-aware task summaries from the package entrypoint", () => {
    const executionGraph = {
      graphId: "graph-1",
      nodes: [
        {
          id: "node-plan-1",
          kind: "plan",
          status: "running",
          preferredBackendIds: ["worker-plan"],
          resolvedBackendId: "worker-plan",
          placementLifecycleState: "confirmed",
        },
      ],
      edges: [],
    } satisfies HugeCodeExecutionGraphSummary;

    const taskSummary: HugeCodeTaskSummary = {
      id: "task-1",
      workspaceId: "ws-1",
      title: "Graph-aware task",
      objective: null,
      origin: {
        kind: "run",
        threadId: null,
        runId: "run-1",
        requestId: null,
      },
      mode: "delegate",
      modeSource: "execution_profile",
      status: "running",
      createdAt: 1,
      updatedAt: 2,
      currentRunId: "run-1",
      latestRunId: "run-1",
      latestRunState: "running",
      nextAction: null,
      lineage: null,
      accountability: null,
      executionGraph,
    };

    expect(taskSummary.executionGraph?.graphId).toBe("graph-1");
    expect(taskSummary.executionGraph?.nodes[0]?.kind).toBe("plan");
    expect(taskSummary.executionGraph?.nodes[0]?.preferredBackendIds).toEqual(["worker-plan"]);
    expect(taskSummary.executionGraph?.nodes[0]?.resolvedBackendId).toBe("worker-plan");
    expect(taskSummary.executionGraph?.nodes[0]?.placementLifecycleState).toBe("confirmed");
  });

  it("re-exports HugeCode aliases for runtime-native mission-control types", () => {
    const executionGraph = {
      graphId: "graph-1",
      nodes: [],
      edges: [],
    } satisfies HugeCodeExecutionGraphSummary;

    const graphAlias: HugeCodeExecutionGraphSummary = executionGraph;
    const reviewPackAlias = {} as HugeCodeReviewPackSummary;
    const taskAlias = {} as HugeCodeTaskSummary;

    expect(graphAlias.graphId).toBe("graph-1");
    expect(reviewPackAlias).toBeDefined();
    expect(taskAlias).toBeDefined();
  });

  it("accepts item.started payloads with canonical item shape", () => {
    const result = parseCodeRuntimeHostEventEnvelope({
      kind: "item.started",
      payload: {
        turnId: "turn-1",
        threadId: "thread-1",
        itemId: "item-1",
        item: {
          id: "item-1",
          type: "mcpToolCall",
          status: "inProgress",
        },
      },
    });

    expect(result.ok).toBe(true);
  });

  it("accepts item.started payloads with legacy tool fields", () => {
    const result = parseCodeRuntimeHostEventEnvelope({
      kind: "item.started",
      payload: {
        turnId: "turn-1",
        toolCallId: "tool-call-1",
        toolName: "bash",
        input: {
          command: "echo hello",
        },
      },
    });

    expect(result.ok).toBe(true);
  });

  it("accepts item.agentMessage.delta payloads", () => {
    const result = parseCodeRuntimeHostEventEnvelope({
      kind: "item.agentMessage.delta",
      payload: {
        turnId: "turn-1",
        itemId: "msg-1",
        delta: "hello",
        transient: true,
        coalesced: true,
        chunkIndex: 0,
        queueDepth: 3,
        droppedChunks: 1,
        emitLagMs: 14,
      },
    });

    expect(result.ok).toBe(true);
  });

  it("rejects item.updated payloads without an item object", () => {
    const errors = validateCodeRuntimeHostEventEnvelope({
      kind: "item.updated",
      payload: {
        turnId: "turn-1",
      },
    });

    expect(errors).toEqual(expect.arrayContaining(["payload.item must be an object."]));
  });

  it("rejects item.mcpToolCall.progress payloads without itemId", () => {
    const errors = validateCodeRuntimeHostEventEnvelope({
      kind: "item.mcpToolCall.progress",
      payload: {
        turnId: "turn-1",
        message: "still running",
      },
    });

    expect(errors).toEqual(expect.arrayContaining(["payload.itemId must be a non-empty string."]));
  });

  it("accepts native_state_fabric_updated payloads", () => {
    const result = parseCodeRuntimeHostEventEnvelope({
      kind: "native_state_fabric_updated",
      payload: {
        revision: "rev-12",
        scope: ["bootstrap", "threads"],
        reason: "code_thread_create",
      },
      emittedAt: "2026-02-11T12:34:56.000Z",
    });

    expect(result.ok).toBe(true);
  });

  it("accepts native_state_fabric_updated payloads with durability diagnostics", () => {
    const result = parseCodeRuntimeHostEventEnvelope({
      kind: "native_state_fabric_updated",
      payload: {
        revision: "rev-13",
        scope: ["agents"],
        reason: "agent_task_durability_degraded",
        workspaceId: "ws-1",
        updatedAt: 1_737_000_000_000,
        timestamp: 1_737_000_000_001,
        mode: "active",
        degraded: true,
        checkpointWriteTotal: 42,
        checkpointWriteFailedTotal: 6,
        agentTaskCheckpointRecoverTotal: 4,
        subagentCheckpointRecoverTotal: 2,
        runtimeRecoveryInterruptTotal: 1,
        agentTaskResumeTotal: 9,
        agentTaskResumeFailedTotal: 3,
        lifecycleSweeperMode: "leader_lease",
        lifecycleLeaseLeader: "runtime-test:lease-1",
        lifecycleLeaseState: "holder",
        lifecycleLastSweepAt: 1_737_000_000_010,
        lifecycleLastLeaseRenewAt: 1_737_000_000_011,
        lifecycleLastLeaseErrorCode: "LEASE_RENEW_FAILED",
        deltaQueueDropTotal: 4,
        terminalizationCasNoopTotal: 2,
        staleWriteRejectedTotal: 2,
        streamGuardrailTrippedTotal: 1,
      },
      emittedAt: "2026-02-17T12:34:56.000Z",
    });

    expect(result.ok).toBe(true);
  });

  it("accepts native_state_fabric_updated payloads with observability diagnostics", () => {
    const result = parseCodeRuntimeHostEventEnvelope({
      kind: "native_state_fabric_updated",
      payload: {
        revision: "rev-15",
        scope: ["threads"],
        reason: "runtime_update",
        observability: {
          scope: "live_update",
          taskCounterMode: "skip",
          snapshotAgeMs: 12,
          sourceRevision: 15,
          queueDepth: 0,
          stateFabricFanoutQueueDepth: 1,
          threadLiveUpdateFanoutQueueDepth: 2,
          taskCounterCacheHitTotal: 4,
          taskCounterCacheMissTotal: 1,
          taskCounterFullScanFallbackTotal: 1,
          stateFabricFanoutCoalescedTotal: 3,
          threadLiveUpdateFanoutCoalescedTotal: 5,
          backpressureLaggedTotal: 0,
          backpressureDroppedTotal: 0,
        },
      },
    });

    expect(result.ok).toBe(true);
  });

  it("accepts approval.resolved payloads", () => {
    const result = parseCodeRuntimeHostEventEnvelope({
      kind: "approval.resolved",
      payload: {
        approvalId: "approval-1",
        turnId: "turn-1",
        status: "approved",
        decision: "approved",
        reason: "operator accepted",
        approval: {
          resolutionStatus: "approved",
          resolutionReason: "operator accepted",
          resolutionAction: "write",
        },
      },
    });

    expect(result.ok).toBe(true);
  });

  it("rejects approval.resolved payloads with invalid status", () => {
    const errors = validateCodeRuntimeHostEventEnvelope({
      kind: "approval.resolved",
      payload: {
        approvalId: "approval-1",
        status: "unknown",
      },
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        "payload.status must be one of: approved, rejected, error, interrupted, resolved.",
      ])
    );
  });

  it("rejects native_state_fabric_updated payloads with invalid scope", () => {
    const errors = validateCodeRuntimeHostEventEnvelope({
      kind: "native_state_fabric_updated",
      payload: {
        revision: "",
        scope: "bootstrap",
      },
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        "payload.revision must be a non-empty string.",
        "payload.scope must be a string array.",
      ])
    );
  });

  it("rejects native_state_fabric_updated payloads with invalid durability diagnostics types", () => {
    const errors = validateCodeRuntimeHostEventEnvelope({
      kind: "native_state_fabric_updated",
      payload: {
        revision: "rev-14",
        scope: ["agents"],
        workspaceId: 100,
        updatedAt: "1737000000000",
        mode: true,
        degraded: "true",
        checkpointWriteTotal: "42",
        lifecycleLeaseState: "unknown",
        lifecycleLastSweepAt: "1737000000010",
      },
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        "workspaceId must be a string when provided.",
        "updatedAt must be a number when provided.",
        "mode must be a string when provided.",
        "degraded must be a boolean when provided.",
        "checkpointWriteTotal must be a number when provided.",
        "payload.lifecycleLeaseState must be one of: holder, follower, degraded.",
        "lifecycleLastSweepAt must be a number when provided.",
      ])
    );
  });

  it("rejects native_state_fabric_updated payloads with invalid observability diagnostics types", () => {
    const errors = validateCodeRuntimeHostEventEnvelope({
      kind: "native_state_fabric_updated",
      payload: {
        revision: "rev-16",
        scope: ["threads"],
        observability: {
          scope: 1,
          taskCounterMode: false,
          snapshotAgeMs: "12",
          sourceRevision: "16",
          queueDepth: "0",
          stateFabricFanoutQueueDepth: "1",
          threadLiveUpdateFanoutQueueDepth: "2",
          taskCounterCacheHitTotal: "4",
          taskCounterCacheMissTotal: "1",
          taskCounterFullScanFallbackTotal: "1",
          stateFabricFanoutCoalescedTotal: "3",
          threadLiveUpdateFanoutCoalescedTotal: "5",
          backpressureLaggedTotal: "0",
          backpressureDroppedTotal: "0",
        },
      },
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        "payload.observability.scope must be a string when provided.",
        "payload.observability.taskCounterMode must be a string when provided.",
        "payload.observability.snapshotAgeMs must be a number when provided.",
        "payload.observability.sourceRevision must be a number when provided.",
        "payload.observability.queueDepth must be a number when provided.",
        "payload.observability.stateFabricFanoutQueueDepth must be a number when provided.",
        "payload.observability.threadLiveUpdateFanoutQueueDepth must be a number when provided.",
        "payload.observability.taskCounterCacheHitTotal must be a number when provided.",
        "payload.observability.taskCounterCacheMissTotal must be a number when provided.",
        "payload.observability.taskCounterFullScanFallbackTotal must be a number when provided.",
        "payload.observability.stateFabricFanoutCoalescedTotal must be a number when provided.",
        "payload.observability.threadLiveUpdateFanoutCoalescedTotal must be a number when provided.",
        "payload.observability.backpressureLaggedTotal must be a number when provided.",
        "payload.observability.backpressureDroppedTotal must be a number when provided.",
      ])
    );
  });

  it("accepts thread.live_update payloads", () => {
    const result = parseCodeRuntimeHostEventEnvelope({
      kind: "thread.live_update",
      payload: {
        workspaceId: "ws-1",
        threadId: "thread-1",
        subscriptionId: "sub-1",
        reason: "turn_completed",
      },
    });

    expect(result.ok).toBe(true);
  });

  it("rejects thread.live_heartbeat payloads without subscriptionId", () => {
    const errors = validateCodeRuntimeHostEventEnvelope({
      kind: "thread.live_heartbeat",
      payload: {
        workspaceId: "ws-1",
        threadId: "thread-1",
      },
    });

    expect(errors).toEqual(
      expect.arrayContaining(["payload.subscriptionId must be a non-empty string."])
    );
  });

  it("accepts extension.updated payloads", () => {
    const result = parseCodeRuntimeHostEventEnvelope({
      kind: "extension.updated",
      payload: {
        extensionId: "ext-1",
        workspaceId: "ws-1",
        action: "installed",
        updatedAt: 1_738_000_000_000,
      },
    });

    expect(result.ok).toBe(true);
  });

  it("accepts session.portability.updated payloads", () => {
    const result = parseCodeRuntimeHostEventEnvelope({
      kind: "session.portability.updated",
      payload: {
        workspaceId: "ws-1",
        threadId: "thread-1",
        operation: "export",
        schemaVersion: "session-portability/v1",
        updatedAt: 1_738_000_000_001,
      },
    });

    expect(result.ok).toBe(true);
  });

  it("accepts security.preflight.blocked payloads", () => {
    const result = parseCodeRuntimeHostEventEnvelope({
      kind: "security.preflight.blocked",
      payload: {
        workspaceId: "ws-1",
        toolName: "bash",
        command: "npx suspicious-package",
        reason: "Package advisory check requires review.",
        action: "review",
        blockedAt: 1_738_000_000_002,
      },
    });

    expect(result.ok).toBe(true);
  });

  it("rejects extension.updated payloads with invalid action", () => {
    const errors = validateCodeRuntimeHostEventEnvelope({
      kind: "extension.updated",
      payload: {
        extensionId: "ext-1",
        action: "create",
        updatedAt: 1_738_000_000_000,
      },
    });

    expect(errors).toEqual(
      expect.arrayContaining(["payload.action must be one of: installed, removed, updated."])
    );
  });
});
