// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildRuntimeToolLifecyclePresentationSummary } from "../../../application/runtime/ports/runtimeToolLifecycle";
import { createRuntimeToolLifecycleEvent } from "../test/debugDiagnosticsFixtures";
import { DebugRuntimeToolLifecycleSection } from "./DebugRuntimeToolLifecycleSection";

describe("DebugRuntimeToolLifecycleSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders lifecycle cards when lifecycle events are available", () => {
    const lifecycleEvents = [
      createRuntimeToolLifecycleEvent(),
      createRuntimeToolLifecycleEvent({
        id: "guardrail-1",
        kind: "guardrail",
        phase: "evaluated",
        source: "telemetry",
        status: "blocked",
        toolCallId: null,
        at: 1_771_331_697_000,
      }),
    ];
    const hookCheckpoints = [
      {
        key: "hook-1",
        point: "post_execution_pre_publication" as const,
        status: "ready" as const,
        source: "telemetry" as const,
        workspaceId: "workspace-1",
        threadId: "thread-1",
        turnId: "turn-1",
        toolCallId: "tool-call-1",
        toolName: "bash",
        scope: "write" as const,
        lifecycleEventId: "guardrail-1",
        at: 1_771_331_697_000,
        reason: null,
      },
    ];

    render(
      <DebugRuntimeToolLifecycleSection
        lifecycleEvents={lifecycleEvents}
        hookCheckpoints={hookCheckpoints}
        summary={buildRuntimeToolLifecyclePresentationSummary({
          lifecycleEvents,
          hookCheckpoints,
        })}
      />
    );

    expect(screen.getByTestId("debug-runtime-tool-lifecycle")).toBeTruthy();
    expect(screen.getByText("2 events observed.")).toBeTruthy();
    expect(
      screen.getByText(
        (_, node) =>
          node?.textContent === "Latest event: guardrail/evaluated at 2026-02-17T12:34:57.000Z."
      )
    ).toBeTruthy();
    expect(screen.getByText("guardrail/evaluated")).toBeTruthy();
    expect(screen.getByText("tool/started")).toBeTruthy();
    expect(screen.getByText("1 hook checkpoints observed.")).toBeTruthy();
    expect(screen.getByText("post_execution_pre_publication/ready")).toBeTruthy();
    expect(screen.getAllByText("2026-02-17T12:34:57.000Z").length).toBeGreaterThan(0);
    expect(screen.getAllByText("bash").length).toBeGreaterThan(0);
  });

  it("renders an empty state when no lifecycle events exist", () => {
    render(
      <DebugRuntimeToolLifecycleSection
        lifecycleEvents={[]}
        hookCheckpoints={[]}
        summary={buildRuntimeToolLifecyclePresentationSummary({
          lifecycleEvents: [],
          hookCheckpoints: [],
        })}
      />
    );

    expect(screen.getByText("No lifecycle activity observed yet.")).toBeTruthy();
  });
});
