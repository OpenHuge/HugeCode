import type { FileDiffMetadata } from "@pierre/diffs";
import { parsePatchFiles } from "@pierre/diffs";
import { FileDiff, WorkerPoolContextProvider } from "@pierre/diffs/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import GitCommitHorizontal from "lucide-react/dist/esm/icons/git-commit-horizontal";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GovernedGitHubFollowUpPreview } from "../../../application/runtime/facades/githubSourceLaunchPreview";
import { isTauri } from "../../../application/runtime/ports/desktopHostCore";
import { ask } from "../../../application/runtime/ports/desktopHostDialogs";
import * as styles from "./GitDiffViewer.styles.css";
import "./GitDiffViewer.global.css";
import { Button } from "../../../design-system";
import { Badge } from "../../../design-system";
import { CardDescription, CardTitle } from "../../../design-system";
import { Surface } from "../../../design-system";
import type { GitDiffScope, GitHubPullRequest, GitHubPullRequestComment } from "../../../types";
import { workerFactory } from "../../../utils/diffsWorker";
import { formatRelativeTime } from "../../../utils/time";
import {
  DIFF_VIEWER_HIGHLIGHTER_OPTIONS,
  DIFF_VIEWER_SCROLL_CSS,
} from "../../design-system/diff/diffViewerTheme";
import { Markdown } from "../../messages/components/Markdown";
import { getDiffStatusBadgeTone, getDiffStatusLabel, splitPath } from "./GitDiffPanel.utils";
import { GitHubFollowUpPreview } from "./GitHubFollowUpPreview";
import { ImageDiffCard } from "./ImageDiffCard";
import { getGitDiffEmptyStateCopy } from "./gitDiffViewerEmptyState";

type GitDiffViewerItem = {
  path: string;
  status: string;
  diff: string;
  scope?: GitDiffScope;
  oldLines?: string[];
  newLines?: string[];
  isImage?: boolean;
  oldImageData?: string | null;
  newImageData?: string | null;
  oldImageMime?: string | null;
  newImageMime?: string | null;
};

type GitDiffViewerProps = {
  diffs: GitDiffViewerItem[];
  selectedPath: string | null;
  scrollRequestId?: number;
  isLoading: boolean;
  error: string | null;
  diffStyle?: "split" | "unified";
  ignoreWhitespaceChanges?: boolean;
  pullRequest?: GitHubPullRequest | null;
  pullRequestComments?: GitHubPullRequestComment[];
  pullRequestCommentsLoading?: boolean;
  pullRequestCommentsError?: string | null;
  onStartTaskFromGitHubPullRequestReviewFollowUp?: (
    pullRequest: GitHubPullRequest,
    comment: GitHubPullRequestComment
  ) => Promise<void> | void;
  getGitHubPullRequestReviewFollowUpPreview?: (
    pullRequest: GitHubPullRequest,
    comment: GitHubPullRequestComment
  ) => GovernedGitHubFollowUpPreview;
  canRevert?: boolean;
  onRevertFile?: (path: string) => Promise<void> | void;
  onActivePathChange?: (path: string) => void;
  hasRepositoryContext?: boolean;
};

