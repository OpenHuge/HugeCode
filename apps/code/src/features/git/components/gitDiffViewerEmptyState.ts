export function getGitDiffEmptyStateCopy({
  hasRepositoryContext,
  hasPullRequestSelection,
}: {
  hasRepositoryContext: boolean;
  hasPullRequestSelection?: boolean;
}) {
  if (!hasRepositoryContext) {
    return {
      title: "Repository not selected",
      subtitle: "Choose a repository-backed workspace or Git root before inspecting diff output.",
      hint: "Once Git context is available, changed files and commit-backed diffs will appear here.",
    };
  }

  if (hasPullRequestSelection) {
    return {
      title: "No file changes in this pull request",
      subtitle:
        "The pull request loaded, but there are no diff hunks to render for this selection.",
      hint: "Try switching to another pull request or commit from the Git panel.",
    };
  }

  return {
    title: "Working tree is clean",
    subtitle: "No local changes were detected for the current workspace.",
    hint: "Make an edit, stage a file, or select a commit to inspect changes here.",
  };
}
