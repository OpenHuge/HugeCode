import Check from "lucide-react/dist/esm/icons/check";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import Copy from "lucide-react/dist/esm/icons/copy";
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as gitDiffViewerStyles from "../../git/components/GitDiffViewer.styles.css";
import type { ConversationItem } from "../../../types";
import { joinClassNames } from "../../../utils/classNames";
import { parseDiff } from "../../../utils/diff";
import { languageFromPath } from "../../../utils/syntaxLanguage";
import { basename } from "../utils/messageRenderUtils";
import * as styles from "./FileEditView.styles.css";

type FileEditChange = NonNullable<Extract<ConversationItem, { kind: "tool" }>["changes"]>[number];

type FileEditViewProps = {
  change: FileEditChange;
};

const LazyDiffBlock = lazy(() =>
  import("../../git/components/DiffBlock").then((module) => ({ default: module.DiffBlock }))
);

type DiffStats = {
  additions: number;
  deletions: number;
};

function summarizeDiff(parsedDiff: ReturnType<typeof parseDiff>): DiffStats {
  let additions = 0;
  let deletions = 0;
  for (const line of parsedDiff) {
    if (line.type === "add") {
      additions += 1;
    } else if (line.type === "del") {
      deletions += 1;
    }
  }
  return { additions, deletions };
}

export const FileEditView = memo(function FileEditView({ change }: FileEditViewProps) {
  const [isCopied, setIsCopied] = useState(false);
  const copyResetTimerRef = useRef<number | null>(null);
  const hasDiff = typeof change.diff === "string" && change.diff.trim().length > 0;
  const parsedDiff = useMemo(() => parseDiff(change.diff ?? ""), [change.diff]);
  const stats = useMemo(() => summarizeDiff(parsedDiff), [parsedDiff]);
  const kindLabel = change.kind?.trim().toUpperCase() ?? "";
  const fileName = basename(change.path) || change.path;
  const statsLabel = `Added ${stats.additions} lines, removed ${stats.deletions} lines`;

  const handleCopyPath = useCallback(async () => {
    if (!change.path || !window.navigator.clipboard?.writeText) {
      return;
    }
    try {
      await window.navigator.clipboard.writeText(change.path);
      setIsCopied(true);
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current);
      }
      copyResetTimerRef.current = window.setTimeout(() => {
        setIsCopied(false);
        copyResetTimerRef.current = null;
      }, 1400);
    } catch {
      setIsCopied(false);
    }
  }, [change.path]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  return (
    <article className={styles.fileEditView}>
      <header className={styles.fileEditViewLabelRow}>
        <span>Edited file</span>
        <ChevronDown size={14} aria-hidden />
        {kindLabel && <span className={styles.fileEditViewKind}>{kindLabel}</span>}
      </header>

      <div className={styles.fileEditViewCard}>
        <div className={styles.fileEditViewCardHeader}>
          <span className={styles.fileEditViewName} title={change.path}>
            {fileName}
          </span>
          <span className={styles.fileEditViewStats} title={statsLabel}>
            {stats.additions > 0 && (
              <span className={styles.fileEditViewStat} data-diff-stat="add">
                +{stats.additions}
              </span>
            )}
            {stats.deletions > 0 && (
              <span className={styles.fileEditViewStat} data-diff-stat="del">
                -{stats.deletions}
              </span>
            )}
          </span>
          <button
            type="button"
            className={styles.fileEditViewCopy}
            onClick={handleCopyPath}
            aria-label={isCopied ? "Copied file path" : "Copy file path"}
            data-copy-state={isCopied ? "copied" : "idle"}
            title={isCopied ? "Copied file path" : "Copy file path"}
          >
            {isCopied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          </button>
        </div>
        <div className={styles.fileEditViewPath}>{change.path}</div>
        {hasDiff ? (
          <div
            className={joinClassNames(
              styles.fileEditViewDiff,
              gitDiffViewerStyles.output,
              gitDiffViewerStyles.outputFlat
            )}
          >
            <Suspense fallback={null}>
              <LazyDiffBlock
                diff={change.diff ?? ""}
                language={languageFromPath(change.path)}
                parsedLines={parsedDiff}
              />
            </Suspense>
          </div>
        ) : (
          <div className={styles.fileEditViewEmpty}>No inline diff provided.</div>
        )}
      </div>
    </article>
  );
});