function normalizePatchName(name: string) {
  if (!name) {
    return name;
  }
  return name.replace(/^(?:a|b)\//, "");
}

function cx(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function getDiffEntryKey(entry: Pick<GitDiffViewerItem, "path" | "scope">) {
  return `${entry.path}::${entry.scope ?? "default"}`;
}

function getDiffScopeLabel(scope: GitDiffScope | undefined) {
  if (scope === "staged") {
    return "Staged";
  }
  if (scope === "unstaged") {
    return "Unstaged";
  }
  return null;
}

type DiffCardProps = {
  entry: GitDiffViewerItem;
  isSelected: boolean;
  diffStyle: "split" | "unified";
  isLoading: boolean;
  ignoreWhitespaceChanges: boolean;
  showRevert: boolean;
  onRequestRevert?: (path: string) => void;
};

const DiffCard = memo(function DiffCard({
  entry,
  isSelected,
  diffStyle,
  isLoading,
  ignoreWhitespaceChanges,
  showRevert,
  onRequestRevert,
}: DiffCardProps) {
  const { name: fileName, dir } = useMemo(() => splitPath(entry.path), [entry.path]);
  const displayDir = dir ? `${dir}/` : "";
  const diffOptions = useMemo(
    () => ({
      diffStyle,
      hunkSeparators: "line-info" as const,
      overflow: "scroll" as const,
      unsafeCSS: DIFF_VIEWER_SCROLL_CSS,
      disableFileHeader: true,
    }),
    [diffStyle]
  );

  const fileDiff = useMemo(() => {
    if (!entry.diff.trim()) {
      return null;
    }
    const patch = parsePatchFiles(entry.diff);
    const parsed = patch[0]?.files[0];
    if (!parsed) {
      return null;
    }
    const normalizedName = normalizePatchName(parsed.name || entry.path);
    const normalizedPrevName = parsed.prevName ? normalizePatchName(parsed.prevName) : undefined;
    return {
      ...parsed,
      name: normalizedName,
      prevName: normalizedPrevName,
      oldLines: entry.oldLines,
      newLines: entry.newLines,
    } satisfies FileDiffMetadata;
  }, [entry.diff, entry.newLines, entry.oldLines, entry.path]);

  const placeholder = useMemo(() => {
    if (isLoading) {
      return "Loading diff...";
    }
    if (ignoreWhitespaceChanges && !entry.diff.trim()) {
      return "No non-whitespace changes.";
    }
    return "Diff unavailable.";
  }, [entry.diff, ignoreWhitespaceChanges, isLoading]);
  const scopeLabel = getDiffScopeLabel(entry.scope);
  const canDiscardScope = showRevert && entry.scope !== "staged";

  return (
    <div
      data-diff-path={entry.path}
      data-diff-scope={entry.scope ?? "default"}
      className={cx(styles.item, isSelected && styles.itemActive)}
    >
      <div className={styles.header}>
        <Badge
          className={styles.status}
          tone={getDiffStatusBadgeTone(entry.status)}
          shape="chip"
          size="md"
        >
          {getDiffStatusLabel(entry.status)}
        </Badge>
        {scopeLabel ? (
          <Badge className={styles.scopeBadge} tone="neutral" shape="chip" size="sm">
            {scopeLabel}
          </Badge>
        ) : null}
        <span className={styles.path} title={entry.path}>
          <span className={styles.name}>{fileName}</span>
          {displayDir && <span className={styles.dir}>{displayDir}</span>}
        </span>
        {canDiscardScope && (
          <button
            type="button"
            className={cx(styles.headerAction, styles.headerActionDiscard)}
            title="Discard changes in this file"
            aria-label="Discard changes in this file"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRequestRevert?.(entry.path);
            }}
          >
            <RotateCcw size={14} aria-hidden />
          </button>
        )}
      </div>
      {entry.diff.trim().length > 0 && fileDiff ? (
        <div className={cx(styles.output, styles.outputFlat)}>
          <FileDiff fileDiff={fileDiff} options={diffOptions} className="git-diff-container" />
        </div>
      ) : (
        <div className={styles.placeholder}>{placeholder}</div>
      )}
    </div>
  );
});

type PullRequestSummaryProps = {
  pullRequest: GitHubPullRequest;
  hasDiffs: boolean;
  diffStats: { additions: number; deletions: number };
  onJumpToFirstFile: () => void;
  pullRequestComments?: GitHubPullRequestComment[];
  pullRequestCommentsLoading: boolean;
  pullRequestCommentsError?: string | null;
  onStartTaskFromGitHubPullRequestReviewFollowUp?: (
    pullRequest: GitHubPullRequest,
    comment: GitHubPullRequestComment
  ) => Promise<void> | void;
  getGitHubPullRequestReviewFollowUpPreview?: (
    pullRequest: GitHubPullRequest,
    comment: GitHubPullRequestComment
  ) => GovernedGitHubFollowUpPreview;
};

