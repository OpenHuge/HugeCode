import X from "lucide-react/dist/esm/icons/x";
import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef } from "react";
import { Button, PopoverSurface, StatusBadge, Surface } from "../../../design-system";
import type { OpenAppTarget } from "../../../types";
import { joinClassNames } from "../../../utils/classNames";
import { type HighlightSegment, highlightLineSegments } from "../../../utils/syntax";
import { languageFromPath } from "../../../utils/syntaxLanguage";
import { OpenAppMenu } from "../../app/components/OpenAppMenu";
import * as styles from "./FilePreviewPopover.styles.css";

type FilePreviewPopoverProps = {
  path: string;
  absolutePath: string;
  content: string;
  truncated: boolean;
  previewKind?: "text" | "image";
  imageSrc?: string | null;
  openTargets: OpenAppTarget[];
  openAppIconById: Record<string, string>;
  selectedOpenAppId: string;
  onSelectOpenAppId: (id: string) => void;
  selection: { start: number; end: number } | null;
  onSelectLine: (index: number, event: MouseEvent<HTMLButtonElement>) => void;
  onLineMouseDown?: (index: number, event: MouseEvent<HTMLButtonElement>) => void;
  onLineMouseEnter?: (index: number, event: MouseEvent<HTMLButtonElement>) => void;
  onLineMouseUp?: (index: number, event: MouseEvent<HTMLButtonElement>) => void;
  onClearSelection: () => void;
  onAddSelection: () => void;
  canInsertText?: boolean;
  onClose: () => void;
  selectionHints?: string[];
  anchorTop: number;
  anchorLeft: number;
  arrowTop: number;
  isLoading?: boolean;
  error?: string | null;
};

type PreviewLineRow = {
  id: string;
  index: number;
  lineNumber: number;
  segments: HighlightSegment[];
};

function resolveSyntaxToneClass(className?: string) {
  if (!className) {
    return undefined;
  }

  const tokens = new Set(className.split(/\s+/u));
  if (
    tokens.has("comment") ||
    tokens.has("prolog") ||
    tokens.has("doctype") ||
    tokens.has("cdata")
  ) {
    return styles.syntaxTone.comment;
  }
  if (tokens.has("punctuation")) {
    return styles.syntaxTone.punctuation;
  }
  if (
    tokens.has("property") ||
    tokens.has("tag") ||
    tokens.has("constant") ||
    tokens.has("symbol") ||
    tokens.has("deleted")
  ) {
    return styles.syntaxTone.danger;
  }
  if (tokens.has("boolean") || tokens.has("number")) {
    return styles.syntaxTone.warning;
  }
  if (
    tokens.has("selector") ||
    tokens.has("attr-name") ||
    tokens.has("string") ||
    tokens.has("char") ||
    tokens.has("builtin") ||
    tokens.has("inserted")
  ) {
    return styles.syntaxTone.success;
  }
  if (
    tokens.has("operator") ||
    tokens.has("entity") ||
    tokens.has("url") ||
    tokens.has("variable")
  ) {
    return styles.syntaxTone.variable;
  }
  if (tokens.has("atrule") || tokens.has("attr-value") || tokens.has("keyword")) {
    return styles.syntaxTone.keyword;
  }
  if (tokens.has("function") || tokens.has("class-name")) {
    return styles.syntaxTone.function;
  }

  return undefined;
}

function renderSegments(lineId: string, segments: HighlightSegment[]) {
  const visibleSegments = segments.length > 0 ? segments : [{ text: "\u00A0" }];
  let offset = 0;
  return visibleSegments.map((segment) => {
    const segmentKey = `${lineId}:${offset}:${segment.className ?? ""}:${segment.text}`;
    offset += segment.text.length + 1;
    return (
      <span key={segmentKey} className={resolveSyntaxToneClass(segment.className)}>
        {segment.text || "\u00A0"}
      </span>
    );
  });
}

