import FileText from "lucide-react/dist/esm/icons/file-text";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import ScrollText from "lucide-react/dist/esm/icons/scroll-text";
import Search from "lucide-react/dist/esm/icons/search";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isTauri } from "../../../application/runtime/ports/desktopHostCore";
import { ask } from "../../../application/runtime/ports/desktopHostDialogs";
import { LogicalPosition } from "../../../application/runtime/ports/desktopDpi";
import { Menu, MenuItem } from "../../../application/runtime/ports/desktopMenu";
import { openUrl, revealItemInDir } from "../../../application/runtime/facades/desktopHostFacade";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import { getCurrentWindow } from "../../../application/runtime/ports/desktopHostWindow";
import type { GitHubIssue, GitHubPullRequest, GitLogEntry } from "../../../types";
import {
  fileManagerName,
  isAbsolutePath as isAbsolutePathForPlatform,
} from "../../../utils/platformPaths";
import { type PanelTabId, PanelTabs } from "../../layout/components/PanelTabs";
import { MetadataList, MetadataRow, PanelFrame, PanelHeader, Text } from "../../../design-system";
import {
  Chip,
  ChipList,
  InspectorSectionGroup,
  NarrativeBlock,
} from "../../right-panel/RightPanelPrimitives";
import { useDiffFileSelection } from "../hooks/useDiffFileSelection";
import * as styles from "./GitDiffPanel.styles.css";
import {
  getFileName,
  getGitHubBaseUrl,
  getRelativePathWithin,
  hasPushSyncConflict,
  isMissingRepo,
  joinRootAndPath,
  normalizeRootPath,
  resolveRootPath,
} from "./GitDiffPanel.utils";
import {
  GitBranchRow,
  GitDiffModeContent,
  GitIssuesModeContent,
  GitLogModeContent,
  GitPanelModeStatus,
  GitPullRequestsModeContent,
  GitRootCurrentPath,
} from "./GitDiffPanelModeContent";
import { SidebarError, type SidebarErrorAction, WorktreeApplyIcon } from "./GitDiffPanelShared";

type GitDiffPanelProps = {
  workspaceId?: string | null;
  workspacePath?: string | null;
  mode: "diff" | "log" | "issues" | "prs";
  onModeChange: (mode: "diff" | "log" | "issues" | "prs") => void;
  filePanelMode: PanelTabId;
  onFilePanelModeChange: (mode: PanelTabId) => void;
  showPanelTabs?: boolean;
  showModeSelect?: boolean;
  integratedRail?: boolean;
  worktreeApplyLabel?: string;
  worktreeApplyTitle?: string | null;
  worktreeApplyLoading?: boolean;
  worktreeApplyError?: string | null;
  worktreeApplySuccess?: boolean;
  onApplyWorktreeChanges?: () => void | Promise<void>;
  onRevertAllChanges?: () => void | Promise<void>;
  branchName: string;
  totalAdditions: number;
  totalDeletions: number;
  fileStatus: string;
  error?: string | null;
  logError?: string | null;
  logLoading?: boolean;
  logTotal?: number;
  logAhead?: number;
  logBehind?: number;
  logAheadEntries?: GitLogEntry[];
  logBehindEntries?: GitLogEntry[];
  logUpstream?: string | null;
  issues?: GitHubIssue[];
  issuesTotal?: number;
  issuesLoading?: boolean;
  issuesError?: string | null;
  onStartTaskFromGitHubIssue?: (issue: GitHubIssue) => void | Promise<void>;
  onStartTaskFromGitHubIssueFollowUp?: (issue: GitHubIssue) => void | Promise<void>;
  onDelegateGitHubIssue?: (issue: GitHubIssue) => void | Promise<void>;
  pullRequests?: GitHubPullRequest[];
  pullRequestsTotal?: number;
  pullRequestsLoading?: boolean;
  pullRequestsError?: string | null;
  onStartTaskFromGitHubPullRequest?: (pullRequest: GitHubPullRequest) => void | Promise<void>;
  selectedPullRequest?: number | null;
  onSelectPullRequest?: (pullRequest: GitHubPullRequest) => void;
  onDelegateGitHubPullRequest?: (pullRequest: GitHubPullRequest) => void;
  gitRemoteUrl?: string | null;
  gitRoot?: string | null;
  gitRootCandidates?: string[];
  gitRootScanDepth?: number;
  gitRootScanLoading?: boolean;
  gitRootScanError?: string | null;
  gitRootScanHasScanned?: boolean;
  onGitRootScanDepthChange?: (depth: number) => void;
  onScanGitRoots?: () => void;
  onSelectGitRoot?: (path: string) => void;
  onClearGitRoot?: () => void;
  onPickGitRoot?: () => void | Promise<void>;
  selectedPath?: string | null;
  onSelectFile?: (path: string) => void;
  stagedFiles: {
    path: string;
    status: string;
    additions: number;
    deletions: number;
  }[];
  unstagedFiles: {
    path: string;
    status: string;
    additions: number;
    deletions: number;
  }[];
  onStageAllChanges?: () => void | Promise<void>;
  onStageFile?: (path: string) => Promise<void> | void;
  onUnstageFile?: (path: string) => Promise<void> | void;
  onRevertFile?: (path: string) => Promise<void> | void;
  logEntries: GitLogEntry[];
  selectedCommitSha?: string | null;
  onSelectCommit?: (entry: GitLogEntry) => void;
  commitMessage?: string;
  commitMessageLoading?: boolean;
  commitMessageError?: string | null;
  onCommitMessageChange?: (value: string) => void;
  onGenerateCommitMessage?: () => void | Promise<void>;
  // Git operations
  onCommit?: () => void | Promise<void>;
  onCommitAndPush?: () => void | Promise<void>;
  onCommitAndSync?: () => void | Promise<void>;
  onPull?: () => void | Promise<void>;
  onFetch?: () => void | Promise<void>;
  onPush?: () => void | Promise<void>;
  onSync?: () => void | Promise<void>;
  commitLoading?: boolean;
  pullLoading?: boolean;
  fetchLoading?: boolean;
  pushLoading?: boolean;
  syncLoading?: boolean;
  commitError?: string | null;
  pullError?: string | null;
  fetchError?: string | null;
  pushError?: string | null;
  syncError?: string | null;
  // For showing push button when there are commits to push
  commitsAhead?: number;
};

