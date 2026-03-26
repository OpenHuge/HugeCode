// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DebugRuntimeToolExecutionMetricsSection } from "./DebugRuntimeToolExecutionMetricsSection";

describe("DebugRuntimeToolExecutionMetricsSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders totals and recent annotated executions", () => {
    render(
      <DebugRuntimeToolExecutionMetricsSection
        updatedAt={1_770_000_000_000}
        totals={{
          attemptedTotal: 3,
          startedTotal: 2,
          completedTotal: 2,
          successTotal: 1,
          validationFailedTotal: 1,
          runtimeFailedTotal: 0,
          timeoutTotal: 0,
          blockedTotal: 0,
          truncatedTotal: 1,
        }}
        recentExecutions={[
          {
            toolName: "run-runtime-live-skill",
            scope: "runtime",
            status: "validation_failed",
            errorCode: "INPUT_SCHEMA_VALIDATION_FAILED",
            durationMs: 0,
            truncatedOutput: false,
            annotations: ["guardrail-required", "validation-failed"],
            at: 1_770_000_000_000,
          },
          {
            toolName: "execute-workspace-command",
            scope: "runtime",
            status: "success",
            errorCode: null,
            durationMs: 42,
            truncatedOutput: false,
            annotations: ["workspace-dry-run", "guardrail-skipped"],
            at: 1_769_999_999_000,
          },
        ]}
      />
    );

    expect(screen.getByText("Tool execution metrics")).toBeTruthy();
    expect(screen.getByText((content) => content.includes("Snapshot updated:"))).toBeTruthy();
    expect(screen.getByText("run-runtime-live-skill")).toBeTruthy();
    expect(screen.getByText("validation_failed")).toBeTruthy();
    expect(screen.getByText("guardrail-required, validation-failed")).toBeTruthy();
    expect(screen.getByText("attemptedTotal")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("renders an empty state when no executions have been recorded", () => {
    render(
      <DebugRuntimeToolExecutionMetricsSection
        updatedAt={0}
        totals={{
          attemptedTotal: 0,
          startedTotal: 0,
          completedTotal: 0,
          successTotal: 0,
          validationFailedTotal: 0,
          runtimeFailedTotal: 0,
          timeoutTotal: 0,
          blockedTotal: 0,
          truncatedTotal: 0,
        }}
        recentExecutions={[]}
      />
    );

    expect(screen.getByText("No tool execution metrics recorded yet.")).toBeTruthy();
  });
});
