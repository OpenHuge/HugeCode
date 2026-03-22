import { Dialog } from "../../../design-system";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BranchInfo, WorkspaceInfo } from "../../../types";
import { filterBranches, findExactBranch } from "../utils/branchSearch";
import { validateBranchName } from "../utils/branchValidation";
import { parseGitWorkflowPullRequestReference } from "../../../application/runtime/facades/gitWorkflowFacade";
import type { BranchSwitcherSelection } from "../types/branchWorkflow";
import { BranchList } from "./BranchList";
import * as styles from "./BranchSwitcherPrompt.styles.css";

type BranchSwitcherPromptProps = {
  branches: BranchInfo[];
  workspaces: WorkspaceInfo[];
  activeWorkspace: WorkspaceInfo | null;
  currentBranch: string | null;
  onSubmit: (selection: BranchSwitcherSelection) => void;
  onCancel: () => void;
};

function getWorktreeByBranch(
  workspaces: WorkspaceInfo[],
  activeWorkspace: WorkspaceInfo | null,
  branch: string
): WorkspaceInfo | null {
  const activeRepoWorkspaceId = activeWorkspace
    ? activeWorkspace.kind === "worktree"
      ? (activeWorkspace.parentId ?? null)
      : activeWorkspace.id
    : null;
  if (!activeRepoWorkspaceId) {
    return null;
  }
  return (
    workspaces.find(
      (ws) =>
        ws.kind === "worktree" &&
        ws.parentId === activeRepoWorkspaceId &&
        ws.worktree?.branch === branch
    ) ?? null
  );
}

export function BranchSwitcherPrompt({
  branches,
  workspaces,
  activeWorkspace,
  currentBranch,
  onSubmit,
  onCancel,
}: BranchSwitcherPromptProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<"local" | "worktree">(
    activeWorkspace?.kind === "worktree" ? "worktree" : "local"
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmedQuery = query.trim();
  const filteredBranches = useMemo(() => {
    return filterBranches(branches, query, { mode: "fuzzy" });
  }, [branches, query]);
  const exactBranch = useMemo(
    () => findExactBranch(branches, trimmedQuery),
    [branches, trimmedQuery]
  );
  const pullRequestNumber = parseGitWorkflowPullRequestReference(trimmedQuery);
  const branchValidationMessage =
    trimmedQuery.length > 0 && pullRequestNumber === null ? validateBranchName(trimmedQuery) : null;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const itemEl = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    itemEl?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const submitSelection = (selection: BranchSwitcherSelection) => {
    onSubmit(selection);
  };

  const submitQuerySelection = () => {
    if (pullRequestNumber !== null) {
      submitSelection({
        kind: "pull-request",
        mode,
        reference: trimmedQuery,
      });
      return;
    }

    const branchName = exactBranch?.name ?? trimmedQuery;
    if (!branchName || branchValidationMessage) {
      return;
    }
    submitSelection({
      kind: "branch",
      mode,
      branch: branchName,
      worktreeWorkspace: getWorktreeByBranch(workspaces, activeWorkspace, branchName),
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => (prev < filteredBranches.length - 1 ? prev + 1 : prev));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (filteredBranches[selectedIndex] && trimmedQuery.length === 0) {
        const branch = filteredBranches[selectedIndex];
        submitSelection({
          kind: "branch",
          mode,
          branch: branch.name,
          worktreeWorkspace: getWorktreeByBranch(workspaces, activeWorkspace, branch.name),
        });
        return;
      }
      submitQuerySelection();
    }
  };

  const helperText =
    pullRequestNumber !== null
      ? `Use pull request #${pullRequestNumber} in ${mode === "worktree" ? "a worktree" : "local"}.`
      : branchValidationMessage
        ? branchValidationMessage
        : trimmedQuery.length > 0 && !exactBranch
          ? `${
              mode === "worktree" ? "Open a new worktree from" : "Create or checkout"
            } “${trimmedQuery}”.`
          : "Search branches or enter a GitHub pull request reference like #42.";

  return (
    <Dialog
      open={true}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onCancel();
        }
      }}
      className={styles.modal}
      cardClassName={styles.modalCard}
      ariaLabel="Branch and worktree workflow"
    >
      <div className={styles.modeRow}>
        <button
          type="button"
          className={`${styles.modeButton}${mode === "local" ? ` ${styles.modeButtonActive}` : ""}`}
          onClick={() => setMode("local")}
        >
          Local
        </button>
        <button
          type="button"
          className={`${styles.modeButton}${mode === "worktree" ? ` ${styles.modeButtonActive}` : ""}`}
          onClick={() => setMode("worktree")}
        >
          Worktree
        </button>
      </div>
      <div className={styles.helper}>{helperText}</div>
      <input
        ref={inputRef}
        className={styles.input}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search branches or enter #123"
        aria-label="Search branches or pull requests"
      />
      <BranchList
        branches={filteredBranches}
        currentBranch={currentBranch}
        selectedIndex={selectedIndex}
        listClassName={styles.list}
        listRef={listRef}
        itemClassName={styles.item}
        selectedItemClassName={styles.itemSelected}
        itemLabelClassName={styles.itemName}
        emptyClassName={styles.empty}
        emptyText="No branches found"
        onSelect={(branch) =>
          submitSelection({
            kind: "branch",
            mode,
            branch: branch.name,
            worktreeWorkspace: getWorktreeByBranch(workspaces, activeWorkspace, branch.name),
          })
        }
        onMouseEnter={setSelectedIndex}
        renderMeta={(branch) => {
          const isCurrent = branch.current ?? branch.name === currentBranch;
          const worktree = getWorktreeByBranch(workspaces, activeWorkspace, branch.name);
          return (
            <span className={styles.itemMeta}>
              {isCurrent && <span className={styles.itemCurrent}>current</span>}
              {worktree && <span className={styles.itemWorktree}>worktree</span>}
            </span>
          );
        }}
      />
    </Dialog>
  );
}
