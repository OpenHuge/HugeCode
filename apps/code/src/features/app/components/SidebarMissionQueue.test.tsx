// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MissionOverviewEntry } from "@ku0/code-application/runtimeMissionControlSurfaceModel";
import { SidebarMissionQueue } from "./SidebarMissionQueue";

function createMissionOverviewEntry(
  overrides: Partial<MissionOverviewEntry> = {}
): MissionOverviewEntry {
  return {
    threadId: "thread-1",
    title: "Review branch protections",
    summary: null,
    operatorSignal: null,
    governanceSummary: null,
    routeDetail: null,
    operatorActionLabel: null,
    operatorActionDetail: null,
    operatorActionTarget: null,
    continuationLabel: null,
    continuePathLabel: null,
    attentionSignals: [],
    updatedAt: 0,
    state: "needsAction",
    isActive: false,
    navigationTarget: {
      kind: "thread",
      workspaceId: "ws-1",
      threadId: "thread-1",
    },
    secondaryLabel: null,
    ...overrides,
  };
}

describe("SidebarMissionQueue", () => {
  it("deduplicates repeated mission subline labels", () => {
    render(
      <SidebarMissionQueue
        items={[
          createMissionOverviewEntry({
            operatorActionLabel: "Open review",
            routeDetail: "Open review",
            operatorSignal: "Needs action",
            attentionSignals: ["Needs action"],
          }),
        ]}
        onOpenMissionTarget={vi.fn()}
      />
    );

    expect(screen.getAllByText("Open review")).toHaveLength(1);
    expect(screen.getAllByText("Needs action")).toHaveLength(1);
  });

  it("opens the operator action target when available", () => {
    const onOpenMissionTarget = vi.fn();
    const operatorActionTarget = {
      kind: "review" as const,
      workspaceId: "ws-1",
      taskId: "task-1",
      runId: "run-1",
      reviewPackId: "review-pack-1",
      limitation: null,
    };

    render(
      <SidebarMissionQueue
        items={[
          createMissionOverviewEntry({
            operatorActionTarget,
          }),
        ]}
        onOpenMissionTarget={onOpenMissionTarget}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Review branch protections" }));

    expect(onOpenMissionTarget).toHaveBeenCalledWith(operatorActionTarget);
  });
});
