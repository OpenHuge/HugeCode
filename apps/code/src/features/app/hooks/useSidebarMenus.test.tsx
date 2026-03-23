/** @vitest-environment jsdom */

import { renderHook } from "@testing-library/react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceInfo } from "../../../types";
import { fileManagerName } from "../../../utils/platformPaths";
import { useSidebarMenus } from "./useSidebarMenus";

const isTauriMock = vi.hoisted(() => vi.fn(() => true));
const menuPopup = vi.hoisted(() => vi.fn(async () => undefined));
const menuNew = vi.hoisted(() => vi.fn(async ({ items }) => ({ popup: menuPopup, items })));
const menuItemNew = vi.hoisted(() => vi.fn(async (options) => options));
const clipboardWriteText = vi.hoisted(() => vi.fn(async () => undefined));
const openWebContextMenuMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/menu", () => ({
  Menu: { new: menuNew },
  MenuItem: { new: menuItemNew },
}));

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => isTauriMock(),
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

const revealItemInDir = vi.hoisted(() => vi.fn());
const pushErrorToastMock = vi.hoisted(() => vi.fn());

vi.mock("../../../application/runtime/facades/desktopHostFacade", () => ({
  revealItemInDir: (...args: unknown[]) => revealItemInDir(...args),
}));

vi.mock("../../../application/runtime/ports/toasts", () => ({
  pushErrorToast: (...args: unknown[]) => pushErrorToastMock(...args),
}));

type MenuActionItem = {
  text: string;
  action: () => Promise<void> | void;
};

function createEvent(): ReactMouseEvent {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    clientX: 12,
    clientY: 34,
  } as unknown as ReactMouseEvent;
}

function createWorktree(path = "/tmp/worktree-1"): WorkspaceInfo {
  return {
    id: "worktree-1",
    name: "feature/test",
    path,
    kind: "worktree",
    connected: true,
    settings: {
      sidebarCollapsed: false,
      worktreeSetupScript: "",
    },
    worktree: { branch: "feature/test" },
  };
}

function getHandlers() {
  return {
    onDeleteThread: vi.fn(),
    onSyncThread: vi.fn(),
    onPinThread: vi.fn(),
    onUnpinThread: vi.fn(),
    isThreadPinned: vi.fn(() => false),
    onRenameThread: vi.fn(),
    onReloadWorkspaceThreads: vi.fn(),
    onDeleteWorkspace: vi.fn(),
    onDeleteWorktree: vi.fn(),
    onOpenWebContextMenu: openWebContextMenuMock,
  };
}

function getMenuItems(callIndex = 0): MenuActionItem[] {
  const args = menuNew.mock.calls[callIndex]?.[0] as { items: MenuActionItem[] } | undefined;
  return args?.items ?? [];
}

