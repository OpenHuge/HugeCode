import type { RuntimeWorkspaceFileSummary } from "./runtimeTurnHelpers";

const WORKSPACE_FILE_CACHE_TTL_MS = 30_000;
const WORKSPACE_FILE_MISS_REFRESH_COOLDOWN_MS = 1_000;
const lastRefreshMsByWorkspace = new Map<string, number>();

type WorkspaceFileIdCacheMap = Map<string, Map<string, string>>;

function buildFileIdMap(files: RuntimeWorkspaceFileSummary[]) {
  const fileIdByPath = new Map<string, string>();
  const paths: string[] = [];
  for (const file of files) {
    if (!file.path) {
      continue;
    }
    fileIdByPath.set(file.path, file.id);
    paths.push(file.path);
  }
  return { fileIdByPath, paths };
}

export function cacheWorkspaceFileIds(
  workspaceId: string,
  files: RuntimeWorkspaceFileSummary[],
  cache: WorkspaceFileIdCacheMap
) {
  const { fileIdByPath, paths } = buildFileIdMap(files);
  cache.set(workspaceId, fileIdByPath);
  lastRefreshMsByWorkspace.set(workspaceId, Date.now());
  return paths;
}

async function refreshWorkspaceFileIdCache(
  workspaceId: string,
  cache: WorkspaceFileIdCacheMap,
  loadWorkspaceFiles: () => Promise<RuntimeWorkspaceFileSummary[]>
) {
  const files = await loadWorkspaceFiles();
  const { fileIdByPath } = buildFileIdMap(files);
  cache.set(workspaceId, fileIdByPath);
  lastRefreshMsByWorkspace.set(workspaceId, Date.now());
  return fileIdByPath;
}

export async function resolveWorkspaceFileId(
  workspaceId: string,
  path: string,
  cache: WorkspaceFileIdCacheMap,
  loadWorkspaceFiles: () => Promise<RuntimeWorkspaceFileSummary[]>
) {
  const now = Date.now();
  const lastRefreshMs = lastRefreshMsByWorkspace.get(workspaceId) ?? 0;
  const cacheExpired = now - lastRefreshMs >= WORKSPACE_FILE_CACHE_TTL_MS;
  let fileIdByPath = cache.get(workspaceId);
  if (!fileIdByPath || cacheExpired) {
    fileIdByPath = await refreshWorkspaceFileIdCache(workspaceId, cache, loadWorkspaceFiles);
  }

  let fileId = fileIdByPath.get(path);
  if (fileId) {
    return fileId;
  }

  const refreshedAt = lastRefreshMsByWorkspace.get(workspaceId) ?? 0;
  const shouldRefreshAfterMiss = now - refreshedAt >= WORKSPACE_FILE_MISS_REFRESH_COOLDOWN_MS;
  if (!shouldRefreshAfterMiss) {
    return null;
  }

  const refreshedFileIdByPath = await refreshWorkspaceFileIdCache(
    workspaceId,
    cache,
    loadWorkspaceFiles
  );
  fileId = refreshedFileIdByPath.get(path);
  return fileId ?? null;
}
