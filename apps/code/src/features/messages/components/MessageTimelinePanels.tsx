import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import CircleAlert from "lucide-react/dist/esm/icons/circle-alert";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { lazy, Suspense, useState } from "react";
import {
  ActivityLogRow,
  Button,
  DiffReviewPanel,
  ExecutionStatusPill,
  ToolCallChip,
  executionToneFromLifecycleTone,
} from "../../../design-system";
import { getDiffStatusLabel } from "../../git/components/GitDiffPanel.utils";
import type { TimelineDiffFile, TimelineStatusBanner } from "../utils/timelineSurface";

const LazyDiffBlock = lazy(() =>
  import("../../git/components/DiffBlock").then((module) => ({ default: module.DiffBlock }))
);

type TimelineMessageShellProps = {
  children: ReactNode;
  modifierClassName?: string;
} & ComponentPropsWithoutRef<"div">;

export function TimelineMessageShell({
  children,
  modifierClassName,
  ...props
}: TimelineMessageShellProps) {
  return (
    <div className="message assistant request-user-input-message" {...props}>
      <div className="message-content">
        <div className={`request-user-input-card ${modifierClassName ?? ""}`.trim()}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function TimelineStatusBannerPanel({
  banner,
  onAction,
}: {
  banner: TimelineStatusBanner;
  onAction?: () => void;
}) {
  const presentationByTone: Record<
    TimelineStatusBanner["tone"],
    {
      tone: "warning" | "danger";
      icon: ReactNode;
      label: string;
    }
  > = {
    runtime: {
      tone: "warning",
      icon: <AlertTriangle size={14} />,
      label: "Attention",
    },
    error: {
      tone: "danger",
      icon: <CircleAlert size={14} />,
      label: "Error",
    },
  };
  const presentation = presentationByTone[banner.tone];

  return (
    <TimelineMessageShell
      modifierClassName={`timeline-status-card timeline-status-card--${banner.tone}`}
    >
      <ActivityLogRow
        data-testid="timeline-status-banner"
        data-artifact-kind="status-banner"
        tone={presentation.tone}
        icon={presentation.icon}
        title={banner.title}
        description={banner.body}
        meta={
          <>
            <ToolCallChip tone="neutral">Timeline status</ToolCallChip>
            <ExecutionStatusPill tone={presentation.tone} showDot>
              {presentation.label}
            </ExecutionStatusPill>
          </>
        }
        actions={
          onAction && banner.actionLabel ? (
            <Button type="button" variant="secondary" size="sm" onClick={onAction}>
              {banner.actionLabel}
            </Button>
          ) : undefined
        }
      />
    </TimelineMessageShell>
  );
}

export function TimelineTurnDiffPanel({
  itemId,
  diff,
  files,
  onRevertAllChanges,
}: {
  itemId?: string;
  diff: string;
  files: TimelineDiffFile[];
  onRevertAllChanges?: () => void | Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const summaryLabel = files.length === 0 ? "No file summary" : `${files.length} changed files`;

  return (
    <DiffReviewPanel
      className="timeline-turn-diff-card"
      itemId={itemId}
      title="Turn diff"
      description="Review what changed in this turn before continuing."
      summaryLabel={summaryLabel}
      statusLabel="Ready"
      statusTone={executionToneFromLifecycleTone("completed")}
      files={files.map((file) => ({
        path: file.path,
        status: getDiffStatusLabel(file.status),
      }))}
      expanded={expanded}
      onToggleExpanded={() => setExpanded((value) => !value)}
      onRevertAllChanges={onRevertAllChanges}
    >
      <div className="timeline-turn-diff-view">
        <Suspense fallback={<pre className="timeline-turn-diff-fallback">{diff}</pre>}>
          <LazyDiffBlock diff={diff} language="diff" />
        </Suspense>
      </div>
    </DiffReviewPanel>
  );
}

export function TimelineSuccessNote({ message }: { message: string }) {
  return (
    <TimelineMessageShell modifierClassName="timeline-status-card timeline-status-card--success">
      <ActivityLogRow
        data-artifact-kind="status-success"
        tone="success"
        icon={<CheckCircle2 size={16} />}
        title="Ready"
        description={message}
        meta={
          <>
            <ToolCallChip tone="neutral">Timeline status</ToolCallChip>
            <ExecutionStatusPill tone="success" showDot>
              Ready
            </ExecutionStatusPill>
          </>
        }
      />
    </TimelineMessageShell>
  );
}
