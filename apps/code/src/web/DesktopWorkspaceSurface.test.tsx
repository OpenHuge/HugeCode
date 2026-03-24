import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearWorkspaceRouteRestoreSelection } from "../features/workspaces/hooks/workspaceRoute";
import DesktopWorkspaceSurface from "./DesktopWorkspaceSurface";

const { mainAppMock, sharedShellMock, lazyDesktopMainAppControl } = vi.hoisted(() => {
  let shouldSuspend = false;
  let resolveRender: (() => void) | null = null;
  let renderPromise: Promise<void> | null = null;

  const getRenderPromise = () => {
    if (renderPromise !== null) {
      return renderPromise;
    }
    renderPromise = new Promise<void>((resolve) => {
      resolveRender = () => {
        shouldSuspend = false;
        renderPromise = null;
        resolveRender = null;
        resolve();
      };
    });
    return renderPromise;
  };

  return {
    mainAppMock: vi.fn(() => {
      if (shouldSuspend) {
        throw getRenderPromise();
      }
      return <div data-testid="desktop-main-app">Main app</div>;
    }),
    sharedShellMock: vi.fn(() => <div data-testid="desktop-shared-shell">Shared shell</div>),
    lazyDesktopMainAppControl: {
      suspend() {
        shouldSuspend = true;
      },
      resolve() {
        resolveRender?.();
      },
      reset() {
        shouldSuspend = false;
        renderPromise = null;
        resolveRender = null;
      },
    },
  };
});

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
    lazyDesktopMainAppControl.reset();
    clearWorkspaceRouteRestoreSelection();
    window.history.pushState({}, "", "/");
  });

  it("renders the main desktop app on the workspace home route", async () => {
    window.history.pushState({}, "", "/workspaces");

    render(<DesktopWorkspaceSurface />);

    expect(await screen.findByTestId("desktop-main-app")).toBeTruthy();
  });

  it("renders the main desktop app on the desktop mission home route", async () => {
    window.history.pushState({}, "", "/missions");

    render(<DesktopWorkspaceSurface />);

    expect(await screen.findByTestId("desktop-main-app")).toBeTruthy();
  });

  it("renders the main desktop app when a workspace route is selected", async () => {
    window.history.pushState({}, "", "/workspaces/ws-1");

    render(<DesktopWorkspaceSurface />);

    expect(await screen.findByTestId("desktop-main-app")).toBeTruthy();
  });

  it("uses the boot fallback instead of the shared shell while the desktop main app is loading", () => {
    window.history.pushState({}, "", "/workspaces");
    lazyDesktopMainAppControl.suspend();

    render(<DesktopWorkspaceSurface />);

    expect(screen.getByText("Launching workspace")).toBeTruthy();
    expect(screen.queryByTestId("desktop-shared-shell")).toBeNull();
  });

  it("keeps shared shell sections on non-home shared routes", () => {
    window.history.pushState({}, "", "/workspaces?section=settings");

    render(<DesktopWorkspaceSurface />);

    expect(screen.getByTestId("desktop-shared-shell")).toBeTruthy();
  });
});
