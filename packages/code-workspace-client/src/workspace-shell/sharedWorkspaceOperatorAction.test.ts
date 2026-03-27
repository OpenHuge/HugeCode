import { describe, expect, it } from "vitest";
import type { SharedMissionControlSummary } from "./sharedMissionControlSummary";
import { deriveSharedWorkspaceOperatorAction } from "./sharedWorkspaceOperatorAction";

const baseSummary: SharedMissionControlSummary = {
  workspaceLabel: "Alpha",
  tasksCount: 0,
  runsCount: 0,
  approvalCount: 0,
  reviewPacksCount: 0,
  connectedWorkspaceCount: 1,
  launchReadiness: {
    tone: "ready",
    label: "Launch readiness",
    detail: "Connected routing is healthy for the current workspace slice.",
  },
  continuityReadiness: {
    tone: "attention",
    label: "Continuity readiness",
    detail:
      "No checkpoint, takeover bundle, handoff, or review actionability signals have been published yet.",
  },
  missionItems: [],
  reviewItems: [],
};

describe("deriveSharedWorkspaceOperatorAction", () => {
  it("keeps the missions call-to-action available while runtime signals hydrate", () => {
    const action = deriveSharedWorkspaceOperatorAction({
      loadState: "loading",
      summary: baseSummary,
    });

    expect(action.label).toBe("Loading runtime next action");
    expect(action.targetSection).toBe("missions");
    expect(action.targetItemId).toBeNull();
    expect(action.ctaLabel).toBe("Open missions");
    expect(action.tone).toBe("idle");
  });

  it("prioritizes blocked launch routing ahead of review-ready signals", () => {
    const action = deriveSharedWorkspaceOperatorAction({
      loadState: "ready",
      summary: {
        ...baseSummary,
        launchReadiness: {
          tone: "blocked",
          label: "Launch readiness",
          detail: "1 run is blocked by routing readiness.",
        },
        reviewPacksCount: 1,
        reviewItems: [
          {
            id: "review-1",
            title: "Review ready",
            workspaceName: "Alpha",
            summary: "Inspect the review pack.",
            reviewStatusLabel: "Ready",
            validationLabel: "Passed",
            tone: "ready",
            warningCount: 0,
          },
        ],
      },
    });

    expect(action.label).toBe("Fix launch routing");
    expect(action.targetSection).toBe("workspaces");
    expect(action.targetItemId).toBeNull();
    expect(action.tone).toBe("blocked");
  });

  it("routes operators to review when a ready review pack is available", () => {
    const action = deriveSharedWorkspaceOperatorAction({
      loadState: "ready",
      summary: {
        ...baseSummary,
        runsCount: 1,
        reviewPacksCount: 1,
        continuityReadiness: {
          tone: "ready",
          label: "Continuity readiness",
          detail: "1 review path ready; 1 review pack published",
        },
        reviewItems: [
          {
            id: "review-1",
            title: "Review ready",
            workspaceName: "Alpha",
            summary: "Inspect the evidence and accept or retry.",
            reviewStatusLabel: "Ready",
            validationLabel: "Passed",
            tone: "ready",
            warningCount: 0,
          },
        ],
      },
    });

    expect(action.label).toBe("Open ready review pack");
    expect(action.targetSection).toBe("review");
    expect(action.targetItemId).toBe("review-1");
    expect(action.detail).toContain("Inspect the evidence");
  });

  it("targets the approval-specific mission item even when blocked runs sort first", () => {
    const action = deriveSharedWorkspaceOperatorAction({
      loadState: "ready",
      summary: {
        ...baseSummary,
        tasksCount: 2,
        runsCount: 2,
        approvalCount: 1,
        missionItems: [
          {
            id: "run-blocked",
            title: "Blocked route",
            workspaceName: "Alpha",
            statusLabel: "Routing blocked",
            tone: "blocked",
            detail: "Routing is blocked for this run.",
            highlights: [],
          },
          {
            id: "run-approval",
            title: "Approval run",
            workspaceName: "Alpha",
            statusLabel: "Approval pending",
            tone: "attention",
            detail: "Waiting for operator approval.",
            highlights: [],
          },
        ],
      },
    });

    expect(action.label).toBe("Review pending approval");
    expect(action.targetSection).toBe("missions");
    expect(action.targetItemId).toBe("run-approval");
    expect(action.detail).toContain("Approval run");
    expect(action.detail).toContain("Waiting for operator approval.");
  });

  it("falls back to a first-launch action when runtime is connected but empty", () => {
    const action = deriveSharedWorkspaceOperatorAction({
      loadState: "ready",
      summary: baseSummary,
    });

    expect(action.label).toBe("Launch the first mission");
    expect(action.targetSection).toBe("workspaces");
    expect(action.targetItemId).toBeNull();
    expect(action.tone).toBe("attention");
  });
});
