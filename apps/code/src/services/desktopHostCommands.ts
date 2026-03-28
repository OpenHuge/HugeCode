import {
  invokeDesktopCommand,
  isDesktopHostRuntime,
} from "../application/runtime/ports/desktopHostCore";

export type MenuAcceleratorUpdate = {
  id: string;
  accelerator: string | null;
};

export async function setMenuAccelerators(updates: MenuAcceleratorUpdate[]): Promise<void> {
  if (!isDesktopHostRuntime()) {
    return;
  }
  return invokeDesktopCommand("menu_set_accelerators", { updates });
}

export async function generateCommitMessage(workspaceId: string): Promise<string> {
  if (!isDesktopHostRuntime()) {
    throw new Error("Commit message generation is not available outside the desktop app.");
  }
  return invokeDesktopCommand("generate_commit_message", { workspaceId });
}
