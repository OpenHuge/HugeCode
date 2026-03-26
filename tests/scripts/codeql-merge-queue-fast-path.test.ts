import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "codeql.yml");

function readWorkflow() {
  return readFileSync(workflowPath, "utf8");
}

describe("codeql merge-queue fast PR path", () => {
  it("adds merge_group coverage and queue-safe concurrency", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("merge_group:");
    expect(workflow).toContain("checks_requested");
    expect(workflow).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}");
  });

  it("defines a queue-aware fast PR mode toggle", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("fast_pr_iteration_mode");
    expect(workflow).toContain(
      "github.event_name == 'pull_request' && vars.MERGE_QUEUE_ENABLED != 'false'"
    );
  });

  it("skips long CodeQL analysis on pull_request when merge queue mode is enabled", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("Analyze (javascript-typescript)");
    expect(workflow).toContain("Analyze (rust)");
    expect(workflow).toContain("needs.changes.outputs.fast_pr_iteration_mode != 'true'");
    expect(workflow).toContain(
      "Skipping JavaScript/TypeScript CodeQL lane because PR fast mode is enabled."
    );
    expect(workflow).toContain("Skipping Rust CodeQL lane because PR fast mode is enabled.");
  });

  it("keeps merge_group scans broad even when PR fast mode is enabled", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("github.event_name == 'merge_group'");
    expect(workflow).toContain("javascript_required");
    expect(workflow).toContain("rust_required");
  });
});
