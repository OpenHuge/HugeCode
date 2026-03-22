import Check from "lucide-react/dist/esm/icons/check";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Copy from "lucide-react/dist/esm/icons/copy";
import Diff from "lucide-react/dist/esm/icons/diff";
import FileDiff from "lucide-react/dist/esm/icons/file-diff";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Image from "lucide-react/dist/esm/icons/image";
import Info from "lucide-react/dist/esm/icons/info";
import Search from "lucide-react/dist/esm/icons/search";
import Terminal from "lucide-react/dist/esm/icons/terminal";
import Users from "lucide-react/dist/esm/icons/users";
import Wrench from "lucide-react/dist/esm/icons/wrench";
import X from "lucide-react/dist/esm/icons/x";
import type {
  ComponentProps,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent,
  ReactNode,
} from "react";
import { lazy, memo, Suspense, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import * as gitDiffViewerStyles from "../../git/components/GitDiffViewer.styles.css";
import {
  ActivityLogRow,
  Button,
  DiffReviewPanel,
  ExecutionStatusPill,
  executionToneFromLifecycleTone,
  formatCompactExecutionStatusLabel,
  formatExecutionStatusLabel,
  resolveExecutionTone,
  type ExecutionLifecycleTone,
  type ExecutionTone,
  ToolCallChip,
} from "../../../design-system";
import type { ConversationItem, SkillOption } from "../../../types";
import { joinClassNames } from "../../../utils/classNames";
import { languageFromPath } from "../../../utils/syntaxLanguage";
import {
  basename,
  buildToolSummary,
  exploreKindLabel,
  extractToolPlannerDiagnostics,
  formatToolDetail,
  formatCount,
  formatDurationMs,
  type CurrentTurnArtifactSummary,
  type MetaNotice,
  type MessageImage,
  normalizeMessageImageSrc,
  type ParsedReasoning,
  type ToolSummary,
  toolNameFromTitle,
  toolStatusTone,
} from "../utils/messageRenderUtils";
import { extractTimelineDiffFiles } from "../utils/timelineSurface";
import { CommandToolRow } from "./CommandToolRow";
import { FileEditView } from "./FileEditView";
import * as markdownStyles from "./Markdown.styles.css";
import * as styles from "./MessageRows.styles.css";

type MarkdownFileLinkProps = {
  skills?: SkillOption[];
  showMessageFilePath?: boolean;
  workspacePath?: string | null;
  onOpenFileLink?: (path: string) => void;
  onOpenFileLinkMenu?: (event: MouseEvent, path: string) => void;
  onOpenThreadLink?: (threadId: string) => void;
};

type WorkingIndicatorProps = {
  isThinking: boolean;
  processingStartedAt?: number | null;
  lastDurationMs?: number | null;
  hasItems: boolean;
  showTurnComplete?: boolean;
  turnCompleteStatusLabel?: string | null;
  turnCompleteDurationLabel?: string | null;
  turnCompleteKind?: "complete" | "warning" | "tool-only";
  reasoningLabel?: string | null;
  activityLabel?: string | null;
  activityDetail?: string | null;
  artifactSummary?: CurrentTurnArtifactSummary | null;
  showArtifactSummaryChips?: boolean;
  artifactActions?: Array<{
    key: string;
    label: string;
    onClick: () => void;
  }>;
  showPollingFetchStatus?: boolean;
  pollingIntervalMs?: number;
};

type MessageRowProps = MarkdownFileLinkProps & {
  item: Extract<ConversationItem, { kind: "message" }>;
  isCopied: boolean;
  onCopy: (item: Extract<ConversationItem, { kind: "message" }>) => void;
  onEdit?: (item: Extract<ConversationItem, { kind: "message" }>) => void;
  codeBlockCopyUseModifier?: boolean;
  isSelected?: boolean;
  onSelect?: (item: Extract<ConversationItem, { kind: "message" }>) => void;
};

type ReasoningRowProps = MarkdownFileLinkProps & {
  item: Extract<ConversationItem, { kind: "reasoning" }>;
  parsed: ParsedReasoning;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  isSelected?: boolean;
  onSelect?: (item: Extract<ConversationItem, { kind: "reasoning" }>) => void;
};

type ReviewRowProps = MarkdownFileLinkProps & {
  item: Extract<ConversationItem, { kind: "review" }>;
  isSelected?: boolean;
  onSelect?: (item: Extract<ConversationItem, { kind: "review" }>) => void;
};

type MetaNoticeRowProps = {
  itemId: string;
  notice: MetaNotice;
  isSelected?: boolean;
  onSelect?: () => void;
};

export type DiffRowProps = {
  item: Extract<ConversationItem, { kind: "diff" }>;
  forceExpanded?: boolean;
  onRevertAllChanges?: () => void | Promise<void>;
  isSelected?: boolean;
  onSelect?: (item: Extract<ConversationItem, { kind: "diff" }>) => void;
};

type ToolRowProps = MarkdownFileLinkProps & {
  item: Extract<ConversationItem, { kind: "tool" }>;
  isExpanded: boolean;
  isCopied: boolean;
  onToggle: (id: string) => void;
  onCopy: (id: string, text: string) => void;
  onRequestAutoScroll?: () => void;
  isSelected?: boolean;
  onSelect?: (item: Extract<ConversationItem, { kind: "tool" }>) => void;
};

type ExploreRowProps = {
  item: Extract<ConversationItem, { kind: "explore" }>;
  isSelected?: boolean;
  onSelect?: (item: Extract<ConversationItem, { kind: "explore" }>) => void;
};

const LazyDiffBlock = lazy(() =>
  import("../../git/components/DiffBlock").then((module) => ({ default: module.DiffBlock }))
);
const LazyMarkdown = lazy(() =>
  import("./Markdown").then((module) => ({ default: module.Markdown }))
);

function MarkdownFallback({ value, className }: { value: string; className?: string }) {
  if (!value) {
    return null;
  }
  return <div className={className}>{value}</div>;
}

function DeferredMarkdown(props: ComponentProps<typeof LazyMarkdown>) {
  return (
    <Suspense fallback={<MarkdownFallback value={props.value} className={props.className} />}>
      <LazyMarkdown {...props} />
    </Suspense>
  );
}

function renderSelectableTimelineContent({
  children,
  className,
  dataKind,
  dataRightPanelSelected,
  dataTone,
  onSelect,
}: {
  children: ReactNode;
  className: string;
  dataKind?: string;
  dataRightPanelSelected?: "true" | undefined;
  dataTone?: string;
  onSelect?: () => void;
}) {
  const shouldIgnoreSelectEvent = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    Boolean(
      target.closest("button, a, input, textarea, select, summary, [role='button'], [role='link']")
    );

  if (!onSelect) {
    return (
      <div
        className={className}
        data-kind={dataKind}
        data-right-panel-selected={dataRightPanelSelected}
        data-tone={dataTone}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      role="option"
      aria-selected={dataRightPanelSelected === "true"}
      tabIndex={0}
      className={joinClassNames(styles.selectableTimelineButtonReset, className)}
      data-kind={dataKind}
      data-right-panel-selected={dataRightPanelSelected}
      data-tone={dataTone}
      onClick={(event) => {
        if (shouldIgnoreSelectEvent(event.target)) {
          return;
        }
        onSelect();
      }}
      onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        onSelect();
      }}
    >
      {children}
    </div>
  );
}

