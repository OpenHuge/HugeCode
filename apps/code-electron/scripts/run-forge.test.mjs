import { describe, expect, it } from "vitest";
import {
  createCliInvocation,
  resolveCliCommand,
  resolveStageInstallCommand,
  sanitizeSpawnEnv,
} from "./run-forge.mjs";

describe("run-forge helpers", () => {
  it("uses npm for staged forge installs so config-time dependencies bypass pnpm subdependency policy", () => {
    expect(resolveStageInstallCommand()).toEqual({
      commandName: process.platform === "win32" ? "npm.cmd" : "npm",
      args: ["install", "--include=dev", "--ignore-scripts", "--no-package-lock"],
    });
  });

  it("uses .cmd shims for bare package-manager commands on Windows", () => {
    expect(resolveCliCommand("npm", "win32")).toBe("npm.cmd");
    expect(resolveCliCommand("pnpm", "win32")).toBe("pnpm.cmd");
    expect(resolveCliCommand("node", "linux")).toBe("node");
  });

  it("wraps Windows CLI invocations through cmd.exe", () => {
    expect(createCliInvocation("npm", ["install"], "win32")).toEqual({
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", "npm.cmd install"],
    });
    expect(createCliInvocation("node", ["scripts/run.js"], "linux")).toEqual({
      command: "node",
      args: ["scripts/run.js"],
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
