import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "pr-branch-maintenance.yml");

function readWorkflow() {
  return readFileSync(workflowPath, "utf8");
}

describe("pr-branch-maintenance workflow", () => {
  it("defines the expected branch maintenance triggers", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("pull_request_target:");
    expect(workflow).toContain("pull_request_review:");
    expect(workflow).toContain("push:");
    expect(workflow).toContain("branches:");
    expect(workflow).toContain("- main");
    expect(workflow).toContain("workflow_dispatch:");
  });

  it("updates only eligible behind pull requests with GitHub-native branch updates", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("reviewDecision");
    expect(workflow).toContain("reviewThreads(first: 100)");
    expect(workflow).toContain("reason=Pull request is not currently approved.");
    expect(workflow).toContain("reason=Pull request still has unresolved review threads.");
    expect(workflow).toContain("reason=Head branch is not hosted in the base repository.");
    expect(workflow).toContain("reason=manual-merge label is present.");
    expect(workflow).toContain('if [[ "$merge_state" == "BEHIND" ]]');
    expect(workflow).toContain("gh pr update-branch");
  });

  it("stops updating behind pull requests when merge queue mode is enabled", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("MERGE_QUEUE_ENABLED");
    expect(workflow).toContain('if [[ "$MERGE_QUEUE_ENABLED" == "true" ]]');
    expect(workflow).toContain("merge queue will refresh latest-base validation");
  });

  it("surfaces conflicted pull requests without trying to auto-resolve them", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain('if [[ "$merge_state" == "DIRTY" ]]');
    expect(workflow).toContain("GITHUB_STEP_SUMMARY");
    expect(workflow).not.toContain("gh pr update-branch --rebase");
  });
});