const MessageImageGrid = memo(function MessageImageGrid({
  images,
  onOpen,
  hasText,
}: {
  images: MessageImage[];
  onOpen: (index: number) => void;
  hasText: boolean;
}) {
  return (
    <ul
      className={joinClassNames(
        styles.messageImageGrid,
        hasText ? styles.messageImageGridWithText : null
      )}
    >
      {images.map((image, index) => (
        <li key={`${image.src}-${index}`} className={styles.messageImageItem}>
          <button
            type="button"
            className={styles.messageImageThumb}
            onClick={() => onOpen(index)}
            aria-label={`Open image ${index + 1}`}
          >
            <img src={image.src} alt={image.label} loading="lazy" />
          </button>
        </li>
      ))}
    </ul>
  );
});

const ImageLightbox = memo(function ImageLightbox({
  images,
  activeIndex,
  onClose,
}: {
  images: MessageImage[];
  activeIndex: number;
  onClose: () => void;
}) {
  const activeImage = images[activeIndex];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!activeImage) {
    return null;
  }

  return createPortal(
    <div
      className={styles.messageImageLightbox}
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onClose();
        }
      }}
    >
      <div className={styles.messageImageLightboxContent}>
        <button
          type="button"
          className={styles.messageImageLightboxClose}
          onClick={onClose}
          aria-label="Close image preview"
        >
          <X size={16} aria-hidden />
        </button>
        <img src={activeImage.src} alt={activeImage.label} />
      </div>
    </div>,
    document.body
  );
});

function toolIconForSummary(
  item: Extract<ConversationItem, { kind: "tool" }>,
  summary: ToolSummary
) {
  if (item.toolType === "commandExecution") {
    return Terminal;
  }
  if (item.toolType === "fileChange") {
    return FileDiff;
  }
  if (item.toolType === "webSearch") {
    return Search;
  }
  if (item.toolType === "imageView") {
    return Image;
  }
  if (item.toolType === "collabToolCall") {
    return Users;
  }

  const label = summary.label.toLowerCase();
  if (label === "read") {
    return FileText;
  }
  if (label === "searched") {
    return Search;
  }

  const toolName = toolNameFromTitle(item.title).toLowerCase();
  const title = item.title.toLowerCase();
  if (toolName.includes("diff") || title.includes("diff")) {
    return Diff;
  }

  return Wrench;
}

