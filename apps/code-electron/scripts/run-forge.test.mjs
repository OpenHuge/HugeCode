import { describe, expect, it } from "vitest";
import { createForgeStageEnv, resolveForgeStageCommands } from "./run-forge.mjs";

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

describe("createForgeStageEnv", () => {
  it("drops pnpm-specific npm config that breaks staged npm installs", () => {
    const env = createForgeStageEnv({
      KEEP_ME: "1",
      npm_config_node_linker: "hoisted",
      npm_config_verify_deps_before_run: "error",
      pnpm_config_verify_deps_before_run: "error",
    });

    expect(env).toEqual({
      KEEP_ME: "1",
    });
  });

  it("preserves unrelated npm environment needed by child processes", () => {
    const env = createForgeStageEnv({
      HOME: "/tmp/home",
      npm_config_registry: "https://registry.npmjs.org/",
      npm_config_user_agent: "pnpm/10.0.0",
    });

    expect(env).toEqual({
      HOME: "/tmp/home",
      npm_config_registry: "https://registry.npmjs.org/",
      npm_config_user_agent: "pnpm/10.0.0",
    });
  });
});
