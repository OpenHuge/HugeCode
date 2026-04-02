import {
  invokeDesktopCommand,
  isDesktopHostRuntime,
} from "../application/runtime/ports/desktopHostCore";
import { getDesktopHostBridge } from "../application/runtime/ports/desktopHostBridge";

export type WorktreeSetupStatus = {
  shouldRun: boolean;
  script: string | null;
};

export async function getWorktreeSetupStatus(workspaceId: string): Promise<WorktreeSetupStatus> {
  return invokeDesktopCommand<WorktreeSetupStatus>("worktree_setup_status", { workspaceId });
}

export async function markWorktreeSetupRan(workspaceId: string): Promise<void> {
  return invokeDesktopCommand("worktree_setup_mark_ran", { workspaceId });
}

export async function renameWorktreeUpstream(
  id: string,
  oldBranch: string,
  newBranch: string
): Promise<void> {
  if (!isDesktopHostRuntime()) {
    throw new Error("Upstream worktree rename is unavailable outside the Electron desktop host.");
  }
  return invokeDesktopCommand("rename_worktree_upstream", { id, oldBranch, newBranch });
}

export async function applyWorktreeChanges(workspaceId: string): Promise<void> {
  return invokeDesktopCommand("apply_worktree_changes", { workspaceId });
}

export async function openWorkspaceIn(
  path: string,
  options: {
    appName?: string | null;
    command?: string | null;
    args?: string[];
  }
): Promise<void> {
  const bridgeOpenPathIn = getDesktopHostBridge()?.shell?.openPathIn;
  if (bridgeOpenPathIn) {
    const opened =
      (await bridgeOpenPathIn({
        appName: options.appName ?? null,
        args: options.args ?? [],
        command: options.command ?? null,
        path,
      })) ?? false;
    if (!opened) {
      throw new Error("Open in is unavailable in the current Electron desktop host.");
    }
    return;
  }

  if (!isDesktopHostRuntime()) {
    throw new Error("Open in is unavailable outside the Electron desktop host.");
  }

  return invokeDesktopCommand("open_workspace_in", {
    path,
    app: options.appName ?? null,
    command: options.command ?? null,
    args: options.args ?? [],
  });
}

export async function getOpenAppIcon(appName: string): Promise<string | null> {
  return invokeDesktopCommand<string | null>("get_open_app_icon", { appName });
}
