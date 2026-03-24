import { describe, expect, it } from "vitest";
import {
  buildForgeEnvironment,
  resolveCommandInvocation,
  resolveNodeInstaller,
  shouldUseLinuxDebianPackagingEnv,
} from "./run-forge-support.mjs";

describe("run-forge platform support", () => {
  it("only enables the Linux Debian packaging env on Linux make and publish commands", () => {
    expect(shouldUseLinuxDebianPackagingEnv({ platform: "linux", command: "make" })).toBe(true);
    expect(shouldUseLinuxDebianPackagingEnv({ platform: "linux", command: "publish" })).toBe(true);
    expect(shouldUseLinuxDebianPackagingEnv({ platform: "linux", command: "package" })).toBe(false);
    expect(shouldUseLinuxDebianPackagingEnv({ platform: "darwin", command: "make" })).toBe(false);
    expect(shouldUseLinuxDebianPackagingEnv({ platform: "win32", command: "publish" })).toBe(false);
  });

  it("keeps the Windows pnpm fallback but avoids forcing NODE_INSTALLER elsewhere", () => {
    expect(resolveNodeInstaller({ platform: "win32", nodeInstaller: undefined })).toBe("pnpm");
    expect(resolveNodeInstaller({ platform: "win32", nodeInstaller: "npm" })).toBe("npm");
    expect(resolveNodeInstaller({ platform: "linux", nodeInstaller: undefined })).toBeUndefined();
    expect(resolveNodeInstaller({ platform: "linux", nodeInstaller: "pnpm" })).toBe("pnpm");
  });

  it("only rewrites temp env vars on Linux Debian packaging paths", () => {
    const baseEnv = {
      HOME: "/home/tester",
      NODE_OPTIONS: "--trace-warnings",
    };

    expect(
      buildForgeEnvironment({
        baseEnv,
        command: "make",
        platform: "linux",
        processTempDir: "/tmp/forge-process",
      })
    ).toMatchObject({
      HOME: "/home/tester",
      NODE_OPTIONS: "--trace-warnings",
      TEMP: "/tmp/forge-process",
      TMP: "/tmp/forge-process",
      TMPDIR: "/tmp/forge-process",
    });

    expect(
      buildForgeEnvironment({
        baseEnv,
        command: "make",
        platform: "darwin",
        processTempDir: "/tmp/forge-process",
      })
    ).toEqual({
      HOME: "/home/tester",
      NODE_OPTIONS: "--trace-warnings",
      ELECTRON_FORGE_DISABLE_PUBLISH_SANDBOX_WARNING: "true",
    });
  });

  it("resolves npm through the Node CLI path before falling back to npm.cmd on Windows", async () => {
    const foundPath = "/node/lib/node_modules/npm/bin/npm-cli.js";
    const invocation = await resolveCommandInvocation({
      commandName: "npm",
      platform: "win32",
      nodeExecDir: "/node/bin",
      accessPath: async (candidate) => {
        if (candidate !== foundPath) {
          throw new Error("missing");
        }
      },
    });

    expect(invocation).toEqual({
      argsPrefix: [foundPath],
      command: process.execPath,
    });
  });

  it("falls back to npm.cmd and pnpm.cmd on Windows when no npm CLI path is present", async () => {
    await expect(
      resolveCommandInvocation({
        commandName: "npm",
        platform: "win32",
        nodeExecDir: "/node/bin",
        accessPath: async () => {
          throw new Error("missing");
        },
      })
    ).resolves.toEqual({
      argsPrefix: [],
      command: "npm.cmd",
    });

    await expect(
      resolveCommandInvocation({
        commandName: "pnpm",
        platform: "win32",
        nodeExecDir: "/node/bin",
        accessPath: async () => {
          throw new Error("missing");
        },
      })
    ).resolves.toEqual({
      argsPrefix: [],
      command: "pnpm.cmd",
    });
  });
});
