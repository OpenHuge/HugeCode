import { describe, expect, it } from "vitest";
import {
  resolveAutoDriveExternalResearchPolicy,
  resolveRuntimeSubAgentBatchPolicy,
} from "./runtimeToolExecutionPolicy";

describe("runtimeToolExecutionPolicy", () => {
  it("keeps OpenAI batch requests parallel when no safety signals require fallback", () => {
    const decision = resolveRuntimeSubAgentBatchPolicy({
      provider: "openai",
      requestedExecutionMode: "parallel",
      requestedMaxParallel: 6,
      taskCount: 3,
      hasApprovalSensitiveTasks: false,
    });

    expect(decision.provider).toBe("openai");
    expect(decision.parallelToolCallsAllowed).toBe(true);
    expect(decision.effectiveExecutionMode).toBe("parallel");
    expect(decision.effectiveMaxParallel).toBe(6);
    expect(decision.reasonCodes).toContain("provider-allows-parallelism");
  });

  it("caps Anthropic parallelism conservatively", () => {
    const decision = resolveRuntimeSubAgentBatchPolicy({
      provider: "claude",
      requestedExecutionMode: "parallel",
      requestedMaxParallel: 6,
      taskCount: 4,
      hasApprovalSensitiveTasks: false,
    });

    expect(decision.provider).toBe("anthropic");
    expect(decision.parallelToolCallsAllowed).toBe(true);
    expect(decision.effectiveExecutionMode).toBe("parallel");
    expect(decision.effectiveMaxParallel).toBe(2);
    expect(decision.reasonCodes).toContain("provider-capped-parallelism");
  });

  it("forces sequential execution for approval-sensitive batches", () => {
    const decision = resolveRuntimeSubAgentBatchPolicy({
      provider: "openai",
      requestedExecutionMode: "parallel",
      requestedMaxParallel: 4,
      taskCount: 2,
      hasApprovalSensitiveTasks: true,
    });

    expect(decision.parallelToolCallsAllowed).toBe(false);
    expect(decision.effectiveExecutionMode).toBe("sequential");
    expect(decision.effectiveMaxParallel).toBe(1);
    expect(decision.reasonCodes).toContain("approval-sensitive-tasks");
  });

  it("disables network research when the run has no freshness signal", () => {
    const decision = resolveAutoDriveExternalResearchPolicy({
      allowNetworkAnalysis: true,
      modelId: "gpt-5",
      destinationTitle: "Refine the local composer layout",
      desiredEndState: ["Improve spacing"],
      arrivalCriteria: ["Preserve layout rhythm"],
      hardBoundaries: ["Do not widen scope"],
      previousSummaryText: "Adjusted spacing after a local refactor.",
    });

    expect(decision.enabled).toBe(false);
    expect(decision.strategy).toBe("disabled");
    expect(decision.reasonCodes).toContain("no-freshness-signal");
  });

  it("uses search-only research for Anthropic runs when freshness signals exist", () => {
    const decision = resolveAutoDriveExternalResearchPolicy({
      allowNetworkAnalysis: true,
      modelId: "claude-3-7-sonnet",
      destinationTitle: "Update SDK integration to latest provider guidance",
      desiredEndState: ["Use latest SDK behavior"],
      arrivalCriteria: ["Confirm latest API docs"],
      hardBoundaries: ["Avoid stale docs"],
      previousSummaryText: "Need latest upstream API guidance before continuing.",
    });

    expect(decision.provider).toBe("anthropic");
    expect(decision.enabled).toBe(true);
    expect(decision.strategy).toBe("search-only");
    expect(decision.fetchPageContent).toBe(false);
    expect(decision.reasonCodes).toContain("research-search-only");
  });
});
