import ArrowLeftRight from "lucide-react/dist/esm/icons/arrow-left-right";
import Download from "lucide-react/dist/esm/icons/download";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import RotateCw from "lucide-react/dist/esm/icons/rotate-cw";
import Upload from "lucide-react/dist/esm/icons/upload";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import { openUrl } from "../../../application/runtime/facades/desktopHostFacade";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import { Button, IconButton, StatusBadge, Textarea } from "../../../design-system";
import type { GitHubIssue, GitHubPullRequest, GitLogEntry } from "../../../types";
import { joinClassNames } from "../../../utils/classNames";
import { formatRelativeTime } from "../../../utils/time";
import {
  InspectorSectionBody,
  InspectorSectionGroup,
  InspectorSectionHeader,
  RightPanelEmptyState,
} from "../../right-panel/RightPanelPrimitives";
import { DEPTH_OPTIONS, normalizeRootPath } from "./GitDiffPanel.utils";
import * as styles from "./GitDiffPanelModeContent.styles.css";
import { CommitButton, type DiffFile, DiffSection, GitLogEntryRow } from "./GitDiffPanelShared";

function cx(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

async function openExternalIssueUrl(url: string) {
  try {
    await openUrl(url);
    return;
  } catch (error) {
    pushErrorToast({
      title: "Couldn't open issue link",
      message: error instanceof Error ? error.message : "Unable to open issue URL.",
    });
  }
}

type GitMode = "diff" | "log" | "issues" | "prs";

type GitPanelModeStatusProps = {
  mode: GitMode;
  hasGitRoot: boolean;
  diffStatusLabel: string;
  logCountLabel: string;
  logSyncLabel: string;
  logUpstreamLabel: string;
  issuesLoading: boolean;
  issuesTotal: number;
  pullRequestsLoading: boolean;
  pullRequestsTotal: number;
};

export function GitPanelModeStatus({
  mode,
  hasGitRoot,
  diffStatusLabel,
  logCountLabel,
  logSyncLabel,
  logUpstreamLabel,
  issuesLoading,
  issuesTotal,
  pullRequestsLoading,
  pullRequestsTotal,
}: GitPanelModeStatusProps) {
  if (mode === "diff") {
    if (!hasGitRoot) {
      return null;
    }
    return <div className={styles.diffStatus}>{diffStatusLabel}</div>;
  }

  if (mode === "log") {
    return (
      <>
        <div className={styles.diffStatus}>{logCountLabel}</div>
        <div className={joinClassNames(styles.logSync, "git-log-sync")}>
          <span>{logSyncLabel}</span>
          {logUpstreamLabel && (
            <>
              <span>·</span>
              <span>{logUpstreamLabel}</span>
            </>
          )}
        </div>
      </>
    );
  }

  if (mode === "issues") {
    return (
      <>
        <div className={cx(styles.diffStatus, styles.diffStatusIssues)}>
          <span>GitHub issues</span>
          {issuesLoading && (
            <span
              className={joinClassNames(styles.panelSpinner, "git-panel-spinner")}
              aria-hidden
            />
          )}
        </div>
        <div className={joinClassNames(styles.logSync, "git-log-sync")}>
          <span>{issuesTotal} open</span>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={cx(styles.diffStatus, styles.diffStatusIssues)}>
        <span>GitHub pull requests</span>
        {pullRequestsLoading && (
          <span className={joinClassNames(styles.panelSpinner, "git-panel-spinner")} aria-hidden />
        )}
      </div>
      <div className={joinClassNames(styles.logSync, "git-log-sync")}>
        <span>{pullRequestsTotal} open</span>
      </div>
    </>
  );
}

type GitBranchRowProps = {
  mode: GitMode;
  hasGitRoot: boolean;
  branchName: string;
  onFetch?: () => void | Promise<void>;
  fetchLoading: boolean;
};

export function GitBranchRow({
  mode,
  hasGitRoot,
  branchName,
  onFetch,
  fetchLoading,
}: GitBranchRowProps) {
  if ((mode !== "diff" && mode !== "log") || !hasGitRoot) {
    return null;
  }

  return (
    <div className={styles.diffBranchRow}>
      <div className={cx(styles.diffBranch, styles.diffBranchInRow)}>{branchName}</div>
      <button
        type="button"
        className={styles.diffBranchRefresh}
        onClick={() => void onFetch?.()}
        disabled={!onFetch || fetchLoading}
        title={fetchLoading ? "Fetching remote..." : "Fetch remote"}
        aria-label={fetchLoading ? "Fetching remote" : "Fetch remote"}
      >
        {fetchLoading ? (
          <span className={joinClassNames(styles.panelSpinner, "git-panel-spinner")} aria-hidden />
        ) : (
          <RotateCw size={12} aria-hidden />
        )}
      </button>
    </div>
  );
}

type GitRootCurrentPathProps = {
  mode: GitMode;
  hasGitRoot: boolean;
  gitRoot: string | null;
  onScanGitRoots?: () => void;
  gitRootScanLoading: boolean;
};

export function GitRootCurrentPath({
  mode,
  hasGitRoot,
  gitRoot,
  onScanGitRoots,
  gitRootScanLoading,
}: GitRootCurrentPathProps) {
  if (mode === "issues" || !hasGitRoot) {
    return null;
  }

  return (
    <div className={styles.gitRootCurrent}>
      <span className={styles.gitRootPath} title={gitRoot ?? ""}>
        {gitRoot}
      </span>
      {onScanGitRoots && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cx(styles.gitRootButton, styles.gitRootButtonIconButton)}
          onClick={onScanGitRoots}
          disabled={gitRootScanLoading}
        >
          <ArrowLeftRight className={styles.gitRootButtonIcon} aria-hidden />
          Change
        </Button>
      )}
    </div>
  );
}

