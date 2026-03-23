import { type MouseEvent, useCallback } from "react";
import { isTauri } from "../../../application/runtime/ports/tauriCore";
import { LogicalPosition } from "../../../application/runtime/ports/tauriDpi";
import { Menu, MenuItem } from "../../../application/runtime/ports/tauriMenu";
import { revealItemInDir } from "../../../application/runtime/facades/desktopHostFacade";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import { getCurrentWindow } from "../../../application/runtime/ports/tauriWindow";
import type { WorkspaceInfo } from "../../../types";
import { fileManagerName } from "../../../utils/platformPaths";

type SidebarMenuHandlers = {
  onDeleteThread: (workspaceId: string, threadId: string) => void;
  onSyncThread: (workspaceId: string, threadId: string) => void;
  onPinThread: (workspaceId: string, threadId: string) => void;
  onUnpinThread: (workspaceId: string, threadId: string) => void;
  isThreadPinned: (workspaceId: string, threadId: string) => boolean;
  onRenameThread: (workspaceId: string, threadId: string) => void;
  onReloadWorkspaceThreads: (workspaceId: string) => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  onDeleteWorktree: (workspaceId: string) => void;
  onOpenWebContextMenu: (payload: SidebarWebContextMenuPayload) => void;
};

export type SidebarWebContextMenuAction = {
  label: string;
  run: () => void | Promise<void>;
};

export type SidebarWebContextMenuPayload = {
  title: string;
  actions: SidebarWebContextMenuAction[];
  x: number;
  y: number;
};

async function copyToClipboard(value: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // Clipboard failures are non-fatal here.
  }
}

