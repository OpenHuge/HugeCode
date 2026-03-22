import { useEffect, useMemo, useRef, useState } from "react";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import GitFork from "lucide-react/dist/esm/icons/git-fork";
import { PopoverSurface, WorkspaceChromePill } from "../../../design-system";
import { parseGitWorkflowPullRequestReference } from "../../../application/runtime/facades/gitWorkflowFacade";
import { useDismissibleMenu } from "../../app/hooks/useDismissibleMenu";
import { BranchList } from "../../git/components/BranchList";
import { useGitBranches } from "../../git/hooks/useGitBranches";
import type { BranchSwitcherSelection } from "../../git/types/branchWorkflow";
import { filterBranches, findExactBranch } from "../../git/utils/branchSearch";
import { validateBranchName } from "../../git/utils/branchValidation";
import type { WorkspaceInfo } from "../../../types";
import type { ComposerWorkspaceControls } from "./ComposerWorkspaceControls";
import * as dropdownStyles from "./ComposerBranchDropdown.css";
import * as barStyles from "./ComposerWorkspaceBar.css";

type ComposerBranchDropdownProps = {
  controls: ComposerWorkspaceControls;
  disabled?: boolean;
};

function getWorktreeByBranch(
  workspaces: WorkspaceInfo[],
  activeWorkspace: WorkspaceInfo | null,
  branch: string
) {
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
      (workspace) =>
        workspace.kind === "worktree" &&
        workspace.parentId === activeRepoWorkspaceId &&
        workspace.worktree?.branch === branch
    ) ?? null
  );
}

