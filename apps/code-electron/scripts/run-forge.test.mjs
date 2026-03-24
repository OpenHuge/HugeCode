import { describe, expect, it } from "vitest";
import { resolveStageInstallCommand, sanitizeSpawnEnv } from "./run-forge.mjs";

describe("run-forge helpers", () => {
  it("reuses the active package manager entrypoint when npm_execpath is available", () => {
    expect(
      resolveStageInstallCommand({
        npm_execpath: "/tmp/pnpm.cjs",
      })
    ).toEqual({
      commandName: process.execPath,
      args: ["/tmp/pnpm.cjs", "install", "--ignore-scripts"],
    });
  });

  it("falls back to npm-compatible commands when no package manager entrypoint is published", () => {
    expect(resolveStageInstallCommand({})).toEqual({
      commandName: process.platform === "win32" ? "npm.cmd" : "npm",
      args: ["install", "--ignore-scripts"],
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