describe("useSidebarMenus", () => {
  beforeEach(() => {
    menuNew.mockClear();
    menuItemNew.mockClear();
    menuPopup.mockClear();
    revealItemInDir.mockClear();
    pushErrorToastMock.mockClear();
    clipboardWriteText.mockClear();
    openWebContextMenuMock.mockReset();
    isTauriMock.mockReturnValue(true);
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });
  });

  it("uses tauri menu actions for thread menu", async () => {
    const handlers = getHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await result.current.showThreadMenu(createEvent(), "ws-1", "thread-1", true);

    expect(menuNew).toHaveBeenCalledTimes(1);
    const items = getMenuItems();
    expect(items.map((item) => item.text)).toEqual([
      "Rename",
      "Sync from server",
      "Pin",
      "Copy ID",
      "Archive",
    ]);
    await items[2]?.action();
    expect(handlers.onPinThread).toHaveBeenCalledWith("ws-1", "thread-1");
    expect(menuPopup).toHaveBeenCalledTimes(1);
  });

  it("uses tauri menu actions for worktree menu", async () => {
    const handlers = getHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));
    const worktree = createWorktree();

    await result.current.showWorktreeMenu(createEvent(), worktree);

    const revealItem = getMenuItems().find((item) => item.text === `Show in ${fileManagerName()}`);
    expect(revealItem).toBeDefined();
    await revealItem?.action();
    expect(revealItemInDir).toHaveBeenCalledWith("/tmp/worktree-1");
    expect(menuPopup).toHaveBeenCalledTimes(1);
  });

  it("uses tauri menu actions for workspace menu", async () => {
    const handlers = getHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await result.current.showWorkspaceMenu(createEvent(), "ws-1");

    const items = getMenuItems();
    expect(items.map((item) => item.text)).toEqual(["Reload threads", "Delete"]);
    await items[1]?.action();
    expect(handlers.onDeleteWorkspace).toHaveBeenCalledWith("ws-1");
    expect(menuPopup).toHaveBeenCalledTimes(1);
  });

  it("uses context menu callback for thread menu in web runtime", async () => {
    isTauriMock.mockReturnValue(false);
    const handlers = getHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await result.current.showThreadMenu(createEvent(), "ws-1", "thread-1", true);

    expect(openWebContextMenuMock).toHaveBeenCalledTimes(1);
    expect(menuNew).not.toHaveBeenCalled();
    const payload = openWebContextMenuMock.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      title: "Thread actions",
      x: 12,
      y: 34,
    });
    expect(payload?.actions.map((item: { label: string }) => item.label)).toEqual([
      "Rename",
      "Sync from server",
      "Pin",
      "Copy ID",
      "Archive",
    ]);
    await payload?.actions[4]?.run();
    expect(handlers.onDeleteThread).toHaveBeenCalledWith("ws-1", "thread-1");
  });

  it("uses context menu callback for workspace menu in web runtime", async () => {
    isTauriMock.mockReturnValue(false);
    const handlers = getHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await result.current.showWorkspaceMenu(createEvent(), "ws-1");

    expect(openWebContextMenuMock).toHaveBeenCalledTimes(1);
    expect(menuNew).not.toHaveBeenCalled();
    const payload = openWebContextMenuMock.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      title: "Workspace actions",
      x: 12,
      y: 34,
    });
    expect(Array.isArray(payload?.actions)).toBe(true);
    expect(payload?.actions.map((item: { label: string }) => item.label)).toEqual([
      "Reload threads",
      "Delete",
    ]);
    await payload?.actions[1]?.run();
    expect(handlers.onDeleteWorkspace).toHaveBeenCalledWith("ws-1");
  });

  it("uses context menu callback for worktree menu in web runtime", async () => {
    isTauriMock.mockReturnValue(false);
    const handlers = getHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));
    const worktree = createWorktree("/tmp/worktree-web");

    await result.current.showWorktreeMenu(createEvent(), worktree);

    expect(openWebContextMenuMock).toHaveBeenCalledTimes(1);
    expect(menuNew).not.toHaveBeenCalled();
    const payload = openWebContextMenuMock.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      title: "Worktree actions",
      x: 12,
      y: 34,
    });
    expect(payload?.actions.map((item: { label: string }) => item.label)).toEqual([
      "Reload threads",
      `Show in ${fileManagerName()}`,
      "Delete worktree",
    ]);
    await payload?.actions[1]?.run();
    expect(clipboardWriteText).toHaveBeenCalledWith("/tmp/worktree-web");
  });

  it("supports deleting worktree from context menu in web runtime", async () => {
    isTauriMock.mockReturnValue(false);
    const handlers = getHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await result.current.showWorktreeMenu(createEvent(), createWorktree());

    const payload = openWebContextMenuMock.mock.calls[0]?.[0];
    await payload?.actions[2]?.run();
    expect(handlers.onDeleteWorktree).toHaveBeenCalledWith("worktree-1");
  });

  it("handles thread menu creation failures without throwing", async () => {
    menuNew.mockRejectedValueOnce(new Error("menu unavailable"));
    const handlers = getHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await expect(
      result.current.showThreadMenu(createEvent(), "ws-1", "thread-1", true)
    ).resolves.toBeUndefined();
    expect(pushErrorToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't open thread actions",
      })
    );
  });

  it("handles workspace menu creation failures without throwing", async () => {
    menuNew.mockRejectedValueOnce(new Error("menu unavailable"));
    const handlers = getHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await expect(result.current.showWorkspaceMenu(createEvent(), "ws-1")).resolves.toBeUndefined();
    expect(pushErrorToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't open workspace actions",
      })
    );
  });

  it("handles worktree menu creation failures without throwing", async () => {
    menuNew.mockRejectedValueOnce(new Error("menu unavailable"));
    const handlers = getHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await expect(
      result.current.showWorktreeMenu(createEvent(), createWorktree())
    ).resolves.toBeUndefined();
    expect(pushErrorToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't open worktree actions",
      })
    );
  });
});