export function ComposerBranchDropdown({
  controls,
  disabled = false,
}: ComposerBranchDropdownProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<"local" | "worktree">(controls.mode);

  const { branches } = useGitBranches({
    activeWorkspace:
      controls.repositoryWorkspace && controls.repositoryWorkspace.connected
        ? controls.repositoryWorkspace
        : null,
  });

  useEffect(() => {
    setMode(controls.mode);
  }, [controls.mode]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setSelectedIndex(0);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const itemEl = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    itemEl?.scrollIntoView?.({ block: "nearest" });
  }, [isOpen, selectedIndex]);

  useDismissibleMenu({
    isOpen,
    containerRef: menuRef,
    additionalRefs: [triggerRef],
    onClose: () => {
      setIsOpen(false);
      setQuery("");
    },
  });

  const trimmedQuery = query.trim();
  const filteredBranches = useMemo(
    () => filterBranches(branches, query, { mode: "fuzzy", whenEmptyLimit: 10 }),
    [branches, query]
  );
  const exactBranch = useMemo(
    () => findExactBranch(branches, trimmedQuery),
    [branches, trimmedQuery]
  );
  const pullRequestNumber = parseGitWorkflowPullRequestReference(trimmedQuery);
  const branchValidationMessage =
    trimmedQuery.length > 0 && pullRequestNumber === null ? validateBranchName(trimmedQuery) : null;
  const helperText =
    pullRequestNumber !== null
      ? `Use pull request #${pullRequestNumber} in ${mode === "worktree" ? "a worktree" : "local"}.`
      : branchValidationMessage
        ? branchValidationMessage
        : trimmedQuery.length > 0 && !exactBranch
          ? `${
              mode === "worktree" ? "Open a new worktree from" : "Create or checkout"
            } "${trimmedQuery}".`
          : "Search branches or enter a pull request like #42.";

  const submitSelection = async (selection: BranchSwitcherSelection) => {
    if (!controls.onSelectGitWorkflowSelection) {
      return;
    }
    setIsSubmitting(true);
    try {
      await controls.onSelectGitWorkflowSelection(selection);
      setIsOpen(false);
      setQuery("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitQuerySelection = async () => {
    if (pullRequestNumber !== null) {
      await submitSelection({
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
    await submitSelection({
      kind: "branch",
      mode,
      branch: branchName,
      worktreeWorkspace: getWorktreeByBranch(
        controls.workspaces,
        controls.activeWorkspace,
        branchName
      ),
    });
  };

  const triggerDisabled =
    disabled ||
    isSubmitting ||
    !controls.repositoryWorkspace ||
    !controls.onSelectGitWorkflowSelection;

  return (
    <div className={barStyles.dropdownRoot}>
      <WorkspaceChromePill
        ref={triggerRef}
        aria-label="Branch & worktree"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={barStyles.branchTrigger}
        onClick={() => {
          if (triggerDisabled) {
            return;
          }
          setIsOpen((current) => !current);
        }}
        disabled={triggerDisabled}
        active={isOpen}
        leading={
          <span className={barStyles.branchTriggerIcon} aria-hidden>
            <GitFork size={14} strokeWidth={1.75} />
          </span>
        }
        label={<span className={barStyles.branchTriggerLabel}>{controls.branchTriggerLabel}</span>}
        trailing={
          <span className={barStyles.branchTriggerCaret} aria-hidden>
            <ChevronDown size={14} />
          </span>
        }
      />
      {isOpen ? (
        <PopoverSurface ref={menuRef} className={dropdownStyles.menu} role="menu">
          <div className={dropdownStyles.modeRow}>
            <button
              type="button"
              className={`${dropdownStyles.modeButton}${mode === "local" ? ` ${dropdownStyles.modeButtonActive}` : ""}`}
              onClick={() => setMode("local")}
            >
              Local
            </button>
            <button
              type="button"
              className={`${dropdownStyles.modeButton}${mode === "worktree" ? ` ${dropdownStyles.modeButtonActive}` : ""}`}
              onClick={() => setMode("worktree")}
            >
              Worktree
            </button>
          </div>
          <div className={dropdownStyles.helper}>{helperText}</div>
          <input
            ref={inputRef}
            className={dropdownStyles.input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={async (event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setIsOpen(false);
                setQuery("");
                return;
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelectedIndex((current) =>
                  current < filteredBranches.length - 1 ? current + 1 : current
                );
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelectedIndex((current) => (current > 0 ? current - 1 : current));
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                if (filteredBranches[selectedIndex] && trimmedQuery.length === 0) {
                  const selectedBranch = filteredBranches[selectedIndex];
                  await submitSelection({
                    kind: "branch",
                    mode,
                    branch: selectedBranch.name,
                    worktreeWorkspace: getWorktreeByBranch(
                      controls.workspaces,
                      controls.activeWorkspace,
                      selectedBranch.name
                    ),
                  });
                  return;
                }
                await submitQuerySelection();
              }
            }}
            placeholder="Search branches or enter #123"
            aria-label="Search branches or pull requests"
          />
          <BranchList
            branches={filteredBranches}
            currentBranch={controls.currentBranch}
            selectedIndex={selectedIndex}
            listClassName={dropdownStyles.list}
            listRef={listRef}
            itemClassName={dropdownStyles.item}
            itemLabelClassName={dropdownStyles.itemName}
            selectedItemClassName={dropdownStyles.itemSelected}
            currentItemClassName={dropdownStyles.itemCurrent}
            emptyClassName={dropdownStyles.empty}
            emptyText="No branches found"
            onMouseEnter={setSelectedIndex}
            onSelect={async (branch) => {
              await submitSelection({
                kind: "branch",
                mode,
                branch: branch.name,
                worktreeWorkspace: getWorktreeByBranch(
                  controls.workspaces,
                  controls.activeWorkspace,
                  branch.name
                ),
              });
            }}
            renderMeta={(branch) => {
              const isCurrent = branch.current ?? branch.name === controls.currentBranch;
              const worktreeWorkspace = getWorktreeByBranch(
                controls.workspaces,
                controls.activeWorkspace,
                branch.name
              );
              return (
                <span className={dropdownStyles.itemMeta}>
                  {isCurrent ? <span className={dropdownStyles.itemMetaChip}>current</span> : null}
                  {worktreeWorkspace ? (
                    <span className={dropdownStyles.itemMetaChip}>worktree</span>
                  ) : null}
                </span>
              );
            }}
          />
        </PopoverSurface>
      ) : null}
    </div>
  );
}
