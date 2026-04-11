import { describe, expect, it } from "vitest";
import { projectAgentTaskStatusToRunState } from "./runtimeMissionControlTaskStatus";

describe("runtimeMissionControlTaskStatus", () => {
  it("maps agent task workflow states into mission-control run states", () => {
    expect(projectAgentTaskStatusToRunState("queued")).toBe("queued");
    expect(projectAgentTaskStatusToRunState("awaiting_approval")).toBe("needs_input");
    expect(projectAgentTaskStatusToRunState("completed")).toBe("review_ready");
    expect(projectAgentTaskStatusToRunState("interrupted")).toBe("cancelled");
  });
});
