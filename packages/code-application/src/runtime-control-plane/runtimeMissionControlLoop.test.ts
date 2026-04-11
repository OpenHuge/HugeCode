import { describe, expect, it } from "vitest";
import { buildMissionControlLoopItems, buildMissionRunSummary } from "./runtimeMissionControlLoop";

describe("runtimeMissionControlLoop", () => {
  it("summarizes runtime run states from task status", () => {
    expect(
      buildMissionRunSummary([
        { status: "queued" },
        { status: "running" },
        { status: "paused" },
        { status: "awaiting_approval" },
        { status: "completed" },
        { status: "failed" },
        { status: "cancelled" },
        { status: "interrupted" },
      ])
    ).toEqual({
      queued: 1,
      running: 2,
      needsInput: 1,
      reviewReady: 1,
      failed: 1,
      cancelled: 2,
    });
  });

  it("builds mission loop messaging from runtime task counts", () => {
    expect(
      buildMissionControlLoopItems([
        { status: "queued" },
        { status: "running" },
        { status: "completed" },
      ])
    ).toEqual([
      {
        id: "observe",
        label: "Observe",
        detail: "2 active runs can be supervised from this control device.",
      },
      {
        id: "approve",
        label: "Approve",
        detail: "Approval requests stay visible here without introducing page-local task truth.",
      },
      {
        id: "intervene",
        label: "Intervene",
        detail:
          "Retry, clarify, or switch profile while runtime remains the source of truth for placement and lifecycle.",
      },
      {
        id: "resume",
        label: "Resume",
        detail: "Resume from checkpoint or handoff using published checkpoint and trace IDs.",
      },
      {
        id: "review",
        label: "Review",
        detail: "1 completed run moves into Review Pack as the primary finish-line surface.",
      },
    ]);
  });
});