function resolveLifecycleTone(tone: ReturnType<typeof toolStatusTone>): ExecutionLifecycleTone {
  if (tone === "completed") {
    return "completed";
  }
  if (tone === "processing") {
    return "processing";
  }
  if (tone === "failed") {
    return "failed";
  }
  return "unknown";
}

function resolveExecutionToneForValue(
  value: string | null | undefined,
  fallbackTone?: ReturnType<typeof toolStatusTone>
): ExecutionTone {
  const resolvedTone = resolveExecutionTone(value);
  if (resolvedTone) {
    return resolvedTone;
  }
  return executionToneFromLifecycleTone(resolveLifecycleTone(fallbackTone ?? "unknown"));
}

export const WorkingIndicator = memo(function WorkingIndicator({
  isThinking,
  processingStartedAt = null,
  lastDurationMs = null,
  hasItems,
  showTurnComplete = true,
  turnCompleteStatusLabel = null,
  turnCompleteDurationLabel = null,
  turnCompleteKind = "complete",
  reasoningLabel = null,
  activityLabel = null,
  activityDetail = null,
  artifactSummary = null,
  showArtifactSummaryChips = true,
  artifactActions = [],
  showPollingFetchStatus = false,
  pollingIntervalMs = 12_000,
}: WorkingIndicatorProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [pollCountdownSeconds, setPollCountdownSeconds] = useState(() =>
    Math.max(1, Math.ceil(pollingIntervalMs / 1000))
  );
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

  useEffect(() => {
    if (!isThinking || !processingStartedAt) {
      setElapsedMs(0);
      return undefined;
    }
    setElapsedMs(Date.now() - processingStartedAt);
    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - processingStartedAt);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isThinking, processingStartedAt]);

  useEffect(() => {
    if (!showPollingFetchStatus || isThinking) {
      return undefined;
    }
    const intervalSeconds = Math.max(1, Math.ceil(pollingIntervalMs / 1000));
    setPollCountdownSeconds(intervalSeconds);
    const timer = window.setInterval(() => {
      setPollCountdownSeconds((previous) => (previous <= 1 ? intervalSeconds : previous - 1));
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [isThinking, pollingIntervalMs, showPollingFetchStatus]);

  useEffect(() => {
    if (isThinking || !showTurnComplete) {
      setIsSummaryExpanded(false);
    }
  }, [isThinking, showTurnComplete]);

  const artifactSummaryLabels = useMemo(() => {
    if (!artifactSummary) {
      return [];
    }

    const labels: string[] = [];
    if (artifactSummary.changedFiles.length > 0) {
      labels.push(
        formatCount(artifactSummary.changedFiles.length, "file changed", "files changed")
      );
    }
    if (artifactSummary.reviewCount > 0) {
      labels.push(formatCount(artifactSummary.reviewCount, "review", "reviews"));
    }
    if (artifactSummary.diffCount > 0) {
      labels.push(formatCount(artifactSummary.diffCount, "diff", "diffs"));
    }
    return labels;
  }, [artifactSummary]);

  const summaryHeadline = showPollingFetchStatus
    ? "Waiting for the next sync"
    : turnCompleteStatusLabel || "Process summary";
  const summaryFragments = [activityLabel, activityDetail, ...artifactSummaryLabels].filter(
    Boolean
  );
  const summaryText =
    summaryFragments.length > 0 ? summaryFragments.slice(0, 3).join(" · ") : "Turn finished.";
  const summaryMeta = showPollingFetchStatus
    ? `Next refresh in ${pollCountdownSeconds}s`
    : turnCompleteDurationLabel ||
      (lastDurationMs !== null ? `Done in ${formatDurationMs(lastDurationMs)}` : null);
  const hasExpandableDetails =
    Boolean(activityLabel) ||
    Boolean(activityDetail) ||
    artifactSummaryLabels.length > 0 ||
    artifactActions.length > 0 ||
    Boolean(summaryMeta);
  const summaryToggleLabel = isSummaryExpanded
    ? "Collapse process summary"
    : "Expand process summary";

  return (
    <>
      {isThinking && (
        <div
          className={styles.working}
          aria-live="polite"
          data-testid="current-turn-working-indicator"
          data-current-turn-indicator-state="working"
        >
          <span className={styles.workingSpinner} aria-hidden />
          <div className={`working-text-enhanced ${styles.workingBody}`}>
            <div className={styles.workingHeader}>
              <span className={styles.workingStatus}>Working</span>
              <span className={styles.workingTimer}>
                <span className={styles.workingTimerClock}>{formatDurationMs(elapsedMs)}</span>
              </span>
              <span className={styles.workingLabel}>
                {activityLabel || reasoningLabel || "Generating response"}
              </span>
            </div>
            {activityDetail && <span className={styles.workingMeta}>{activityDetail}</span>}
          </div>
          <span className={styles.workingText}>{reasoningLabel || "Working…"}</span>
        </div>
      )}
      {!isThinking && showTurnComplete && lastDurationMs !== null && hasItems && (
        <div
          className={styles.turnComplete}
          aria-live="polite"
          data-testid="current-turn-footer"
          data-current-turn-indicator-state={turnCompleteKind}
        >
          <button
            type="button"
            className={styles.turnCompleteToggle}
            onClick={() => {
              if (hasExpandableDetails) {
                setIsSummaryExpanded((value) => !value);
              }
            }}
            aria-expanded={hasExpandableDetails ? isSummaryExpanded : undefined}
            aria-label={summaryToggleLabel}
            disabled={!hasExpandableDetails}
          >
            <span className={styles.turnCompleteStatus}>{summaryHeadline}</span>
            <span className={styles.turnCompleteSummaryText}>{summaryText}</span>
            {summaryMeta ? <span className={styles.turnCompleteMeta}>{summaryMeta}</span> : null}
            {hasExpandableDetails ? (
              <span className={styles.turnCompleteChevron} aria-hidden>
                {isSummaryExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            ) : null}
          </button>
          {isSummaryExpanded ? (
            <div className={styles.turnCompleteDetails}>
              {activityLabel || activityDetail ? (
                <div className={styles.turnCompleteDetailBlock}>
                  <span className={styles.turnCompleteDetailLabel}>Flow</span>
                  <span className={styles.turnCompleteDetailValue}>
                    {[activityLabel, activityDetail].filter(Boolean).join(" · ")}
                  </span>
                </div>
              ) : null}
              {showArtifactSummaryChips && artifactSummaryLabels.length > 0 ? (
                <div className={styles.turnCompleteDetailBlock}>
                  <span className={styles.turnCompleteDetailLabel}>Output</span>
                  <span className={styles.turnCompleteSummary}>
                    {artifactSummaryLabels.map((label) => (
                      <span key={label} className={styles.turnCompleteChip}>
                        {label}
                      </span>
                    ))}
                  </span>
                </div>
              ) : null}
              {artifactActions.length > 0 ? (
                <div className={styles.turnCompleteDetailBlock}>
                  <span className={styles.turnCompleteDetailLabel}>Follow-up</span>
                  <span className={styles.turnCompleteActions} aria-label="Turn artifact actions">
                    {artifactActions.map((action) => (
                      <button
                        key={action.key}
                        type="button"
                        className={styles.turnCompleteAction}
                        onClick={action.onClick}
                      >
                        {action.label}
                      </button>
                    ))}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </>
  );
});

export const MessageRow = memo(function MessageRow({
  item,
  isCopied,
  onCopy,
  onEdit,
  codeBlockCopyUseModifier,
  isSelected = false,
  onSelect,
  skills,
  showMessageFilePath,
  workspacePath,
  onOpenFileLink,
  onOpenFileLinkMenu,
  onOpenThreadLink,
}: MessageRowProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const hasText = item.text.trim().length > 0;
  const canEdit = hasText && item.role === "user" && Boolean(onEdit);
  const imageItems = useMemo(() => {
    if (!item.images || item.images.length === 0) {
      return [];
    }
    return item.images
      .map((image, index) => {
        const src = normalizeMessageImageSrc(image);
        if (!src) {
          return null;
        }
        return { src, label: `Image ${index + 1}` };
      })
      .filter(Boolean) as MessageImage[];
  }, [item.images]);

  return (
    <div
      className={joinClassNames(styles.message, styles.messageRoleClass[item.role])}
      data-message-role={item.role}
      data-right-panel-selected={isSelected ? "true" : undefined}
    >
      <div className={styles.messageContent}>
        <div className={styles.messageSurface}>
          {hasText && (
            <div className={styles.messageActions}>
              <Button
                variant="ghost"
                size="sm"
                className={joinClassNames(
                  styles.messageCopyButton,
                  isCopied ? styles.stateCopied : null
                )}
                onClick={() => onCopy(item)}
                aria-label="Copy message"
                title={isCopied ? "Copied" : "Copy message"}
                data-copy-state={isCopied ? "copied" : "idle"}
              >
                <span className={styles.messageCopyIcon} aria-hidden>
                  {isCopied ? (
                    <Check className={styles.messageCopyIconCheck} size={14} />
                  ) : (
                    <Copy className={styles.messageCopyIconCopy} size={14} />
                  )}
                </span>
              </Button>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.messageEditButton}
                  onClick={() => onEdit?.(item)}
                  aria-label="Edit message"
                  title="Edit message"
                >
                  <span className={styles.messageEditIcon} aria-hidden>
                    <svg viewBox="0 0 24 24" width="14" height="14" focusable="false">
                      <title>Edit message</title>
                      <path
                        d="M14.4 5.6 18.4 9.6M4 20h4l10.5-10.5a1.4 1.4 0 0 0 0-2L16.5 5.5a1.4 1.4 0 0 0-2 0L4 16z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </Button>
              )}
            </div>
          )}
          {renderSelectableTimelineContent({
            className: joinClassNames(
              styles.bubble,
              styles.messageBubble,
              onSelect ? styles.selectableTimelineItem : null,
              isSelected ? styles.selectedTimelineItem : null
            ),
            dataRightPanelSelected: isSelected ? "true" : undefined,
            onSelect: onSelect ? () => onSelect(item) : undefined,
            children: (
              <>
                <div className={styles.messageBody}>
                  {imageItems.length > 0 && (
                    <MessageImageGrid
                      images={imageItems}
                      onOpen={setLightboxIndex}
                      hasText={hasText}
                    />
                  )}
                  {hasText && (
                    <DeferredMarkdown
                      value={item.text}
                      skills={skills}
                      className={markdownStyles.markdown}
                      codeBlockStyle="message"
                      codeBlockCopyUseModifier={codeBlockCopyUseModifier}
                      showFilePath={showMessageFilePath}
                      workspacePath={workspacePath}
                      onOpenFileLink={onOpenFileLink}
                      onOpenFileLinkMenu={onOpenFileLinkMenu}
                      onOpenThreadLink={onOpenThreadLink}
                    />
                  )}
                </div>
                {lightboxIndex !== null && imageItems.length > 0 && (
                  <ImageLightbox
                    images={imageItems}
                    activeIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                  />
                )}
              </>
            ),
          })}
        </div>
      </div>
    </div>
  );
});

export const ReasoningRow = memo(function ReasoningRow({
  item,
  parsed,
  isExpanded,
  onToggle,
  isSelected = false,
  onSelect,
  skills,
  showMessageFilePath,
  workspacePath,
  onOpenFileLink,
  onOpenFileLinkMenu,
  onOpenThreadLink,
}: ReasoningRowProps) {
  const { summaryTitle, bodyText, hasBody } = parsed;
  const isThinking = !hasBody;
  const Chevron = isExpanded ? ChevronDown : ChevronRight;

  return (
    <div
      className={joinClassNames(
        styles.reasoningBlock,
        onSelect ? styles.selectableTimelineItem : null,
        isSelected ? styles.selectedTimelineItem : null
      )}
      data-right-panel-selected={isSelected ? "true" : undefined}
    >
      <button
        type="button"
        className={styles.reasoningToggle}
        onClick={() => {
          onSelect?.(item);
          onToggle(item.id);
        }}
        aria-expanded={isExpanded}
      >
        {isThinking ? (
          <span className={styles.reasoningSpinner} aria-hidden />
        ) : (
          <Chevron size={14} className={styles.reasoningChevron} aria-hidden />
        )}
        <span className={styles.reasoningTitle}>
          {summaryTitle || (isThinking ? "Thinking..." : "Thought")}
        </span>
      </button>

      {isExpanded && (
        <div className={styles.reasoningContent}>
          <div className={styles.reasoningContentHeader}>Reasoning Process</div>
          {hasBody && (
            <DeferredMarkdown
              value={bodyText}
              skills={skills}
              className={joinClassNames(markdownStyles.markdown, styles.reasoningMarkdown)}
              showFilePath={showMessageFilePath}
              workspacePath={workspacePath}
              onOpenFileLink={onOpenFileLink}
              onOpenFileLinkMenu={onOpenFileLinkMenu}
              onOpenThreadLink={onOpenThreadLink}
            />
          )}
        </div>
      )}
    </div>
  );
});

export const ReviewRow = memo(function ReviewRow({
  item,
  isSelected: _isSelected = false,
  onSelect: _onSelect,
  skills,
  showMessageFilePath,
  workspacePath,
  onOpenFileLink,
  onOpenFileLinkMenu,
  onOpenThreadLink,
}: ReviewRowProps) {
  const title = item.state === "started" ? "Review started" : "Review completed";
  const statusLabel = formatExecutionStatusLabel(item.state);
  const statusTone = resolveExecutionToneForValue(item.state);
  return (
    <ActivityLogRow
      className={styles.review}
      data-timeline-item-id={item.id}
      data-artifact-kind="review"
      tone={statusTone}
      icon={<FileText size={15} />}
      title={title}
      meta={
        <>
          <ToolCallChip tone="neutral">Review</ToolCallChip>
          {statusLabel ? (
            <ExecutionStatusPill tone={statusTone} showDot>
              {statusLabel}
            </ExecutionStatusPill>
          ) : null}
        </>
      }
      body={
        item.text ? (
          <DeferredMarkdown
            value={item.text}
            skills={skills}
            className={joinClassNames(styles.itemText, markdownStyles.markdown)}
            showFilePath={showMessageFilePath}
            workspacePath={workspacePath}
            onOpenFileLink={onOpenFileLink}
            onOpenFileLinkMenu={onOpenFileLinkMenu}
            onOpenThreadLink={onOpenThreadLink}
          />
        ) : null
      }
    />
  );
});

const META_NOTICE_LABELS: Record<MetaNotice["noticeType"], string> = {
  modelSwitch: "模型",
  reasoningChange: "推理",
  permissionChange: "权限",
  contextCompaction: "上下文",
  genericMeta: "系统",
};

export const MetaNoticeRow = memo(function MetaNoticeRow({
  itemId,
  notice,
  isSelected = false,
  onSelect,
}: MetaNoticeRowProps) {
  return renderSelectableTimelineContent({
    className: joinClassNames(
      onSelect ? styles.selectableTimelineItem : null,
      isSelected ? styles.selectedTimelineItem : null
    ),
    dataKind: "meta-notice",
    dataRightPanelSelected: isSelected ? "true" : undefined,
    onSelect,
    children: (
      <ActivityLogRow
        className={styles.metaNotice}
        data-testid="meta-notice-row"
        data-timeline-item-id={itemId}
        data-meta-notice-type={notice.noticeType}
        tone="neutral"
        icon={<Info size={15} />}
        title={notice.title}
        description={notice.description}
        meta={
          <>
            <ToolCallChip tone="neutral">系统提示</ToolCallChip>
            <ToolCallChip tone="neutral">{META_NOTICE_LABELS[notice.noticeType]}</ToolCallChip>
          </>
        }
      />
    ),
  });
});

export const DiffRow = memo(function DiffRow({
  item,
  forceExpanded = false,
  onRevertAllChanges,
  isSelected: _isSelected = false,
  onSelect: _onSelect,
}: DiffRowProps) {
  const [isExpanded, setIsExpanded] = useState(item.title !== "Turn diff");
  const files = useMemo(() => extractTimelineDiffFiles(item.diff), [item.diff]);
  const fileCountLabel = files.length > 0 ? formatCount(files.length, "file", "files") : null;
  const statusLabel = formatExecutionStatusLabel(item.status);
  const statusTone = resolveExecutionToneForValue(item.status);

  useEffect(() => {
    if (forceExpanded) {
      setIsExpanded(true);
    }
  }, [forceExpanded]);

  return (
    <DiffReviewPanel
      itemId={item.id}
      title={item.title}
      description="Inspect the changed files before continuing with the turn."
      summaryLabel={fileCountLabel ? `${fileCountLabel} changed` : "No file summary"}
      statusLabel={statusLabel}
      statusTone={statusTone}
      files={files.map((file) => ({
        path: file.path,
        status: file.status,
      }))}
      expanded={isExpanded}
      onToggleExpanded={() => setIsExpanded((value) => !value)}
      onRevertAllChanges={onRevertAllChanges}
    >
      {isExpanded ? (
        <div
          className={joinClassNames(
            styles.diffViewerOutput,
            gitDiffViewerStyles.output,
            gitDiffViewerStyles.outputFlat
          )}
        >
          <Suspense fallback={null}>
            <LazyDiffBlock diff={item.diff} language={languageFromPath(item.title)} />
          </Suspense>
        </div>
      ) : null}
    </DiffReviewPanel>
  );
});

const GenericToolRow = memo(function GenericToolRow({
  item,
  isExpanded,
  isCopied,
  onToggle,
  onCopy,
  skills,
  showMessageFilePath,
  workspacePath,
  onOpenFileLink,
  onOpenFileLinkMenu,
  onOpenThreadLink,
  isSelected: _isSelected = false,
  onSelect: _onSelect,
}: ToolRowProps) {
  const isFileChange = item.toolType === "fileChange";
  const commandText = "";
  const summary = buildToolSummary(item, commandText);
  const fileChanges = item.changes ?? [];
  const keyedFileChanges = useMemo(() => {
    const keyCounts = new Map<string, number>();
    return fileChanges.map((change) => {
      const baseKey = `${change.path}:${change.kind ?? ""}:${change.diff ?? ""}`;
      const seen = keyCounts.get(baseKey) ?? 0;
      keyCounts.set(baseKey, seen + 1);
      return {
        key: `${baseKey}:${seen}`,
        change,
      };
    });
  }, [fileChanges]);
  const changeNames = keyedFileChanges.map(({ change }) => basename(change.path)).filter(Boolean);
  const hasChanges = keyedFileChanges.length > 0;
  const tone = toolStatusTone(item, hasChanges);
  const ToolIcon = toolIconForSummary(item, summary);
  const summaryLabel = isFileChange
    ? changeNames.length > 1
      ? "files edited"
      : "file edited"
    : summary.label;
  const summaryValue = isFileChange
    ? changeNames.length > 1
      ? `${changeNames[0]} +${changeNames.length - 1}`
      : changeNames[0] || "changes"
    : summary.value;
  const showToolOutput = isExpanded && (!isFileChange || !hasChanges);
  const commandDurationMs = typeof item.durationMs === "number" ? item.durationMs : null;
  const recoveredExecution = item.recovered === true;
  const detailChips = [
    recoveredExecution ? "Recovered" : "",
    commandDurationMs !== null ? `Duration ${formatDurationMs(commandDurationMs)}` : "",
    item.errorClass ? `Class ${item.errorClass}` : "",
  ].filter(Boolean);
  const statusLabel =
    formatExecutionStatusLabel(item.status) ??
    (tone === "processing" ? "In progress" : tone === "failed" ? "Failed" : "Completed");
  const statusTone = resolveExecutionToneForValue(item.status, tone);
  const compactStatusLabel = formatCompactExecutionStatusLabel(statusLabel, statusTone);
  const summaryLeadLabel =
    summaryLabel && summaryLabel !== "tool"
      ? summaryLabel.charAt(0).toUpperCase() + summaryLabel.slice(1)
      : null;
  const plannerDiagnostics = useMemo(() => extractToolPlannerDiagnostics(item), [item]);
  const formattedDetail = useMemo(() => formatToolDetail(item), [item]);
  const plannerDiagnosticsSummary = plannerDiagnostics
    ? `Planner diagnostics: ${plannerDiagnostics.fatalCount} fatal, ${plannerDiagnostics.warningCount} warning`
    : null;
  const plannerDiagnosticLines = useMemo(
    () =>
      plannerDiagnostics?.diagnostics.map(
        (diagnostic) =>
          `${diagnostic.severity.toUpperCase()} ${diagnostic.code}: ${diagnostic.message}`
      ) ?? [],
    [plannerDiagnostics]
  );
  const descriptionText =
    formattedDetail &&
    formattedDetail !== summaryLeadLabel &&
    formattedDetail !== summaryValue &&
    formattedDetail !== item.title
      ? formattedDetail
      : null;
  const copyText = useMemo(() => {
    const sections = [
      item.title,
      summary.value && summary.value !== item.title ? summary.value : "",
      statusLabel ? `Status: ${statusLabel}` : "",
      formattedDetail,
      plannerDiagnosticsSummary ?? "",
      ...plannerDiagnosticLines,
      summary.output ?? "",
    ].filter(Boolean);
    return sections.join("\n\n");
  }, [
    formattedDetail,
    item.title,
    plannerDiagnosticLines,
    plannerDiagnosticsSummary,
    statusLabel,
    summary.output,
  ]);

  return (
    <ActivityLogRow
      tone={statusTone}
      data-tone={tone}
      data-kind="tool"
      data-timeline-item-id={item.id}
      data-artifact-kind={isFileChange ? "changed-files" : "tool"}
      interactive
      selected={isExpanded}
      icon={<ToolIcon size={14} />}
      title={
        <span
          className={joinClassNames(!isExpanded ? styles.toolInlineSingleLine : null)}
          title={
            typeof (summaryValue || item.title) === "string"
              ? summaryValue || item.title
              : undefined
          }
        >
          {summaryValue || item.title}
        </span>
      }
      description={
        !isExpanded && descriptionText ? (
          <span className={styles.toolInlineSingleLine} title={descriptionText}>
            {descriptionText}
          </span>
        ) : null
      }
      meta={
        <>
          {summaryLeadLabel ? <ToolCallChip tone="neutral">{summaryLeadLabel}</ToolCallChip> : null}
          <ExecutionStatusPill tone={statusTone} showDot>
            {compactStatusLabel}
          </ExecutionStatusPill>
          {detailChips.map((chip) => (
            <ToolCallChip key={chip} tone="neutral">
              {chip}
            </ToolCallChip>
          ))}
        </>
      }
      actions={
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onToggle(item.id)}
            aria-expanded={isExpanded}
            title={isExpanded ? "Hide details" : "Show details"}
            aria-label={
              isFileChange && summaryValue
                ? `Toggle tool details: ${summaryValue}`
                : "Toggle tool details"
            }
          >
            {isExpanded ? (
              <ChevronDown size={14} aria-hidden />
            ) : (
              <ChevronRight size={14} aria-hidden />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={joinClassNames(
              styles.messageCopyButton,
              isCopied ? styles.stateCopied : null
            )}
            onClick={() => onCopy(item.id, copyText)}
            aria-label="Copy tool message"
            title={isCopied ? "Copied" : "Copy tool message"}
            data-copy-state={isCopied ? "copied" : "idle"}
          >
            <span className={styles.messageCopyIcon} aria-hidden>
              {isCopied ? (
                <Check className={styles.messageCopyIconCheck} size={14} />
              ) : (
                <Copy className={styles.messageCopyIconCopy} size={14} />
              )}
            </span>
          </Button>
        </>
      }
      body={
        <>
          {isExpanded && formattedDetail && !isFileChange ? (
            <div className={styles.toolInlineDetail}>{formattedDetail}</div>
          ) : null}
          {isExpanded && plannerDiagnostics && plannerDiagnosticsSummary ? (
            <div
              className={joinClassNames(
                styles.toolInlineDetail,
                plannerDiagnostics.hasFatal ? null : styles.toolInlineMuted
              )}
            >
              {plannerDiagnosticsSummary}
            </div>
          ) : null}
          {isExpanded && plannerDiagnostics ? (
            <div className={styles.toolInlineDetail}>
              {plannerDiagnosticLines.map((line, index) => (
                <div
                  key={`${plannerDiagnostics.diagnostics[index]?.code ?? "diagnostic"}-${plannerDiagnostics.diagnostics[index]?.stepIndex ?? index}`}
                >
                  {line}
                </div>
              ))}
            </div>
          ) : null}
          {isExpanded && isFileChange && hasChanges ? (
            <div className={styles.toolInlineChangeList}>
              {keyedFileChanges.map(({ key, change }) => (
                <FileEditView key={key} change={change} />
              ))}
            </div>
          ) : null}
          {isExpanded && isFileChange && !hasChanges && item.detail ? (
            <DeferredMarkdown
              value={item.detail}
              skills={skills}
              className={joinClassNames(styles.itemText, markdownStyles.markdown)}
              showFilePath={showMessageFilePath}
              workspacePath={workspacePath}
              onOpenFileLink={onOpenFileLink}
              onOpenFileLinkMenu={onOpenFileLinkMenu}
              onOpenThreadLink={onOpenThreadLink}
            />
          ) : null}
          {showToolOutput && summary.output ? (
            <DeferredMarkdown
              value={summary.output}
              skills={skills}
              className={joinClassNames(styles.toolInlineOutput, markdownStyles.markdown)}
              codeBlock
              showFilePath={showMessageFilePath}
              workspacePath={workspacePath}
              onOpenFileLink={onOpenFileLink}
              onOpenFileLinkMenu={onOpenFileLinkMenu}
              onOpenThreadLink={onOpenThreadLink}
            />
          ) : null}
        </>
      }
    />
  );
});

export const ToolRow = memo(function ToolRow(props: ToolRowProps) {
  if (props.item.toolType === "commandExecution") {
    return <CommandToolRow {...props} />;
  }
  return <GenericToolRow {...props} />;
});

export const ExploreRow = memo(function ExploreRow({
  item,
  isSelected: _isSelected = false,
  onSelect: _onSelect,
}: ExploreRowProps) {
  const title = item.status === "exploring" ? "Exploring" : "Explored";
  const lifecycleTone = item.status === "exploring" ? "processing" : "completed";
  const tone = executionToneFromLifecycleTone(lifecycleTone);
  return (
    <ActivityLogRow
      tone={tone}
      data-tone={lifecycleTone}
      data-kind="explore"
      icon={<Terminal size={14} />}
      title={title}
      meta={
        <>
          <ToolCallChip tone="neutral">
            {formatCount(item.entries.length, "step", "steps")}
          </ToolCallChip>
          <ExecutionStatusPill tone={tone} showDot>
            {item.status === "exploring" ? "Running" : "Done"}
          </ExecutionStatusPill>
        </>
      }
      body={
        <div className={styles.exploreInline}>
          <div className={styles.exploreInlineHeader}>
            <span className={joinClassNames(styles.exploreInlineTitle, styles.visuallyHidden)}>
              {title}
            </span>
          </div>
          <div className={styles.exploreInlineList}>
            {item.entries.map((entry, index) => (
              <div
                key={`${entry.kind}-${entry.label}-${index}`}
                className={styles.exploreInlineItem}
              >
                <span
                  className={styles.exploreInlineKind}
                >{`${index + 1}. ${exploreKindLabel(entry.kind)}`}</span>
                <span className={styles.exploreInlineLabel}>{entry.label}</span>
                {entry.detail && entry.detail !== entry.label ? (
                  <span className={styles.exploreInlineDetail}>{entry.detail}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      }
    />
  );
});