export function FilePreviewPopover({
  path,
  absolutePath,
  content,
  truncated,
  previewKind = "text",
  imageSrc = null,
  openTargets,
  openAppIconById,
  selectedOpenAppId,
  onSelectOpenAppId,
  selection,
  onSelectLine,
  onLineMouseDown,
  onLineMouseEnter,
  onLineMouseUp,
  onClearSelection,
  onAddSelection,
  canInsertText = true,
  onClose,
  selectionHints = [],
  anchorTop,
  anchorLeft,
  arrowTop,
  isLoading = false,
  error = null,
}: FilePreviewPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const isImagePreview = previewKind === "image";
  const lines = useMemo(
    () => (isImagePreview ? [] : content.split("\n")),
    [content, isImagePreview]
  );
  const language = useMemo(() => languageFromPath(path), [path]);
  const selectionLabel = selection
    ? `Lines ${selection.start + 1}-${selection.end + 1}`
    : isImagePreview
      ? "Image preview"
      : "No selection";
  const previewLines = useMemo<PreviewLineRow[]>(() => {
    if (isImagePreview) {
      return [];
    }
    const duplicateCounts = new Map<string, number>();
    return lines.map((line, index) => {
      const lineNumber = index + 1;
      const seen = duplicateCounts.get(line) ?? 0;
      duplicateCounts.set(line, seen + 1);
      return {
        id: `${lineNumber}:${seen}:${line}`,
        index,
        lineNumber,
        segments: highlightLineSegments(line, language),
      };
    });
  }, [isImagePreview, language, lines]);

  useEffect(() => {
    if (!popoverRef.current) {
      return;
    }
    popoverRef.current.style.setProperty("--file-preview-top", `${anchorTop}px`);
    popoverRef.current.style.setProperty("--file-preview-left", `${anchorLeft}px`);
    popoverRef.current.style.setProperty("--file-preview-arrow-top", `${arrowTop}px`);
  }, [anchorLeft, anchorTop, arrowTop]);

  return (
    <PopoverSurface
      className={joinClassNames(styles.popover, "file-preview-popover")}
      ref={popoverRef}
    >
      <div className={joinClassNames(styles.header, "file-preview-header")}>
        <div className={joinClassNames(styles.headerCopy, "file-preview-header-copy")}>
          <span className={joinClassNames(styles.eyebrow, "file-preview-eyebrow")}>
            {isImagePreview ? "Image preview" : "File preview"}
          </span>
          <div className={joinClassNames(styles.title, "file-preview-title")}>
            <span className={joinClassNames(styles.path, "file-preview-path")}>{path}</span>
          </div>
        </div>
        <div className={joinClassNames(styles.headerActions, "file-preview-header-actions")}>
          {truncated && <StatusBadge tone="warning">Truncated</StatusBadge>}
          <Button
            variant="ghost"
            size="icon"
            className={joinClassNames(styles.close, "file-preview-close")}
            onClick={onClose}
            aria-label="Close preview"
            title="Close preview"
          >
            <X size={14} aria-hidden />
          </Button>
        </div>
      </div>
      {isLoading ? (
        <Surface
          className={joinClassNames(styles.status, "file-preview-status")}
          padding="sm"
          tone="subtle"
        >
          Loading file...
        </Surface>
      ) : error ? (
        <Surface
          className={joinClassNames(
            styles.status,
            styles.statusError,
            "file-preview-status file-preview-error"
          )}
          padding="sm"
          tone="translucent"
        >
          {error}
        </Surface>
      ) : isImagePreview ? (
        <div
          className={joinClassNames(
            styles.body,
            styles.bodyImage,
            "file-preview-body file-preview-body--image"
          )}
        >
          <div className={joinClassNames(styles.toolbar, "file-preview-toolbar")}>
            <span className={joinClassNames(styles.selection, "file-preview-selection")}>
              {selectionLabel}
            </span>
            <div className={joinClassNames(styles.actions, "file-preview-actions")}>
              <OpenAppMenu
                path={absolutePath}
                openTargets={openTargets}
                selectedOpenAppId={selectedOpenAppId}
                onSelectOpenAppId={onSelectOpenAppId}
                iconById={openAppIconById}
              />
            </div>
          </div>
          {imageSrc ? (
            <Surface
              className={joinClassNames(styles.image, "file-preview-image")}
              padding="md"
              tone="translucent"
            >
              <img className={styles.imageElement} src={imageSrc} alt={path} />
            </Surface>
          ) : (
            <Surface
              className={joinClassNames(
                styles.status,
                styles.statusError,
                "file-preview-status file-preview-error"
              )}
              padding="sm"
              tone="translucent"
            >
              Image preview unavailable.
            </Surface>
          )}
        </div>
      ) : (
        <div className={joinClassNames(styles.body, "file-preview-body")}>
          <div className={joinClassNames(styles.toolbar, "file-preview-toolbar")}>
            <div className={joinClassNames(styles.selectionGroup, "file-preview-selection-group")}>
              <StatusBadge tone={selection ? "progress" : "default"}>{selectionLabel}</StatusBadge>
              {selectionHints.length > 0 ? (
                <div className={joinClassNames(styles.hints, "file-preview-hints")}>
                  {selectionHints.map((hint) => (
                    <span key={hint} className={joinClassNames(styles.hint, "file-preview-hint")}>
                      {hint}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className={joinClassNames(styles.actions, "file-preview-actions")}>
              <OpenAppMenu
                path={absolutePath}
                openTargets={openTargets}
                selectedOpenAppId={selectedOpenAppId}
                onSelectOpenAppId={onSelectOpenAppId}
                iconById={openAppIconById}
              />
              <Button
                variant="ghost"
                size="sm"
                className={joinClassNames(styles.action, "file-preview-action")}
                onClick={onClearSelection}
                disabled={!selection}
              >
                Clear
              </Button>
              <Button
                variant="primary"
                size="sm"
                className={joinClassNames(
                  styles.action,
                  styles.actionAdd,
                  "file-preview-action file-preview-action--add"
                )}
                onClick={onAddSelection}
                disabled={!selection || !canInsertText}
              >
                Add to chat
              </Button>
            </div>
          </div>
          <div className={joinClassNames(styles.lines, "file-preview-lines")}>
            {previewLines.map((line) => {
              const index = line.index;
              const isSelected = selection && index >= selection.start && index <= selection.end;
              return (
                <button
                  key={line.id}
                  type="button"
                  className={joinClassNames(
                    styles.line,
                    isSelected && styles.lineSelected,
                    "file-preview-line",
                    isSelected && "is-selected"
                  )}
                  onClick={(event) => onSelectLine(index, event)}
                  onMouseDown={(event) => onLineMouseDown?.(index, event)}
                  onMouseEnter={(event) => onLineMouseEnter?.(index, event)}
                  onMouseUp={(event) => onLineMouseUp?.(index, event)}
                >
                  <span className={joinClassNames(styles.lineNumber, "file-preview-line-number")}>
                    {line.lineNumber}
                  </span>
                  <span className={joinClassNames(styles.lineText, "file-preview-line-text")}>
                    {renderSegments(line.id, line.segments)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </PopoverSurface>
  );
}
