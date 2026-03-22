import { getRuntimeClient } from "./runtimeClient";
import {
  type RuntimeWorkspaceFileContent,
  type RuntimeWorkspaceFileSummary,
  runtimeWorkspaceFileIdsByPath,
} from "./tauriRuntimeTurnHelpers";
import { cacheWorkspaceFileIds, resolveWorkspaceFileId } from "./tauriWorkspaceFileIdCache";

export async function getWorkspaceFiles(workspaceId: string) {
  const files = (await getRuntimeClient().workspaceFiles(
    workspaceId
  )) as RuntimeWorkspaceFileSummary[];
  return cacheWorkspaceFileIds(workspaceId, files, runtimeWorkspaceFileIdsByPath);
}

export async function readWorkspaceFile(
  workspaceId: string,
  path: string
): Promise<{ content: string; truncated: boolean }> {
  const fileId = await resolveWorkspaceFileId(
    workspaceId,
    path,
    runtimeWorkspaceFileIdsByPath,
    async () =>
      (await getRuntimeClient().workspaceFiles(workspaceId)) as RuntimeWorkspaceFileSummary[]
  );
  if (!fileId) {
    throw new Error("Runtime file id not found.");
  }
  const file = (await getRuntimeClient().workspaceFileRead(
    workspaceId,
    fileId
  )) as RuntimeWorkspaceFileContent | null;
  if (!file) {
    throw new Error("Runtime file content not found.");
  }
  return {
    content: file.content ?? "",
    truncated: false,
  };
}
