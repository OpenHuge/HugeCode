import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CODE_RUNTIME_CANONICAL_MISSION_LAUNCH_METHODS,
  CODE_RUNTIME_CANONICAL_RUN_LIFECYCLE_METHODS,
  CODE_RUNTIME_COMPAT_THREAD_TURN_METHODS,
  CODE_RUNTIME_RPC_METHOD_LIST,
} from "../../packages/code-runtime-host-contract/src/codeRuntimeRpc";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const productLaunchRoots = [
  "apps/code-t3/src",
  "packages/code-application/src",
  "packages/code-workspace-client/src/workspace",
];

function grepProductLaunchSources(pattern: string): string {
  try {
    return execFileSync(
      "rg",
      [
        "-n",
        "--pcre2",
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

function listProductLaunchFiles(pattern: string): string[] {
  const hits = grepProductLaunchSources(pattern);
  if (!hits) {
    return [];
  }
  return [
    ...new Set(
      hits
        .split(/\r?\n/u)
        .filter(Boolean)
        .map((line) => line.split(":", 1)[0])
    ),
  ]
    .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
    .sort();
}

describe("runtime launch path governance", () => {
  it("documents the canonical mission launch contract in the shared rpc constants", () => {
    expect(CODE_RUNTIME_CANONICAL_MISSION_LAUNCH_METHODS).toEqual([
      "code_runtime_run_prepare_v2",
      "code_runtime_run_start_v2",
    ]);
    expect(CODE_RUNTIME_CANONICAL_RUN_LIFECYCLE_METHODS).toEqual([
      "code_runtime_run_prepare_v2",
      "code_runtime_run_start_v2",
      "code_runtime_run_get_v2",
      "code_runtime_run_subscribe_v2",
      "code_runtime_review_get_v2",
      "code_runtime_run_cancel_v2",
      "code_runtime_run_resume_v2",
      "code_runtime_run_intervene_v2",
      "code_runtime_runs_list",
      "code_runtime_run_checkpoint_approval",
    ]);
    expect(CODE_RUNTIME_COMPAT_THREAD_TURN_METHODS).toEqual([
      "code_threads_list",
      "code_thread_create",
      "code_thread_resume",
      "code_thread_archive",
      "code_thread_live_subscribe",
      "code_thread_live_unsubscribe",
      "code_turn_send",
      "code_turn_interrupt",
    ]);
    expect(CODE_RUNTIME_RPC_METHOD_LIST).toContain("code_runtime_run_cancel_v2");
    expect(CODE_RUNTIME_RPC_METHOD_LIST).not.toContain("code_runtime_run_start");
    expect(CODE_RUNTIME_RPC_METHOD_LIST).not.toContain("code_runtime_run_cancel");
    expect(CODE_RUNTIME_RPC_METHOD_LIST).not.toContain("code_kernel_job_start_v3");
  });

  it("keeps runtime replay launch fixtures on prepare_v2 plus start_v2", () => {
    const source = readFileSync(
      path.resolve(repoRoot, "tests/e2e/src/code/runtime-core-replay.spec.ts"),
      "utf8"
    );

    expect(source).toMatch(/code_runtime_run_prepare_v2/);
    expect(source).toMatch(/code_runtime_run_start_v2/);
    expect(source).not.toMatch(/code_runtime_run_start(?!_v2)/);
  });

  it("rejects non-canonical product launch entry points in product-facing sources", () => {
    const legacyHelperHits = grepProductLaunchSources(
      "startRuntimeJobWithRemoteSelection|resolvePreferredBackendIdsForRuntimeJobStart"
    );
    const legacyKernelLaunchHits = grepProductLaunchSources(
      "KERNEL_JOB_START_V3|code_kernel_job_start_v3"
    );
    const legacyRunStartHits = grepProductLaunchSources("code_runtime_run_start(?!_v2)");
    const legacyJobControlHits = grepProductLaunchSources(
      "startRuntimeJob\\b|getRuntimeJob\\b|RuntimeJobInterventionAck|cancelRuntimeJob|resumeRuntimeJob|interveneRuntimeJob|subscribeRuntimeJob|listRuntimeJobs|KernelJob[A-Za-z]+V3"
    );

    expect(legacyHelperHits).toBe("");
    expect(legacyKernelLaunchHits).toBe("");
    expect(legacyRunStartHits).toBe("");
    expect(legacyJobControlHits).toBe("");
  });

  it("keeps mission navigation/control-plane wiring on shared package imports", () => {
    const legacyMissionPresentationHits = grepProductLaunchSources("missionControlPresentation");
    const legacyControlPlaneCompatHits = grepProductLaunchSources(
      "application/runtime/facades/runtimeMission(ControlOperatorAction|ControlTakeoverAction|ControlNavigationTarget|NavigationTarget|NavigationTypes)"
    );

    expect(legacyMissionPresentationHits).toBe("");
    expect(legacyControlPlaneCompatHits).toBe("");
  });

  it("keeps deleted app-server and direct thread ports out of active product routing", () => {
    expect(listProductLaunchFiles("subscribeAppServerEvents\\(")).toEqual([]);
    expect(grepProductLaunchSources("account/login/completed|loginChatGptComplete")).toBe("");
    expect(grepProductLaunchSources("account/updated|authStatusChange")).toBe("");
    expect(grepProductLaunchSources("sendUserMessage|ports/runtimeThreads")).toBe("");
  });
});
