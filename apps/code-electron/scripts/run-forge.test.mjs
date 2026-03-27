import { describe, expect, it } from "vitest";
import {
  assertForgeHostBinaryRequirements,
  createCliInvocation,
  createForgeStageInstallArgs,
  createStagedPackageJson,
  parseForgeCommand,
  resolveCliCommand,
  resolveForgeHostBinaryRequirements,
  resolveMissingForgeHostBinaries,
  sanitizeSpawnEnv,
} from "./run-forge.mjs";

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
      command: "cmd.exe",
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
        electron: "41.0.3",
      },
    });
  });

  it("removes Windows pseudo-environment keys before spawning child processes", () => {
    expect(
      sanitizeSpawnEnv({
        "=C:": "C:\\repo",
        PATH: "C:\\Windows\\System32",
        KEEP_ME: "ok",
        BROKEN: "bad\u0000value",
        npm_config_node_linker: "hoisted",
      })
    ).toEqual({
      PATH: "C:\\Windows\\System32",
      KEEP_ME: "ok",
    });
  });

  it("installs staged dependencies with the workspace lockfile", () => {
    expect(createForgeStageInstallArgs("/repo")).toEqual([
      "install",
      "--frozen-lockfile",
      "--ignore-scripts",
      "--ignore-workspace",
      "--lockfile-dir",
      "/repo",
    ]);
  });
});

describe("forge host preflight", () => {
  it("requires zip for linux packaging and deb toolchain for make/publish", () => {
    expect(resolveForgeHostBinaryRequirements("package", "linux")).toEqual([
      {
        binary: "zip",
        rationale: "HugeCode stages a local Electron zip before invoking Forge packaging.",
      },
    ]);
    expect(resolveForgeHostBinaryRequirements("make", "linux")).toEqual([
      {
        binary: "zip",
        rationale: "HugeCode stages a local Electron zip before invoking Forge packaging.",
      },
      {
        binary: "dpkg",
        rationale: "Electron Forge's Debian maker needs dpkg to produce .deb artifacts.",
      },
      {
        binary: "fakeroot",
        rationale: "Electron Forge's Debian maker needs fakeroot to package .deb artifacts.",
      },
    ]);
    expect(resolveForgeHostBinaryRequirements("make", "darwin")).toEqual([]);
  });

  it("reports missing linux host binaries from PATH lookup", async () => {
    const missing = await resolveMissingForgeHostBinaries(
      "make",
      {
        env: {
          PATH: "/tmp/nowhere",
        },
        platform: "linux",
      },
      {
        accessImpl: async () => {
          throw new Error("missing");
        },
      }
    );

    expect(missing.map((entry) => entry.binary)).toEqual(["zip", "dpkg", "fakeroot"]);
  });

  it("passes preflight when every required binary resolves", async () => {
    await expect(
      assertForgeHostBinaryRequirements(
        "package",
        {
          env: {
            PATH: "/tooling/bin",
          },
          platform: "linux",
        },
        {
          accessImpl: async () => {},
        }
      )
    ).resolves.toBeUndefined();
  });
});
