import { beforeEach, describe, expect, it } from "vitest";
import {
  ensureDesktopBrowserWorkspaceSession,
  getDesktopBrowserWorkspaceSession,
  listDesktopBrowserWorkspaceSessions,
  navigateDesktopBrowserWorkspaceSession,
  reportDesktopBrowserWorkspaceVerification,
  setDesktopBrowserWorkspaceAgentAttached,
  setDesktopBrowserWorkspaceDevtoolsOpen,
  setDesktopBrowserWorkspaceHost,
  setDesktopBrowserWorkspacePaneState,
  setDesktopBrowserWorkspacePreviewServerStatus,
  setDesktopBrowserWorkspaceProfileMode,
} from "./desktopBrowserWorkspace";

describe("desktopBrowserWorkspace", () => {
  beforeEach(() => {
    delete window.hugeCodeDesktopHost;
  });

  it("returns empty values when the desktop browser workspace bridge is unavailable", async () => {
    await expect(getDesktopBrowserWorkspaceSession()).resolves.toBeNull();
    await expect(ensureDesktopBrowserWorkspaceSession()).resolves.toBeNull();
    await expect(listDesktopBrowserWorkspaceSessions()).resolves.toEqual([]);
  });

  it("normalizes valid browser workspace payloads from the Electron bridge", async () => {
    const session = {
      sessionId: " ws-1 ",
      kind: "preview",
      host: "pane",
      browserUrl: " http://127.0.0.1:9333 ",
      currentUrl: " http://127.0.0.1:5173/ ",
      targetUrl: " http://127.0.0.1:5173/ ",
      workspaceId: " workspace-1 ",
      windowId: 41,
      partitionId: " persist:hugecode-browser-workspace:workspace-1:preview ",
      profileMode: "isolated",
      canAgentAttach: true,
      agentAttached: false,
      devtoolsOpen: false,
      previewServerStatus: "ready",
      pageTitle: " Preview ",
      canGoBack: true,
      canGoForward: false,
      paneWindowId: 9,
      paneVisible: true,
      loadingState: "ready",
      lastError: null,
      crashCount: 1,
      consoleTail: ["[1] hello"],
      lastVerifiedTarget: " http://127.0.0.1:5173/ ",
      lastVerifiedAt: " 2026-03-25T00:00:00.000Z ",
    } as const;

    window.hugeCodeDesktopHost = {
      kind: "electron",
      browserWorkspace: {
        getSession: async () => session,
        ensureSession: async () => session,
        listSessions: async () => [session],
        setHost: async () => ({ ...session, host: "window" }),
        setProfileMode: async () => ({ ...session, profileMode: "shared" }),
        setAgentAttached: async () => ({ ...session, agentAttached: true }),
        setPreviewServerStatus: async () => ({ ...session, previewServerStatus: "starting" }),
        setDevtoolsOpen: async () => ({ ...session, devtoolsOpen: true }),
        navigate: async () => ({ ...session, canGoBack: false, canGoForward: true }),
        setPaneState: async () => ({ ...session, paneVisible: false }),
        reportVerification: async () => ({
          ...session,
          lastVerifiedTarget: "http://127.0.0.1:5173/health",
        }),
      },
    };

    await expect(getDesktopBrowserWorkspaceSession()).resolves.toEqual({
      sessionId: "ws-1",
      kind: "preview",
      host: "pane",
      browserUrl: "http://127.0.0.1:9333",
      currentUrl: "http://127.0.0.1:5173/",
      targetUrl: "http://127.0.0.1:5173/",
      workspaceId: "workspace-1",
      windowId: 41,
      partitionId: "persist:hugecode-browser-workspace:workspace-1:preview",
      profileMode: "isolated",
      canAgentAttach: true,
      agentAttached: false,
      devtoolsOpen: false,
      previewServerStatus: "ready",
      pageTitle: "Preview",
      canGoBack: true,
      canGoForward: false,
      paneWindowId: 9,
      paneVisible: true,
      loadingState: "ready",
      lastError: null,
      crashCount: 1,
      consoleTail: ["[1] hello"],
      lastVerifiedTarget: "http://127.0.0.1:5173/",
      lastVerifiedAt: "2026-03-25T00:00:00.000Z",
    });
    await expect(listDesktopBrowserWorkspaceSessions()).resolves.toHaveLength(1);
    await expect(
      setDesktopBrowserWorkspaceHost({ sessionId: "ws-1", host: "window" })
    ).resolves.toMatchObject({ host: "window" });
    await expect(
      setDesktopBrowserWorkspaceProfileMode({ sessionId: "ws-1", profileMode: "shared" })
    ).resolves.toMatchObject({ profileMode: "shared" });
    await expect(
      setDesktopBrowserWorkspaceAgentAttached({ sessionId: "ws-1", attached: true })
    ).resolves.toMatchObject({ agentAttached: true });
    await expect(
      setDesktopBrowserWorkspacePreviewServerStatus({
        sessionId: "ws-1",
        previewServerStatus: "starting",
      })
    ).resolves.toMatchObject({ previewServerStatus: "starting" });
    await expect(
      setDesktopBrowserWorkspaceDevtoolsOpen({ sessionId: "ws-1", open: true })
    ).resolves.toMatchObject({ devtoolsOpen: true });
    await expect(
      navigateDesktopBrowserWorkspaceSession({ sessionId: "ws-1", action: "reload" })
    ).resolves.toMatchObject({ canGoForward: true });
    await expect(
      setDesktopBrowserWorkspacePaneState({ sessionId: "ws-1", visible: false, bounds: null })
    ).resolves.toMatchObject({ paneVisible: false });
    await expect(
      reportDesktopBrowserWorkspaceVerification({
        sessionId: "ws-1",
        targetUrl: "http://127.0.0.1:5173/health",
      })
    ).resolves.toMatchObject({ lastVerifiedTarget: "http://127.0.0.1:5173/health" });
  });

  it("rejects malformed browser workspace payloads", async () => {
    window.hugeCodeDesktopHost = {
      kind: "electron",
      browserWorkspace: {
        getSession: async () => ({
          sessionId: "",
          kind: "invalid",
          host: "pane",
          browserUrl: "",
          partitionId: "",
          previewServerStatus: "unknown",
        }),
        ensureSession: async () => null,
        listSessions: async () => [null, { sessionId: "x", kind: "invalid" }],
        setHost: async () => ({ sessionId: "x", kind: "invalid" }),
        setProfileMode: async () => ({ sessionId: "x", kind: "invalid" }),
        setAgentAttached: async () => ({ sessionId: "x", kind: "invalid" }),
        setPreviewServerStatus: async () => ({ sessionId: "x", kind: "invalid" }),
        setDevtoolsOpen: async () => ({ sessionId: "x", kind: "invalid" }),
        navigate: async () => ({ sessionId: "x", kind: "invalid" }),
        setPaneState: async () => ({ sessionId: "x", kind: "invalid" }),
        reportVerification: async () => ({ sessionId: "x", kind: "invalid" }),
      },
    };

    await expect(getDesktopBrowserWorkspaceSession()).resolves.toBeNull();
    await expect(listDesktopBrowserWorkspaceSessions()).resolves.toEqual([]);
    await expect(
      setDesktopBrowserWorkspaceHost({ sessionId: "ws-1", host: "window" })
    ).resolves.toBeNull();
  });
});
