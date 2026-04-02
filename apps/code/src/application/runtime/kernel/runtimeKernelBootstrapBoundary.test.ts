import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const KERNEL_DIR = dirname(fileURLToPath(import.meta.url));

const EAGER_RUNTIME_KERNEL_ENTRYPOINTS = [
  resolve(KERNEL_DIR, "createRuntimeKernel.ts"),
  resolve(KERNEL_DIR, "RuntimeKernelContext.tsx"),
  resolve(KERNEL_DIR, "sharedRuntimeKernel.ts"),
] as const;

const FORBIDDEN_IMPORT_PATTERNS = [
  /application\/runtime\/facades\/runtimeKernelControlPlane/i,
  /application\/runtime\/facades\/runtimeKernelPluginProjection/i,
  /application\/runtime\/facades\/runtimeKernelPluginCatalogFacadeHooks/i,
  /application\/runtime\/facades\/runtimeWorkspaceMissionControlProjection/i,
] as const;

function readEntrypointSource(path: string) {
  return readFileSync(path, "utf8");
}

describe("runtime kernel bootstrap boundary", () => {
  it("keeps control-plane hooks and projection builders out of eager kernel entrypoints", () => {
    for (const entrypoint of EAGER_RUNTIME_KERNEL_ENTRYPOINTS) {
      const source = readEntrypointSource(entrypoint);
      for (const forbiddenImport of FORBIDDEN_IMPORT_PATTERNS) {
        expect(source).not.toMatch(forbiddenImport);
      }
    }
  });
});