type GitDiffModeContentProps = {
  error: string | null | undefined;
  showGitRootPanel: boolean;
  onScanGitRoots?: () => void;
  gitRootScanLoading: boolean;
  gitRootScanDepth: number;
  onGitRootScanDepthChange?: (depth: number) => void;
  onPickGitRoot?: () => void | Promise<void>;
  hasGitRoot: boolean;
  onClearGitRoot?: () => void;
  gitRootScanError: string | null | undefined;
  gitRootScanHasScanned: boolean;
  gitRootCandidates: string[];
  gitRoot: string | null;
  onSelectGitRoot?: (path: string) => void;
  showGenerateCommitMessage: boolean;
  commitMessage: string;
  onCommitMessageChange?: (value: string) => void;
  commitMessageLoading: boolean;
  canGenerateCommitMessage: boolean;
  onGenerateCommitMessage?: () => void | Promise<void>;
  stagedFiles: DiffFile[];
  unstagedFiles: DiffFile[];
  commitLoading: boolean;
  onCommit?: () => void | Promise<void>;
  commitsAhead: number;
  commitsBehind: number;
  onPull?: () => void | Promise<void>;
  pullLoading: boolean;
  onPush?: () => void | Promise<void>;
  pushLoading: boolean;
  onSync?: () => void | Promise<void>;
  syncLoading: boolean;
  onStageAllChanges?: () => void | Promise<void>;
  onStageFile?: (path: string) => Promise<void> | void;
  onUnstageFile?: (path: string) => Promise<void> | void;
  onDiscardFile?: (path: string) => Promise<void> | void;
  onDiscardFiles?: (paths: string[]) => Promise<void> | void;
  selectedFiles: Set<string>;
  selectedPath: string | null;
  onFileClick: (
    event: ReactMouseEvent<HTMLElement>,
    path: string,
    section: "staged" | "unstaged"
  ) => void;
  onShowFileMenu: (
    event: ReactMouseEvent<HTMLElement>,
    path: string,
    section: "staged" | "unstaged"
  ) => void;
  onDiffListClick: (
    event: ReactMouseEvent<HTMLDivElement> | ReactKeyboardEvent<HTMLDivElement>
  ) => void;
};