const PullRequestSummary = memo(function PullRequestSummary({
  pullRequest,
  hasDiffs,
  diffStats,
  onJumpToFirstFile,
  pullRequestComments,
  pullRequestCommentsLoading,
  pullRequestCommentsError,
  onStartTaskFromGitHubPullRequestReviewFollowUp,
  getGitHubPullRequestReviewFollowUpPreview,
}: PullRequestSummaryProps) {
  const prUpdatedLabel = pullRequest.updatedAt
    ? formatRelativeTime(new Date(pullRequest.updatedAt).getTime())
    : null;
  const prAuthor = pullRequest.author?.login ?? "unknown";
  const prBody = pullRequest.body?.trim() ?? "";
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);
  const sortedComments = useMemo(() => {
    if (!pullRequestComments?.length) {
      return [];
    }
    return [...pullRequestComments].sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [pullRequestComments]);
  const visibleCommentCount = 3;
  const visibleComments = isTimelineExpanded
    ? sortedComments
    : sortedComments.slice(-visibleCommentCount);
  const hiddenCommentCount = Math.max(0, sortedComments.length - visibleComments.length);

  // oxlint-disable-next-line react/exhaustive-deps -- collapse timeline when selected pull request number changes.
  useEffect(() => {
    setIsTimelineExpanded(false);
  }, [pullRequest.number]);

  return (
    <Surface
      className={styles.pullRequestSummary}
      aria-label="Pull request summary"
      padding="lg"
      tone="elevated"
    >
      <div className={styles.pullRequestHeader}>
        <div className={styles.pullRequestHeaderRow}>
          <div className={styles.pullRequestTitle}>
            <span className={styles.pullRequestNumber}>#{pullRequest.number}</span>
            <CardTitle className={styles.pullRequestTitleText}>{pullRequest.title}</CardTitle>
          </div>
          {hasDiffs && (
            <Button
              variant="ghost"
              size="sm"
              className={styles.pullRequestJump}
              onClick={onJumpToFirstFile}
              aria-label="Jump to first file"
            >
              <span className={styles.pullRequestJumpAdd}>+{diffStats.additions}</span>
              <span className={styles.pullRequestJumpSeparator}>/</span>
              <span className={styles.pullRequestJumpDelete}>-{diffStats.deletions}</span>
            </Button>
          )}
        </div>
        <div className={styles.pullRequestMeta}>
          <span className={styles.pullRequestAuthor}>@{prAuthor}</span>
          {prUpdatedLabel && (
            <>
              <span className={styles.pullRequestSeparator}>·</span>
              <span>{prUpdatedLabel}</span>
            </>
          )}
          <span className={styles.pullRequestSeparator}>·</span>
          <Badge className={styles.pullRequestBranch} tone="neutral" shape="chip" size="md">
            {pullRequest.baseRefName} ← {pullRequest.headRefName}
          </Badge>
          {pullRequest.isDraft && (
            <Badge className={styles.pullRequestPill} tone="warning" shape="chip" size="md">
              Draft
            </Badge>
          )}
        </div>
      </div>
      <div className={styles.pullRequestBody}>
        {prBody ? (
          <Markdown value={prBody} className={cx(styles.pullRequestMarkdown, "markdown")} />
        ) : (
          <CardDescription className={styles.pullRequestEmpty}>
            No description provided.
          </CardDescription>
        )}
      </div>
      <div className={styles.pullRequestTimeline}>
        <div className={styles.pullRequestTimelineHeader}>
          <CardTitle className={styles.pullRequestTimelineTitle}>Activity</CardTitle>
          <span className={styles.pullRequestTimelineCount}>
            {sortedComments.length} comment
            {sortedComments.length === 1 ? "" : "s"}
          </span>
          {hiddenCommentCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className={styles.pullRequestTimelineButton}
              onClick={() => setIsTimelineExpanded(true)}
            >
              Show all
            </Button>
          )}
          {isTimelineExpanded && sortedComments.length > visibleCommentCount && (
            <Button
              variant="ghost"
              size="sm"
              className={styles.pullRequestTimelineButton}
              onClick={() => setIsTimelineExpanded(false)}
            >
              Collapse
            </Button>
          )}
        </div>
        <div className={styles.pullRequestTimelineList}>
          {pullRequestCommentsLoading && (
            <div className={styles.pullRequestTimelineState}>Loading comments…</div>
          )}
          {pullRequestCommentsError && (
            <div className={cx(styles.pullRequestTimelineState, styles.pullRequestTimelineError)}>
              {pullRequestCommentsError}
            </div>
          )}
          {!pullRequestCommentsLoading && !pullRequestCommentsError && !sortedComments.length && (
            <CardDescription className={styles.pullRequestTimelineState}>
              No comments yet.
            </CardDescription>
          )}
          {hiddenCommentCount > 0 && !isTimelineExpanded && (
            <div className={styles.pullRequestTimelineDivider}>
              {hiddenCommentCount} earlier comment
              {hiddenCommentCount === 1 ? "" : "s"}
            </div>
          )}
          {visibleComments.map((comment) => {
            const commentAuthor = comment.author?.login ?? "unknown";
            const commentTime = formatRelativeTime(new Date(comment.createdAt).getTime());
            const followUpPreview =
              getGitHubPullRequestReviewFollowUpPreview?.(pullRequest, comment) ?? null;
            return (
              <div key={comment.id} className={styles.pullRequestTimelineItem}>
                <div className={styles.pullRequestTimelineMarker} />
                <div className={styles.pullRequestTimelineContent}>
                  <div className={styles.pullRequestTimelineMeta}>
                    <span className={styles.pullRequestTimelineAuthor}>@{commentAuthor}</span>
                    <span className={styles.pullRequestSeparator}>·</span>
                    <span>{commentTime}</span>
                    {onStartTaskFromGitHubPullRequestReviewFollowUp ? (
                      <>
                        <span className={styles.pullRequestSeparator}>·</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            void onStartTaskFromGitHubPullRequestReviewFollowUp(
                              pullRequest,
                              comment
                            );
                          }}
                        >
                          Follow up
                        </Button>
                      </>
                    ) : null}
                  </div>
                  {comment.body.trim() ? (
                    <Markdown
                      value={comment.body}
                      className={cx(styles.pullRequestComment, "markdown")}
                    />
                  ) : (
                    <CardDescription className={styles.pullRequestTimelineText}>
                      No comment body.
                    </CardDescription>
                  )}
                  {followUpPreview ? (
                    <GitHubFollowUpPreview
                      preview={followUpPreview}
                      className={styles.pullRequestTimelinePreview}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Surface>
  );
});

export function GitDiffViewer({
  diffs,
  selectedPath,
  scrollRequestId,
  isLoading,
  error,
  diffStyle = "split",
  ignoreWhitespaceChanges = false,
  pullRequest,
  pullRequestComments,
  pullRequestCommentsLoading = false,
  pullRequestCommentsError = null,
  onStartTaskFromGitHubPullRequestReviewFollowUp,
  getGitHubPullRequestReviewFollowUpPreview,
  canRevert = false,
  onRevertFile,
  onActivePathChange,
  hasRepositoryContext = true,
}: GitDiffViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const activePathRef = useRef<string | null>(null);
  const ignoreActivePathUntilRef = useRef<number>(0);
  const lastScrollRequestIdRef = useRef<number | null>(null);
  const onActivePathChangeRef = useRef(onActivePathChange);
  const rowResizeObserversRef = useRef(new Map<Element, ResizeObserver>());
  const rowNodesByPathRef = useRef(new Map<string, HTMLDivElement>());
  const hasActivePathHandler = Boolean(onActivePathChange);
  const poolOptions = useMemo(() => ({ workerFactory }), []);
  const highlighterOptions = useMemo(() => DIFF_VIEWER_HIGHLIGHTER_OPTIONS, []);
  const indexByPath = useMemo(() => {
    const map = new Map<string, number>();
    diffs.forEach((entry, index) => {
      if (!map.has(entry.path)) {
        map.set(entry.path, index);
      }
    });
    return map;
  }, [diffs]);
  const rowVirtualizer = useVirtualizer({
    count: diffs.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 260,
    overscan: 6,
    getItemKey: (index) => getDiffEntryKey(diffs[index]),
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const virtualHeight = rowVirtualizer.getTotalSize();
  const setRowRef = useCallback(
    (rowKey: string) => (node: HTMLDivElement | null) => {
      const prevNode = rowNodesByPathRef.current.get(rowKey);
      if (prevNode && prevNode !== node) {
        const prevObserver = rowResizeObserversRef.current.get(prevNode);
        if (prevObserver) {
          prevObserver.disconnect();
          rowResizeObserversRef.current.delete(prevNode);
        }
      }
      if (!node) {
        rowNodesByPathRef.current.delete(rowKey);
        return;
      }
      rowNodesByPathRef.current.set(rowKey, node);
      rowVirtualizer.measureElement(node);
      if (rowResizeObserversRef.current.has(node)) {
        return;
      }
      const observer = new ResizeObserver(() => {
        rowVirtualizer.measureElement(node);
      });
      observer.observe(node);
      rowResizeObserversRef.current.set(node, observer);
    },
    [rowVirtualizer]
  );
  const setVirtualRowRef = useCallback(
    (rowKey: string, start: number) => (node: HTMLDivElement | null) => {
      setRowRef(rowKey)(node);
      if (!node) {
        return;
      }
      node.style.setProperty("--diff-viewer-row-offset", `${start}px`);
    },
    [setRowRef]
  );
  const stickyEntry = useMemo(() => {
    if (!diffs.length) {
      return null;
    }
    if (selectedPath) {
      const index = indexByPath.get(selectedPath);
      if (index !== undefined) {
        return diffs[index];
      }
    }
    return diffs[0];
  }, [diffs, selectedPath, indexByPath]);
  const stickyPathDisplay = useMemo(() => {
    if (!stickyEntry) {
      return null;
    }
    const { name, dir } = splitPath(stickyEntry.path);
    return { fileName: name, displayDir: dir ? `${dir}/` : "" };
  }, [stickyEntry]);

  const showRevert = canRevert && Boolean(onRevertFile);
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

  const handleRequestRevert = useCallback(
    async (path: string) => {
      if (!onRevertFile) {
        return;
      }
      const confirmed = await confirmWarning(
        `Discard changes in:\n\n${path}\n\nThis cannot be undone.`,
        "Discard changes"
      );
      if (!confirmed) {
        return;
      }
      await onRevertFile(path);
    },
    [confirmWarning, onRevertFile]
  );

  useEffect(() => {
    if (!selectedPath || !scrollRequestId) {
      return;
    }
    if (lastScrollRequestIdRef.current === scrollRequestId) {
      return;
    }
    const index = indexByPath.get(selectedPath);
    if (index === undefined) {
      return;
    }
    ignoreActivePathUntilRef.current = Date.now() + 250;
    rowVirtualizer.scrollToIndex(index, { align: "start" });
    lastScrollRequestIdRef.current = scrollRequestId;
  }, [selectedPath, scrollRequestId, indexByPath, rowVirtualizer]);

  useEffect(() => {
    const observers = rowResizeObserversRef.current;
    return () => {
      for (const observer of observers.values()) {
        observer.disconnect();
      }
      observers.clear();
    };
  }, []);

  useEffect(() => {
    activePathRef.current = selectedPath;
  }, [selectedPath]);

  useEffect(() => {
    if (!listRef.current) {
      return;
    }
    listRef.current.style.setProperty("--diff-viewer-list-height", `${virtualHeight}px`);
  }, [virtualHeight]);

  useEffect(() => {
    onActivePathChangeRef.current = onActivePathChange;
  }, [onActivePathChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasActivePathHandler) {
      return;
    }
    let frameId: number | null = null;

    const updateActivePath = () => {
      frameId = null;
      if (Date.now() < ignoreActivePathUntilRef.current) {
        return;
      }
      const items = rowVirtualizer.getVirtualItems();
      if (!items.length) {
        return;
      }
      const scrollTop = container.scrollTop;
      const canScroll = container.scrollHeight > container.clientHeight;
      const isAtBottom =
        canScroll && scrollTop + container.clientHeight >= container.scrollHeight - 4;
      let nextPath: string | undefined;
      if (isAtBottom) {
        nextPath = diffs[diffs.length - 1]?.path;
      } else {
        const targetOffset = scrollTop + 8;
        let activeItem = items[0];
        for (const item of items) {
          if (item.start <= targetOffset) {
            activeItem = item;
          } else {
            break;
          }
        }
        nextPath = diffs[activeItem.index]?.path;
      }
      if (!nextPath || nextPath === activePathRef.current) {
        return;
      }
      activePathRef.current = nextPath;
      onActivePathChangeRef.current?.(nextPath);
    };

    const handleScroll = () => {
      if (frameId !== null) {
        return;
      }
      frameId = requestAnimationFrame(updateActivePath);
    };

    handleScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      container.removeEventListener("scroll", handleScroll);
    };
  }, [diffs, rowVirtualizer, hasActivePathHandler]);

  const diffStats = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    for (const entry of diffs) {
      const lines = entry.diff.split("\n");
      for (const line of lines) {
        if (!line) {
          continue;
        }
        if (
          line.startsWith("+++") ||
          line.startsWith("---") ||
          line.startsWith("diff --git") ||
          line.startsWith("@@") ||
          line.startsWith("index ") ||
          line.startsWith("\\ No newline")
        ) {
          continue;
        }
        if (line.startsWith("+")) {
          additions += 1;
        } else if (line.startsWith("-")) {
          deletions += 1;
        }
      }
    }
    return { additions, deletions };
  }, [diffs]);
  const handleScrollToFirstFile = useCallback(() => {
    if (!diffs.length) {
      return;
    }
    const container = containerRef.current;
    const list = listRef.current;
    if (container && list) {
      const top = list.offsetTop;
      container.scrollTo({ top, behavior: "smooth" });
      return;
    }
    rowVirtualizer.scrollToIndex(0, { align: "start" });
  }, [diffs.length, rowVirtualizer]);
  const emptyStateCopy = getGitDiffEmptyStateCopy({
    hasRepositoryContext,
    hasPullRequestSelection: Boolean(pullRequest),
  });

  return (
    <WorkerPoolContextProvider poolOptions={poolOptions} highlighterOptions={highlighterOptions}>
      <div className={cx(styles.viewer, "ds-diff-viewer")} ref={containerRef}>
        {pullRequest && (
          <PullRequestSummary
            pullRequest={pullRequest}
            hasDiffs={diffs.length > 0}
            diffStats={diffStats}
            onJumpToFirstFile={handleScrollToFirstFile}
            pullRequestComments={pullRequestComments}
            pullRequestCommentsLoading={pullRequestCommentsLoading}
            pullRequestCommentsError={pullRequestCommentsError}
            onStartTaskFromGitHubPullRequestReviewFollowUp={
              onStartTaskFromGitHubPullRequestReviewFollowUp
            }
            getGitHubPullRequestReviewFollowUpPreview={getGitHubPullRequestReviewFollowUpPreview}
          />
        )}
        {!error && stickyEntry && (
          <div className={styles.sticky}>
            <div className={cx(styles.header, styles.stickyHeader)}>
              <Badge
                className={styles.status}
                tone={getDiffStatusBadgeTone(stickyEntry.status)}
                shape="chip"
                size="md"
              >
                {getDiffStatusLabel(stickyEntry.status)}
              </Badge>
              {getDiffScopeLabel(stickyEntry.scope) ? (
                <Badge className={styles.scopeBadge} tone="neutral" shape="chip" size="sm">
                  {getDiffScopeLabel(stickyEntry.scope)}
                </Badge>
              ) : null}
              <span className={styles.path} title={stickyEntry.path}>
                <span className={styles.name}>
                  {stickyPathDisplay?.fileName ?? stickyEntry.path}
                </span>
                {stickyPathDisplay?.displayDir && (
                  <span className={styles.dir}>{stickyPathDisplay.displayDir}</span>
                )}
              </span>
              {showRevert && stickyEntry.scope !== "staged" && (
                <button
                  type="button"
                  className={cx(styles.headerAction, styles.headerActionDiscard)}
                  title="Discard changes in this file"
                  aria-label="Discard changes in this file"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void handleRequestRevert(stickyEntry.path);
                  }}
                >
                  <RotateCcw size={14} aria-hidden />
                </button>
              )}
            </div>
          </div>
        )}
        {error && <div className={styles.empty}>{error}</div>}
        {!error && isLoading && diffs.length > 0 && (
          <div className={cx(styles.loading, styles.loadingOverlay)}>Refreshing diff...</div>
        )}
        {!error && !isLoading && !diffs.length && (
          <div className={styles.emptyState} aria-live="polite">
            <div className={styles.emptyGlow} aria-hidden />
            <span className={styles.emptyIcon} aria-hidden>
              <GitCommitHorizontal size={18} />
            </span>
            <h3 className={styles.emptyTitle}>{emptyStateCopy.title}</h3>
            <p className={styles.emptySubtitle}>{emptyStateCopy.subtitle}</p>
            <p className={styles.emptyHint}>{emptyStateCopy.hint}</p>
          </div>
        )}
        {!error && diffs.length > 0 && (
          <div className={styles.list} ref={listRef}>
            {virtualItems.map((virtualRow) => {
              const entry = diffs[virtualRow.index];
              return (
                <div
                  key={getDiffEntryKey(entry)}
                  className={styles.row}
                  data-index={virtualRow.index}
                  ref={setVirtualRowRef(getDiffEntryKey(entry), virtualRow.start)}
                >
                  {entry.isImage ? (
                    <ImageDiffCard
                      path={entry.path}
                      status={entry.status}
                      oldImageData={entry.oldImageData}
                      newImageData={entry.newImageData}
                      oldImageMime={entry.oldImageMime}
                      newImageMime={entry.newImageMime}
                      isSelected={entry.path === selectedPath}
                      showRevert={showRevert}
                      onRequestRevert={(path) => void handleRequestRevert(path)}
                    />
                  ) : (
                    <DiffCard
                      entry={entry}
                      isSelected={entry.path === selectedPath}
                      diffStyle={diffStyle}
                      isLoading={isLoading}
                      ignoreWhitespaceChanges={ignoreWhitespaceChanges}
                      showRevert={showRevert}
                      onRequestRevert={(path) => void handleRequestRevert(path)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </WorkerPoolContextProvider>
  );
}
