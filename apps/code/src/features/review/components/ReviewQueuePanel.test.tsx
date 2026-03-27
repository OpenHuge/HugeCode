// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewQueuePanel } from "./ReviewQueuePanel";

describe("ReviewQueuePanel", () => {
  it("renders runtime-backed review entries and opens runtime-managed review targets", () => {
    const onOpenMissionTarget = vi.fn();
    const onRefresh = vi.fn();

    render(
      <ReviewQueuePanel
        workspaceName="Workspace One"
        freshness={{
          status: "ready",
          isStale: false,
          error: null,
          lastUpdatedAt: Date.now(),
        }}
        onRefresh={onRefresh}
        onOpenMissionTarget={onOpenMissionTarget}
        items={[
          {
            id: "review-pack:task-1",
            kind: "review_pack",
            taskId: "runtime-task:task-1",
            runId: "task-1",
            reviewPackId: "review-pack:task-1",
            workspaceId: "workspace-1",
            title: "Draft regression fix",
            summary: "Runtime produced a review-ready draft with explicit evidence state.",
            createdAt: Date.now() - 60_000,
            state: "reviewReady",
            validationOutcome: "skipped",
            warningCount: 0,
            recommendedNextAction: "Inspect runtime evidence, validate, then accept or retry.",
            accountabilityLifecycle: "in_review",
            queueEnteredAt: Date.now() - 30_000,
            filterTags: ["needs_attention"],
            navigationTarget: {
              kind: "mission",
              workspaceId: "workspace-1",
              taskId: "runtime-task:task-1",
              runId: "task-1",
              reviewPackId: "review-pack:task-1",
              threadId: null,
              limitation: "thread_unavailable",
            },
            secondaryLabel: "Runtime-managed mission",
            evidenceLabel: "Runtime evidence only",
            operatorSignal: "Runtime paused for approval",
            attentionSignals: ["Approval pending", "Blocked"],
            failureClassLabel: null,
            subAgentSignal: "Sub-agent awaiting approval",
            publishHandoffLabel: "Publish handoff ready",
            relaunchLabel: "Relaunch available",
            contextSummary: "GitHub issue · triage",
            provenanceSummary:
              "Repo guidance: AGENTS.md, .github/copilot-instructions.md | Source evidence: GitHub issue #42",
            triageSummary: "Owner Issue Desk · Priority high · Risk high",
            delegationSummary: "Open Review Pack",
            continuationTruthSourceLabel: "Runtime takeover bundle",
          },
        ]}
      />
    );

    expect(screen.getByTestId("review-queue-panel")).toBeTruthy();
    expect(screen.getByTestId("review-queue-panel").getAttribute("data-review-loop-panel")).toBe(
      "triage"
    );
    expect(screen.getByText("Runtime evidence only")).toBeTruthy();
    expect(screen.getByText("Runtime paused for approval")).toBeTruthy();
    expect(screen.getByText("Sub-agent awaiting approval")).toBeTruthy();
    expect(screen.getByText("Publish handoff ready")).toBeTruthy();
    expect(screen.getByText("Relaunch available")).toBeTruthy();
    expect(
      screen.getByText(
        "GitHub issue · triage | Owner Issue Desk · Priority high · Risk high | Open Review Pack"
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Repo guidance: AGENTS.md, .github/copilot-instructions.md | Source evidence: GitHub issue #42"
      )
    ).toBeTruthy();
    expect(screen.getByText("Follow-up source: Runtime takeover bundle")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Open action center" }));
    expect(onOpenMissionTarget).toHaveBeenCalledWith({
      kind: "mission",
      workspaceId: "workspace-1",
      taskId: "runtime-task:task-1",
      runId: "task-1",
      reviewPackId: "review-pack:task-1",
      threadId: null,
      limitation: "thread_unavailable",
    });
  });

  it("filters review queue items by risk tags", () => {
    render(
      <ReviewQueuePanel
        items={[
          {
            id: "review-pack:task-1",
            kind: "review_pack",
            taskId: "runtime-task:task-1",
            runId: "task-1",
            reviewPackId: "review-pack:task-1",
            workspaceId: "workspace-1",
            title: "Fallback routing review",
            summary: "Needs review because routing fell back.",
            createdAt: Date.now() - 60_000,
            state: "reviewReady",
            validationOutcome: "warning",
            warningCount: 1,
            recommendedNextAction: null,
            accountabilityLifecycle: "in_review",
            queueEnteredAt: Date.now() - 50_000,
            filterTags: ["fallback_routing"],
            navigationTarget: {
              kind: "mission",
              workspaceId: "workspace-1",
              taskId: "runtime-task:task-1",
              runId: "task-1",
              reviewPackId: "review-pack:task-1",
              threadId: null,
              limitation: "thread_unavailable",
            },
            secondaryLabel: "Runtime-managed mission",
            evidenceLabel: "Evidence needs review",
            operatorSignal: null,
            attentionSignals: ["Fallback route"],
            failureClassLabel: "Runtime failure",
            subAgentSignal: null,
            publishHandoffLabel: null,
            relaunchLabel: null,
          },
          {
            id: "run:task-2",
            kind: "mission_run",
            taskId: "runtime-task:task-2",
            runId: "task-2",
            reviewPackId: null,
            workspaceId: "workspace-1",
            title: "Blocked runtime mission",
            summary: "Operator approval is still pending.",
            createdAt: Date.now() - 40_000,
            state: "needsAction",
            validationOutcome: "unknown",
            warningCount: 0,
            recommendedNextAction: null,
            accountabilityLifecycle: "in_review",
            queueEnteredAt: Date.now() - 30_000,
            filterTags: ["needs_attention"],
            navigationTarget: {
              kind: "mission",
              workspaceId: "workspace-1",
              taskId: "runtime-task:task-2",
              runId: "task-2",
              reviewPackId: null,
              threadId: null,
              limitation: "thread_unavailable",
            },
            secondaryLabel: "Runtime-managed mission",
            evidenceLabel: "Runtime evidence only",
            operatorSignal: "Awaiting approval",
            attentionSignals: ["Approval pending", "Blocked"],
            failureClassLabel: null,
            subAgentSignal: "Sub-agent blocked",
            publishHandoffLabel: null,
            relaunchLabel: "Relaunch available",
          },
        ]}
        selectedRunId="task-2"
      />
    );

    const panel = screen.getAllByTestId("review-queue-panel").at(-1);
    expect(panel).toBeTruthy();
    if (!panel) {
      throw new Error("Expected review queue panel");
    }
    expect(within(panel).getAllByText(/mission triage/i).length).toBeGreaterThan(0);
    expect(within(panel).getAllByText("Sub-agent blocked").length).toBeGreaterThan(0);
    expect(within(panel).getAllByText("Relaunch available").length).toBeGreaterThan(0);
    expect(within(panel).getByRole("button", { name: "Selected" })).toBeTruthy();

    fireEvent.click(within(panel).getByRole("button", { name: /Fallback routing/ }));

    expect(screen.getByText("Fallback routing review")).toBeTruthy();
    expect(screen.queryByText("Blocked runtime mission")).toBeNull();
  });

  it("renders supporting review metadata through shared status-badge semantics", () => {
    render(
      <ReviewQueuePanel
        freshness={{
          status: "ready",
          isStale: false,
          error: null,
          lastUpdatedAt: Date.now(),
        }}
        items={[
          {
            id: "review-pack:task-3",
            kind: "review_pack",
            taskId: "runtime-task:task-3",
            runId: "task-3",
            reviewPackId: "review-pack:task-3",
            workspaceId: "workspace-1",
            title: "Status grammar review",
            summary: "Review metadata should use the shared status badge contract.",
            createdAt: Date.now() - 15_000,
            state: "reviewReady",
            validationOutcome: "warning",
            warningCount: 2,
            recommendedNextAction: null,
            accountabilityLifecycle: "in_review",
            queueEnteredAt: Date.now() - 10_000,
            filterTags: ["fallback_routing", "sub_agent_blocked"],
            navigationTarget: {
              kind: "mission",
              workspaceId: "workspace-1",
              taskId: "runtime-task:task-3",
              runId: "task-3",
              reviewPackId: "review-pack:task-3",
              threadId: null,
              limitation: "thread_unavailable",
            },
            secondaryLabel: "Runtime-managed mission",
            evidenceLabel: "Runtime evidence only",
            operatorSignal: null,
            attentionSignals: ["Blocked"],
            failureClassLabel: null,
            subAgentSignal: "Sub-agent blocked",
            publishHandoffLabel: null,
            relaunchLabel: null,
            continuationState: "blocked",
            reviewGateLabel: "Review gate blocked",
            reviewGateState: "blocked",
            autofixAvailable: true,
            continuationTruthSourceLabel: "Runtime checkpoint",
          },
        ]}
      />
    );

    expect(
      screen
        .getAllByText("Runtime evidence only")
        .some((node) => node.closest("[data-status-tone]"))
    ).toBe(true);
    expect(
      screen
        .getAllByText("Fallback routing")
        .some((node) => node.closest('[data-status-tone="warning"]'))
    ).toBe(true);
    expect(screen.getByText("2 warnings").closest('[data-status-tone="warning"]')).toBeTruthy();
    expect(
      screen.getByText("Autofix available").closest('[data-status-tone="progress"]')
    ).toBeTruthy();
    expect(screen.getAllByText("Blocked follow-up").length).toBeGreaterThan(0);
    expect(screen.getByText("Follow-up source: Runtime checkpoint")).toBeTruthy();
    expect(screen.getAllByTestId("review-summary-card").length).toBeGreaterThan(0);
  });

  it("prioritizes critical review items and supports critical/autofix filters", () => {
    render(
      <ReviewQueuePanel
        items={[
          {
            id: "review-pack:task-standard",
            kind: "review_pack",
            taskId: "runtime-task:task-standard",
            runId: "task-standard",
            reviewPackId: "review-pack:task-standard",
            workspaceId: "workspace-1",
            title: "Standard review item",
            summary: "A normal review-ready mission.",
            createdAt: Date.now() - 5_000,
            state: "reviewReady",
            validationOutcome: "pass",
            warningCount: 0,
            recommendedNextAction: null,
            accountabilityLifecycle: "in_review",
            queueEnteredAt: Date.now() - 5_000,
            filterTags: [],
            navigationTarget: {
              kind: "mission",
              workspaceId: "workspace-1",
              taskId: "runtime-task:task-standard",
              runId: "task-standard",
              reviewPackId: "review-pack:task-standard",
              threadId: null,
              limitation: "thread_unavailable",
            },
            secondaryLabel: "Runtime-managed mission",
            evidenceLabel: "Runtime evidence only",
            operatorSignal: null,
            attentionSignals: [],
            failureClassLabel: null,
            subAgentSignal: null,
            publishHandoffLabel: null,
            relaunchLabel: null,
          },
          {
            id: "review-pack:task-critical",
            kind: "review_pack",
            taskId: "runtime-task:task-critical",
            runId: "task-critical",
            reviewPackId: "review-pack:task-critical",
            workspaceId: "workspace-1",
            title: "Critical review item",
            summary: "The review gate is blocked and autofix is available.",
            createdAt: Date.now() - 60_000,
            state: "reviewReady",
            validationOutcome: "warning",
            warningCount: 2,
            recommendedNextAction:
              "Inspect the critical finding and decide whether to apply autofix.",
            accountabilityLifecycle: "in_review",
            queueEnteredAt: Date.now() - 60_000,
            filterTags: ["needs_attention"],
            navigationTarget: {
              kind: "mission",
              workspaceId: "workspace-1",
              taskId: "runtime-task:task-critical",
              runId: "task-critical",
              reviewPackId: "review-pack:task-critical",
              threadId: null,
              limitation: "thread_unavailable",
            },
            secondaryLabel: "Runtime-managed mission",
            evidenceLabel: "Runtime evidence only",
            operatorSignal: "Operator review is blocked.",
            attentionSignals: ["Critical"],
            failureClassLabel: null,
            subAgentSignal: null,
            publishHandoffLabel: null,
            relaunchLabel: null,
            reviewGateLabel: "Review gate blocked",
            reviewGateState: "blocked",
            highestReviewSeverity: "critical",
            reviewFindingCount: 3,
            autofixAvailable: true,
            continuationState: "degraded",
          },
        ]}
      />
    );

    const criticalTitle = screen.getByText("Critical review item");
    const standardTitle = screen.getByText("Standard review item");
    expect(
      criticalTitle.compareDocumentPosition(standardTitle) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    expect(screen.getAllByText("Critical now").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Autofix ready").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Blocked follow-up").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Triage: Critical review | Blocked follow-up | Autofix ready | 3 findings | Highest severity critical"
      )
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Critical now/ }));
    expect(screen.getByText("Critical review item")).toBeTruthy();
    expect(screen.queryByText("Standard review item")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Autofix ready/ }));
    expect(screen.getByText("Critical review item")).toBeTruthy();
    expect(screen.queryByText("Standard review item")).toBeNull();
  });
});
