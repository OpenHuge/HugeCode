import {
  getRuntimeClient,
  type WorkspaceFileContent,
  type WorkspaceFileSummary,
} from "./runtimeClient";

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
