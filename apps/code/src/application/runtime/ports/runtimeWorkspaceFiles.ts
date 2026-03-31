import {
  getRuntimeClient,
  type WorkspaceFileContent,
  type WorkspaceFileSummary,
} from "./runtimeClient";

/**
 * Canonical workspace-file runtime port for kernel/workspace-client assembly.
 *
 * Keep file-entry reads on raw runtime ids here so callers do not reconstruct
 * file-lookup semantics in kernel or UI code.
 */
export async function listRuntimeWorkspaceFileEntries(
  workspaceId: string
): Promise<WorkspaceFileSummary[]> {
  return getRuntimeClient().workspaceFiles(workspaceId);
}

export async function readRuntimeWorkspaceFile(
  workspaceId: string,
  fileId: string
): Promise<WorkspaceFileContent | null> {
  return getRuntimeClient().workspaceFileRead(workspaceId, fileId);
}
