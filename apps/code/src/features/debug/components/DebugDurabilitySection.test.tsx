// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createAgentTaskDurabilityDiagnostics } from "../test/debugDiagnosticsFixtures";
import { formatDiagnosticsTimestamp } from "../utils/debugEntryDiagnostics";
import { DebugDurabilitySection } from "./DebugDurabilitySection";

const durabilityDiagnostics = createAgentTaskDurabilityDiagnostics();

describe("DebugDurabilitySection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders both durability columns in the existing field order", () => {
    const { container } = render(<DebugDurabilitySection diagnostics={durabilityDiagnostics} />);

    const section = screen.getByTestId("debug-agent-task-durability-diagnostics");
    expect(within(section).getByText("Agent Task Durability")).toBeTruthy();

    const columns = container.querySelectorAll(".debug-event-channel-diagnostics-item");
    const primaryTerms = Array.from(columns[0]?.querySelectorAll("dt") ?? []).map(
      (node) => node.textContent
    );
    const secondaryTerms = Array.from(columns[1]?.querySelectorAll("dt") ?? []).map(
      (node) => node.textContent
    );

    expect(primaryTerms).toEqual([
      "reason",
      "revision",
      "occurrences_in_window",
      "first_seen_at",
      "last_seen_at",
      "mode",
      "degraded",
      "checkpoint_write_total",
      "checkpoint_write_failed_total",
    ]);
    expect(secondaryTerms).toEqual([
      "agent_task_checkpoint_recover_total",
      "subagent_checkpoint_recover_total",
      "runtime_recovery_interrupt_total",
      "agent_task_resume_total",
      "agent_task_resume_failed_total",
    ]);
  });

  it("formats timestamps and degraded values consistently", () => {
    render(<DebugDurabilitySection diagnostics={durabilityDiagnostics} />);

    expect(
      screen.getByText(formatDiagnosticsTimestamp(durabilityDiagnostics.firstSeenAt))
    ).toBeTruthy();
    expect(
      screen.getByText(formatDiagnosticsTimestamp(durabilityDiagnostics.lastSeenAt))
    ).toBeTruthy();
    expect(screen.getByText("true")).toBeTruthy();
  });

  it("falls back degraded to a placeholder when status is unknown", () => {
    const diagnostics = { ...durabilityDiagnostics, degraded: null };
    const { container } = render(<DebugDurabilitySection diagnostics={diagnostics} />);

    const degradedValue = Array.from(container.querySelectorAll("dt")).find(
      (node) => node.textContent === "degraded"
    )?.nextElementSibling?.textContent;

    expect(degradedValue).toBe("-");
  });
});
