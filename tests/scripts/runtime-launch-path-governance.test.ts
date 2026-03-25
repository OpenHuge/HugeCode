import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CODE_RUNTIME_CANONICAL_MISSION_LAUNCH_METHODS,
  CODE_RUNTIME_RETIRE_ONLY_PRODUCT_LAUNCH_METHODS,
} from "../../packages/code-runtime-host-contract/src/codeRuntimeRpc";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const productLaunchRoots = [
  "apps/code/src/features",
  "apps/code/src/application/runtime/facades",
  "apps/code/src/application/runtime/kernel",
  "packages/code-workspace-client/src/workspace",
];

function grepProductLaunchSources(pattern: string): string {
  try {
    return execFileSync(
      "rg",
      [
        "-n",
        pattern,
        ...productLaunchRoots,
        "--glob",
        "!**/*.test.*",
        "--glob",
        "!**/*.spec.*",
        "--glob",
        "!**/dist/**",
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
      }
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error as { status?: number }).status === 1
    ) {
      return "";
    }
    throw error;
  }
}

describe("runtime launch path governance", () => {
  it("documents the canonical mission launch contract in the shared rpc constants", () => {
    expect(CODE_RUNTIME_CANONICAL_MISSION_LAUNCH_METHODS).toEqual([
      "code_runtime_run_prepare_v2",
      "code_runtime_run_start_v2",
    ]);
    expect(CODE_RUNTIME_RETIRE_ONLY_PRODUCT_LAUNCH_METHODS).toContain("code_kernel_job_start_v3");
  });

  it("keeps PlanPanel observe/interrupt only and out of direct relaunch flow", () => {
    const source = readFileSync(
      path.resolve(repoRoot, "apps/code/src/features/plan/components/PlanPanel.tsx"),
      "utf8"
    );

    expect(source).not.toMatch(/startRuntimeRunWithRemoteSelection/);
    expect(source).not.toMatch(/startRuntimeJob\b/);
    expect(source).not.toMatch(/getRuntimeJob\b/);
    expect(source).not.toMatch(/onRetryNode=/);
  });

  it("keeps product launch helper on prepare_v2 plus start_v2", () => {
    const source = readFileSync(
      path.resolve(
        repoRoot,
        "apps/code/src/application/runtime/facades/runtimeRemoteExecutionFacade.ts"
      ),
      "utf8"
    );

    expect(source).toMatch(/prepareRuntimeRunV2/);
    expect(source).toMatch(/startRuntimeRunV2/);
    expect(source).not.toMatch(/startRuntimeJob\b/);
    expect(source).not.toMatch(/kernelJobStartV3/);
  });

  it("does not re-export direct legacy job launch through the app runtime port", () => {
    const source = readFileSync(
      path.resolve(repoRoot, "apps/code/src/application/runtime/ports/tauriRuntimeJobs.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/\bstartRuntimeJob\b/);
    expect(source).not.toMatch(/\bgetRuntimeJob\b/);
    expect(source).not.toMatch(/\bKernelJobStartRequestV3\b/);
    expect(source).not.toMatch(/\bKernelJobGetRequestV3\b/);
  });

  it("rejects non-canonical product launch entry points in product-facing sources", () => {
    const legacyHelperHits = grepProductLaunchSources(
      "startRuntimeJobWithRemoteSelection|resolvePreferredBackendIdsForRuntimeJobStart"
    );
    const legacyKernelLaunchHits = grepProductLaunchSources(
      "KERNEL_JOB_START_V3|code_kernel_job_start_v3"
    );
    const legacyRunStartHits = grepProductLaunchSources("RUN_START[^_V]|code_runtime_run_start");

    expect(legacyHelperHits).toBe("");
    expect(legacyKernelLaunchHits).toBe("");
    expect(legacyRunStartHits).toBe("");
  });
});
