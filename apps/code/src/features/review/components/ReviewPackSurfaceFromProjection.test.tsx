// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { resolveReviewPackSelection } from "@ku0/code-application/runtimeReviewPackSurfaceModel";
import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import { describe, expect, it, vi } from "vitest";
import { ReviewPackSurfaceFromProjection } from "./ReviewPackSurfaceFromProjection";

function asProjection(value: unknown): HugeCodeMissionControlSnapshot {
  return value as HugeCodeMissionControlSnapshot;
}

vi.mock("../../../application/runtime/facades/runtimeReviewIntelligenceFacade", () => ({
  useRuntimeWorkspaceSkillCatalog: () => ({
    status: "idle",
    entries: [],
    error: null,
  }),
}));

describe("ReviewPackSurfaceFromProjection", () => {
  it("threads continuity continue-path labels into the compact review evidence card", () => {
    const projection = asProjection({
      source: "runtime_snapshot_v1" as const,
      generatedAt: 10,
      workspaces: [
        {
          id: "workspace-1",
          name: "Workspace One",
          rootPath: "/tmp/workspace-one",
          connected: true,
          defaultProfileId: null,
        },
      ],
      tasks: [
        {
          id: "task-1",
          workspaceId: "workspace-1",
          title: "Review continuation",
          objective: "Review continuation",
          origin: {
            kind: "thread" as const,
            threadId: "thread-1",
            runId: "run-1",
            requestId: null,
          },
          mode: "pair" as const,
          modeSource: "execution_profile" as const,
          status: "review_ready" as const,
          createdAt: 1,
          updatedAt: 10,
          currentRunId: null,
          latestRunId: "run-1",
          latestRunState: "review_ready" as const,
          nextAction: null,
        },
      ],
      runs: [
        {
          id: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          state: "review_ready" as const,
          title: "Review continuation",
          summary: "Ready for review.",
          startedAt: 2,
          finishedAt: 9,
          updatedAt: 10,
          currentStepIndex: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          reviewPackId: "review-pack:1",
          takeoverBundle: {
            pathKind: "review",
            primaryAction: "open_review_pack",
            state: "ready",
            summary: "Continue from Review Pack.",
            recommendedAction: "Open Review Pack",
            reviewPackId: "review-pack:1",
          },
          publishHandoff: {
            summary: "Legacy publish handoff",
          },
        },
      ],
      reviewPacks: [
        {
          id: "review-pack:1",
          runId: "run-1",
          taskId: "task-1",
          workspaceId: "workspace-1",
          summary: "Ready for review.",
          reviewStatus: "ready" as const,
          evidenceState: "confirmed" as const,
          validationOutcome: "passed" as const,
          warningCount: 0,
          warnings: [],
          validations: [],
          artifacts: [],
          checksPerformed: [],
          recommendedNextAction: "Legacy follow-up",
          createdAt: 10,
        },
      ],
    });

    render(
      <ReviewPackSurfaceFromProjection
        workspaceName="Workspace One"
        projection={projection}
        workspaceId="workspace-1"
        selection={resolveReviewPackSelection({
          projection,
          workspaceId: "workspace-1",
          request: {
            workspaceId: "workspace-1",
            reviewPackId: "review-pack:1",
            source: "review_surface",
          },
        })}
        onSelectReviewPack={() => undefined}
      />
    );

    const evidenceCards = screen.getAllByText("Quick decision evidence");
    const evidenceCard = evidenceCards.at(-1)?.closest("section");

    expect(evidenceCard).toBeTruthy();
    expect(within(evidenceCard as HTMLElement).getByText("Continue via Review Pack")).toBeTruthy();
  });
});
