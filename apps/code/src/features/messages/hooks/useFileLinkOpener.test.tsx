/** @vitest-environment jsdom */

import { renderHook } from "@testing-library/react";
import type { MouseEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFileLinkOpener } from "./useFileLinkOpener";

const isTauriMock = vi.hoisted(() => vi.fn(() => true));
const menuNew = vi.hoisted(() => vi.fn(async ({ items }) => ({ popup: vi.fn(), items })));
const menuItemNew = vi.hoisted(() => vi.fn(async (options) => options));
const predefinedMenuItemNew = vi.hoisted(() => vi.fn(async (options) => options));
const pushErrorToastMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());
const openWorkspaceInMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => isTauriMock(),
}));

vi.mock("@tauri-apps/api/menu", () => ({
  Menu: { new: menuNew },
  MenuItem: { new: menuItemNew },
  PredefinedMenuItem: { new: predefinedMenuItemNew },
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ scaleFactor: () => 1 }),
}));

vi.mock("@tauri-apps/api/dpi", () => ({
  LogicalPosition: class LogicalPosition {
    x: number;
    y: number;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  },
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  revealItemInDir: vi.fn(),
}));

vi.mock("../../../application/runtime/ports/tauriApps", () => ({
  openWorkspaceIn: (...args: unknown[]) => openWorkspaceInMock(...args),
}));

vi.mock("../../../application/runtime/ports/toasts", () => ({
  pushErrorToast: (...args: unknown[]) => pushErrorToastMock(...args),
}));

vi.mock("../../../application/runtime/ports/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

vi.mock("../../shared/sentry", () => ({
  captureSentryException: (...args: unknown[]) => captureExceptionMock(...args),
}));

function createEvent(): MouseEvent {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    clientX: 24,
    clientY: 36,
  } as unknown as MouseEvent;
}

describe("useFileLinkOpener", () => {
  beforeEach(() => {
    menuNew.mockClear();
    menuItemNew.mockClear();
    predefinedMenuItemNew.mockClear();
    openWorkspaceInMock.mockClear();
    pushErrorToastMock.mockClear();
    captureExceptionMock.mockClear();
    isTauriMock.mockReturnValue(true);
  });

  it("handles menu creation failures without throwing", async () => {
    menuNew.mockRejectedValueOnce(new Error("menu unavailable"));
    const { result } = renderHook(() =>
      useFileLinkOpener(
        "/tmp/workspace",
        [
          {
            id: "vscode",
            label: "VS Code",
            kind: "app",
            appName: "Visual Studio Code",
            command: null,
            args: [],
          },
        ],
        "vscode"
      )
    );

    await expect(
      result.current.showFileLinkMenu(createEvent(), "src/file.ts")
    ).resolves.toBeUndefined();

    expect(pushErrorToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn’t open file",
      })
    );
    expect(captureExceptionMock).toHaveBeenCalled();
  });

  it("opens files through the runtime bridge on the web surface", async () => {
    isTauriMock.mockReturnValue(false);

    const { result } = renderHook(() =>
      useFileLinkOpener(
        "/tmp/workspace",
        [
          {
            id: "vscode",
            label: "VS Code",
            kind: "command",
            command: "code",
            args: ["--reuse-window"],
          },
        ],
        "vscode"
      )
    );

    await expect(result.current.openFileLink("src/file.ts")).resolves.toBeUndefined();

    expect(openWorkspaceInMock).toHaveBeenCalledWith("/tmp/workspace/src/file.ts", {
      command: "code",
      args: ["--reuse-window"],
    });
    expect(pushErrorToastMock).not.toHaveBeenCalled();
  });
});
