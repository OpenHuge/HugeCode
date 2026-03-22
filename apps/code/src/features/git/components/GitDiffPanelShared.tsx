import Check from "lucide-react/dist/esm/icons/check";
import Minus from "lucide-react/dist/esm/icons/minus";
import Plus from "lucide-react/dist/esm/icons/plus";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import Upload from "lucide-react/dist/esm/icons/upload";
import X from "lucide-react/dist/esm/icons/x";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Button } from "../../../design-system";
import { Badge } from "../../../design-system";
import { Tooltip } from "../../../design-system";
import type { GitLogEntry } from "../../../types";
import { joinClassNames } from "../../../utils/classNames";
import { formatRelativeTime } from "../../../utils/time";
import {
  InspectorSectionBody,
  InspectorSectionGroup,
  InspectorSectionHeader,
} from "../../right-panel/RightPanelPrimitives";
import {
  getDiffStatusBadgeTone,
  getStatusSymbol,
  getStatusTone,
  splitNameAndExtension,
  splitPath,
} from "./GitDiffPanel.utils";
import * as styles from "./GitDiffPanelShared.styles.css";

export type DiffFile = {
  path: string;
  status: string;
  additions: number;
  deletions: number;
};

export type SidebarErrorAction = {
  label: string;
  onAction: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
};

type CommitButtonProps = {
  commitMessage: string;
  hasStagedFiles: boolean;
  hasUnstagedFiles: boolean;
  commitLoading: boolean;
  onCommit?: () => void | Promise<void>;
};

