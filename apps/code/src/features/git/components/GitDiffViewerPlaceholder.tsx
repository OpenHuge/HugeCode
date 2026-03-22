import GitCommitHorizontal from "lucide-react/dist/esm/icons/git-commit-horizontal";
import * as styles from "./GitDiffViewer.styles.css";
import { getGitDiffEmptyStateCopy } from "./gitDiffViewerEmptyState";

type GitDiffViewerPlaceholderProps = {
  isLoading: boolean;
  error: string | null;
  hasRepositoryContext: boolean;
};

export function GitDiffViewerPlaceholder({
  isLoading,
  error,
  hasRepositoryContext,
}: GitDiffViewerPlaceholderProps) {
  if (error) {
    return <div className={styles.empty}>{error}</div>;
  }

  if (isLoading) {
    return <div className={styles.loading}>Loading diff...</div>;
  }

  const emptyStateCopy = getGitDiffEmptyStateCopy({
    hasRepositoryContext,
    hasPullRequestSelection: false,
  });

  return (
    <div className={styles.emptyState} aria-live="polite" data-testid="git-diff-viewer-placeholder">
      <div className={styles.emptyGlow} aria-hidden />
      <span className={styles.emptyIcon} aria-hidden>
        <GitCommitHorizontal size={18} />
      </span>
      <h3 className={styles.emptyTitle}>{emptyStateCopy.title}</h3>
      <p className={styles.emptySubtitle}>{emptyStateCopy.subtitle}</p>
      <p className={styles.emptyHint}>{emptyStateCopy.hint}</p>
    </div>
  );
}
