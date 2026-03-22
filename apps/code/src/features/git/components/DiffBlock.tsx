import type { KeyboardEvent, MouseEvent } from "react";
import { useMemo } from "react";
import { type ParsedDiffLine, parseDiff } from "../../../utils/diff";
import { type HighlightSegment, highlightLineSegments } from "../../../utils/syntax";

type DiffBlockProps = {
  diff: string;
  language?: string | null;
  showLineNumbers?: boolean;
  onLineSelect?: (
    line: ParsedDiffLine,
    index: number,
    event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>
  ) => void;
  selectedRange?: { start: number; end: number } | null;
  parsedLines?: ParsedDiffLine[] | null;
};

type ParsedLineRow = {
  key: string;
  index: number;
  line: ParsedDiffLine;
};

function buildLineKey(line: ParsedDiffLine): string {
  return `${line.type}:${line.oldLine ?? "-"}:${line.newLine ?? "-"}:${line.text}`;
}

function renderLineSegments(lineKey: string, segments: HighlightSegment[]) {
  const visibleSegments = segments.length > 0 ? segments : [{ text: "\u00A0" }];
  let offset = 0;
  return visibleSegments.map((segment) => {
    const segmentKey = `${lineKey}:${offset}:${segment.className ?? ""}:${segment.text}`;
    offset += segment.text.length + 1;
    return (
      <span key={segmentKey} className={segment.className}>
        {segment.text || "\u00A0"}
      </span>
    );
  });
}

export function DiffBlock({
  diff,
  language,
  showLineNumbers = true,
  onLineSelect,
  selectedRange = null,
  parsedLines = null,
}: DiffBlockProps) {
  const parsed = useMemo(() => parsedLines ?? parseDiff(diff), [diff, parsedLines]);
  const lineRows = useMemo<ParsedLineRow[]>(() => {
    const keyCounts = new Map<string, number>();
    return parsed.map((line, index) => {
      const baseKey = buildLineKey(line);
      const seen = keyCounts.get(baseKey) ?? 0;
      keyCounts.set(baseKey, seen + 1);
      return {
        key: `${baseKey}:${seen}`,
        index,
        line,
      };
    });
  }, [parsed]);

  return (
    <div>
      {lineRows.map(({ key, index, line }) => {
        const shouldHighlight =
          line.type === "add" || line.type === "del" || line.type === "context";
        const segments = shouldHighlight
          ? highlightLineSegments(line.text, language)
          : [{ text: line.text }];
        const isSelectable = Boolean(onLineSelect) && shouldHighlight;
        const isSelected = Boolean(
          isSelectable &&
          selectedRange &&
          index >= selectedRange.start &&
          index <= selectedRange.end
        );
        const isRangeStart = isSelected && selectedRange?.start === index;
        const isRangeEnd = isSelected && selectedRange?.end === index;
        const className = `diff-line diff-line-${line.type}${
          isSelectable ? " is-selectable" : ""
        }${isSelected ? " is-selected" : ""}${isRangeStart ? " is-range-start" : ""}${
          isRangeEnd ? " is-range-end" : ""
        }`;

        if (isSelectable) {
          return (
            <button
              type="button"
              key={key}
              className={className}
              aria-pressed={isSelected}
              onClick={(event) => {
                onLineSelect?.(line, index, event);
              }}
            >
              {showLineNumbers && (
                <div className="diff-gutter">
                  <span className="diff-line-number">{line.oldLine ?? ""}</span>
                  <span className="diff-line-number">{line.newLine ?? ""}</span>
                </div>
              )}
              <div className="diff-line-content">{renderLineSegments(key, segments)}</div>
            </button>
          );
        }

        return (
          <div key={key} className={className}>
            {showLineNumbers && (
              <div className="diff-gutter">
                <span className="diff-line-number">{line.oldLine ?? ""}</span>
                <span className="diff-line-number">{line.newLine ?? ""}</span>
              </div>
            )}
            <div className="diff-line-content">{renderLineSegments(key, segments)}</div>
          </div>
        );
      })}
    </div>
  );
}
