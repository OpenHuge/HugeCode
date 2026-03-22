import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearWorkspaceRouteRestoreSelection } from "../features/workspaces/hooks/workspaceRoute";
import DesktopWorkspaceSurface from "./DesktopWorkspaceSurface";

const { mainAppMock, sharedShellMock } = vi.hoisted(() => ({
  mainAppMock: vi.fn(() => <div data-testid="desktop-main-app">Main app</div>),
  sharedShellMock: vi.fn(() => <div data-testid="desktop-shared-shell">Shared shell</div>),
}));

vi.mock("../MainAppContainerCore", () => ({
  default: mainAppMock,
}));

vi.mock("@ku0/code-workspace-client/workspace-shell", async () => {
  const actual = await vi.importActual<typeof import("@ku0/code-workspace-client/workspace-shell")>(
    "@ku0/code-workspace-client/workspace-shell"
  );
  return {
    ...actual,
    WorkspaceShellApp: sharedShellMock,
  };
});

describe("DesktopWorkspaceSurface", () => {
  afterEach(() => {
    cleanup();
    clearWorkspaceRouteRestoreSelection();
    window.history.pushState({}, "", "/");
  });

  it("renders the shared shell on the workspace home route", () => {
    window.history.pushState({}, "", "/workspaces");

    render(<DesktopWorkspaceSurface />);

    expect(screen.getByTestId("desktop-shared-shell")).toBeTruthy();
  });

  it("renders the main desktop app when a workspace route is selected", async () => {
    window.history.pushState({}, "", "/workspaces/ws-1");

    render(<DesktopWorkspaceSurface />);

    expect(await screen.findByTestId("desktop-main-app")).toBeTruthy();
  });
});