export function CommitButton({
  commitMessage,
  hasStagedFiles,
  hasUnstagedFiles,
  commitLoading,
  onCommit,
}: CommitButtonProps) {
  const hasMessage = commitMessage.trim().length > 0;
  const hasChanges = hasStagedFiles || hasUnstagedFiles;
  const canCommit = hasMessage && hasChanges && !commitLoading;

  const handleCommit = () => {
    if (canCommit) {
      void onCommit?.();
    }
  };

  return (
    <div className={joinClassNames(styles.commitButtonContainer, "commit-button-container")}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={joinClassNames(styles.commitButton, "commit-button")}
        onClick={handleCommit}
        disabled={!canCommit}
        title={
          !hasMessage
            ? "Enter a commit message"
            : !hasChanges
              ? "No changes to commit"
              : hasStagedFiles
                ? "Commit staged changes"
                : "Commit all unstaged changes"
        }
      >
        {commitLoading ? (
          <span
            className={joinClassNames(styles.commitButtonSpinner, "commit-button-spinner")}
            aria-hidden
          />
        ) : (
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <title>Commit</title>
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
        <span>{commitLoading ? "Committing..." : "Commit"}</span>
      </Button>
    </div>
  );
}

type SidebarErrorProps = {
  variant?: "diff" | "commit";
  message: string;
  action?: SidebarErrorAction | null;
  onDismiss: () => void;
};

export function SidebarError({ variant = "diff", message, action, onDismiss }: SidebarErrorProps) {
  return (
    <div
      className={joinClassNames(styles.sidebarError, "sidebar-error", `sidebar-error-${variant}`)}
    >
      <div className={joinClassNames(styles.sidebarErrorBody, "sidebar-error-body")}>
        <div
          className={joinClassNames(
            styles.sidebarErrorMessage,
            variant === "commit" ? "commit-message-error" : "diff-error",
            variant === "diff" ? styles.diffError : styles.commitError
          )}
        >
          {message}
        </div>
        {action && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={joinClassNames(styles.sidebarErrorAction, "sidebar-error-action")}
            onClick={() => void action.onAction()}
            disabled={action.disabled || action.loading}
          >
            {action.loading && (
              <span
                className={joinClassNames(styles.commitButtonSpinner, "commit-button-spinner")}
                aria-hidden
              />
            )}
            <span>{action.label}</span>
          </Button>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={joinClassNames(styles.sidebarErrorDismiss, "sidebar-error-dismiss")}
        onClick={onDismiss}
        aria-label="Dismiss error"
        title="Dismiss error"
      >
        <X size={12} aria-hidden />
      </Button>
    </div>
  );
}

type DiffFileRowProps = {
  file: DiffFile;
  isSelected: boolean;
  isActive: boolean;
  section: "staged" | "unstaged";
  onClick: (event: ReactMouseEvent<HTMLElement>) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onStageFile?: (path: string) => Promise<void> | void;
  onUnstageFile?: (path: string) => Promise<void> | void;
  onDiscardFile?: (path: string) => Promise<void> | void;
};

function DiffFileRow({
  file,
  isSelected,
  isActive,
  section,
  onClick,
  onContextMenu,
  onStageFile,
  onUnstageFile,
  onDiscardFile,
}: DiffFileRowProps) {
  const { name, dir } = splitPath(file.path);
  const { base, extension } = splitNameAndExtension(name);
  const statusSymbol = getStatusSymbol(file.status);
  const statusTone = getStatusTone(file.status);
  const statusToneClass = styles.diffIconTone[statusTone];
  const showStage = section === "unstaged" && Boolean(onStageFile);
  const showUnstage = section === "staged" && Boolean(onUnstageFile);
  const showDiscard = section === "unstaged" && Boolean(onDiscardFile);
  const diffCountLabel = `+${file.additions} / -${file.deletions}`;

  return (
    <div
      className={styles.diffRow}
      data-git-diff-row="true"
      data-active={isActive ? "true" : "false"}
      data-selected={isSelected ? "true" : "false"}
      onContextMenu={onContextMenu}
    >
      <button type="button" className={styles.diffRowButton} onClick={onClick}>
        <span className={joinClassNames(styles.diffIcon, statusToneClass)} aria-hidden>
          {statusSymbol}
        </span>
        <div className={styles.diffFile}>
          <div className={styles.diffPath}>
            <span className={styles.diffName}>
              <span className={styles.diffNameBase}>{base}</span>
              {extension && <span className={styles.diffNameExt}>.{extension}</span>}
            </span>
          </div>
          {dir && <div className={styles.diffDir}>{dir}</div>}
        </div>
        <Badge
          className={styles.diffCountsInline}
          tone={getDiffStatusBadgeTone(file.status)}
          shape="chip"
          size="md"
          title={diffCountLabel}
        >
          {diffCountLabel}
        </Badge>
      </button>
      <div className={styles.diffRowMeta}>
        <div className={joinClassNames(styles.diffRowActions, styles.diffRowActionsVisible)}>
          {showStage && (
            <Tooltip content="Stage Changes">
              <button
                type="button"
                className={joinClassNames(styles.diffRowAction, styles.diffRowActionTone.stage)}
                data-git-diff-action="stage"
                onClick={(event) => {
                  event.stopPropagation();
                  void onStageFile?.(file.path);
                }}
                aria-label="Stage file"
              >
                <Plus size={12} aria-hidden />
              </button>
            </Tooltip>
          )}
          {showUnstage && (
            <Tooltip content="Unstage Changes">
              <button
                type="button"
                className={joinClassNames(styles.diffRowAction, styles.diffRowActionTone.unstage)}
                data-git-diff-action="unstage"
                onClick={(event) => {
                  event.stopPropagation();
                  void onUnstageFile?.(file.path);
                }}
                aria-label="Unstage file"
              >
                <Minus size={12} aria-hidden />
              </button>
            </Tooltip>
          )}
          {showDiscard && (
            <Tooltip content="Discard Changes">
              <button
                type="button"
                className={joinClassNames(styles.diffRowAction, styles.diffRowActionTone.discard)}
                data-git-diff-action="discard"
                onClick={(event) => {
                  event.stopPropagation();
                  void onDiscardFile?.(file.path);
                }}
                aria-label="Discard changes"
              >
                <RotateCcw size={12} aria-hidden />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

type DiffSectionProps = {
  title: string;
  files: DiffFile[];
  section: "staged" | "unstaged";
  selectedFiles: Set<string>;
  selectedPath: string | null;
  onStageAllChanges?: () => Promise<void> | void;
  onStageFile?: (path: string) => Promise<void> | void;
  onUnstageFile?: (path: string) => Promise<void> | void;
  onDiscardFile?: (path: string) => Promise<void> | void;
  onDiscardFiles?: (paths: string[]) => Promise<void> | void;
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
};

export function DiffSection({
  title,
  files,
  section,
  selectedFiles,
  selectedPath,
  onStageAllChanges,
  onStageFile,
  onUnstageFile,
  onDiscardFile,
  onDiscardFiles,
  onFileClick,
  onShowFileMenu,
}: DiffSectionProps) {
  const filePaths = files.map((file) => file.path);
  const canStageAll =
    section === "unstaged" &&
    (Boolean(onStageAllChanges) || Boolean(onStageFile)) &&
    filePaths.length > 0;
  const canUnstageAll = section === "staged" && Boolean(onUnstageFile) && filePaths.length > 0;
  const canDiscardAll = section === "unstaged" && Boolean(onDiscardFiles) && filePaths.length > 0;
  const showSectionActions = canStageAll || canUnstageAll || canDiscardAll;

  return (
    <InspectorSectionGroup
      className={styles.diffSection}
      data-git-diff-section={section}
      data-testid={`git-diff-section-${section}`}
    >
      <InspectorSectionHeader
        title={`${title} (${files.length})`}
        actions={
          showSectionActions ? (
            <div className={styles.diffSectionHeaderActions}>
              {canStageAll && (
                <Tooltip content="Stage All Changes">
                  <button
                    type="button"
                    className={joinClassNames(styles.diffRowAction, styles.diffRowActionTone.stage)}
                    data-git-diff-action="stage-all"
                    onClick={() => {
                      if (onStageAllChanges) {
                        void onStageAllChanges();
                        return;
                      }
                      void (async () => {
                        for (const path of filePaths) {
                          await onStageFile?.(path);
                        }
                      })();
                    }}
                    aria-label="Stage all changes"
                  >
                    <Plus size={12} aria-hidden />
                  </button>
                </Tooltip>
              )}
              {canUnstageAll && (
                <Tooltip content="Unstage All Changes">
                  <button
                    type="button"
                    className={joinClassNames(
                      styles.diffRowAction,
                      styles.diffRowActionTone.unstage
                    )}
                    data-git-diff-action="unstage-all"
                    onClick={() => {
                      void (async () => {
                        for (const path of filePaths) {
                          await onUnstageFile?.(path);
                        }
                      })();
                    }}
                    aria-label="Unstage all changes"
                  >
                    <Minus size={12} aria-hidden />
                  </button>
                </Tooltip>
              )}
              {canDiscardAll && (
                <Tooltip content="Discard All Changes">
                  <button
                    type="button"
                    className={joinClassNames(
                      styles.diffRowAction,
                      styles.diffRowActionTone.discard
                    )}
                    data-git-diff-action="discard-all"
                    onClick={() => {
                      void onDiscardFiles?.(filePaths);
                    }}
                    aria-label="Discard all changes"
                  >
                    <RotateCcw size={12} aria-hidden />
                  </button>
                </Tooltip>
              )}
            </div>
          ) : null
        }
      />
      <InspectorSectionBody className={styles.diffSectionList}>
        {files.map((file) => {
          const isSelected = selectedFiles.size > 1 && selectedFiles.has(file.path);
          const isActive = selectedPath === file.path;
          return (
            <DiffFileRow
              key={`${section}-${file.path}`}
              file={file}
              isSelected={isSelected}
              isActive={isActive}
              section={section}
              onClick={(event) => onFileClick(event, file.path, section)}
              onContextMenu={(event) => onShowFileMenu(event, file.path, section)}
              onStageFile={onStageFile}
              onUnstageFile={onUnstageFile}
              onDiscardFile={onDiscardFile}
            />
          );
        })}
      </InspectorSectionBody>
    </InspectorSectionGroup>
  );
}

type GitLogEntryRowProps = {
  entry: GitLogEntry;
  isSelected: boolean;
  compact?: boolean;
  onSelect?: (entry: GitLogEntry) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
};

export function GitLogEntryRow({
  entry,
  isSelected,
  compact = false,
  onSelect,
  onContextMenu,
}: GitLogEntryRowProps) {
  return (
    <button
      type="button"
      className={joinClassNames(
        styles.gitLogEntry,
        compact ? styles.gitLogEntryCompact : null,
        "git-log-entry",
        compact ? "git-log-entry-compact" : null
      )}
      aria-pressed={isSelected}
      onClick={() => onSelect?.(entry)}
      onContextMenu={onContextMenu}
    >
      <div className={joinClassNames(styles.gitLogSummary, "git-log-summary")}>
        {entry.summary || "No message"}
      </div>
      <div className={joinClassNames(styles.gitLogMeta, "git-log-meta")}>
        <span className={joinClassNames(styles.gitLogSha, "git-log-sha")}>
          {entry.sha.slice(0, 7)}
        </span>
        <span className={joinClassNames(styles.gitLogSep, "git-log-sep")}>·</span>
        <span className="git-log-author">{entry.author || "Unknown"}</span>
        <span className={joinClassNames(styles.gitLogSep, "git-log-sep")}>·</span>
        <span className="git-log-date">{formatRelativeTime(entry.timestamp * 1000)}</span>
      </div>
    </button>
  );
}

export function WorktreeApplyIcon({ success }: { success: boolean }) {
  if (success) {
    return <Check size={12} aria-hidden />;
  }
  return <Upload size={12} aria-hidden />;
}
