import { describe, expect, it } from "vitest";
import { resolveStageInstallCommand, sanitizeSpawnEnv } from "./run-forge.mjs";

describe("run-forge helpers", () => {
  it("uses npm for staged forge installs so config-time dependencies bypass pnpm subdependency policy", () => {
    expect(resolveStageInstallCommand()).toEqual({
      commandName: process.platform === "win32" ? "npm.cmd" : "npm",
      args: ["install", "--include=dev", "--ignore-scripts", "--no-package-lock"],
    });
  });

  it("removes Windows pseudo-environment keys before spawning child processes", () => {
    expect(
      sanitizeSpawnEnv({
        "=C:": "C:\\repo",
        PATH: "C:\\Windows\\System32",
        KEEP_ME: "ok",
        BROKEN: "bad\u0000value",
      })
    ).toEqual({
      PATH: "C:\\Windows\\System32",
      KEEP_ME: "ok",
    });
  });
});