export function GitDiffModeContent({
  error,
  showGitRootPanel,
  onScanGitRoots,
  gitRootScanLoading,
  gitRootScanDepth,
  onGitRootScanDepthChange,
  onPickGitRoot,
  hasGitRoot,
  onClearGitRoot,
  gitRootScanError,
  gitRootScanHasScanned,
  gitRootCandidates,
  gitRoot,
  onSelectGitRoot,
  showGenerateCommitMessage,
  commitMessage,
  onCommitMessageChange,
  commitMessageLoading,
  canGenerateCommitMessage,
  onGenerateCommitMessage,
  stagedFiles,
  unstagedFiles,
  commitLoading,
  onCommit,
  commitsAhead,
  commitsBehind,
  onPull,
  pullLoading,
  onPush,
  pushLoading,
  onSync,
  syncLoading,
  onStageAllChanges,
  onStageFile,
  onUnstageFile,
  onDiscardFile,
  onDiscardFiles,
  selectedFiles,
  selectedPath,
  onFileClick,
  onShowFileMenu,
  onDiffListClick,
}: GitDiffModeContentProps) {
  const normalizedGitRoot = normalizeRootPath(gitRoot);
  const showRepositoryUnavailableEmpty =
    !error &&
    !showGitRootPanel &&
    !hasGitRoot &&
    stagedFiles.length === 0 &&
    unstagedFiles.length === 0 &&
    commitsAhead === 0 &&
    commitsBehind === 0;

  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- panel-level click delegation is intentional and keyboard interaction is owned by nested controls
    <div className={styles.diffList} onClick={onDiffListClick}>
      {showGitRootPanel && (
        <InspectorSectionGroup className={styles.gitRootPanel}>
          <InspectorSectionHeader
            title="Repository"
            subtitle="Choose which repo this workspace should inspect."
          />
          <InspectorSectionBody>
            <div className={styles.gitRootActions}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={styles.gitRootButton}
                onClick={onScanGitRoots}
                disabled={!onScanGitRoots || gitRootScanLoading}
              >
                Scan workspace
              </Button>
              <label className={styles.gitRootDepth}>
                <span>Depth</span>
                <select
                  className={styles.gitRootSelect}
                  value={gitRootScanDepth}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (!Number.isNaN(value)) {
                      onGitRootScanDepthChange?.(value);
                    }
                  }}
                  disabled={gitRootScanLoading}
                >
                  {DEPTH_OPTIONS.map((depth) => (
                    <option key={depth} value={depth}>
                      {depth}
                    </option>
                  ))}
                </select>
              </label>
              {onPickGitRoot && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={styles.gitRootButton}
                  onClick={() => {
                    void onPickGitRoot();
                  }}
                  disabled={gitRootScanLoading}
                >
                  Pick folder
                </Button>
              )}
              {hasGitRoot && onClearGitRoot && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={styles.gitRootButton}
                  onClick={onClearGitRoot}
                  disabled={gitRootScanLoading}
                >
                  Use workspace root
                </Button>
              )}
            </div>
            {gitRootScanLoading && (
              <div className={styles.diffEmpty}>Scanning for repositories...</div>
            )}
            {!gitRootScanLoading &&
              !gitRootScanError &&
              gitRootScanHasScanned &&
              gitRootCandidates.length === 0 && (
                <div className={styles.diffEmpty}>No repositories found.</div>
              )}
            {gitRootCandidates.length > 0 && (
              <div className={styles.gitRootList}>
                {gitRootCandidates.map((path) => {
                  const normalizedPath = normalizeRootPath(path);
                  const isActive = normalizedGitRoot && normalizedGitRoot === normalizedPath;
                  return (
                    <button
                      key={path}
                      type="button"
                      className={cx(styles.gitRootItem, isActive && styles.gitRootItemActive)}
                      onClick={() => onSelectGitRoot?.(path)}
                    >
                      <span className={styles.gitRootPath}>{path}</span>
                      {isActive && <span className={styles.gitRootTag}>Active</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </InspectorSectionBody>
        </InspectorSectionGroup>
      )}
      {showGenerateCommitMessage && (
        <div className={joinClassNames(styles.commitSection, "commit-message-section")}>
          <div
            className={joinClassNames(styles.commitInputWrapper, "commit-message-input-wrapper")}
          >
            <Textarea
              className={joinClassNames(styles.commitInput, "commit-message-input")}
              placeholder="Commit message..."
              value={commitMessage}
              onChange={(event) => onCommitMessageChange?.(event.target.value)}
              disabled={commitMessageLoading}
              rows={2}
            />
            <IconButton
              variant="ghost"
              size="icon"
              className={joinClassNames(
                styles.commitGenerateButton,
                "commit-message-generate-button"
              )}
              onClick={() => {
                if (!canGenerateCommitMessage) {
                  return;
                }
                void onGenerateCommitMessage?.();
              }}
              disabled={!canGenerateCommitMessage}
              loading={commitMessageLoading}
              title={
                stagedFiles.length > 0
                  ? "Generate commit message from staged changes"
                  : "Generate commit message from unstaged changes"
              }
              aria-label="Generate commit message"
              icon={
                <svg
                  width={14}
                  height={14}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <title>Generate commit message</title>
                  <path
                    d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"
                    stroke="none"
                  />
                  <path d="M20 2v4" fill="none" />
                  <path d="M22 4h-4" fill="none" />
                  <circle cx="4" cy="20" r="2" fill="none" />
                </svg>
              }
            />
          </div>
          <CommitButton
            commitMessage={commitMessage}
            hasStagedFiles={stagedFiles.length > 0}
            hasUnstagedFiles={unstagedFiles.length > 0}
            commitLoading={commitLoading}
            onCommit={onCommit}
          />
        </div>
      )}
      {(commitsAhead > 0 || commitsBehind > 0) && !stagedFiles.length && (
        <div
          className={joinClassNames(styles.pushSection, styles.pushSectionFirst, "push-section")}
        >
          <div className={joinClassNames(styles.pushSyncButtons, "push-sync-buttons")}>
            {commitsBehind > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={joinClassNames(styles.pushButton, "push-button-secondary")}
                onClick={() => void onPull?.()}
                disabled={!onPull || pullLoading || syncLoading}
                title={`Pull ${commitsBehind} commit${commitsBehind > 1 ? "s" : ""}`}
              >
                {pullLoading ? (
                  <span
                    className={joinClassNames(styles.actionSpinner, "commit-button-spinner")}
                    aria-hidden
                  />
                ) : (
                  <Download size={14} aria-hidden />
                )}
                <span>{pullLoading ? "Pulling..." : "Pull"}</span>
                <span className={joinClassNames(styles.pushCount, "push-count")}>
                  {commitsBehind}
                </span>
              </Button>
            )}
            {commitsAhead > 0 && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                className={joinClassNames(styles.pushButton, "push-button")}
                onClick={() => void onPush?.()}
                disabled={!onPush || pushLoading || commitsBehind > 0}
                title={
                  commitsBehind > 0
                    ? "Remote is ahead. Pull first, or use Sync."
                    : `Push ${commitsAhead} commit${commitsAhead > 1 ? "s" : ""}`
                }
              >
                {pushLoading ? (
                  <span
                    className={joinClassNames(styles.actionSpinner, "commit-button-spinner")}
                    aria-hidden
                  />
                ) : (
                  <Upload size={14} aria-hidden />
                )}
                <span>Push</span>
                <span className={joinClassNames(styles.pushCount, "push-count")}>
                  {commitsAhead}
                </span>
              </Button>
            )}
          </div>
          {commitsAhead > 0 && commitsBehind > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={joinClassNames(styles.pushButton, "push-button-secondary")}
              onClick={() => void onSync?.()}
              disabled={!onSync || syncLoading || pullLoading}
              title="Pull latest changes and push your local commits"
            >
              {syncLoading ? (
                <span
                  className={joinClassNames(styles.actionSpinner, "commit-button-spinner")}
                  aria-hidden
                />
              ) : (
                <RotateCcw size={14} aria-hidden />
              )}
              <span>{syncLoading ? "Syncing..." : "Sync (pull then push)"}</span>
            </Button>
          )}
        </div>
      )}
      {showRepositoryUnavailableEmpty ? (
        <RightPanelEmptyState
          title="Repository not selected"
          body="Open a repository-backed workspace or choose a Git root in this workspace to inspect changes, history, issues, and pull requests."
        />
      ) : null}
      {!showRepositoryUnavailableEmpty &&
        !error &&
        !stagedFiles.length &&
        !unstagedFiles.length &&
        commitsAhead === 0 &&
        commitsBehind === 0 && (
          <RightPanelEmptyState
            title="No changes"
            body="The current repository is clean. New edits, commits to push, or upstream changes will appear here."
          />
        )}
      {(stagedFiles.length > 0 || unstagedFiles.length > 0) && (
        <>
          {stagedFiles.length > 0 && (
            <DiffSection
              title="Staged"
              files={stagedFiles}
              section="staged"
              selectedFiles={selectedFiles}
              selectedPath={selectedPath}
              onUnstageFile={onUnstageFile}
              onDiscardFile={onDiscardFile}
              onDiscardFiles={onDiscardFiles}
              onFileClick={onFileClick}
              onShowFileMenu={onShowFileMenu}
            />
          )}
          {unstagedFiles.length > 0 && (
            <DiffSection
              title="Unstaged"
              files={unstagedFiles}
              section="unstaged"
              selectedFiles={selectedFiles}
              selectedPath={selectedPath}
              onStageAllChanges={onStageAllChanges}
              onStageFile={onStageFile}
              onDiscardFile={onDiscardFile}
              onDiscardFiles={onDiscardFiles}
              onFileClick={onFileClick}
              onShowFileMenu={onShowFileMenu}
            />
          )}
        </>
      )}
    </div>
  );
}

