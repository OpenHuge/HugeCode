import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const desktopWorkflowPath = path.join(repoRoot, ".github", "workflows", "desktop.yml");
const electronWorkflowPath = path.join(repoRoot, ".github", "workflows", "electron-beta.yml");

function readWorkflow(workflowPath: string) {
  return readFileSync(workflowPath, "utf8");
}

function sliceBetween(workflow: string, startMarker: string, endMarker: string) {
  const start = workflow.indexOf(startMarker);
  const end = workflow.indexOf(endMarker, start);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return workflow.slice(start, end);
}

describe("optional PR workflow scope", () => {
  it("keeps Tauri desktop pull_request triggers host-owned while preserving broader push coverage", () => {
    const workflow = readWorkflow(desktopWorkflowPath);
    const pullRequestSection = sliceBetween(workflow, "  pull_request:\n", "  push:\n");
    const pushSection = sliceBetween(workflow, "  push:\n", "\npermissions:\n");
    const desktopFilterSection = sliceBetween(
      workflow,
      "            desktop:\n",
      "            desktop_frontend:\n"
    );
    const desktopHostFilterSection = sliceBetween(
      workflow,
      "            desktop_host:\n",
      "\n\n      - id: scope\n"
    );

    expect(pullRequestSection).toContain('"apps/code-tauri/**"');
    expect(pullRequestSection).toContain('".github/workflows/desktop.yml"');
    expect(pullRequestSection).not.toContain('"apps/code/src/application/runtime/**"');
    expect(pullRequestSection).not.toContain('"apps/code/src/features/update/**"');
    expect(pullRequestSection).not.toContain('"apps/code/package.json"');

    expect(pushSection).toContain('"apps/code/**"');
    expect(pushSection).toContain('"apps/code-tauri/**"');
    expect(desktopFilterSection).toContain('"apps/code-tauri/**"');
    expect(desktopFilterSection).not.toContain(
      '".github/workflows/_reusable-desktop-build-pr.yml"'
    );
    expect(desktopFilterSection).not.toContain('".github/actions/setup-node-pnpm/**"');
    expect(desktopHostFilterSection).toContain('"apps/code-tauri/**"');
    expect(desktopHostFilterSection).not.toContain(
      '".github/workflows/_reusable-desktop-build-pr.yml"'
    );
    expect(desktopHostFilterSection).not.toContain('".github/actions/setup-rust-ci/**"');
  });

  it("keeps Electron beta pull_request triggers packaging-owned while preserving broader push coverage", () => {
    const workflow = readWorkflow(electronWorkflowPath);
    const pullRequestSection = sliceBetween(workflow, "  pull_request:\n", "  push:\n");
    const pushSection = sliceBetween(workflow, "  push:\n", "\npermissions:\n");

    expect(pullRequestSection).toContain('"apps/code-electron/**"');
    expect(pullRequestSection).toContain('"scripts/electron-publish-dry-run.mjs"');
    expect(pullRequestSection).not.toContain('"packages/code-application/**"');
    expect(pullRequestSection).not.toContain('"packages/code-platform-interfaces/**"');
    expect(pullRequestSection).not.toContain('"apps/code/package.json"');
    expect(pullRequestSection).not.toContain('"pnpm-lock.yaml"');

    expect(pushSection).toContain('"apps/code/**"');
    expect(pushSection).toContain('"packages/code-application/**"');
    expect(pushSection).toContain('"packages/code-platform-interfaces/**"');
  });
});
