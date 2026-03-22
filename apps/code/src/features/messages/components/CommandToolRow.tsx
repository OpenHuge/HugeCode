import Check from "lucide-react/dist/esm/icons/check";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Copy from "lucide-react/dist/esm/icons/copy";
import Terminal from "lucide-react/dist/esm/icons/terminal";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  ExecutionStatusPill,
  executionToneFromLifecycleTone,
  formatExecutionStatusLabel,
  resolveExecutionTone,
  ToolCallChip,
} from "../../../design-system";
import type { ConversationItem } from "../../../types";
import { joinClassNames } from "../../../utils/classNames";
import {
  buildToolSummary,
  extractToolPlannerDiagnostics,
  formatDurationMs,
  formatToolDetail,
  MAX_COMMAND_OUTPUT_LINES,
  toolStatusTone,
} from "../utils/messageRenderUtils";
import * as styles from "./MessageRows.styles.css";

type CommandToolRowProps = {
  item: Extract<ConversationItem, { kind: "tool" }>;
  isExpanded: boolean;
  isCopied: boolean;
  onToggle: (id: string) => void;
  onCopy: (id: string, text: string) => void;
  onRequestAutoScroll?: () => void;
  isSelected?: boolean;
  onSelect?: (item: Extract<ConversationItem, { kind: "tool" }>) => void;
};

function formatCommandDurationLabel(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function formatCommandHeadline(
  tone: ReturnType<typeof toolStatusTone>,
  durationMs: number | null,
  isRunning: boolean
) {
  if (isRunning) {
    return durationMs !== null
      ? `Running command for ${formatCommandDurationLabel(durationMs)}`
      : "Running command";
  }
  if (tone === "failed") {
    return durationMs !== null
      ? `Command failed after ${formatCommandDurationLabel(durationMs)}`
      : "Command failed";
  }
  if (tone === "completed") {
    return durationMs !== null
      ? `Command finished in ${formatCommandDurationLabel(durationMs)}`
      : "Command finished";
  }
  return "Command";
}

const CommandOutput = memo(function CommandOutput({ output }: { output: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPinned, setIsPinned] = useState(true);
  const lines = useMemo(() => {
    if (!output) {
      return [];
    }
    return output.split(/\r?\n/);
  }, [output]);
  const lineWindow = useMemo(() => {
    if (lines.length <= MAX_COMMAND_OUTPUT_LINES) {
      return { offset: 0, lines };
    }
    const startIndex = lines.length - MAX_COMMAND_OUTPUT_LINES;
    return { offset: startIndex, lines: lines.slice(startIndex) };
  }, [lines]);

  const handleScroll = useCallback(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }
    const threshold = 6;
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    setIsPinned(distanceFromBottom <= threshold);
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || !isPinned || output.length === 0) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [output, isPinned]);

  if (lineWindow.lines.length === 0) {
    return null;
  }

  return (
    <div className={styles.toolInlineTerminal} role="log" aria-live="polite">
      <div className={styles.toolInlineTerminalLines} ref={containerRef} onScroll={handleScroll}>
        {lineWindow.lines.map((line, index) => (
          <div
            key={`${lineWindow.offset + index}-${line}`}
            className={styles.toolInlineTerminalLine}
          >
            {line || " "}
          </div>
        ))}
      </div>
    </div>
  );
});