type GitLogModeContentProps = {
  logError: string | null | undefined;
  logLoading: boolean;
  logEntries: GitLogEntry[];
  showAheadSection: boolean;
  showBehindSection: boolean;
  logAheadEntries: GitLogEntry[];
  logBehindEntries: GitLogEntry[];
  selectedCommitSha: string | null;
  onSelectCommit?: (entry: GitLogEntry) => void;
  onShowLogMenu: (event: ReactMouseEvent<HTMLElement>, entry: GitLogEntry) => void;
};

export function GitLogModeContent({
  logError,
  logLoading,
  logEntries,
  showAheadSection,
  showBehindSection,
  logAheadEntries,
  logBehindEntries,
  selectedCommitSha,
  onSelectCommit,
  onShowLogMenu,
}: GitLogModeContentProps) {
  return (
    <div className={joinClassNames(styles.list, "git-log-list")}>
      {!logError && logLoading && <div className="diff-viewer-loading">Loading commits...</div>}
      {!logError &&
        !logLoading &&
        !logEntries.length &&
        !showAheadSection &&
        !showBehindSection && <div className={styles.diffEmpty}>No commits yet.</div>}
      {showAheadSection && (
        <InspectorSectionGroup className="git-log-section">
          <InspectorSectionHeader title="To push" />
          <InspectorSectionBody
            className={joinClassNames(styles.logSectionList, "git-log-section-list")}
          >
            {logAheadEntries.map((entry) => {
              const isSelected = selectedCommitSha === entry.sha;
              return (
                <GitLogEntryRow
                  key={entry.sha}
                  entry={entry}
                  isSelected={isSelected}
                  compact
                  onSelect={onSelectCommit}
                  onContextMenu={(event) => onShowLogMenu(event, entry)}
                />
              );
            })}
          </InspectorSectionBody>
        </InspectorSectionGroup>
      )}
      {showBehindSection && (
        <InspectorSectionGroup className="git-log-section">
          <InspectorSectionHeader title="To pull" />
          <InspectorSectionBody
            className={joinClassNames(styles.logSectionList, "git-log-section-list")}
          >
            {logBehindEntries.map((entry) => {
              const isSelected = selectedCommitSha === entry.sha;
              return (
                <GitLogEntryRow
                  key={entry.sha}
                  entry={entry}
                  isSelected={isSelected}
                  compact
                  onSelect={onSelectCommit}
                  onContextMenu={(event) => onShowLogMenu(event, entry)}
                />
              );
            })}
          </InspectorSectionBody>
        </InspectorSectionGroup>
      )}
      {(logEntries.length > 0 || logLoading) && (
        <InspectorSectionGroup className="git-log-section">
          <InspectorSectionHeader title="Recent commits" />
          <InspectorSectionBody
            className={joinClassNames(styles.logSectionList, "git-log-section-list")}
          >
            {logEntries.map((entry) => {
              const isSelected = selectedCommitSha === entry.sha;
              return (
                <GitLogEntryRow
                  key={entry.sha}
                  entry={entry}
                  isSelected={isSelected}
                  onSelect={onSelectCommit}
                  onContextMenu={(event) => onShowLogMenu(event, entry)}
                />
              );
            })}
          </InspectorSectionBody>
        </InspectorSectionGroup>
      )}
    </div>
  );
}

