import { describe, expect, it } from "vitest";
import {
  copyForgeOutDir,
  createCliInvocation,
  createForgeExecutionEnv,
  createForgeStageEnv,
  createStagedPackageJson,
  parseForgeCommand,
  resolveCliCommand,
  resolveForgeStageCommands,
  resolveLocalElectronZipArtifactName,
} from "./run-forge.mjs";

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

describe("resolveLocalElectronZipArtifactName", () => {
  it("builds the local packager cache artifact name from version, platform, and arch", () => {
    expect(resolveLocalElectronZipArtifactName("41.0.3", "darwin", "x64")).toBe(
      "electron-v41.0.3-darwin-x64.zip"
    );
    expect(resolveLocalElectronZipArtifactName("v41.0.3", "win32", "arm64")).toBe(
      "electron-v41.0.3-win32-arm64.zip"
    );
  });
});

describe("createForgeExecutionEnv", () => {
  it("injects the staged local electron zip directory for Forge packaging", () => {
    const env = createForgeExecutionEnv(
      {
        KEEP_ME: "1",
        npm_config_verify_deps_before_run: "error",
      },
      "/tmp/hugecode-electron-zips"
    );

    expect(env).toEqual({
      ELECTRON_FORGE_DISABLE_PUBLISH_SANDBOX_WARNING: "true",
      HUGECODE_ELECTRON_ZIP_DIR: "/tmp/hugecode-electron-zips",
      KEEP_ME: "1",
    });
  });
});

describe("forge stage dependencies", () => {
  it("keeps only forge config-time dependencies in the staged package", async () => {
    const { FORGE_STAGE_CONFIG_TIME_DEV_DEPENDENCIES } = await import("./forge-stage-package.mjs");

    expect(FORGE_STAGE_CONFIG_TIME_DEV_DEPENDENCIES).toEqual([
      "electron",
      "@electron-forge/maker-deb",
      "@electron-forge/plugin-fuses",
      "@electron/fuses",
    ]);
  });
});

describe("copyForgeOutDir", () => {
  it("replaces the repo out directory with the staged forge output without dereferencing symlinks", async () => {
    const calls = [];

    await copyForgeOutDir("/tmp/staged-out", "/tmp/repo-out", {
      accessImpl: async () => {},
      cpImpl: async (...args) => {
        calls.push(["cp", ...args]);
      },
      rmImpl: async (...args) => {
        calls.push(["rm", ...args]);
      },
    });

    expect(calls).toEqual([
      ["rm", "/tmp/repo-out", { force: true, recursive: true }],
      [
        "cp",
        "/tmp/staged-out",
        "/tmp/repo-out",
        {
          force: true,
          recursive: true,
        },
      ],
    ]);
  });
});

describe("run-forge helpers", () => {
  it("parses supported forge commands", () => {
    expect(parseForgeCommand(["node", "run-forge.mjs", "make"])).toBe("make");
  });

  it("rejects unsupported forge commands", () => {
    expect(() => parseForgeCommand(["node", "run-forge.mjs", "ship"])).toThrow(
      "Usage: node ./scripts/run-forge.mjs <package|make|publish>"
    );
  });

  it("uses .cmd shims for bare package manager commands on Windows", () => {
    expect(resolveCliCommand("npm", "win32")).toBe("npm.cmd");
    expect(resolveCliCommand("pnpm", "win32")).toBe("pnpm.cmd");
    expect(resolveCliCommand("node", "linux")).toBe("node");
    expect(resolveCliCommand("C:/tooling/electron-forge.cmd", "win32")).toBe(
      "C:/tooling/electron-forge.cmd"
    );
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

  it("filters workspace dependencies from the staged package manifest", () => {
    expect(
      createStagedPackageJson({
        version: "1.2.3",
        repository: {
          type: "git",
          url: "https://github.com/OpenHuge/HugeCode.git",
        },
        dependencies: {
          "@ku0/code-platform-interfaces": "workspace:*",
          "update-electron-app": "3.1.2",
        },
        devDependencies: {
          electron: "41.0.3",
        },
      })
    ).toEqual({
      name: "hugecode",
      productName: "HugeCode",
      version: "1.2.3",
      author: "OpenHuge",
      description: "HugeCode beta desktop shell",
      productDescription: "HugeCode beta desktop shell",
      type: "module",
      main: "dist-electron/main/main.js",
      repository: {
        type: "git",
        url: "https://github.com/OpenHuge/HugeCode.git",
      },
      config: {
        forge: "./forge.config.mjs",
      },
      dependencies: {
        "update-electron-app": "3.1.2",
      },
      devDependencies: {
        "@electron-forge/maker-deb": "7.11.1",
        electron: "41.0.3",
      },
    });
  });
});
