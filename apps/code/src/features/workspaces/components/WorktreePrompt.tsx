import type { FocusEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BranchInfo } from "../../../types";
import {
  Checkbox,
  DialogButton,
  DialogDescription,
  DialogDivider,
  DialogError,
  DialogFooter,
  DialogInput,
  DialogLabelText,
  DialogTextarea,
  DialogTitle,
} from "../../../design-system";
import { joinClassNames } from "../../../utils/classNames";
import { ModalShell } from "../../../design-system";
import { BranchList } from "../../git/components/BranchList";
import { filterBranches } from "../../git/utils/branchSearch";
import * as styles from "./WorktreePrompt.styles.css";

type WorktreePromptProps = {
  workspaceName: string;
  name: string;
  branch: string;
  branchWasEdited?: boolean;
  branchSuggestions?: BranchInfo[];
  copyAgentsMd: boolean;
  setupScript: string;
  scriptError?: string | null;
  error?: string | null;
  onNameChange: (value: string) => void;
  onChange: (value: string) => void;
  onCopyAgentsMdChange: (value: boolean) => void;
  onSetupScriptChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  isBusy?: boolean;
  isSavingScript?: boolean;
};

export function WorktreePrompt({
  workspaceName,
  name,
  branch,
  branchWasEdited = false,
  branchSuggestions = [],
  copyAgentsMd,
  setupScript,
  scriptError = null,
  error = null,
  onNameChange,
  onChange,
  onCopyAgentsMdChange,
  onSetupScriptChange,
  onCancel,
  onConfirm,
  isBusy = false,
  isSavingScript = false,
}: WorktreePromptProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const branchContainerRef = useRef<HTMLDivElement | null>(null);
  const branchListRef = useRef<HTMLDivElement | null>(null);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [selectedBranchIndex, setSelectedBranchIndex] = useState(0);
  const [didNavigateBranches, setDidNavigateBranches] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const filteredBranches = useMemo(() => {
    const query = !branchWasEdited && branchMenuOpen ? "" : branch;
    return filterBranches(branchSuggestions, query, { mode: "fuzzy", whenEmptyLimit: 8 });
  }, [branch, branchMenuOpen, branchSuggestions, branchWasEdited]);

  useEffect(() => {
    if (!branchMenuOpen) {
      return;
    }
    setDidNavigateBranches(false);
    setSelectedBranchIndex(0);
  }, [branchMenuOpen]);

  useEffect(() => {
    if (!branchMenuOpen) {
      return;
    }
    const itemEl = branchListRef.current?.children[selectedBranchIndex] as HTMLElement | undefined;
    itemEl?.scrollIntoView({ block: "nearest" });
  }, [branchMenuOpen, selectedBranchIndex]);

  const handleBranchSelect = (branchInfo: BranchInfo) => {
    onChange(branchInfo.name);
    setBranchMenuOpen(false);
    requestAnimationFrame(() => {
      const input = branchContainerRef.current?.querySelector("input") as HTMLInputElement | null;
      input?.focus();
    });
  };

  const handleBranchContainerBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextFocus = event.relatedTarget;
    if (!nextFocus) {
      setBranchMenuOpen(false);
      return;
    }
    if (event.currentTarget.contains(nextFocus)) {
      return;
    }
    setBranchMenuOpen(false);
  };

  return (
    <ModalShell
      open={true}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isBusy) {
          onCancel();
        }
      }}
      className="worktree-modal"
      cardClassName={styles.modalCard}
      ariaLabel="New worktree agent"
    >
      <DialogTitle className="worktree-modal-title">New worktree agent</DialogTitle>
      <DialogDescription className="worktree-modal-subtitle">
        Create a worktree under "{workspaceName}".
      </DialogDescription>
      <DialogInput
        id="worktree-name"
        ref={inputRef}
        fieldClassName="worktree-modal-input"
        label={<DialogLabelText className="worktree-modal-label">Name</DialogLabelText>}
        value={name}
        placeholder="(Optional)"
        onChange={(event) => onNameChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (!isBusy) {
              onCancel();
            }
          }
          if (event.key === "Enter" && !isBusy) {
            event.preventDefault();
            onConfirm();
          }
        }}
      />
      <div
        className={joinClassNames(styles.branch, "worktree-modal-branch")}
        ref={branchContainerRef}
        onFocusCapture={() => setBranchMenuOpen(true)}
        onBlurCapture={handleBranchContainerBlur}
      >
        <DialogInput
          id="worktree-branch"
          fieldClassName="worktree-modal-input"
          label={<DialogLabelText className="worktree-modal-label">Branch name</DialogLabelText>}
          value={branch}
          onChange={(event) => {
            setDidNavigateBranches(false);
            onChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              if (!isBusy) {
                onCancel();
              }
              return;
            }

            if (!branchMenuOpen || filteredBranches.length === 0) {
              if (event.key === "Enter" && !isBusy) {
                event.preventDefault();
                onConfirm();
              }
              if (event.key === "ArrowDown") {
                setBranchMenuOpen(true);
              }
              return;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();
              setDidNavigateBranches(true);
              setSelectedBranchIndex((prev) =>
                prev < filteredBranches.length - 1 ? prev + 1 : prev
              );
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setDidNavigateBranches(true);
              setSelectedBranchIndex((prev) => (prev > 0 ? prev - 1 : prev));
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              if (didNavigateBranches) {
                const picked = filteredBranches[selectedBranchIndex];
                if (picked) {
                  handleBranchSelect(picked);
                  return;
                }
              }
              if (!isBusy) {
                onConfirm();
              }
            }
          }}
        />
        {branchMenuOpen && (
          <BranchList
            branches={filteredBranches}
            currentBranch={null}
            selectedIndex={selectedBranchIndex}
            listClassName={joinClassNames(styles.branchList, "worktree-modal-branch-list")}
            listRef={branchListRef}
            itemClassName={joinClassNames(styles.branchItem, "worktree-modal-branch-item")}
            itemLabelClassName={joinClassNames(
              styles.branchItemName,
              "worktree-modal-branch-item-name"
            )}
            selectedItemClassName={joinClassNames(styles.branchItemSelected, "selected")}
            emptyClassName={joinClassNames(styles.branchEmpty, "worktree-modal-branch-empty")}
            emptyText={branch.trim().length > 0 ? "No matching branches" : "No branches found"}
            onMouseEnter={(index) => {
              setDidNavigateBranches(true);
              setSelectedBranchIndex(index);
            }}
            onSelect={handleBranchSelect}
          />
        )}
      </div>
      <Checkbox
        id="worktree-copy-agents"
        className={joinClassNames(styles.checkboxRow, "worktree-modal-checkbox-row")}
        inputClassName={joinClassNames(styles.checkboxInput, "worktree-modal-checkbox-input")}
        labelClassName="worktree-modal-checkbox-label"
        label={
          <>
            Copy <code className={styles.checkboxCode}>AGENTS.md</code> into the worktree
          </>
        }
        checked={copyAgentsMd}
        disabled={isBusy}
        onCheckedChange={onCopyAgentsMdChange}
      />
      <DialogDivider className="worktree-modal-divider" />
      <DialogTextarea
        id="worktree-setup-script"
        className="worktree-modal-textarea"
        label={
          <span className={joinClassNames(styles.sectionTitle, "worktree-modal-section-title")}>
            Environment setup script
          </span>
        }
        description={
          <span className={joinClassNames(styles.hint, "worktree-modal-hint")}>
            Stored on the project (Settings → Environments) and runs once in a dedicated terminal
            after each new worktree is created.
          </span>
        }
        value={setupScript}
        onChange={(event) => onSetupScriptChange(event.target.value)}
        placeholder="pnpm install"
        rows={4}
        disabled={isBusy || isSavingScript}
      />
      {scriptError && <DialogError className="worktree-modal-error">{scriptError}</DialogError>}
      {error && <DialogError className="worktree-modal-error">{error}</DialogError>}
      <DialogFooter className="worktree-modal-actions">
        <DialogButton
          variant="ghost"
          size="sm"
          className="worktree-modal-button"
          onClick={onCancel}
          disabled={isBusy}
        >
          Cancel
        </DialogButton>
        <DialogButton
          variant="primary"
          size="sm"
          className="worktree-modal-button"
          onClick={onConfirm}
          disabled={isBusy || branch.trim().length === 0}
        >
          Create
        </DialogButton>
      </DialogFooter>
    </ModalShell>
  );
}