function isCapabilityContractError(message: string): boolean {
  return /Runtime RPC capabilities must advertise canonical methods only\./i.test(message);
}

const GIT_RUNTIME_CAPABILITY_TOAST_ID = "git-runtime-capabilities-contract";
const GIT_RUNTIME_CAPABILITY_TOAST_MESSAGE =
  "Runtime host capabilities are stale. Restart or update the runtime host, then reload the workspace.";

export function GitDiffPanel({
  workspaceId = null,
  workspacePath = null,
  mode,
  onModeChange,
  filePanelMode,
  onFilePanelModeChange,
  showPanelTabs = true,
  showModeSelect = true,
  integratedRail = false,
  worktreeApplyTitle = null,
  worktreeApplyLoading = false,
  worktreeApplyError = null,
  worktreeApplySuccess = false,
  onApplyWorktreeChanges,
  onRevertAllChanges: _onRevertAllChanges,
  branchName,
  totalAdditions,
  totalDeletions,
  fileStatus,
  error,
  logError,
  logLoading = false,
  logTotal = 0,
  gitRemoteUrl = null,
  onSelectFile,
  logEntries,
  logAhead = 0,
  logBehind = 0,
  logAheadEntries = [],
  logBehindEntries = [],
  logUpstream = null,
  selectedCommitSha = null,
  onSelectCommit,
  issues = [],
  issuesTotal = 0,
  issuesLoading = false,
  issuesError = null,
  onStartTaskFromGitHubIssue,
  onDelegateGitHubIssue,
  pullRequests = [],
  pullRequestsTotal = 0,
  pullRequestsLoading = false,
  pullRequestsError = null,
  onStartTaskFromGitHubPullRequest,
  onStartTaskFromGitHubIssueFollowUp,
  selectedPullRequest = null,
  onSelectPullRequest,
  onDelegateGitHubPullRequest,
  gitRoot = null,
  gitRootCandidates = [],
  gitRootScanDepth = 2,
  gitRootScanLoading = false,
  gitRootScanError = null,
  gitRootScanHasScanned = false,
  selectedPath = null,
  stagedFiles = [],
  unstagedFiles = [],
  onStageAllChanges,
  onStageFile,
  onUnstageFile,
  onRevertFile,
  onGitRootScanDepthChange,
  onScanGitRoots,
  onSelectGitRoot,
  onClearGitRoot,
  onPickGitRoot,
  commitMessage = "",
  commitMessageLoading = false,
  commitMessageError = null,
  onCommitMessageChange,
  onGenerateCommitMessage,
  onCommit,
  onCommitAndPush: _onCommitAndPush,
  onCommitAndSync: _onCommitAndSync,
  onPull,
  onFetch,
  onPush,
  onSync: _onSync,
  commitLoading = false,
  pullLoading = false,
  fetchLoading = false,
  pushLoading = false,
  syncLoading: _syncLoading = false,
  commitError = null,
  pullError = null,
  fetchError = null,
  pushError = null,
  syncError = null,
  commitsAhead = 0,
}: GitDiffPanelProps) {
  const [dismissedErrorSignatures, setDismissedErrorSignatures] = useState<Set<string>>(new Set());
  const { selectedFiles, handleFileClick, handleDiffListClick, selectOnlyFile } =
    useDiffFileSelection({
      stagedFiles,
      unstagedFiles,
      onSelectFile,
    });

  const ModeIcon = useMemo(() => {
    switch (mode) {
      case "log":
        return ScrollText;
      case "issues":
        return Search;
      case "prs":
        return GitBranch;
      default:
        return FileText;
    }
  }, [mode]);

  const pushNeedsSync = useMemo(() => hasPushSyncConflict(pushError), [pushError]);
  const pushErrorMessage = useMemo(() => {
    if (!pushError) {
      return null;
    }
    if (!pushNeedsSync) {
      return pushError;
    }
    return `Remote has new commits. Sync (pull then push) before retrying.\n\n${pushError}`;
  }, [pushError, pushNeedsSync]);

  const handleSyncFromError = useCallback(() => {
    void _onSync?.();
  }, [_onSync]);

  const confirmWarning = useCallback(async (message: string, title: string) => {
    if (isTauri()) {
      try {
        return await ask(message, { title, kind: "warning" });
      } catch {
        // Fall back to browser confirm when native dialog bridge is unavailable.
      }
    }
    if (typeof window === "undefined" || typeof window.confirm !== "function") {
      return false;
    }
    return window.confirm(message);
  }, []);

  const pushErrorAction = useMemo<SidebarErrorAction | null>(() => {
    if (!pushNeedsSync || !_onSync) {
      return null;
    }
    return {
      label: _syncLoading ? "Syncing..." : "Sync (pull then push)",
      onAction: handleSyncFromError,
      disabled: _syncLoading,
      loading: _syncLoading,
    };
  }, [pushNeedsSync, _onSync, _syncLoading, handleSyncFromError]);

  const githubBaseUrl = useMemo(() => getGitHubBaseUrl(gitRemoteUrl), [gitRemoteUrl]);

  const showLogMenu = useCallback(
    async (event: ReactMouseEvent<HTMLElement>, entry: GitLogEntry) => {
      if (!isTauri()) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      try {
        const copyItem = await MenuItem.new({
          text: "Copy SHA",
          action: async () => {
            await navigator.clipboard.writeText(entry.sha);
          },
        });

        const items = [copyItem];
        if (githubBaseUrl) {
          const openItem = await MenuItem.new({
            text: "Open on GitHub",
            action: async () => {
              try {
                await openUrl(`${githubBaseUrl}/commit/${entry.sha}`);
              } catch (openError) {
                pushErrorToast({
                  title: "Couldn't open commit on GitHub",
                  message:
                    openError instanceof Error ? openError.message : "Unable to open commit link.",
                });
              }
            },
          });
          items.push(openItem);
        }

        const menu = await Menu.new({ items });
        const window = getCurrentWindow();
        const position = new LogicalPosition(event.clientX, event.clientY);
        await menu.popup(position, window);
      } catch (error) {
        pushErrorToast({
          title: "Couldn't open commit actions",
          message: error instanceof Error ? error.message : "Unable to open commit menu.",
        });
      }
    },
    [githubBaseUrl]
  );

  const showPullRequestMenu = useCallback(
    async (event: ReactMouseEvent<HTMLElement>, pullRequest: GitHubPullRequest) => {
      if (!isTauri()) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      try {
        const openItem = await MenuItem.new({
          text: "Open on GitHub",
          action: async () => {
            try {
              await openUrl(pullRequest.url);
            } catch (openError) {
              pushErrorToast({
                title: "Couldn't open pull request on GitHub",
                message:
                  openError instanceof Error
                    ? openError.message
                    : "Unable to open pull request link.",
              });
            }
          },
        });

        const menu = await Menu.new({ items: [openItem] });
        const window = getCurrentWindow();
        const position = new LogicalPosition(event.clientX, event.clientY);
        await menu.popup(position, window);
      } catch (error) {
        pushErrorToast({
          title: "Couldn't open pull request actions",
          message: error instanceof Error ? error.message : "Unable to open pull request menu.",
        });
      }
    },
    []
  );

  const discardFiles = useCallback(
    async (paths: string[]) => {
      if (!onRevertFile) {
        return;
      }

      const isSingle = paths.length === 1;
      const previewLimit = 6;
      const preview = paths.slice(0, previewLimit).join("\n");
      const more = paths.length > previewLimit ? `\n… and ${paths.length - previewLimit} more` : "";
      const message = isSingle
        ? `Discard changes in:\n\n${paths[0]}\n\nThis cannot be undone.`
        : `Discard changes in these files?\n\n${preview}${more}\n\nThis cannot be undone.`;
      const confirmed = await confirmWarning(message, "Discard changes");
      if (!confirmed) {
        return;
      }

      for (const path of paths) {
        await onRevertFile(path);
      }
    },
    [confirmWarning, onRevertFile]
  );

  const discardFile = useCallback(
    async (path: string) => {
      await discardFiles([path]);
    },
    [discardFiles]
  );

  const showFileMenu = useCallback(
    async (event: ReactMouseEvent<HTMLElement>, path: string, _section: "staged" | "unstaged") => {
      if (!isTauri()) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      try {
        const isInSelection = selectedFiles.has(path);
        const targetPaths =
          isInSelection && selectedFiles.size > 1 ? Array.from(selectedFiles) : [path];

        if (!isInSelection) {
          selectOnlyFile(path);
        }

        const fileCount = targetPaths.length;
        const plural = fileCount > 1 ? "s" : "";
        const countSuffix = fileCount > 1 ? ` (${fileCount})` : "";
        const normalizedRoot = resolveRootPath(gitRoot, workspacePath);
        const inferredRoot =
          !normalizedRoot && gitRootCandidates.length === 1
            ? resolveRootPath(gitRootCandidates[0], workspacePath)
            : "";
        const fallbackRoot = normalizeRootPath(workspacePath);
        const resolvedRoot = normalizedRoot || inferredRoot || fallbackRoot;

        const stagedPaths = targetPaths.filter((targetPath) =>
          stagedFiles.some((file) => file.path === targetPath)
        );
        const unstagedPaths = targetPaths.filter((targetPath) =>
          unstagedFiles.some((file) => file.path === targetPath)
        );

        const items: MenuItem[] = [];

        if (stagedPaths.length > 0 && onUnstageFile) {
          items.push(
            await MenuItem.new({
              text: `Unstage file${stagedPaths.length > 1 ? `s (${stagedPaths.length})` : ""}`,
              action: async () => {
                for (const stagedPath of stagedPaths) {
                  await onUnstageFile(stagedPath);
                }
              },
            })
          );
        }

        if (unstagedPaths.length > 0 && onStageFile) {
          items.push(
            await MenuItem.new({
              text: `Stage file${unstagedPaths.length > 1 ? `s (${unstagedPaths.length})` : ""}`,
              action: async () => {
                for (const unstagedPath of unstagedPaths) {
                  await onStageFile(unstagedPath);
                }
              },
            })
          );
        }

        if (targetPaths.length === 1) {
          const fileManagerLabel = fileManagerName();
          const rawPath = targetPaths[0];
          const absolutePath = resolvedRoot ? joinRootAndPath(resolvedRoot, rawPath) : rawPath;
          const relativeRoot =
            workspacePath && resolvedRoot
              ? getRelativePathWithin(workspacePath, resolvedRoot)
              : null;
          const projectRelativePath =
            relativeRoot !== null ? joinRootAndPath(relativeRoot, rawPath) : rawPath;
          const fileName = getFileName(rawPath);

          items.push(
            await MenuItem.new({
              text: `Show in ${fileManagerLabel}`,
              action: async () => {
                try {
                  if (!resolvedRoot && !isAbsolutePathForPlatform(absolutePath)) {
                    pushErrorToast({
                      title: `Couldn't show file in ${fileManagerLabel}`,
                      message: "Select a git root first.",
                    });
                    return;
                  }
                  await revealItemInDir(absolutePath);
                } catch (menuError) {
                  const message =
                    menuError instanceof Error ? menuError.message : String(menuError);
                  pushErrorToast({
                    title: `Couldn't show file in ${fileManagerLabel}`,
                    message,
                  });
                }
              },
            })
          );

          items.push(
            await MenuItem.new({
              text: "Copy file name",
              action: async () => {
                await navigator.clipboard.writeText(fileName);
              },
            }),
            await MenuItem.new({
              text: "Copy file path",
              action: async () => {
                await navigator.clipboard.writeText(projectRelativePath);
              },
            })
          );
        }

        if (onRevertFile) {
          items.push(
            await MenuItem.new({
              text: `Discard change${plural}${countSuffix}`,
              action: async () => {
                await discardFiles(targetPaths);
              },
            })
          );
        }

        if (!items.length) {
          return;
        }

        const menu = await Menu.new({ items });
        const window = getCurrentWindow();
        const position = new LogicalPosition(event.clientX, event.clientY);
        await menu.popup(position, window);
      } catch (error) {
        pushErrorToast({
          title: "Couldn't open file actions",
          message: error instanceof Error ? error.message : "Unable to open file menu.",
        });
      }
    },
    [
      selectedFiles,
      selectOnlyFile,
      stagedFiles,
      unstagedFiles,
      onUnstageFile,
      onStageFile,
      onRevertFile,
      discardFiles,
      gitRoot,
      gitRootCandidates,
      workspacePath,
    ]
  );

  const logCountLabel = logTotal
    ? `${logTotal} commit${logTotal === 1 ? "" : "s"}`
    : logEntries.length
      ? `${logEntries.length} commit${logEntries.length === 1 ? "" : "s"}`
      : "No commits";
  const logSyncLabel = logUpstream ? `↑${logAhead} ↓${logBehind}` : "No upstream configured";
  const logUpstreamLabel = logUpstream ? `Upstream ${logUpstream}` : "";
  const showAheadSection = Boolean(logUpstream && logAhead > 0);
  const showBehindSection = Boolean(logUpstream && logBehind > 0);
  const hasDiffTotals = totalAdditions > 0 || totalDeletions > 0;
  const diffTotalsLabel = `+${totalAdditions} / -${totalDeletions}`;
  const diffStatusLabel = hasDiffTotals
    ? [logUpstream ? logSyncLabel : null, diffTotalsLabel].filter(Boolean).join(" · ")
    : logUpstream
      ? `${logSyncLabel} · ${fileStatus}`
      : fileStatus;
  const hasGitRoot = Boolean(gitRoot?.trim());
  const showGitRootPanel =
    isMissingRepo(error) ||
    gitRootScanLoading ||
    gitRootScanHasScanned ||
    Boolean(gitRootScanError) ||
    gitRootCandidates.length > 0;
  const normalizedGitRoot = normalizeRootPath(gitRoot);
  const errorScope = `${workspaceId ?? "no-workspace"}:${normalizedGitRoot || "no-git-root"}:${mode}`;
  const hasAnyChanges = stagedFiles.length > 0 || unstagedFiles.length > 0;
  const showApplyWorktree = mode === "diff" && Boolean(onApplyWorktreeChanges) && hasAnyChanges;
  const canGenerateCommitMessage = hasAnyChanges;
  const showGenerateCommitMessage =
    mode === "diff" && Boolean(onGenerateCommitMessage) && hasAnyChanges;
  const commitsBehind = logBehind;
  const useIntegratedRail = integratedRail || !showPanelTabs;
  const showLogSection =
    showAheadSection || showBehindSection || logLoading || logEntries.length > 0;
  const showIssuesSection = issuesLoading || Boolean(issuesError) || issues.length > 0;
  const showPullRequestsSection =
    pullRequestsLoading || Boolean(pullRequestsError) || pullRequests.length > 0;

  const sidebarErrorCandidates = useMemo(() => {
    const options: Array<{
      key: string;
      message: string | null | undefined;
      action?: SidebarErrorAction;
    }> =
      mode === "diff"
        ? [
            { key: "push", message: pushErrorMessage, action: pushErrorAction ?? undefined },
            { key: "pull", message: pullError },
            { key: "fetch", message: fetchError },
            { key: "commit", message: commitError },
            { key: "sync", message: syncError },
            { key: "commitMessage", message: commitMessageError },
            { key: "git", message: error },
            { key: "worktreeApply", message: worktreeApplyError },
            { key: "gitRootScan", message: gitRootScanError },
          ]
        : mode === "log"
          ? [{ key: "log", message: logError }]
          : mode === "issues"
            ? [{ key: "issues", message: issuesError }]
            : [{ key: "pullRequests", message: pullRequestsError }];

    return options
      .filter((entry) => Boolean(entry.message))
      .map((entry) => ({
        ...entry,
        signature: `${errorScope}:${entry.key}:${entry.message}`,
        message: entry.message as string,
      }));
  }, [
    commitError,
    commitMessageError,
    error,
    fetchError,
    gitRootScanError,
    issuesError,
    logError,
    pullRequestsError,
    pullError,
    pushErrorAction,
    pushErrorMessage,
    syncError,
    worktreeApplyError,
    errorScope,
    mode,
  ]);

  const sidebarError = useMemo(
    () =>
      sidebarErrorCandidates.find((entry) => !dismissedErrorSignatures.has(entry.signature)) ??
      null,
    [dismissedErrorSignatures, sidebarErrorCandidates]
  );

  useEffect(() => {
    const activeSignatures = new Set(sidebarErrorCandidates.map((entry) => entry.signature));
    setDismissedErrorSignatures((previous) => {
      let changed = false;
      const next = new Set<string>();
      previous.forEach((signature) => {
        if (activeSignatures.has(signature)) {
          next.add(signature);
        } else {
          changed = true;
        }
      });
      return changed || next.size !== previous.size ? next : previous;
    });
  }, [sidebarErrorCandidates]);

  useEffect(() => {
    const capabilityErrors = sidebarErrorCandidates.filter((entry) =>
      isCapabilityContractError(entry.message)
    );
    if (!capabilityErrors.length) {
      return;
    }
    const undispatchedErrors = capabilityErrors.filter(
      (entry) => !dismissedErrorSignatures.has(entry.signature)
    );
    if (!undispatchedErrors.length) {
      return;
    }
    const uniqueMessages = new Set<string>();
    undispatchedErrors.forEach((entry) => {
      if (uniqueMessages.has(entry.message)) {
        return;
      }
      uniqueMessages.add(entry.message);
      pushErrorToast({
        id: GIT_RUNTIME_CAPABILITY_TOAST_ID,
        title: "Runtime capabilities are out of date",
        message: GIT_RUNTIME_CAPABILITY_TOAST_MESSAGE,
      });
    });
    setDismissedErrorSignatures((previous) => {
      const next = new Set(previous);
      undispatchedErrors.forEach((entry) => {
        next.add(entry.signature);
      });
      return next;
    });
  }, [dismissedErrorSignatures, sidebarErrorCandidates]);

  const showSidebarError = Boolean(sidebarError);
  const summaryRows = [
    !useIntegratedRail &&
      (mode !== "diff" || hasGitRoot) && {
        key: "view",
        label: "View",
        value: (
          <div className={styles.summaryValue}>
            <GitPanelModeStatus
              mode={mode}
              hasGitRoot={hasGitRoot}
              diffStatusLabel={diffStatusLabel}
              logCountLabel={logCountLabel}
              logSyncLabel={logSyncLabel}
              logUpstreamLabel={logUpstreamLabel}
              issuesLoading={issuesLoading}
              issuesTotal={issuesTotal}
              pullRequestsLoading={pullRequestsLoading}
              pullRequestsTotal={pullRequestsTotal}
            />
          </div>
        ),
      },
    hasGitRoot &&
      (mode === "diff" || mode === "log") && {
        key: "branch",
        label: "Branch",
        value: (
          <div className={styles.summaryValue}>
            <GitBranchRow
              mode={mode}
              hasGitRoot={hasGitRoot}
              branchName={branchName}
              onFetch={onFetch}
              fetchLoading={fetchLoading}
            />
          </div>
        ),
      },
    hasGitRoot &&
      mode !== "issues" && {
        key: "repo",
        label: "Repo",
        value: (
          <div className={styles.summaryValue}>
            <GitRootCurrentPath
              mode={mode}
              hasGitRoot={hasGitRoot}
              gitRoot={gitRoot}
              onScanGitRoots={onScanGitRoots}
              gitRootScanLoading={gitRootScanLoading}
            />
          </div>
        ),
      },
  ].filter(Boolean) as Array<{ key: string; label: string; value: ReactNode }>;

  const modeContent =
    mode === "diff" ? (
      <GitDiffModeContent
        error={error}
        showGitRootPanel={showGitRootPanel}
        onScanGitRoots={onScanGitRoots}
        gitRootScanLoading={gitRootScanLoading}
        gitRootScanDepth={gitRootScanDepth}
        onGitRootScanDepthChange={onGitRootScanDepthChange}
        onPickGitRoot={onPickGitRoot}
        hasGitRoot={hasGitRoot}
        onClearGitRoot={onClearGitRoot}
        gitRootScanError={gitRootScanError}
        gitRootScanHasScanned={gitRootScanHasScanned}
        gitRootCandidates={gitRootCandidates}
        gitRoot={gitRoot}
        onSelectGitRoot={onSelectGitRoot}
        showGenerateCommitMessage={showGenerateCommitMessage}
        commitMessage={commitMessage}
        onCommitMessageChange={onCommitMessageChange}
        commitMessageLoading={commitMessageLoading}
        canGenerateCommitMessage={canGenerateCommitMessage}
        onGenerateCommitMessage={onGenerateCommitMessage}
        stagedFiles={stagedFiles}
        unstagedFiles={unstagedFiles}
        commitLoading={commitLoading}
        onCommit={onCommit}
        commitsAhead={commitsAhead}
        commitsBehind={commitsBehind}
        onPull={onPull}
        pullLoading={pullLoading}
        onPush={onPush}
        pushLoading={pushLoading}
        onSync={_onSync}
        syncLoading={_syncLoading}
        onStageAllChanges={onStageAllChanges}
        onStageFile={onStageFile}
        onUnstageFile={onUnstageFile}
        onDiscardFile={onRevertFile ? discardFile : undefined}
        onDiscardFiles={onRevertFile ? discardFiles : undefined}
        selectedFiles={selectedFiles}
        selectedPath={selectedPath}
        onFileClick={handleFileClick}
        onShowFileMenu={showFileMenu}
        onDiffListClick={handleDiffListClick}
      />
    ) : mode === "log" ? (
      <GitLogModeContent
        logError={logError}
        logLoading={logLoading}
        logEntries={logEntries}
        showAheadSection={showAheadSection}
        showBehindSection={showBehindSection}
        logAheadEntries={logAheadEntries}
        logBehindEntries={logBehindEntries}
        selectedCommitSha={selectedCommitSha}
        onSelectCommit={onSelectCommit}
        onShowLogMenu={showLogMenu}
      />
    ) : mode === "issues" ? (
      <GitIssuesModeContent
        issuesError={issuesError}
        issuesLoading={issuesLoading}
        issues={issues}
        onStartTask={onStartTaskFromGitHubIssue}
        onStartFollowUpTask={onStartTaskFromGitHubIssueFollowUp}
        onDelegateIssue={onDelegateGitHubIssue}
      />
    ) : (
      <GitPullRequestsModeContent
        pullRequestsError={pullRequestsError}
        pullRequestsLoading={pullRequestsLoading}
        pullRequests={pullRequests}
        onStartTask={onStartTaskFromGitHubPullRequest}
        selectedPullRequest={selectedPullRequest}
        onSelectPullRequest={onSelectPullRequest}
        onDelegatePullRequest={onDelegateGitHubPullRequest}
        onShowPullRequestMenu={showPullRequestMenu}
      />
    );

  const integratedOverview =
    useIntegratedRail &&
    (hasGitRoot || fileStatus || hasDiffTotals || logUpstream || showApplyWorktree) ? (
      <div className={styles.integratedRailOverview}>
        <div className={styles.integratedRailSummary}>
          <ChipList>
            {hasGitRoot ? <Chip>{branchName}</Chip> : null}
            {fileStatus ? <Chip>{fileStatus}</Chip> : null}
            {hasDiffTotals ? <Chip>{diffTotalsLabel}</Chip> : null}
            {logUpstream ? <Chip>{logSyncLabel}</Chip> : null}
          </ChipList>
          {showApplyWorktree ? (
            <button
              type="button"
              className={styles.worktreeApplyButton}
              onClick={() => {
                void onApplyWorktreeChanges?.();
              }}
              disabled={worktreeApplyLoading || worktreeApplySuccess}
              data-tooltip={worktreeApplyTitle ?? "Apply changes to parent workspace"}
              aria-label="Apply worktree changes"
            >
              <WorktreeApplyIcon success={worktreeApplySuccess} />
            </button>
          ) : null}
        </div>
        {hasGitRoot ? (
          <NarrativeBlock className={styles.integratedRailRepo}>
            <Text as="div" size="fine" tone="muted" weight="medium" transform="uppercase">
              Repository
            </Text>
            <Text as="div" size="meta" tone="strong" monospace>
              {gitRoot}
            </Text>
          </NarrativeBlock>
        ) : null}
      </div>
    ) : null;

  if (useIntegratedRail) {
    return (
      <div className={styles.integratedRailShell}>
        {integratedOverview}
        {modeContent}
        {showLogSection ? (
          <GitLogModeContent
            logError={logError}
            logLoading={logLoading}
            logEntries={logEntries}
            showAheadSection={showAheadSection}
            showBehindSection={showBehindSection}
            logAheadEntries={logAheadEntries}
            logBehindEntries={logBehindEntries}
            selectedCommitSha={selectedCommitSha}
            onSelectCommit={onSelectCommit}
            onShowLogMenu={showLogMenu}
          />
        ) : null}
        {showIssuesSection ? (
          <GitIssuesModeContent
            issuesError={issuesError}
            issuesLoading={issuesLoading}
            issues={issues}
            onStartTask={onStartTaskFromGitHubIssue}
            onStartFollowUpTask={onStartTaskFromGitHubIssueFollowUp}
            onDelegateIssue={onDelegateGitHubIssue}
          />
        ) : null}
        {showPullRequestsSection ? (
          <GitPullRequestsModeContent
            pullRequestsError={pullRequestsError}
            pullRequestsLoading={pullRequestsLoading}
            pullRequests={pullRequests}
            onStartTask={onStartTaskFromGitHubPullRequest}
            selectedPullRequest={selectedPullRequest}
            onSelectPullRequest={onSelectPullRequest}
            onDelegatePullRequest={onDelegateGitHubPullRequest}
            onShowPullRequestMenu={showPullRequestMenu}
          />
        ) : null}
        {showSidebarError && sidebarError ? (
          <SidebarError
            message={sidebarError.message}
            action={sidebarError.action ?? null}
            onDismiss={() =>
              setDismissedErrorSignatures((previous) => {
                if (previous.has(sidebarError.signature)) {
                  return previous;
                }
                const next = new Set(previous);
                next.add(sidebarError.signature);
                return next;
              })
            }
          />
        ) : null}
      </div>
    );
  }

  return (
    <PanelFrame className={styles.panelShell}>
      <InspectorSectionGroup className={styles.summaryGroup}>
        <PanelHeader className={styles.panelHeader}>
          <div className={styles.panelHeaderPrimary}>
            {showPanelTabs ? (
              <PanelTabs active={filePanelMode} onSelect={onFilePanelModeChange} />
            ) : null}
          </div>
          <div className={styles.panelHeaderSecondary}>
            {showModeSelect && !useIntegratedRail ? (
              <div className={styles.panelSelect}>
                <span className={styles.panelSelectIcon} aria-hidden>
                  <ModeIcon />
                </span>
                <select
                  className={styles.panelSelectInput}
                  value={mode}
                  onChange={(event) =>
                    onModeChange(event.target.value as GitDiffPanelProps["mode"])
                  }
                  aria-label="Git panel view"
                >
                  <option value="diff">Diff</option>
                  <option value="log">Log</option>
                  <option value="issues">Issues</option>
                  <option value="prs">PRs</option>
                </select>
              </div>
            ) : null}
            {showApplyWorktree && (
              <button
                type="button"
                className={styles.worktreeApplyButton}
                onClick={() => {
                  void onApplyWorktreeChanges?.();
                }}
                disabled={worktreeApplyLoading || worktreeApplySuccess}
                data-tooltip={worktreeApplyTitle ?? "Apply changes to parent workspace"}
                aria-label="Apply worktree changes"
              >
                <WorktreeApplyIcon success={worktreeApplySuccess} />
              </button>
            )}
          </div>
        </PanelHeader>
        <MetadataList>
          {summaryRows.map((row) => (
            <MetadataRow key={row.key} label={row.label} value={row.value} />
          ))}
        </MetadataList>
      </InspectorSectionGroup>

      {modeContent}

      {showSidebarError && sidebarError && (
        <SidebarError
          message={sidebarError.message}
          action={sidebarError.action ?? null}
          onDismiss={() =>
            setDismissedErrorSignatures((previous) => {
              if (previous.has(sidebarError.signature)) {
                return previous;
              }
              const next = new Set(previous);
              next.add(sidebarError.signature);
              return next;
            })
          }
        />
      )}
    </PanelFrame>
  );
}
