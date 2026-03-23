import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceClientEntry } from "./WorkspaceClientEntry";

const {
  createWorkspaceHostRendererMock,
  createDesktopWorkspaceClientHostBindingsMock,
  createRuntimeKernelMock,
  createWorkspaceClientBindingsMock,
  workspaceClientBootMock,
} = vi.hoisted(() => ({
  createWorkspaceHostRendererMock: vi.fn(() => (children: unknown) => children),
  createDesktopWorkspaceClientHostBindingsMock: vi.fn(() => ({
    platform: "desktop",
    intents: {},
    notifications: {},
    shell: {},
  })),
  createRuntimeKernelMock: vi.fn(() => ({
    workspaceClientRuntimeGateway: {},
    workspaceClientRuntime: {
      oauth: {
        getAccountInfo: vi.fn(),
        listAccounts: vi.fn(),
      },
    },
  })),
  createWorkspaceClientBindingsMock: vi.fn(() => ({
    navigation: {},
    runtimeGateway: {},
    runtime: {},
    host: {},
    platformUi: {},
  })),
  workspaceClientBootMock: vi.fn(({ bindings }: { bindings: unknown }) => (
    <div data-testid="workspace-client-boot" data-has-bindings={String(Boolean(bindings))} />
  )),
}));

vi.mock("@ku0/code-workspace-client", () => ({
  WorkspaceClientBoot: workspaceClientBootMock,
  WorkspaceRuntimeShell: () => null,
}));

vi.mock("@ku0/code-application", () => ({
  createWorkspaceHostRenderer: createWorkspaceHostRendererMock,
  createDesktopWorkspaceClientHostBindings: createDesktopWorkspaceClientHostBindingsMock,
  createWorkspaceClientBindings: createWorkspaceClientBindingsMock,
}));

vi.mock("../application/runtime/facades/desktopHostFacade", () => ({
  openUrl: vi.fn(),
  showDesktopNotification: vi.fn(),
}));

vi.mock("../application/runtime/kernel/createRuntimeKernel", () => ({
  createRuntimeKernel: createRuntimeKernelMock,
}));

vi.mock("../features/settings/components/desktopSettingsShellFraming", () => ({
  desktopSettingsShellFraming: { mode: "sidebar" },
}));

vi.mock(
  "../features/settings/components/sections/settings-codex-accounts-card/codexOauthBinding",
  () => ({
    waitForCodexOauthBinding: vi.fn(async () => true),
  })
);

vi.mock("../features/workspaces/hooks/workspaceRoute", () => ({
  desktopWorkspaceNavigation: {
    navigateToSettings: vi.fn(),
    replaceWorkspaceSelection: vi.fn(),
  },
}));

vi.mock("./DesktopWorkspaceSurface", () => ({
  default: () => null,
}));

describe("WorkspaceClientEntry", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the shared workspace client boot with the desktop host bindings", () => {
    render(<WorkspaceClientEntry />);

    expect(createRuntimeKernelMock).toHaveBeenCalledTimes(1);
    expect(createWorkspaceHostRendererMock).toHaveBeenCalledTimes(1);
    expect(createDesktopWorkspaceClientHostBindingsMock).toHaveBeenCalledTimes(1);
    expect(createWorkspaceClientBindingsMock).toHaveBeenCalledTimes(1);
    expect(workspaceClientBootMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("workspace-client-boot")).toBeTruthy();
    expect(screen.getByTestId("workspace-client-boot").dataset.hasBindings).toBe("true");
  });
});
