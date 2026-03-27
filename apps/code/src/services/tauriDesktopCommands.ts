import { invoke, isTauri } from "../application/runtime/ports/tauriCore";

export type MenuAcceleratorUpdate = {
  id: string;
  accelerator: string | null;
};

export async function setMenuAccelerators(updates: MenuAcceleratorUpdate[]): Promise<void> {
  if (!isTauri()) {
    return;
  }
  return invoke("menu_set_accelerators", { updates });
}

export async function generateCommitMessage(workspaceId: string): Promise<string> {
  if (!isTauri()) {
    throw new Error("Commit message generation is not available outside the desktop app.");
  }
  return invoke("generate_commit_message", { workspaceId });
}