export const CommandToolRow = memo(function CommandToolRow({
  item,
  isExpanded,
  isCopied,
  onToggle,
  onCopy,
  onRequestAutoScroll,
  isSelected = false,
  onSelect,
}: CommandToolRowProps) {
  const commandText = item.title.replace(/^Command:\s*/i, "").trim();
  const summary = buildToolSummary(item, commandText);
  const tone = toolStatusTone(item, false);
  const statusTone =
    resolveExecutionTone(item.status) ??
    executionToneFromLifecycleTone(
      tone === "completed"
        ? "completed"
        : tone === "processing"
          ? "processing"
          : tone === "failed"
            ? "failed"
            : "unknown"
    );
  const normalizedStatus = (item.status ?? "").toLowerCase();
  const isCommandRunning = /in[_\s-]*progress|running|started/.test(normalizedStatus);
  const commandDurationMs = typeof item.durationMs === "number" ? item.durationMs : null;
  const isLongRunning = commandDurationMs !== null && commandDurationMs >= 800;
  const recoveredExecution = item.recovered === true;
  const statusLabel =
    formatExecutionStatusLabel(item.status) ??
    (tone === "processing" ? "In progress" : tone === "failed" ? "Failed" : "Completed");
  const statusHeadline = formatCommandHeadline(tone, commandDurationMs, isCommandRunning);
  const detailChips = [
    commandDurationMs !== null ? `Duration ${formatDurationMs(commandDurationMs)}` : "",
    item.detail ? `cwd ${item.detail}` : "",
    recoveredExecution ? "Recovered" : "",
    item.errorClass ? `Class ${item.errorClass}` : "",
  ].filter(Boolean);
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
  const [showLiveOutput, setShowLiveOutput] = useState(false);
  const collapsedSummary =
    tone === "failed"
      ? "Command details"
      : isCommandRunning
        ? "Running shell step"
        : "Shell step complete";
  const copyText = useMemo(() => {
    const sections = [
      item.title,
      statusLabel ? `Status: ${statusLabel}` : "",
      formattedDetail,
      item.detail ? `cwd: ${item.detail}` : "",
      plannerDiagnosticsSummary ?? "",
      ...plannerDiagnosticLines,
      summary.output ?? "",
    ].filter(Boolean);
    return sections.join("\n\n");
  }, [
    formattedDetail,
    item.detail,
    item.title,
    plannerDiagnosticLines,
    plannerDiagnosticsSummary,
    statusLabel,
    summary.output,
  ]);

  useEffect(() => {
    if (!isCommandRunning) {
      setShowLiveOutput(false);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setShowLiveOutput(true);
    }, 600);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isCommandRunning]);

  const showCommandOutput =
    Boolean(summary.output) &&
    (isExpanded || !isCommandRunning || (isCommandRunning && showLiveOutput) || isLongRunning);

  useEffect(() => {
    if (showCommandOutput && isCommandRunning && showLiveOutput) {
      onRequestAutoScroll?.();
    }
  }, [isCommandRunning, onRequestAutoScroll, showCommandOutput, showLiveOutput]);

  return (
    <div
      className={joinClassNames(
        styles.toolInline,
        styles.commandInline,
        isExpanded ? styles.toolInlineExpanded : null,
        onSelect ? styles.selectableTimelineItem : null,
        isSelected ? styles.selectedTimelineItem : null
      )}
      data-tone={tone}
      data-kind="tool"
      data-timeline-item-id={item.id}
      data-artifact-kind="tool"
      data-right-panel-selected={isSelected ? "true" : undefined}
    >
      <button
        type="button"
        className={styles.toolInlineBarToggle}
        onClick={() => {
          onSelect?.(item);
          onToggle(item.id);
        }}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div className={styles.toolInlineContent}>
        <div className={styles.commandInlineStatusRow}>
          <span className={styles.commandInlineStatus}>{statusHeadline}</span>
          <div className={styles.toolInlineActions}>
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
          </div>
        </div>
        <div className={styles.commandInlineSurface}>
          <div className={styles.commandInlineSurfaceHeader}>
            <button
              type="button"
              className={styles.commandInlineSurfaceToggle}
              onClick={() => {
                onSelect?.(item);
                onToggle(item.id);
              }}
              aria-expanded={isExpanded}
              aria-label="Toggle tool details"
              title={isExpanded ? "Hide details" : "Show details"}
            >
              <span className={styles.commandInlineSurfaceLabel}>
                <Terminal
                  className={joinClassNames(styles.toolInlineIcon, tone)}
                  size={14}
                  aria-hidden
                />
                Shell
              </span>
              <span className={styles.commandInlineSurfaceHint}>
                {isExpanded ? (
                  <ChevronDown size={14} aria-hidden />
                ) : (
                  <ChevronRight size={14} aria-hidden />
                )}
              </span>
            </button>
          </div>
          {isExpanded ? (
            <div className={styles.commandInlinePromptRow}>
              <span className={styles.commandInlinePrompt} aria-hidden>
                $
              </span>
              <span className={styles.commandInlinePromptCommand}>
                {summary.value || "Command"}
              </span>
            </div>
          ) : (
            <div className={styles.commandInlineContext}>
              <span className={styles.commandInlineContextLabel}>Step</span>
              <span className={styles.toolInlineSingleLine} title={collapsedSummary}>
                {collapsedSummary}
              </span>
            </div>
          )}
          {showCommandOutput ? <CommandOutput output={summary.output ?? ""} /> : null}
          {isExpanded && item.detail ? (
            <div className={styles.commandInlineContext}>
              <span className={styles.commandInlineContextLabel}>cwd</span>
              <span>{item.detail}</span>
            </div>
          ) : null}
        </div>
        <div className={styles.toolInlineMeta}>
          <ExecutionStatusPill tone={statusTone} showDot>
            {statusLabel}
          </ExecutionStatusPill>
          {detailChips.map((chip) => (
            <ToolCallChip key={chip} tone="neutral">
              {chip}
            </ToolCallChip>
          ))}
        </div>
        {isExpanded && formattedDetail ? (
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
      </div>
    </div>
  );
});
