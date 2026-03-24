import { beforeEach, describe, expect, it } from "vitest";
import {
  ensureDesktopBrowserWorkspaceSession,
  getDesktopBrowserWorkspaceSession,
  listDesktopBrowserWorkspaceSessions,
  setDesktopBrowserWorkspaceAgentAttached,
  setDesktopBrowserWorkspaceDevtoolsOpen,
  setDesktopBrowserWorkspaceHost,
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
      },
    };

    await expect(getDesktopBrowserWorkspaceSession()).resolves.toBeNull();
    await expect(listDesktopBrowserWorkspaceSessions()).resolves.toEqual([]);
    await expect(
      setDesktopBrowserWorkspaceHost({ sessionId: "ws-1", host: "window" })
    ).resolves.toBeNull();
  });
});
