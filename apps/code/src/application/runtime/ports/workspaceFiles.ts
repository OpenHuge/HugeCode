import {
  getWorkspaceFiles as readWorkspaceFileSummaries,
  readWorkspaceFile,
} from "../../../services/runtimeWorkspaceFilesBridge";

export type RuntimeWorkspaceFileEntry = {
  id: string;
  path: string;
};

export async function listWorkspaceFileEntries(
  workspaceId: string
): Promise<RuntimeWorkspaceFileEntry[]> {
  return (await readWorkspaceFileSummaries(workspaceId)) as unknown as RuntimeWorkspaceFileEntry[];
}

export async function getWorkspaceFiles(workspaceId: string): Promise<string[]> {
  return (await listWorkspaceFileEntries(workspaceId)).map((file) => file.path);
}

export { readWorkspaceFile };
