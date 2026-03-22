// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createDistributedDiagnostics } from "../test/debugDiagnosticsFixtures";
import { DebugDistributedDiagnosticsSection } from "./DebugDistributedDiagnosticsSection";

const distributedDiagnostics = createDistributedDiagnostics();

describe("DebugDistributedDiagnosticsSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders summary metrics and remote execution details in the existing order", () => {
    const { container } = render(
      <DebugDistributedDiagnosticsSection
        distributedDiagnostics={distributedDiagnostics}
        hasRemoteExecutionDiagnostics
      />
    );

    const diagnostics = screen.getByTestId("debug-distributed-diagnostics");
    expect(within(diagnostics).getByText("Distributed Diagnostics")).toBeTruthy();

    const metricLabels = Array.from(
      container.querySelectorAll(".debug-distributed-diagnostics-item > span")
    ).map((node) => node.textContent);
    expect(metricLabels).toEqual([
      "backendsTotal",
      "backendsHealthy",
      "backendsDraining",
      "placementFailuresTotal",
      "queueDepth",
      "snapshotAgeMs",
      "stateFabricFanoutQueueDepth",
      "threadLiveUpdateFanoutQueueDepth",
      "stateFabricFanoutCoalescedTotal",
      "threadLiveUpdateFanoutCoalescedTotal",
    ]);

    const remoteDetails = screen.getByTestId("debug-remote-execution-diagnostics");
    const remoteTerms = Array.from(remoteDetails.querySelectorAll("dt")).map(
      (node) => node.textContent
    );
    const remoteValues = Array.from(remoteDetails.querySelectorAll("dd")).map(
      (node) => node.textContent
    );

    expect(remoteTerms).toEqual(["access_mode", "routed_provider", "execution_mode", "reason"]);
    expect(remoteValues).toEqual([
      "on-request",
      "openai",
      "runtime",
      "policy_rejected_local_access",
    ]);
  });

  it("uses fallback placeholders when distributed diagnostics are unavailable", () => {
    const { container } = render(
      <DebugDistributedDiagnosticsSection
        distributedDiagnostics={null}
        hasRemoteExecutionDiagnostics
      />
    );

    const metricValues = Array.from(
      container.querySelectorAll(".debug-distributed-diagnostics-item > strong")
    ).map((node) => node.textContent);
    const remoteValues = Array.from(
      screen.getByTestId("debug-remote-execution-diagnostics").querySelectorAll("dd")
    ).map((node) => node.textContent);

    expect(metricValues).toEqual(["-", "-", "-", "-", "-", "-", "-", "-", "-", "-"]);
    expect(remoteValues).toEqual(["-", "-", "-", "-"]);
  });
});
