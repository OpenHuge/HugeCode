import { describe, expect, it } from "vitest";
import type {
  RuntimeToolLifecycleEvent,
  RuntimeToolLifecycleHookCheckpoint,
} from "../types/runtimeToolLifecycle";
import {
  describeRuntimeToolLifecycleEvent,
  describeRuntimeToolLifecycleHookCheckpoint,
  formatRuntimeToolLifecycleStatusLabel,
  getRuntimeToolLifecycleEventTone,
  getRuntimeToolLifecycleHookCheckpointTone,
  sortRuntimeToolLifecycleEventsByRecency,
  sortRuntimeToolLifecycleHookCheckpointsByRecency,
} from "./runtimeToolLifecyclePresentation";

function createRuntimeToolLifecycleEvent(
  overrides: Partial<RuntimeToolLifecycleEvent> = {}
): RuntimeToolLifecycleEvent {
  return {
    id: "tool-started-1",
    kind: "tool",
    phase: "started",
    source: "app-event",
    workspaceId: "workspace-1",
    threadId: "thread-1",
    turnId: "turn-1",
    toolCallId: "tool-call-1",
    toolName: "bash",
    scope: "write",
    status: "in_progress",
    at: 1_771_331_696_000,
    errorCode: null,
    ...overrides,
  } as RuntimeToolLifecycleEvent;
}

function createRuntimeToolLifecycleHookCheckpoint(
  overrides: Partial<RuntimeToolLifecycleHookCheckpoint> = {}
): RuntimeToolLifecycleHookCheckpoint {
  return {
    key: "hook-1",
    point: "post_execution_pre_publication",
    status: "ready",
    source: "telemetry",
    workspaceId: "workspace-1",
    threadId: "thread-1",
    turnId: "turn-1",
    toolCallId: "tool-call-1",
    toolName: "bash",
    scope: "write",
    lifecycleEventId: "tool-1",
    at: 1_771_331_697_000,
    reason: null,
    ...overrides,
  };
}

describe("runtimeToolLifecyclePresentation", () => {
  it("sorts lifecycle events by recency with deterministic id tie-breaks", () => {
    const events = sortRuntimeToolLifecycleEventsByRecency([
      createRuntimeToolLifecycleEvent({ id: "tool-a", at: 10 }),
      createRuntimeToolLifecycleEvent({ id: "tool-c", at: 20 }),
      createRuntimeToolLifecycleEvent({ id: "tool-b", at: 20 }),
    ]);

    expect(events.map((event) => event.id)).toEqual(["tool-c", "tool-b", "tool-a"]);
  });

  it("sorts hook checkpoints by recency with deterministic key tie-breaks", () => {
    const checkpoints = sortRuntimeToolLifecycleHookCheckpointsByRecency([
      createRuntimeToolLifecycleHookCheckpoint({ key: "hook-a", at: 10 }),
      createRuntimeToolLifecycleHookCheckpoint({ key: "hook-c", at: 20 }),
      createRuntimeToolLifecycleHookCheckpoint({ key: "hook-b", at: 20 }),
    ]);

    expect(checkpoints.map((checkpoint) => checkpoint.key)).toEqual(["hook-c", "hook-b", "hook-a"]);
  });

  it("derives shared lifecycle labels and tones for events and checkpoints", () => {
    expect(
      describeRuntimeToolLifecycleEvent(
        createRuntimeToolLifecycleEvent({ kind: "approval", phase: "requested", toolName: null })
      )
    ).toBe("Approval requested");
    expect(
      describeRuntimeToolLifecycleHookCheckpoint(
        createRuntimeToolLifecycleHookCheckpoint({ point: "post_validation_pre_execution" })
      )
    ).toBe("post validation pre execution");
    expect(formatRuntimeToolLifecycleStatusLabel("runtime_failed")).toBe("runtime failed");
    expect(formatRuntimeToolLifecycleStatusLabel(null)).toBe("unknown");
    expect(
      getRuntimeToolLifecycleEventTone(createRuntimeToolLifecycleEvent({ status: "failed" }))
    ).toBe("danger");
    expect(
      getRuntimeToolLifecycleHookCheckpointTone(
        createRuntimeToolLifecycleHookCheckpoint({ status: "pending" })
      )
    ).toBe("warning");
  });
});
