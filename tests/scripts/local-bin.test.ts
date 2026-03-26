import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  resolveCommandInvocation,
  resolveLocalBinaryCommand,
} from "../../scripts/lib/local-bin.mjs";

describe("local-bin command invocation", () => {
  it("resolves local binaries directly on non-Windows hosts", () => {
    const resolved = resolveLocalBinaryCommand("oxlint");
    expect(resolved).toBeTruthy();

    const invocation = resolveCommandInvocation("oxlint", ["--no-ignore", "scripts/validate.mjs"], {
      platform: "linux",
    });

    expect(invocation.command).toBe(path.join(path.dirname(resolved ?? ""), "oxlint"));
    expect(invocation.args).toEqual(["--no-ignore", "scripts/validate.mjs"]);
    expect(invocation.display).toEqual(["oxlint", "--no-ignore", "scripts/validate.mjs"]);
  });

  it("wraps local Windows shims through cmd.exe", () => {
    const invocation = resolveCommandInvocation("oxfmt", ["--check", "package.json"], {
      platform: "win32",
    });

    expect(invocation.command).toBe("cmd.exe");
    expect(invocation.args[0]).toBe("/d");
    expect(invocation.args[1]).toBe("/s");
    expect(invocation.args[2]).toBe("/c");
    expect(invocation.args[3]).toContain(path.join("node_modules", ".bin", "oxfmt.cmd"));
    expect(invocation.args.slice(4)).toEqual(["--check", "package.json"]);
    expect(invocation.display).toEqual(["oxfmt", "--check", "package.json"]);
  });

  it("keeps pnpm and node wrapped on Windows", () => {
    const pnpmInvocation = resolveCommandInvocation("pnpm", ["validate:fast"], {
      platform: "win32",
    });
    const nodeInvocation = resolveCommandInvocation("node", ["scripts/validate.mjs"], {
      platform: "win32",
    });

    expect(pnpmInvocation).toEqual({
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "pnpm", "validate:fast"],
      display: ["pnpm", "validate:fast"],
    });
    expect(nodeInvocation).toEqual({
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "node", "scripts/validate.mjs"],
      display: ["node", "scripts/validate.mjs"],
    });
  });
});
