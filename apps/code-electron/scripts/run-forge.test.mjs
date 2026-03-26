import { describe, expect, it } from "vitest";
import {
  createCliInvocation,
  createStagedPackageJson,
  parseForgeCommand,
  resolveCliCommand,
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
