import { describe, expect, it, vi } from "vitest";

import {
  buildCodeRuntimeServicePrewarmCommand,
  runCodeRuntimeServicePrewarm,
  shouldPrewarmCodeRuntimeService,
} from "../../scripts/prewarm-code-runtime-service.mjs";

describe("prewarm-code-runtime-service", () => {
  it("builds the guarded runtime service cargo command from the repo root", () => {
    expect(buildCodeRuntimeServicePrewarmCommand("/repo")).toEqual({
      command: process.execPath,
      args: [
        "/repo/scripts/run-cargo-with-target-guard.mjs",
        "--cwd",
        "packages/code-runtime-service-rs",
        "build",
        "--manifest-path",
        "Cargo.toml",
      ],
      cwd: "/repo",
    });
  });

  it("lets callers disable prewarm explicitly", () => {
    expect(shouldPrewarmCodeRuntimeService({ CODE_RUNTIME_PREWARM: "false" })).toBe(false);
    expect(shouldPrewarmCodeRuntimeService({ CODE_RUNTIME_PREWARM: "0" })).toBe(false);
    expect(shouldPrewarmCodeRuntimeService({ CODE_RUNTIME_PREWARM: "true" })).toBe(true);
  });

  it("skips the guarded cargo build when prewarm is disabled", () => {
    const spawnSyncImpl = vi.fn();

    expect(
      runCodeRuntimeServicePrewarm({
        repoRoot: "/repo",
        env: {
          CODE_RUNTIME_PREWARM: "false",
        },
        spawnSyncImpl,
      })
    ).toEqual({
      skipped: true,
      status: 0,
    });

    expect(spawnSyncImpl).not.toHaveBeenCalled();
  });

  it("runs the guarded cargo build when prewarm is enabled", () => {
    const spawnSyncImpl = vi.fn(() => ({
      status: 0,
      error: null,
    }));

    expect(
      runCodeRuntimeServicePrewarm({
        repoRoot: "/repo",
        env: {},
        spawnSyncImpl,
      })
    ).toEqual({
      skipped: false,
      status: 0,
    });

    expect(spawnSyncImpl).toHaveBeenCalledWith(
      process.execPath,
      [
        "/repo/scripts/run-cargo-with-target-guard.mjs",
        "--cwd",
        "packages/code-runtime-service-rs",
        "build",
        "--manifest-path",
        "Cargo.toml",
      ],
      expect.objectContaining({
        cwd: "/repo",
        env: {},
        stdio: "inherit",
      })
    );
  });
});
