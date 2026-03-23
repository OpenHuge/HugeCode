import { describe, expect, it, vi } from "vitest";
import { createDesktopStateStore } from "./desktopStateStore.js";

describe("desktopStateStore", () => {
  it("returns an empty persisted state when no state file exists", () => {
    const store = createDesktopStateStore({
      statePath: "/var/lib/hugecode/desktop-state.json",
      dependencies: {
        existsSync: vi.fn(() => false),
      },
    });

    expect(store.read()).toEqual({
      trayEnabled: false,
      sessions: [],
    });
  });

  it("sanitizes malformed state file contents", () => {
    const store = createDesktopStateStore({
      statePath: "/var/lib/hugecode/desktop-state.json",
      dependencies: {
        existsSync: vi.fn(() => true),
        readFileSync: vi.fn(() => '{"trayEnabled":"yes","sessions":"bad"}'),
      },
    });

    expect(store.read()).toEqual({
      trayEnabled: false,
      sessions: [],
    });
  });

  it("creates the parent directory and writes formatted JSON", () => {
    const mkdirSyncMock = vi.fn();
    const writeFileSyncMock = vi.fn();
    const store = createDesktopStateStore({
      statePath: "/var/lib/hugecode/state/desktop-state.json",
      dependencies: {
        mkdirSync: mkdirSyncMock,
        writeFileSync: writeFileSyncMock,
      },
    });

    store.write({
      trayEnabled: true,
      sessions: [],
    });

    expect(mkdirSyncMock).toHaveBeenCalledWith("/var/lib/hugecode/state", {
      mode: 0o700,
      recursive: true,
    });
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      "/var/lib/hugecode/state/desktop-state.json",
      '{\n  "trayEnabled": true,\n  "sessions": []\n}',
      { mode: 0o600 }
    );
  });

  it("rejects temporary-directory state paths unless explicitly allowed", () => {
    const store = createDesktopStateStore({
      statePath: "/tmp/desktop-state.json",
      dependencies: {
        tmpdir: vi.fn(() => "/tmp"),
      },
    });

    expect(() =>
      store.write({
        trayEnabled: true,
        sessions: [],
      })
    ).toThrowError("Desktop state must not be stored in the system temporary directory.");
  });

  it("allows temporary-directory state paths when explicitly enabled", () => {
    const writeFileSyncMock = vi.fn();
    const store = createDesktopStateStore({
      allowTemporaryStatePath: true,
      statePath: "/tmp/desktop-state.json",
      dependencies: {
        mkdirSync: vi.fn(),
        tmpdir: vi.fn(() => "/tmp"),
        writeFileSync: writeFileSyncMock,
      },
    });

    store.write({
      trayEnabled: true,
      sessions: [],
    });

    expect(writeFileSyncMock).toHaveBeenCalledWith(
      "/tmp/desktop-state.json",
      '{\n  "trayEnabled": true,\n  "sessions": []\n}',
      { mode: 0o600 }
    );
  });
});
