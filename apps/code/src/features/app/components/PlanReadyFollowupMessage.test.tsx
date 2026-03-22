/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResolvedPlanArtifact } from "../../messages/utils/planArtifact";
import { onOpenPlanPanel } from "../../plan/utils/planPanelSurface";
import { PlanReadyFollowupMessage } from "./PlanReadyFollowupMessage";

afterEach(() => {
  cleanup();
});

const artifact: ResolvedPlanArtifact = {
  planItemId: "plan-1",
  threadId: "thread-1",
  title: "Plan ready",
  preview: "1. Migrate the next simple button batch.",
  body: "1. Migrate the next simple button batch.",
  awaitingFollowup: true,
};

describe("PlanReadyFollowupMessage", () => {
  it("preserves follow-up button behavior after migrating to the app design-system adapter", () => {
    const onAccept = vi.fn();
    const onOpenPlanPanelMock = vi.fn();
    const dispose = onOpenPlanPanel(onOpenPlanPanelMock);

    render(<PlanReadyFollowupMessage artifact={artifact} onAccept={onAccept} />);

    fireEvent.click(screen.getByRole("button", { name: "Open plan panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Implement plan" }));

    expect(onOpenPlanPanelMock).toHaveBeenCalledTimes(1);
    expect(onAccept).toHaveBeenCalledTimes(1);

    dispose();
  });
});
