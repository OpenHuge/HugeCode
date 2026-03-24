// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listDesktopBrowserWorkspaceSessions: vi.fn(),
  ensureDesktopBrowserWorkspaceSession: vi.fn(),
  setDesktopBrowserWorkspaceHost: vi.fn(),
  setDesktopBrowserWorkspaceProfileMode: vi.fn(),
  setDesktopBrowserWorkspaceAgentAttached: vi.fn(),
  setDesktopBrowserWorkspaceDevtoolsOpen: vi.fn(),
  navigateDesktopBrowserWorkspaceSession: vi.fn(),
  setDesktopBrowserWorkspacePaneState: vi.fn(),
  reportDesktopBrowserWorkspaceVerification: vi.fn(),
  setDesktopBrowserWorkspacePreviewServerStatus: vi.fn(),
  readWorkspaceFile: vi.fn(),
  bootManagedPreview: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/desktopBrowserWorkspace", () => ({
  listDesktopBrowserWorkspaceSessions: mocks.listDesktopBrowserWorkspaceSessions,
  ensureDesktopBrowserWorkspaceSession: mocks.ensureDesktopBrowserWorkspaceSession,
  setDesktopBrowserWorkspaceHost: mocks.setDesktopBrowserWorkspaceHost,
  setDesktopBrowserWorkspaceProfileMode: mocks.setDesktopBrowserWorkspaceProfileMode,
  setDesktopBrowserWorkspaceAgentAttached: mocks.setDesktopBrowserWorkspaceAgentAttached,
  setDesktopBrowserWorkspaceDevtoolsOpen: mocks.setDesktopBrowserWorkspaceDevtoolsOpen,
  navigateDesktopBrowserWorkspaceSession: mocks.navigateDesktopBrowserWorkspaceSession,
  setDesktopBrowserWorkspacePaneState: mocks.setDesktopBrowserWorkspacePaneState,
  reportDesktopBrowserWorkspaceVerification: mocks.reportDesktopBrowserWorkspaceVerification,
  setDesktopBrowserWorkspacePreviewServerStatus:
    mocks.setDesktopBrowserWorkspacePreviewServerStatus,
}));

vi.mock("../../../application/runtime/ports/tauriWorkspaceFiles", () => ({
  readWorkspaceFile: mocks.readWorkspaceFile,
}));

vi.mock("../../../application/runtime/ports/tauriRuntimeTerminal", () => ({
  openRuntimeTerminalSession: vi.fn(),
  readRuntimeTerminalSession: vi.fn(),
  writeRuntimeTerminalSession: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/desktopShell", () => ({
  openDesktopExternalUrl: vi.fn(async () => true),
}));

vi.mock("../../../application/runtime/facades/runtimeBrowserWorkspacePreview", async () => {
  const actual = await vi.importActual<
    typeof import("../../../application/runtime/facades/runtimeBrowserWorkspacePreview")
  >("../../../application/runtime/facades/runtimeBrowserWorkspacePreview");
  return {
    ...actual,
    bootManagedPreview: mocks.bootManagedPreview,
  };
});

import { WorkspaceHomeBrowserWorkspacePanel } from "./WorkspaceHomeBrowserWorkspacePanel";

describe("WorkspaceHomeBrowserWorkspacePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listDesktopBrowserWorkspaceSessions.mockResolvedValue([
      {
        sessionId: "workspace-1:preview",
        kind: "preview",
        host: "pane",
        browserUrl: "http://127.0.0.1:9333",
        currentUrl: "http://127.0.0.1:5173/",
        targetUrl: "http://127.0.0.1:5173/",
        workspaceId: "workspace-1",
        windowId: null,
        partitionId: "persist:hugecode-browser-workspace:workspace-1:preview",
        profileMode: "isolated",
        canAgentAttach: true,
        agentAttached: false,
        devtoolsOpen: false,
        previewServerStatus: "ready",
        pageTitle: "Workspace Preview",
        canGoBack: true,
        canGoForward: false,
        paneWindowId: 1,
        paneVisible: true,
        loadingState: "ready",
        lastError: null,
        crashCount: 0,
        consoleTail: [],
        lastVerifiedTarget: "http://127.0.0.1:5173/",
        lastVerifiedAt: "2026-03-25T00:00:00.000Z",
      },
    ]);
    mocks.setDesktopBrowserWorkspacePaneState.mockResolvedValue(null);
    mocks.navigateDesktopBrowserWorkspaceSession.mockResolvedValue(null);
    mocks.reportDesktopBrowserWorkspaceVerification.mockResolvedValue(null);
    mocks.readWorkspaceFile.mockResolvedValue({
      content: JSON.stringify({
        packageManager: "pnpm@10.0.0",
        scripts: { dev: "vite" },
      }),
    });
    mocks.bootManagedPreview.mockResolvedValue({
      candidate: null,
      error: null,
      previewUrl: "http://127.0.0.1:5173/",
      session: { sessionId: "workspace-1:preview" },
      status: "ready",
      terminalSessionId: "terminal-1",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders current preview workspace state and native pane telemetry", async () => {
    render(<WorkspaceHomeBrowserWorkspacePanel workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText("Browser workspace")).toBeTruthy();
    });

    expect(screen.getByText("Current URL")).toBeTruthy();
    expect(screen.getByText("Workspace Preview")).toBeTruthy();
    expect(screen.getByText("Native preview pane")).toBeTruthy();
    await waitFor(() => {
      expect(mocks.setDesktopBrowserWorkspacePaneState).toHaveBeenCalled();
    });
    expect(screen.getByText("Session policy")).toBeTruthy();
  });

  it("exposes browser navigation actions for the active session", async () => {
    render(<WorkspaceHomeBrowserWorkspacePanel workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getByText("Reload")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Back"));
    await waitFor(() => {
      expect(mocks.navigateDesktopBrowserWorkspaceSession).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByText("Reload"));

    await waitFor(() => {
      expect(mocks.navigateDesktopBrowserWorkspaceSession).toHaveBeenCalledTimes(2);
    });
    expect(mocks.navigateDesktopBrowserWorkspaceSession.mock.calls[0]?.[0]).toMatchObject({
      sessionId: "workspace-1:preview",
      action: "back",
    });
    expect(mocks.navigateDesktopBrowserWorkspaceSession.mock.calls[1]?.[0]).toMatchObject({
      sessionId: "workspace-1:preview",
      action: "reload",
    });
  });

  it("boots managed preview from a detected script", async () => {
    render(<WorkspaceHomeBrowserWorkspacePanel workspaceId="workspace-1" />);

    await waitFor(() => {
      expect(screen.getAllByText("Start managed preview").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText("Start managed preview")[0]!);

    await waitFor(() => {
      expect(mocks.bootManagedPreview).toHaveBeenCalledTimes(1);
    });
    expect(mocks.bootManagedPreview.mock.calls[0]?.[0]).toMatchObject({
      workspaceId: "workspace-1",
      candidate: expect.objectContaining({
        id: "script:dev",
        command: "pnpm dev",
      }),
    });
  });
});
