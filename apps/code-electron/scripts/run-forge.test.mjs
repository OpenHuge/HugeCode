import { describe, expect, it } from "vitest";
import { resolveForgeStageCommands } from "./run-forge.mjs";

describe("run-forge invocation resolution", () => {
  it("uses shell-backed cmd entrypoints on Windows", () => {
    const commands = resolveForgeStageCommands("win32");

    expect(commands.npm).toEqual({
      command: "npm.cmd",
      shell: true,
    });
    expect(commands.electronForge.command.endsWith("node_modules/.bin/electron-forge.cmd")).toBe(
      true
    );
    expect(commands.electronForge.shell).toBe(true);
  });

  it("uses direct binaries on POSIX platforms", () => {
    const commands = resolveForgeStageCommands("darwin");

    expect(commands.npm).toEqual({
      command: "npm",
      shell: false,
    });
    expect(commands.electronForge.command.endsWith("node_modules/.bin/electron-forge")).toBe(true);
    expect(commands.electronForge.shell).toBe(false);
  });
});
