// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

describe("WorkspaceClientApp module", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@ku0/code-workspace-client");
    vi.doUnmock("@ku0/code-workspace-client/workspace");
  });

  it("avoids loading the full workspace-client barrel for the boot wrapper", async () => {
    let workspaceClientBarrelLoads = 0;

    vi.doMock("@ku0/code-workspace-client", () => {
      workspaceClientBarrelLoads += 1;
      return {};
    });

    vi.doMock("@ku0/code-workspace-client/workspace", () => ({
      WorkspaceClientBoot: function MockWorkspaceClientBoot() {
        return null;
      },
    }));

    await import("./WorkspaceClientApp");

    expect(workspaceClientBarrelLoads).toBe(0);
  }, 20_000);
});
