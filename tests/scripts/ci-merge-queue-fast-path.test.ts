import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "ci.yml");

function readWorkflow() {
  return readFileSync(workflowPath, "utf8");
}

describe("ci merge-queue fast PR path", () => {
  it("keeps merge_group enabled for required checks", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("merge_group:");
    expect(workflow).toContain("checks_requested");
  });

  it("defines a queue-aware fast PR mode toggle", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("fast_pr_iteration_mode");
    expect(workflow).toContain("github.event_name == 'pull_request'");
    expect(workflow).toContain("vars.MERGE_QUEUE_ENABLED != 'false'");
  });

  it("skips heavy runtime and test jobs on pull_request when merge queue mode is enabled", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("quality_runtime_contract_parity:");
    expect(workflow).toContain("pr_affected_tests:");
    expect(workflow).toContain("needs.changes.outputs.fast_pr_iteration_mode != 'true'");
  });

  it("moves frontend optimization off the pull_request fast path and onto merge_group", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("frontend_optimization:");
    expect(workflow).toContain("github.event_name == 'merge_group'");
    expect(workflow).not.toContain(
      "github.event_name == 'pull_request' && needs.changes.outputs.frontend_optimization_changed == 'true'"
    );
  });

  it("keeps desktop fast verify scoped to desktop host-owned changes", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("desktop_host_changed");
    expect(workflow).toContain("desktop_host:");
    expect(workflow).toContain("apps/code-electron/**");
    expect(workflow).toContain("desktop_fast_verify_required");
    expect(workflow).toContain(
      "desktop_fast_verify_required: ${{ needs.changes.outputs.desktop_fast_verify_required == 'true' }}"
    );
  });

  it("keeps the merge-queue required affected summary green on push", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("pr_affected:");
    expect(workflow).not.toContain("if: always() && github.event_name != 'push'");
  });
});
