import { useMemo, useState } from "react";
import { PopoverSurface } from "../../../design-system";
import type { WorkspaceInfo } from "../../../types";
import { useGitBranches } from "../../git/hooks/useGitBranches";
import { BranchList } from "../../git/components/BranchList";
import { findExactBranch, filterBranches } from "../../git/utils/branchSearch";
import { validateBranchName } from "../../git/utils/branchValidation";

type MainHeaderBranchMenuProps = {
  workspace: WorkspaceInfo;
  branchName: string;
  onClose: () => void;
  onRefreshGitStatus: () => void;
};

export function MainHeaderBranchMenu({
  workspace,
  branchName,
  onClose,
  onRefreshGitStatus,
}: MainHeaderBranchMenuProps) {
  const [branchQuery, setBranchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { branches, checkoutBranch, createBranch } = useGitBranches({
    activeWorkspace: workspace.connected ? workspace : null,
  });

  const trimmedQuery = branchQuery.trim();
  const filteredBranches = useMemo(
    () => filterBranches(branches, branchQuery, { mode: "includes", whenEmptyLimit: 12 }),
    [branches, branchQuery]
  );
  const exactMatch = useMemo(
    () => findExactBranch(branches, trimmedQuery),
    [branches, trimmedQuery]
  );
  const canCreate = trimmedQuery.length > 0 && !exactMatch;
  const branchValidationMessage = useMemo(() => validateBranchName(trimmedQuery), [trimmedQuery]);

  const handleCheckout = async (nextBranchName: string) => {
    try {
      await checkoutBranch(nextBranchName);
      onRefreshGitStatus();
      onClose();
      setBranchQuery("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCreate = async () => {
    if (branchValidationMessage) {
      setError(branchValidationMessage);
      return;
    }
    if (!canCreate) {
      return;
    }
    try {
      await createBranch(trimmedQuery);
      onRefreshGitStatus();
      onClose();
      setBranchQuery("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <PopoverSurface
      className="workspace-branch-dropdown"
      role="menu"
      data-tauri-drag-region="false"
    >
      <div className="branch-actions">
        <div className="branch-search">
          <input
            value={branchQuery}
            onChange={(event) => {
              setBranchQuery(event.target.value);
              setError(null);
            }}
            onKeyDown={async (event) => {
              if (event.key !== "Enter") {
                return;
              }
              event.preventDefault();
              if (branchValidationMessage) {
                setError(branchValidationMessage);
                return;
              }
              if (canCreate) {
                await handleCreate();
                return;
              }
              if (exactMatch && exactMatch.name !== branchName) {
                await handleCheckout(exactMatch.name);
              }
            }}
            placeholder="Search or create branch"
            className="branch-input"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            data-tauri-drag-region="false"
            aria-label="Search branches"
          />
          <button
            type="button"
            className="branch-create-button"
            disabled={!canCreate || Boolean(branchValidationMessage)}
            onClick={handleCreate}
            data-tauri-drag-region="false"
          >
            Create
          </button>
        </div>
        {branchValidationMessage && <div className="branch-error">{branchValidationMessage}</div>}
        {canCreate && !branchValidationMessage && (
          <div className="branch-create-hint">Create branch “{trimmedQuery}”</div>
        )}
      </div>
      <BranchList
        branches={filteredBranches}
        currentBranch={branchName}
        listClassName="branch-list"
        listRole="none"
        itemClassName="branch-item"
        currentItemClassName="is-active"
        itemRole="menuitem"
        itemDataTauriDragRegion="false"
        emptyClassName="branch-empty"
        emptyText="No branches found"
        onSelect={async (branch) => {
          if (branch.name === branchName) {
            return;
          }
          await handleCheckout(branch.name);
        }}
      />
      {error && <div className="branch-error">{error}</div>}
    </PopoverSurface>
  );
}
