import { describe, expect, it } from "vitest";
import {
  CODE_RUNTIME_RPC_METHOD_LIST,
  computeCodeRuntimeRpcMethodSetHash,
} from "../../packages/code-runtime-host-contract/src/codeRuntimeRpc.ts";

import {
  findDefaultWorkspacePath,
  loadLocalRuntimeContractFingerprint,
  normalizeWorkspacePathForReuse,
  parseRuntimeReadyTimeout,
  resolveDefaultRuntimeReadyTimeout,
  resolveCodeAppViteEntryPath,
  runtimeDefaultWorkspaceMatchesExpected,
} from "../../scripts/dev-code-runtime-gateway-web-all.mjs";

describe("dev-code-runtime-gateway-web-all", () => {
  it("normalizes Windows workspace paths before reuse comparison", () => {
    expect(normalizeWorkspacePathForReuse("\\\\?\\C:\\Dev\\Y\\Y-keep-up\\")).toBe(
      normalizeWorkspacePathForReuse("C:/Dev/Y/Y-keep-up")
    );
  });

  it("finds the default web workspace path from the workspace list", () => {
    expect(
      findDefaultWorkspacePath([
        {
          id: "workspace-demo",
          displayName: "Demo",
          path: "C:\\Dev\\demo",
        },
        {
          id: "workspace-web",
          displayName: "Web Workspace",
          path: "C:\\Dev\\Y\\Y-keep-up",
        },
      ])
    ).toBe("C:\\Dev\\Y\\Y-keep-up");
  });

  it("rejects runtime reuse when the default workspace points at a different repo", () => {
    const workspaces = [
      {
        id: "workspace-web",
        displayName: "Web Workspace",
        path: "C:\\Dev\\keep-up",
      },
    ];

    expect(runtimeDefaultWorkspaceMatchesExpected(workspaces, "C:\\Dev\\Y\\Y-keep-up")).toBe(false);
    expect(runtimeDefaultWorkspaceMatchesExpected(workspaces, "C:\\Dev\\keep-up")).toBe(true);
  });

  it("launches the code UI from the workspace-local vite entry", () => {
    const viteEntryPath = normalizeWorkspacePathForReuse(resolveCodeAppViteEntryPath());

    expect(viteEntryPath).toContain("/apps/code/node_modules/vite/bin/vite.js");
    expect(viteEntryPath).not.toContain("/node_modules/.bin/vite");
  });

  it("defaults runtime readiness timeout high enough for cold Rust builds", () => {
    expect(resolveDefaultRuntimeReadyTimeout({})).toBe(480_000);
    expect(resolveDefaultRuntimeReadyTimeout({ CI: "true" })).toBe(900_000);
    expect(parseRuntimeReadyTimeout(undefined, {})).toBe(480_000);
    expect(parseRuntimeReadyTimeout(undefined, { CI: "true" })).toBe(900_000);
    expect(parseRuntimeReadyTimeout("9", {})).toBe(480_000);
    expect(parseRuntimeReadyTimeout("9", { CI: "true" })).toBe(900_000);
  });

  it("preserves explicit runtime readiness timeout overrides", () => {
    expect(parseRuntimeReadyTimeout("540000")).toBe(540_000);
  });

  it("derives runtime reuse fingerprint from the canonical frozen contract", async () => {
    const fingerprint = await loadLocalRuntimeContractFingerprint();

    expect(fingerprint).not.toBeNull();
    expect(fingerprint?.methodSetHash).toBe(
      computeCodeRuntimeRpcMethodSetHash(CODE_RUNTIME_RPC_METHOD_LIST)
    );
  });
});
