import { describe, expect, it } from "vitest";
import type { RuntimeAutomationScheduleRecord } from "../../../application/runtime/ports/runtimeAutomationSchedules";
import { buildNativeSchedulePayload } from "./settingsAutomationSchedules";

describe("buildNativeSchedulePayload", () => {
  it("drops projected review linkage from the existing schedule record", () => {
    const existing: RuntimeAutomationScheduleRecord = {
      id: "schedule-1",
      enabled: true,
      name: "Night Operator",
      status: "idle",
      cron: "0 0 * * *",
      updatedAt: null,
      lastActionAt: null,
      workspaceId: "workspace-1",
      prompt: "Sweep the runtime queue.",
      reviewPackId: "review-pack-1",
      review_pack_id: "review-pack-legacy",
      reviewActionability: { state: "ready" },
      reviewActionabilityState: "ready",
      reviewPackSummary: { id: "review-pack-1" },
      missionLinkage: { workspaceId: "workspace-1" },
      taskSource: { kind: "schedule" },
    };

    const payload = buildNativeSchedulePayload(
      {
        name: "Night Operator",
        prompt: "Sweep the runtime queue.",
        workspaceId: "workspace-1",
        cadence: "0 0 * * *",
        backendId: "backend-1",
        reviewProfileId: "",
        validationPresetId: "",
        enabled: true,
        autonomyProfile: "night_operator",
        sourceScope: "workspace_graph",
        wakePolicy: "auto_queue",
        researchPolicy: "repository_only",
        queueBudget: "2",
        safeFollowUp: true,
      },
      existing
    );

    expect(payload.workspaceId).toBe("workspace-1");
    expect(payload.reviewPackId).toBeUndefined();
    expect(payload.review_pack_id).toBeUndefined();
    expect(payload.reviewActionability).toBeUndefined();
    expect(payload.reviewActionabilityState).toBeUndefined();
    expect(payload.reviewPackSummary).toBeUndefined();
    expect(payload.missionLinkage).toBeUndefined();
    expect(payload.taskSource).toBeUndefined();
  });
});
