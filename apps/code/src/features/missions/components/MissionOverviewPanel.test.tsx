// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MissionOverviewPanel, type MissionOverviewItem } from "./MissionOverviewPanel";

describe("MissionOverviewPanel", () => {
  it("renders mission counts and routes mission selection", () => {
    const onSelectMission = vi.fn();
    const items: MissionOverviewItem[] = [
      {
        threadId: "thread-1",
        title: "Fix flaky runtime test",
        summary: "Latest run is blocked on an approval request.",
        operatorSignal: "Waiting for approval",
        attentionSignals: ["Approval pending", "Blocked"],
        updatedAt: Date.now() - 60_000,
        state: "needsAction",
        isActive: true,
        navigationTarget: {
          kind: "thread",
          workspaceId: "workspace-1",
          threadId: "thread-1",
        },
        secondaryLabel: null,
      },
      {
        threadId: "thread-2",
        title: "Refactor workspace actions",
        summary: "Validation passed and the diff is ready for review.",
        operatorSignal: null,
        attentionSignals: [],
        updatedAt: Date.now() - 120_000,
        state: "reviewReady",
        isActive: false,
        navigationTarget: {
          kind: "thread",
          workspaceId: "workspace-1",
          threadId: "thread-2",
        },
        secondaryLabel: null,
      },
    ];

    render(
      <MissionOverviewPanel
        workspaceName="Workspace One"
        counts={{
          active: 1,
          needsAction: 1,
          reviewReady: 1,
          ready: 2,
        }}
        items={items}
        onSelectMission={onSelectMission}
      />
    );

    expect(screen.getByText("Mission Index")).toBeTruthy();
    expect(screen.getByText("Workspace One")).toBeTruthy();
    expect(
      screen.getByTestId("mission-overview-panel").getAttribute("data-review-loop-panel")
    ).toBe("mission-overview");
    expect(screen.getAllByText("Waiting").length).toBeGreaterThan(0);
    expect(screen.getByText("Review Ready")).toBeTruthy();
    expect(screen.getByText("Fix flaky runtime test")).toBeTruthy();
    expect(screen.getByText("Refactor workspace actions")).toBeTruthy();

    fireEvent.click(screen.getByTestId("mission-overview-item-thread-2"));
    expect(onSelectMission).toHaveBeenCalledWith("thread-2");
  });

  it("routes runtime-managed missions into mission detail when no thread is available", () => {
    const onSelectMission = vi.fn();
    const onOpenMissionTarget = vi.fn();
    const onOpenReviewMission = vi.fn();
    const items: MissionOverviewItem[] = [
      {
        threadId: "runtime-task:task-9",
        title: "Runtime-managed mission",
        summary: null,
        operatorSignal: "Review-ready evidence published",
        attentionSignals: ["Evidence incomplete"],
        updatedAt: Date.now() - 30_000,
        state: "reviewReady",
        isActive: false,
        navigationTarget: {
          kind: "mission",
          workspaceId: "workspace-1",
          taskId: "runtime-task:task-9",
          runId: "task-9",
          reviewPackId: "review-pack:task-9",
          threadId: null,
          limitation: "thread_unavailable",
        },
        secondaryLabel: "Runtime-managed mission",
      },
    ];

    render(
      <MissionOverviewPanel
        workspaceName="Workspace One"
        counts={{
          active: 0,
          needsAction: 0,
          reviewReady: 1,
          ready: 0,
        }}
        items={items}
        onSelectMission={onSelectMission}
        onOpenMissionTarget={onOpenMissionTarget}
        onOpenReviewMission={onOpenReviewMission}
      />
    );

    expect(
      screen.getByText(
        "Thread detail is unavailable. Open the action center to supervise runtime evidence, handoff, and recovery."
      )
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId("mission-overview-item-runtime-task:task-9"));

    expect(onOpenMissionTarget).toHaveBeenCalledWith({
      kind: "mission",
      workspaceId: "workspace-1",
      taskId: "runtime-task:task-9",
      runId: "task-9",
      reviewPackId: "review-pack:task-9",
      threadId: null,
      limitation: "thread_unavailable",
    });
    expect(onSelectMission).not.toHaveBeenCalled();
    expect(onOpenReviewMission).not.toHaveBeenCalled();
  });

  it("shows operator signals and attention chips for supervised runs", () => {
    render(
      <MissionOverviewPanel
        workspaceName="Workspace One"
        counts={{
          active: 1,
          needsAction: 1,
          reviewReady: 0,
          ready: 0,
        }}
        items={[
          {
            threadId: "runtime-task:task-9",
            title: "Prepare migration",
            summary:
              "Mission detail is available, but runtime has not published a textual summary.",
            updatedAt: Date.now() - 30_000,
            state: "running",
            isActive: false,
            navigationTarget: {
              kind: "mission",
              workspaceId: "workspace-1",
              taskId: "runtime-task:task-9",
              runId: "task-9",
              reviewPackId: "review-pack:task-9",
              threadId: null,
              limitation: "thread_unavailable",
            },
            secondaryLabel: "Runtime-managed mission",
            operatorSignal: "Running validation command",
            attentionSignals: ["Approval pending", "Blocked", "Fallback route"],
          } as MissionOverviewItem,
        ]}
        onSelectMission={() => undefined}
      />
    );

    const panel = screen.getAllByTestId("mission-overview-panel").at(-1);
    expect(panel).toBeTruthy();
    expect(within(panel!).getAllByTestId("review-summary-card").length).toBeGreaterThan(0);
    expect(within(panel!).getByText("Running validation command")).toBeTruthy();
    expect(within(panel!).getAllByText("Approval pending").length).toBeGreaterThan(0);
    expect(within(panel!).getByText("Blocked")).toBeTruthy();
    expect(within(panel!).getByText("Fallback route")).toBeTruthy();
  });

  it("shows supervision-oriented mission summaries for relaunch and publish states", () => {
    render(
      <MissionOverviewPanel
        workspaceName="Workspace One"
        counts={{
          active: 0,
          needsAction: 2,
          reviewReady: 0,
          ready: 0,
        }}
        items={[
          {
            threadId: "runtime-task:publish",
            title: "Prepare publish handoff",
            summary: "Publish handoff ready",
            updatedAt: Date.now() - 30_000,
            state: "needsAction",
            isActive: false,
            navigationTarget: {
              kind: "mission",
              workspaceId: "workspace-1",
              taskId: "runtime-task:publish",
              runId: "run-publish",
              reviewPackId: "review-pack:publish",
              threadId: null,
              limitation: "thread_unavailable",
            },
            secondaryLabel: "Runtime-managed mission",
            operatorSignal: "Inspect publish draft before merging",
            attentionSignals: ["Publish handoff ready", "Relaunch available"],
          },
          {
            threadId: "runtime-task:sub-agent",
            title: "Investigate blocked review",
            summary: "Sub-agent blocked while waiting for operator input.",
            updatedAt: Date.now() - 45_000,
            state: "needsAction",
            isActive: false,
            navigationTarget: {
              kind: "mission",
              workspaceId: "workspace-1",
              taskId: "runtime-task:sub-agent",
              runId: "run-sub-agent",
              reviewPackId: null,
              threadId: null,
              limitation: "thread_unavailable",
            },
            secondaryLabel: "Runtime-managed mission",
            operatorSignal: "Approval required before sub-agent can resume",
            attentionSignals: ["Sub-agent blocked", "Runtime failure"],
          },
        ]}
        onSelectMission={() => undefined}
      />
    );

    const panel = screen.getAllByTestId("mission-overview-panel").at(-1);
    expect(panel).toBeTruthy();
    expect(within(panel!).getAllByText("Publish handoff ready").length).toBeGreaterThan(0);
    expect(within(panel!).getByText("Relaunch available")).toBeTruthy();
    expect(within(panel!).getByText("Sub-agent blocked")).toBeTruthy();
    expect(within(panel!).getByText("Runtime failure")).toBeTruthy();
    expect(within(panel!).getByText("Inspect publish draft before merging")).toBeTruthy();
  });
});
