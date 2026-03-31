import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { logger } from "../../../application/runtime/ports/logger";
import { getGitDiffs } from "../../../application/runtime/ports/git";
import type { GitDiffScope, GitFileDiff, GitFileStatus, WorkspaceInfo } from "../../../types";
import { shouldSuppressGitConsoleError } from "../utils/repositoryErrors";

type GitDiffState = {
  diffs: GitFileDiff[];
  isLoading: boolean;
  error: string | null;
};

const emptyState: GitDiffState = {
  diffs: [],
  isLoading: false,
  error: null,
};

export function useGitDiffs(
  activeWorkspace: WorkspaceInfo | null,
  stagedFiles: GitFileStatus[],
  unstagedFiles: GitFileStatus[],
  enabled: boolean,
  ignoreWhitespaceChanges: boolean
) {
  const [state, setState] = useState<GitDiffState>(emptyState);
  const requestIdRef = useRef(0);
  const cacheKeyRef = useRef<string | null>(null);
  const cachedDiffsRef = useRef<Map<string, GitFileDiff[]>>(new Map());

  const fileKey = useMemo(
    () =>
      [...stagedFiles, ...unstagedFiles]
        .map((file) => `${file.path}:${file.status}:${file.additions}:${file.deletions}`)
        .sort()
        .join("|"),
    [stagedFiles, unstagedFiles]
  );

  const refresh = useCallback(async () => {
    if (!activeWorkspace) {
      setState(emptyState);
      return;
    }
    const workspaceId = activeWorkspace.id;
    const cacheKey = `${workspaceId}|ignoreWhitespaceChanges:${ignoreWhitespaceChanges ? "1" : "0"}`;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const diffs = await getGitDiffs(workspaceId);
      if (requestIdRef.current !== requestId || cacheKeyRef.current !== cacheKey) {
        return;
      }
      setState({ diffs, isLoading: false, error: null });
      cachedDiffsRef.current.set(cacheKey, diffs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!shouldSuppressGitConsoleError(error)) {
        logger.error("Failed to load git diffs", error);
      }
      if (requestIdRef.current !== requestId || cacheKeyRef.current !== cacheKey) {
        return;
      }
      setState({
        diffs: [],
        isLoading: false,
        error: message,
      });
    }
  }, [activeWorkspace, ignoreWhitespaceChanges]);

  useEffect(() => {
    const workspaceId = activeWorkspace?.id ?? null;
    const nextCacheKey = workspaceId
      ? `${workspaceId}|ignoreWhitespaceChanges:${ignoreWhitespaceChanges ? "1" : "0"}`
      : null;
    if (cacheKeyRef.current !== nextCacheKey) {
      cacheKeyRef.current = nextCacheKey;
      requestIdRef.current += 1;
      if (!nextCacheKey) {
        setState(emptyState);
        return;
      }
      const cached = cachedDiffsRef.current.get(nextCacheKey);
      setState({
        diffs: cached ?? [],
        isLoading: false,
        error: null,
      });
    }
  }, [activeWorkspace?.id, ignoreWhitespaceChanges]);

  // oxlint-disable-next-line react/exhaustive-deps -- fileKey triggers a refresh when the visible file set changes.
  useEffect(() => {
    if (!enabled) {
      return;
    }
    void refresh();
  }, [enabled, fileKey, refresh]);

  const orderedDiffs = useMemo(() => {
    const scopedFiles = [
      ...stagedFiles.map((file) => ({ ...file, scope: "staged" as const })),
      ...unstagedFiles.map((file) => ({ ...file, scope: "unstaged" as const })),
    ];
    const diffByScopeKey = new Map(
      state.diffs.map((entry) => [`${entry.path}::${entry.scope ?? "unstaged"}`, entry])
    );
    return scopedFiles.map((file) => {
      const entry = diffByScopeKey.get(`${file.path}::${file.scope}`);
      return {
        path: file.path,
        status: file.status,
        diff: entry?.diff ?? "",
        scope: file.scope as GitDiffScope,
        oldLines: entry?.oldLines,
        newLines: entry?.newLines,
        isImage: entry?.isImage,
        oldImageData: entry?.oldImageData,
        newImageData: entry?.newImageData,
        oldImageMime: entry?.oldImageMime,
        newImageMime: entry?.newImageMime,
      };
    });
  }, [stagedFiles, state.diffs, unstagedFiles]);

  return {
    diffs: orderedDiffs,
    isLoading: state.isLoading,
    error: state.error,
    refresh,
  };
}