type GitIssuesModeContentProps = {
  issuesError: string | null | undefined;
  issuesLoading: boolean;
  issues: GitHubIssue[];
  onStartTask?: (issue: GitHubIssue) => void | Promise<void>;
  onStartCommentCommandTask?: (issue: GitHubIssue) => void | Promise<void>;
  onDelegateIssue?: (issue: GitHubIssue) => void | Promise<void>;
};

export function GitIssuesModeContent({
  issuesError,
  issuesLoading,
  issues,
  onStartTask,
  onStartCommentCommandTask,
  onDelegateIssue,
}: GitIssuesModeContentProps) {
  return (
    <div className={joinClassNames(styles.list, "git-issues-list")}>
      {!issuesError && !issuesLoading && !issues.length && (
        <div className={styles.diffEmpty}>No open issues.</div>
      )}
      {issues.map((issue) => {
        const relativeTime = formatRelativeTime(new Date(issue.updatedAt).getTime());
        return (
          <div key={issue.number} className={joinClassNames(styles.issueEntry, "git-issue-entry")}>
            <div className={joinClassNames(styles.issueSummary, "git-issue-summary")}>
              <span className={joinClassNames(styles.issueTitle, "git-issue-title")}>
                <span className={joinClassNames(styles.issueNumber, "git-issue-number")}>
                  #{issue.number}
                </span>{" "}
                {issue.title}{" "}
                <span className={joinClassNames(styles.issueDate, "git-issue-date")}>
                  · {relativeTime}
                </span>
              </span>
            </div>
            <div className={styles.entryActions}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={styles.entryActionButton}
                aria-label={`Start comment follow-up for issue #${issue.number}`}
                onClick={() => {
                  void onStartCommentCommandTask?.(issue);
                }}
                disabled={!onStartCommentCommandTask}
              >
                Follow up
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={styles.entryActionButton}
                aria-label={`Open issue #${issue.number} on GitHub`}
                onClick={() => {
                  void openExternalIssueUrl(issue.url);
                }}
              >
                Open
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={styles.entryActionButton}
                aria-label={`Delegate issue #${issue.number}`}
                onClick={() => {
                  if (onDelegateIssue) {
                    void onDelegateIssue(issue);
                    return;
                  }
                  void onStartTask?.(issue);
                }}
                disabled={!onStartTask && !onDelegateIssue}
              >
                Delegate
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type GitPullRequestsModeContentProps = {
  pullRequestsError: string | null | undefined;
  pullRequestsLoading: boolean;
  pullRequests: GitHubPullRequest[];
  onStartTask?: (pullRequest: GitHubPullRequest) => void | Promise<void>;
  selectedPullRequest: number | null;
  onSelectPullRequest?: (pullRequest: GitHubPullRequest) => void;
  onDelegatePullRequest?: (pullRequest: GitHubPullRequest) => void;
  onShowPullRequestMenu: (
    event: ReactMouseEvent<HTMLElement>,
    pullRequest: GitHubPullRequest
  ) => void;
};

export function GitPullRequestsModeContent({
  pullRequestsError,
  pullRequestsLoading,
  pullRequests,
  onStartTask,
  selectedPullRequest,
  onSelectPullRequest,
  onDelegatePullRequest,
  onShowPullRequestMenu,
}: GitPullRequestsModeContentProps) {
  return (
    <div className={joinClassNames(styles.list, "git-pr-list")}>
      {!pullRequestsError && !pullRequestsLoading && !pullRequests.length && (
        <div className={styles.diffEmpty}>No open pull requests.</div>
      )}
      {pullRequests.map((pullRequest) => {
        const relativeTime = formatRelativeTime(new Date(pullRequest.updatedAt).getTime());
        const author = pullRequest.author?.login ?? "unknown";
        const isSelected = selectedPullRequest === pullRequest.number;

        return (
          <div
            key={pullRequest.number}
            className={joinClassNames(styles.pullRequestEntry, "git-pr-entry")}
            data-selected={isSelected ? "true" : "false"}
          >
            <button
              type="button"
              className={styles.pullRequestSelectButton}
              aria-pressed={isSelected}
              onClick={() => onSelectPullRequest?.(pullRequest)}
              onContextMenu={(event) => onShowPullRequestMenu(event, pullRequest)}
            >
              <div className={joinClassNames(styles.pullRequestHeader, "git-pr-header")}>
                <span className={joinClassNames(styles.pullRequestTitle, "git-pr-title")}>
                  <span className={joinClassNames(styles.pullRequestNumber, "git-pr-number")}>
                    #{pullRequest.number}
                  </span>
                  <span
                    className={joinClassNames(styles.pullRequestTitleText, "git-pr-title-text")}
                  >
                    {pullRequest.title}{" "}
                    <span
                      className={joinClassNames(styles.pullRequestAuthor, "git-pr-author-inline")}
                    >
                      @{author}
                    </span>
                  </span>
                </span>
                <span className={joinClassNames(styles.pullRequestTime, "git-pr-time")}>
                  {relativeTime}
                </span>
              </div>
              <div className={joinClassNames(styles.pullRequestMeta, "git-pr-meta")}>
                {pullRequest.isDraft && <StatusBadge>Draft</StatusBadge>}
              </div>
            </button>
            <div className={styles.entryActions}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={styles.entryActionButton}
                aria-label={`Open pull request #${pullRequest.number} on GitHub`}
                onClick={() => {
                  void openExternalIssueUrl(pullRequest.url);
                }}
              >
                Open
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={styles.entryActionButton}
                aria-label={`Delegate PR #${pullRequest.number}`}
                onClick={() => {
                  if (onDelegatePullRequest) {
                    void onDelegatePullRequest(pullRequest);
                    return;
                  }
                  void onStartTask?.(pullRequest);
                }}
                disabled={!onStartTask && !onDelegatePullRequest}
              >
                Delegate
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
