import { describe, expect, it } from "vitest";
import * as runtimeAgentBridge from "./runtimeAgentBridge";

describe("runtimeAgentBridge", () => {
  it("does not expose legacy runtime run helpers", () => {
    expect(runtimeAgentBridge).not.toHaveProperty("startRuntimeRun");
    expect(runtimeAgentBridge).not.toHaveProperty("cancelRuntimeRun");
    expect(runtimeAgentBridge).not.toHaveProperty("interveneRuntimeRun");
    expect(runtimeAgentBridge).not.toHaveProperty("resumeRuntimeRun");
    expect(runtimeAgentBridge).not.toHaveProperty("subscribeRuntimeRun");
    expect(runtimeAgentBridge).not.toHaveProperty("listRuntimeRuns");
    expect(runtimeAgentBridge).not.toHaveProperty("checkpointRuntimeRunApproval");
  });

  it("does not expose legacy agent-task alias exports", () => {
    expect(runtimeAgentBridge).not.toHaveProperty("startAgentTask");
    expect(runtimeAgentBridge).not.toHaveProperty("interruptAgentTask");
    expect(runtimeAgentBridge).not.toHaveProperty("resumeAgentTask");
    expect(runtimeAgentBridge).not.toHaveProperty("interveneAgentTask");
    expect(runtimeAgentBridge).not.toHaveProperty("getAgentTaskStatus");
    expect(runtimeAgentBridge).not.toHaveProperty("listAgentTasks");
    expect(runtimeAgentBridge).not.toHaveProperty("submitApprovalDecision");
  });
});
