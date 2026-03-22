import type { ReactNode } from "react";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import FileDiff from "lucide-react/dist/esm/icons/file-diff";
import { Button } from "../../adapters/Button";
import { joinClassNames } from "../../../utils/classNames";
import { ActivityLogRow } from "./ActivityLogRow";
import * as styles from "./ExecutionPrimitives.css";
import type { ExecutionTone } from "./executionStatus";
import { ExecutionStatusPill } from "./ExecutionStatusPill";
import { ToolCallChip } from "./ToolCallChip";

export type DiffReviewFileEntry = {
  path: string;
  status: string;
};

type DiffReviewPanelProps = {
  title: string;
  description?: ReactNode;
  summaryLabel?: string | null;
  statusLabel?: string | null;
  statusTone?: ExecutionTone;
  files?: DiffReviewFileEntry[];
  expanded?: boolean;
  onToggleExpanded?: () => void;
  showToggleLabel?: string;
  hideToggleLabel?: string;
  onRevertAllChanges?: (() => void | Promise<void>) | null;
  children?: ReactNode;
  className?: string;
  itemId?: string;
};

export function DiffReviewPanel({
  title,
  description,
  summaryLabel,
  statusLabel,
  statusTone = "neutral",
  files = [],
  expanded = false,
  onToggleExpanded,
  showToggleLabel = "Show diff",
  hideToggleLabel = "Hide diff",
  onRevertAllChanges = null,
  children,
  className,
  itemId,
}: DiffReviewPanelProps) {
  const toggleLabel = expanded ? hideToggleLabel : showToggleLabel;
  const meta = (
    <>
      <ToolCallChip tone="neutral">Diff</ToolCallChip>
      {summaryLabel ? <ToolCallChip tone="neutral">{summaryLabel}</ToolCallChip> : null}
      {statusLabel ? (
        <ExecutionStatusPill tone={statusTone} showDot>
          {statusLabel}
        </ExecutionStatusPill>
      ) : null}
    </>
  );
  const actions = (
    <>
      {onToggleExpanded ? (
        <Button type="button" variant="ghost" size="sm" onClick={onToggleExpanded}>
          {expanded ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
          {toggleLabel}
        </Button>
      ) : null}
      {onRevertAllChanges ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void onRevertAllChanges()}
        >
          Revert all changes
        </Button>
      ) : null}
    </>
  );

  return (
    <ActivityLogRow
      className={className}
      data-artifact-kind="diff"
      data-timeline-item-id={itemId}
      tone={statusTone}
      icon={<FileDiff size={16} />}
      title={<span className="diff-title">{title}</span>}
      description={description}
      meta={meta}
      actions={actions}
      body={
        <>
          {files.length ? (
            <ul className={styles.diffPanelFileList} aria-label="Changed files">
              {files.map((file) => (
                <li key={`${file.status}-${file.path}`} className={styles.diffPanelFile}>
                  <ExecutionStatusPill
                    className={styles.diffPanelFileStatus}
                    tone={statusTone === "danger" ? "danger" : "neutral"}
                  >
                    {file.status}
                  </ExecutionStatusPill>
                  <span className={styles.diffPanelFilePath}>{file.path}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {expanded && children ? (
            <div className={joinClassNames(styles.diffPanelContent)}>{children}</div>
          ) : null}
        </>
      }
    />
  );
}
