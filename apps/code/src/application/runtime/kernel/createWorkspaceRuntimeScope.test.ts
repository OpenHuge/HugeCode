import { describe, expect, it, vi } from "vitest";
import { createWorkspaceRuntimeScope } from "./createWorkspaceRuntimeScope";
import { createRuntimeAgentControlFacade } from "../facades/runtimeAgentControlFacade";
import { createRuntimeSessionCommandFacade } from "../facades/runtimeSessionCommandFacade";

vi.mock("../facades/runtimeAgentControlFacade", () => ({
  createRuntimeAgentControlFacade: vi.fn(),
}));

vi.mock("../facades/runtimeSessionCommandFacade", () => ({
  createRuntimeSessionCommandFacade: vi.fn(),
}));

describe("createWorkspaceRuntimeScope", () => {
  it("assembles workspace-scoped agent control and session commands", () => {
    const runtimeGateway = { detectMode: vi.fn() };
    const runtimeAgentControl = { listTasks: vi.fn() };
    const runtimeSessionCommands = { sendMessage: vi.fn() };

    vi.mocked(createRuntimeAgentControlFacade).mockReturnValue(
      runtimeAgentControl as unknown as ReturnType<typeof createRuntimeAgentControlFacade>
    );
    vi.mocked(createRuntimeSessionCommandFacade).mockReturnValue(
      runtimeSessionCommands as unknown as ReturnType<typeof createRuntimeSessionCommandFacade>
    );

    const scope = createWorkspaceRuntimeScope({
      workspaceId: "ws-1",
      runtimeGateway: runtimeGateway as never,
      runtimeAgentControlDependencies: {} as never,
    });

    expect(createRuntimeAgentControlFacade).toHaveBeenCalledWith("ws-1", {});
    expect(createRuntimeSessionCommandFacade).toHaveBeenCalledWith("ws-1");
    expect(scope).toMatchObject({
      workspaceId: "ws-1",
      runtimeGateway,
      runtimeAgentControl,
      runtimeSessionCommands,
    });
  });
});
