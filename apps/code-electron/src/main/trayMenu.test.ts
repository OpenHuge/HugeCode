import { describe, expect, it, vi } from "vitest";
import { buildTrayMenuTemplate, getTrayMenuStateSignature } from "./trayMenu";

describe("trayMenu", () => {
  it("builds a tray menu with active windows, recent sessions, and quit actions", () => {
    const handlers = {
      onNewWindow: vi.fn(),
      onFocusWindow: vi.fn(),
      onReopenSession: vi.fn(),
      onToggleTray: vi.fn(),
      onQuit: vi.fn(),
    };

    const template = buildTrayMenuTemplate(
      {
        trayEnabled: true,
        windows: [
          {
            windowId: 7,
            sessionId: "session-active",
            workspaceLabel: "alpha",
            windowLabel: "main",
            focused: true,
          },
        ],
        recentSessions: [
          {
            id: "session-recent",
            windowLabel: "main",
            workspacePath: "/workspace/recent",
            workspaceLabel: "recent",
            preferredBackendId: null,
            runtimeMode: "local",
            lastActiveAt: "2026-03-23T03:00:00.000Z",
          },
        ],
      },
      handlers
    );

    expect(template.map((item) => ("label" in item ? item.label : null))).toContain("New Window");
    expect(template.map((item) => ("label" in item ? item.label : null))).toContain(
      "Current Windows"
    );
    expect(template.map((item) => ("label" in item ? item.label : null))).toContain(
      "Recent Sessions"
    );
    expect(template.map((item) => ("label" in item ? item.label : null))).toContain(
      "Keep HugeCode in Tray"
    );
    expect(template.map((item) => ("label" in item ? item.label : null))).toContain(
      "Quit HugeCode"
    );
  });

  it("ignores focused and hidden window flags when hashing tray menu contents", () => {
    const baseState = {
      trayEnabled: true,
      windows: [
        {
          windowId: 7,
          sessionId: "session-active",
          workspaceLabel: "alpha",
          windowLabel: "main" as const,
          focused: true,
        },
      ],
      recentSessions: [
        {
          id: "session-recent",
          windowLabel: "main" as const,
          workspacePath: "/workspace/recent",
          workspaceLabel: "recent",
          preferredBackendId: null,
          runtimeMode: "local" as const,
          lastActiveAt: "2026-03-23T03:00:00.000Z",
        },
      ],
    };

    const baseSignature = getTrayMenuStateSignature(baseState);
    const focusOnlySignature = getTrayMenuStateSignature({
      ...baseState,
      windows: [
        {
          ...baseState.windows[0],
          focused: false,
          hidden: true,
        },
      ],
    });

    expect(focusOnlySignature).toBe(baseSignature);
  });
});
