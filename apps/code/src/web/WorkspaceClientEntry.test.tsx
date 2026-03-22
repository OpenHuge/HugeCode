import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceClientEntry } from "./WorkspaceClientEntry";

const { workspaceClientBootMock, createDesktopWorkspaceClientBindingsMock } = vi.hoisted(() => ({
  workspaceClientBootMock: vi.fn(({ bindings }: { bindings: unknown }) => (
    <div data-testid="workspace-client-boot" data-has-bindings={String(Boolean(bindings))} />
  )),
  createDesktopWorkspaceClientBindingsMock: vi.fn(() => ({
    runtimeGateway: {},
    runtime: {},
    host: {},
    platformUi: {},
  })),
}));

vi.mock("@ku0/code-workspace-client/workspace", () => ({
  WorkspaceClientBoot: workspaceClientBootMock,
}));

vi.mock("./createDesktopWorkspaceClientBindings", () => ({
  createDesktopWorkspaceClientBindings: createDesktopWorkspaceClientBindingsMock,
}));

describe("WorkspaceClientEntry", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the shared workspace client boot with the desktop host bindings", () => {
    render(<WorkspaceClientEntry />);

    expect(createDesktopWorkspaceClientBindingsMock).toHaveBeenCalledTimes(1);
    expect(workspaceClientBootMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("workspace-client-boot")).toBeTruthy();
    expect(screen.getByTestId("workspace-client-boot").dataset.hasBindings).toBe("true");
  });
});