export function useSidebarMenus({
  onDeleteThread,
  onSyncThread,
  onPinThread,
  onUnpinThread,
  isThreadPinned,
  onRenameThread,
  onReloadWorkspaceThreads,
  onDeleteWorkspace,
  onDeleteWorktree,
  onOpenWebContextMenu,
}: SidebarMenuHandlers) {
  const showThreadMenu = useCallback(
    async (event: MouseEvent, workspaceId: string, threadId: string, canPin: boolean) => {
      event.preventDefault();
      event.stopPropagation();
      if (!isTauri()) {
        const actions: SidebarWebContextMenuAction[] = [
          {
            label: "Rename",
            run: () => onRenameThread(workspaceId, threadId),
          },
          {
            label: "Sync from server",
            run: () => onSyncThread(workspaceId, threadId),
          },
        ];
        if (canPin) {
          const pinned = isThreadPinned(workspaceId, threadId);
          actions.push({
            label: pinned ? "Unpin" : "Pin",
            run: () => {
              if (pinned) {
                onUnpinThread(workspaceId, threadId);
              } else {
                onPinThread(workspaceId, threadId);
              }
            },
          });
        }
        actions.push(
          {
            label: "Copy ID",
            run: async () => copyToClipboard(threadId),
          },
          {
            label: "Archive",
            run: () => onDeleteThread(workspaceId, threadId),
          }
        );
        onOpenWebContextMenu({
          title: "Thread actions",
          actions,
          x: event.clientX,
          y: event.clientY,
        });
        return;
      }
      try {
        const renameItem = await MenuItem.new({
          text: "Rename",
          action: () => onRenameThread(workspaceId, threadId),
        });
        const syncItem = await MenuItem.new({
          text: "Sync from server",
          action: () => onSyncThread(workspaceId, threadId),
        });
        const archiveItem = await MenuItem.new({
          text: "Archive",
          action: () => onDeleteThread(workspaceId, threadId),
        });
        const copyItem = await MenuItem.new({
          text: "Copy ID",
          action: async () => copyToClipboard(threadId),
        });
        const items = [renameItem, syncItem];
        if (canPin) {
          const isPinned = isThreadPinned(workspaceId, threadId);
          items.push(
            await MenuItem.new({
              text: isPinned ? "Unpin" : "Pin",
              action: () => {
                if (isPinned) {
                  onUnpinThread(workspaceId, threadId);
                } else {
                  onPinThread(workspaceId, threadId);
                }
              },
            })
          );
        }
        items.push(copyItem, archiveItem);
        const menu = await Menu.new({ items });
        const window = getCurrentWindow();
        const position = new LogicalPosition(event.clientX, event.clientY);
        await menu.popup(position, window);
      } catch (error) {
        pushErrorToast({
          title: "Couldn't open thread actions",
          message: error instanceof Error ? error.message : "Unable to open thread menu.",
        });
      }
    },
    [
      isThreadPinned,
      onDeleteThread,
      onOpenWebContextMenu,
      onPinThread,
      onRenameThread,
      onSyncThread,
      onUnpinThread,
    ]
  );

  const showWorkspaceMenu = useCallback(
    async (event: MouseEvent, workspaceId: string) => {
      event.preventDefault();
      event.stopPropagation();
      if (!isTauri()) {
        const actions: SidebarWebContextMenuAction[] = [
          {
            label: "Reload threads",
            run: () => onReloadWorkspaceThreads(workspaceId),
          },
          {
            label: "Delete",
            run: () => onDeleteWorkspace(workspaceId),
          },
        ];
        onOpenWebContextMenu({
          title: "Workspace actions",
          actions,
          x: event.clientX,
          y: event.clientY,
        });
        return;
      }
      try {
        const reloadItem = await MenuItem.new({
          text: "Reload threads",
          action: () => onReloadWorkspaceThreads(workspaceId),
        });
        const deleteItem = await MenuItem.new({
          text: "Delete",
          action: () => onDeleteWorkspace(workspaceId),
        });
        const menu = await Menu.new({ items: [reloadItem, deleteItem] });
        const window = getCurrentWindow();
        const position = new LogicalPosition(event.clientX, event.clientY);
        await menu.popup(position, window);
      } catch (error) {
        pushErrorToast({
          title: "Couldn't open workspace actions",
          message: error instanceof Error ? error.message : "Unable to open workspace menu.",
        });
      }
    },
    [onDeleteWorkspace, onOpenWebContextMenu, onReloadWorkspaceThreads]
  );

  const showWorktreeMenu = useCallback(
    async (event: MouseEvent, worktree: WorkspaceInfo) => {
      event.preventDefault();
      event.stopPropagation();
      const fileManagerLabel = fileManagerName();
      if (!isTauri()) {
        const actions: SidebarWebContextMenuAction[] = [
          {
            label: "Reload threads",
            run: () => onReloadWorkspaceThreads(worktree.id),
          },
        ];
        if (worktree.path) {
          actions.push({
            label: `Show in ${fileManagerLabel}`,
            run: async () => copyToClipboard(worktree.path),
          });
        }
        actions.push({
          label: "Delete worktree",
          run: () => onDeleteWorktree(worktree.id),
        });
        onOpenWebContextMenu({
          title: "Worktree actions",
          actions,
          x: event.clientX,
          y: event.clientY,
        });
        return;
      }
      try {
        const reloadItem = await MenuItem.new({
          text: "Reload threads",
          action: () => onReloadWorkspaceThreads(worktree.id),
        });
        const revealItem = await MenuItem.new({
          text: `Show in ${fileManagerLabel}`,
          action: async () => {
            if (!worktree.path) {
              return;
            }
            try {
              await revealItemInDir(worktree.path);
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              pushErrorToast({
                title: `Couldn't show worktree in ${fileManagerLabel}`,
                message,
              });
            }
          },
        });
        const deleteItem = await MenuItem.new({
          text: "Delete worktree",
          action: () => onDeleteWorktree(worktree.id),
        });
        const menu = await Menu.new({ items: [reloadItem, revealItem, deleteItem] });
        const window = getCurrentWindow();
        const position = new LogicalPosition(event.clientX, event.clientY);
        await menu.popup(position, window);
      } catch (error) {
        pushErrorToast({
          title: "Couldn't open worktree actions",
          message: error instanceof Error ? error.message : "Unable to open worktree menu.",
        });
      }
    },
    [onDeleteWorktree, onOpenWebContextMenu, onReloadWorkspaceThreads]
  );

  return { showThreadMenu, showWorkspaceMenu, showWorktreeMenu };
}
