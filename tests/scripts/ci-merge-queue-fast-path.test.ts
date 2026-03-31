import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "ci.yml");

function readWorkflow() {
  return readFileSync(workflowPath, "utf8");
}

function readJobBlock(workflow: string, jobName: string, nextMarker: string) {
  const match = workflow.match(
    new RegExp(`\\n  ${jobName}:\\n([\\s\\S]*?)\\n  ${nextMarker}`, "m")
  );
  return match?.[1] ?? "";
}

function readFilterBlock(workflow: string, filterName: string, nextFilterName: string) {
  const match = workflow.match(
    new RegExp(`\\n            ${filterName}:\\n([\\s\\S]*?)\\n            ${nextFilterName}:`, "m")
  );
  return match?.[1] ?? "";
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

  it("keeps exclude-heavy frontend optimization scope in the classifier instead of duplicate workflow globs", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain(
      "frontend_optimization_changed: ${{ steps.scope.outputs.frontend_optimization_changed }}"
    );
    expect(workflow).not.toContain("            frontend_optimization:\n");
    expect(workflow).not.toContain("            app_circular:\n");
    expect(workflow).not.toContain("            ui_contract:\n");
  });

  it("keeps runtime contract parity scoped to runtime-owned surfaces instead of CI plumbing", () => {
    const workflow = readWorkflow();
    const runtimeContractFilter = readFilterBlock(workflow, "runtime_contract", "desktop_host");

    expect(runtimeContractFilter).not.toContain(".github/workflows/ci.yml");
    expect(runtimeContractFilter).not.toContain(
      ".github/workflows/_reusable-ci-runtime-contract-parity.yml"
    );
    expect(runtimeContractFilter).not.toContain(".github/actions/setup-node-pnpm/**");
    expect(runtimeContractFilter).not.toContain(".github/actions/install-linux-desktop-deps/**");
    expect(runtimeContractFilter).not.toContain(".github/actions/setup-rust-ci/**");
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

  it("lets affected tests skip for story and fixture only changes without dropping the aggregate gate", () => {
    const workflow = readWorkflow();
    const buildJob = readJobBlock(workflow, "pr_affected_build", "pr_affected_tests:");
    const testsJob = readJobBlock(
      workflow,
      "pr_affected_tests",
      "# Merge-queue-required affected summary"
    );

    expect(workflow).toContain("pr_affected_tests_required");
    expect(workflow).toContain(
      "pr_affected_tests_required: ${{ steps.scope.outputs.test_skip_eligible_only != 'true' }}"
    );
    expect(testsJob).toContain(
      "affected_tests_required: ${{ needs.changes.outputs.pr_affected_tests_required == 'true' }}"
    );
    expect(buildJob).not.toContain("affected_tests_required:");
  });
});
