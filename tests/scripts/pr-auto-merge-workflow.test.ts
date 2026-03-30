import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "pr-auto-merge.yml");

function readWorkflow() {
  return readFileSync(workflowPath, "utf8");
}

describe("pr-auto-merge workflow", () => {
  it("recovers stuck merge queue entries from all recoverable stalled states", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("is_recoverable_stuck_merge_queue_state()");
    expect(workflow).toContain('[[ "$merge_queue_state" == "AWAITING_CHECKS" ]]');
    expect(workflow).toContain('[[ "$merge_queue_state" == "UNMERGEABLE" ]]');
    expect(workflow).toContain("already in merge queue with unrecoverable state");
  });
});
