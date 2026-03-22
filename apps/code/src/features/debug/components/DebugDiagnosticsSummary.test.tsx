// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  createAgentTaskDurabilityDiagnostics,
  createDistributedDiagnostics,
} from "../test/debugDiagnosticsFixtures";
import { DebugDiagnosticsSummary } from "./DebugDiagnosticsSummary";

const distributedDiagnostics = createDistributedDiagnostics();
const durabilityDiagnostics = createAgentTaskDurabilityDiagnostics();

describe("DebugDiagnosticsSummary", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders distributed diagnostics only when observability is enabled", () => {
    render(
      <DebugDiagnosticsSummary
        observabilityCapabilityEnabled
        distributedDiagnostics={distributedDiagnostics}
        hasRemoteExecutionDiagnostics
        agentTaskDurabilityDiagnostics={null}
      />
    );

    const diagnostics = screen.getByTestId("debug-distributed-diagnostics");
    expect(within(diagnostics).getByText("backendsTotal")).toBeTruthy();
    expect(screen.getByTestId("debug-remote-execution-diagnostics")).toBeTruthy();
    expect(screen.queryByTestId("debug-agent-task-durability-diagnostics")).toBeNull();
  });

  it("renders durability diagnostics even when observability is disabled", () => {
    render(
      <DebugDiagnosticsSummary
        observabilityCapabilityEnabled={false}
        distributedDiagnostics={distributedDiagnostics}
        hasRemoteExecutionDiagnostics={false}
        agentTaskDurabilityDiagnostics={durabilityDiagnostics}
      />
    );

    const durability = screen.getByTestId("debug-agent-task-durability-diagnostics");
    expect(within(durability).getByText("Agent Task Durability")).toBeTruthy();
    expect(screen.queryByTestId("debug-distributed-diagnostics")).toBeNull();
  });
});
