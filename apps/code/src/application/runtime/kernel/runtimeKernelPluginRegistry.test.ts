import { describe, expect, it, vi } from "vitest";
import { createRuntimeKernelPluginRegistryFacade } from "./runtimeKernelPluginRegistry";

describe("runtimeKernelPluginRegistry", () => {
  function createRegistry() {
    const pluginCatalog = {
      listPlugins: vi.fn(async () => []),
    };
    return createRuntimeKernelPluginRegistryFacade({
      workspaceId: "workspace-1",
      pluginCatalog,
    });
  }

  it("installs a signed external package", async () => {
    const registry = createRegistry();

    const result = await registry.installPackage({
      packageRef: "hugecode.mcp.search@1.0.0",
    });

    expect(result.installed).toBe(true);
    expect(result.blockedReason).toBeNull();
    expect(result.package.trust.status).toBe("verified");
    await expect(registry.listInstalledPackages()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packageRef: "hugecode.mcp.search@1.0.0",
          installed: true,
          source: "installed",
        }),
      ])
    );
  });

  it("blocks unsigned remote packages by default", async () => {
    const registry = createRegistry();

    const result = await registry.installPackage({
      packageRef: "hugecode.mcp.unsigned-lab@0.3.0",
    });

    expect(result.installed).toBe(false);
    expect(result.blockedReason).toMatch(/Unsigned remote packages are blocked by default/);
    expect(result.package.trust.status).toBe("blocked");
  });

  it("blocks incompatible packages", async () => {
    const registry = createRegistry();

    const result = await registry.installPackage({
      packageRef: "hugecode.wasi.future-host@2.0.0",
    });

    expect(result.installed).toBe(false);
    expect(result.package.compatibility.status).toBe("incompatible");
    expect(result.blockedReason).toMatch(/newer host contract version/i);
  });

  it("blocks dependency activation when required packages are missing", async () => {
    const registry = createRegistry();

    const result = await registry.installPackage({
      packageRef: "hugecode.a2a.planner@1.1.0",
    });

    expect(result.installed).toBe(false);
    expect(result.package.compatibility.status).toBe("incompatible");
    expect(result.blockedReason).toMatch(/Missing dependency hugecode\.mcp\.search@1\.0\.0/);
  });
});
