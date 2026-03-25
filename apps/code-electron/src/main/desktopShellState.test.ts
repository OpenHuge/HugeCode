import { describe, expect, it } from "vitest";
import {
  createDesktopShellState,
  resolveCloseBehavior,
  resolveSessionDescriptor,
  type DesktopPersistedState,
  type OpenDesktopSessionInput,
} from "./desktopShellState";

describe("desktopShellState", () => {
  it("restores persisted sessions and tray state", () => {
    const persistedState: DesktopPersistedState = {
      trayEnabled: true,
      sessions: [
        {
          id: "session-a",
          windowLabel: "main",
          workspacePath: "/workspace/alpha",
          workspaceLabel: "alpha",
          preferredBackendId: "backend-a",
          runtimeMode: "remote",
          lastActiveAt: "2026-03-23T02:00:00.000Z",
          windowBounds: {
            width: 1500,
            height: 900,
            x: 40,
            y: 80,
          },
        },
      ],
    };

    const state = createDesktopShellState({
      persistedState,
      now: () => "2026-03-23T03:00:00.000Z",
    });

    expect(state.trayEnabled).toBe(true);
    expect(state.recentSessions).toHaveLength(1);
    expect(state.recentSessions[0]).toMatchObject({
      id: "session-a",
      workspacePath: "/workspace/alpha",
      windowLabel: "main",
      preferredBackendId: "backend-a",
      runtimeMode: "remote",
    });
  });

  it("dedupes restored sessions by session id and workspace fingerprint", () => {
    const state = createDesktopShellState({
      persistedState: {
        trayEnabled: false,
        sessions: [
          {
            id: "session-a",
            windowLabel: "main",
            workspacePath: "/workspace/alpha",
            workspaceLabel: "alpha",
            preferredBackendId: null,
            runtimeMode: "local",
            lastActiveAt: "2026-03-23T02:00:00.000Z",
          },
          {
            id: "session-a",
            windowLabel: "main",
            workspacePath: "/workspace/other",
            workspaceLabel: "other",
            preferredBackendId: null,
            runtimeMode: "local",
            lastActiveAt: "2026-03-23T01:00:00.000Z",
          },
          {
            id: "session-b",
            windowLabel: "main",
            workspacePath: "/workspace/alpha",
            workspaceLabel: "alpha duplicate",
            preferredBackendId: "backend-b",
            runtimeMode: "remote",
            lastActiveAt: "2026-03-23T00:00:00.000Z",
          },
          {
            id: "session-c",
            windowLabel: "about",
            workspacePath: null,
            workspaceLabel: null,
            preferredBackendId: null,
            runtimeMode: "local",
            lastActiveAt: "2026-03-22T23:00:00.000Z",
          },
        ],
      },
      now: () => "2026-03-23T03:00:00.000Z",
    });

    expect(state.recentSessions).toEqual([
      expect.objectContaining({
        id: "session-a",
        workspacePath: "/workspace/alpha",
      }),
      expect.objectContaining({
        id: "session-c",
        windowLabel: "about",
      }),
    ]);
  });

  it("reuses an existing workspace session unless a duplicate is requested", () => {
    const state = createDesktopShellState({
      persistedState: {
        trayEnabled: false,
        sessions: [
          {
            id: "session-a",
            windowLabel: "main",
            workspacePath: "/workspace/alpha",
            workspaceLabel: "alpha",
            preferredBackendId: null,
            runtimeMode: "local",
            lastActiveAt: "2026-03-23T02:00:00.000Z",
          },
        ],
      },
      now: () => "2026-03-23T03:00:00.000Z",
    });

    const reusedSession = resolveSessionDescriptor(state, {
      workspacePath: "/workspace/alpha",
      workspaceLabel: "alpha",
    });
    const duplicateSession = resolveSessionDescriptor(state, {
      workspacePath: "/workspace/alpha",
      workspaceLabel: "alpha",
      duplicate: true,
    });

    expect(reusedSession.id).toBe("session-a");
    expect(duplicateSession.id).not.toBe("session-a");
    expect(duplicateSession.workspacePath).toBe("/workspace/alpha");
  });

  it("tracks active windows and keeps recent sessions ordered by most recent use", () => {
    const nowValues = [
      "2026-03-23T03:00:00.000Z",
      "2026-03-23T03:01:00.000Z",
      "2026-03-23T03:02:00.000Z",
    ];
    const state = createDesktopShellState({
      persistedState: { trayEnabled: false, sessions: [] },
      now: () => nowValues.shift() ?? "2026-03-23T03:03:00.000Z",
    });

    const alpha = resolveSessionDescriptor(state, {
      workspacePath: "/workspace/alpha",
      workspaceLabel: "alpha",
    });
    state.attachWindow(alpha, 101);
    const beta = resolveSessionDescriptor(state, {
      workspacePath: "/workspace/beta",
      workspaceLabel: "beta",
    });
    state.attachWindow(beta, 202);
    state.detachWindow(101, {
      width: 1280,
      height: 840,
      x: 20,
      y: 20,
    });

    expect(state.listWindows()).toEqual([
      expect.objectContaining({
        windowId: 202,
        sessionId: beta.id,
        workspaceLabel: "beta",
      }),
    ]);
    expect(state.recentSessions.map((session) => session.workspaceLabel)).toEqual([
      "alpha",
      "beta",
    ]);
    expect(state.toPersistedState().sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: alpha.id,
          windowBounds: {
            width: 1280,
            height: 840,
            x: 20,
            y: 20,
          },
        }),
      ])
    );
  });

  it("hides the last window to tray only when tray mode is enabled", () => {
    const state = createDesktopShellState({
      persistedState: { trayEnabled: false, sessions: [] },
      now: () => "2026-03-23T03:00:00.000Z",
    });
    const session = resolveSessionDescriptor(state, {} satisfies OpenDesktopSessionInput);
    state.attachWindow(session, 100);

    expect(resolveCloseBehavior(state, 100)).toBe("close");

    state.setTrayEnabled(true);

    expect(resolveCloseBehavior(state, 100)).toBe("hide");
  });
});
