import { describe, expect, it, vi } from "vitest";
import { createDesktopStateStore } from "./desktopStateStore.js";

describe("desktopStateStore", () => {
  it("returns an empty persisted state when no state file exists", () => {
    const store = createDesktopStateStore({
      statePath: "/tmp/desktop-state.json",
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
      statePath: "/tmp/desktop-state.json",
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
      statePath: "/tmp/state/desktop-state.json",
      dependencies: {
        mkdirSync: mkdirSyncMock,
        writeFileSync: writeFileSyncMock,
      },
    });

    store.write({
      trayEnabled: true,
      sessions: [],
    });

    expect(mkdirSyncMock).toHaveBeenCalledWith("/tmp/state", { recursive: true });
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      "/tmp/state/desktop-state.json",
      '{\n  "trayEnabled": true,\n  "sessions": []\n}'
    );
  });
});
