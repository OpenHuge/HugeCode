import { describe, expect, it } from "vitest";
import {
  formatThreadAgentRoleLabel,
  resolveThreadStatePillLabel,
  resolveThreadStatusPresentation,
  resolveThreadStatusTone,
  resolveThreadVisualState,
} from "./threadExecutionState";

describe("threadExecutionState", () => {
  it("derives thread visual states from status summaries", () => {
    expect(
      resolveThreadVisualState({ isProcessing: true, hasUnread: false, isReviewing: false })
    ).toBe("processing");
    expect(
      resolveThreadVisualState({
        isProcessing: false,
        hasUnread: false,
        isReviewing: false,
        timelineState: "awaitingApproval",
      })
    ).toBe("awaitingApproval");
    expect(
      resolveThreadVisualState({ isProcessing: false, hasUnread: true, isReviewing: false })
    ).toBe("unread");
  });

  it("resolves one shared label and tone presentation for visual states", () => {
    expect(resolveThreadStatusPresentation("processing")).toEqual({
      label: "Working",
      tone: "warning",
    });
    expect(resolveThreadStatusPresentation("reviewing")).toEqual({
      label: "Review",
      tone: "success",
    });
    expect(resolveThreadStatusPresentation("planReady")).toEqual({
      label: "Plan",
      tone: "progress",
    });
    expect(resolveThreadStatusPresentation("ready")).toEqual({
      label: null,
      tone: "success",
    });
  });

  it("keeps the legacy label and tone helpers aligned with shared presentation", () => {
    expect(resolveThreadStatePillLabel("completed")).toBe("Done");
    expect(resolveThreadStatusTone("awaitingInput")).toBe("progress");
  });

  it("formats agent roles into title case labels", () => {
    expect(formatThreadAgentRoleLabel("pair_programmer")).toBe("Pair Programmer");
    expect(formatThreadAgentRoleLabel("reviewAgent")).toBe("Review Agent");
    expect(formatThreadAgentRoleLabel(null)).toBeNull();
  });
});
