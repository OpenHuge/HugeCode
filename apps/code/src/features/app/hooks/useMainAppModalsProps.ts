import { useMemo } from "react";
import type { useRenameThreadPrompt } from "../../threads/hooks/useRenameThreadPrompt";
import type { useClonePrompt } from "../../workspaces/hooks/useClonePrompt";
import type { useWorktreePrompt } from "../../workspaces/hooks/useWorktreePrompt";
import type { AppModalsProps } from "../components/AppModals";

type RenamePromptState = ReturnType<typeof useRenameThreadPrompt>;
type WorktreePromptState = ReturnType<typeof useWorktreePrompt>;
type ClonePromptState = ReturnType<typeof useClonePrompt>;

type UseMainAppModalsPropsParams = {
  renamePromptState: RenamePromptState;
  worktreePromptState: WorktreePromptState;
  clonePromptState: ClonePromptState;
  branchSwitcher: AppModalsProps["branchSwitcher"];
  workspaces: AppModalsProps["workspaces"];
  activeWorkspace: AppModalsProps["activeWorkspace"];
  branchSwitcherWorkspace: AppModalsProps["branchSwitcherWorkspace"];
  currentBranch: AppModalsProps["currentBranch"];
  onBranchSwitcherSubmit: AppModalsProps["onBranchSwitcherSubmit"];
  onBranchSwitcherCancel: AppModalsProps["onBranchSwitcherCancel"];
  settingsOpen: AppModalsProps["settingsOpen"];
  settingsSection: AppModalsProps["settingsSection"] | undefined;
  onCloseSettings: AppModalsProps["onCloseSettings"];
  settingsProps: AppModalsProps["settingsProps"];
};

export function useMainAppModalsProps({
  renamePromptState,
  worktreePromptState,
  clonePromptState,
  branchSwitcher,
  workspaces,
  activeWorkspace,
  branchSwitcherWorkspace,
  currentBranch,
  onBranchSwitcherSubmit,
  onBranchSwitcherCancel,
  settingsOpen,
  settingsSection,
  onCloseSettings,
  settingsProps,
}: UseMainAppModalsPropsParams): AppModalsProps {
  return useMemo(
    () => ({
      renamePrompt: renamePromptState.renamePrompt,
      onRenamePromptChange: renamePromptState.handleRenamePromptChange,
      onRenamePromptCancel: renamePromptState.handleRenamePromptCancel,
      onRenamePromptConfirm: renamePromptState.handleRenamePromptConfirm,
      worktreePrompt: worktreePromptState.worktreePrompt,
      onWorktreePromptNameChange: worktreePromptState.updateName,
      onWorktreePromptChange: worktreePromptState.updateBranch,
      onWorktreePromptCopyAgentsMdChange: worktreePromptState.updateCopyAgentsMd,
      onWorktreeSetupScriptChange: worktreePromptState.updateSetupScript,
      onWorktreePromptCancel: worktreePromptState.cancelPrompt,
      onWorktreePromptConfirm: worktreePromptState.confirmPrompt,
      clonePrompt: clonePromptState.clonePrompt,
      onClonePromptCopyNameChange: clonePromptState.updateCopyName,
      onClonePromptChooseCopiesFolder: clonePromptState.chooseCopiesFolder,
      onClonePromptUseSuggestedFolder: clonePromptState.useSuggestedCopiesFolder,
      onClonePromptClearCopiesFolder: clonePromptState.clearCopiesFolder,
      onClonePromptCancel: clonePromptState.cancelPrompt,
      onClonePromptConfirm: clonePromptState.confirmPrompt,
      branchSwitcher,
      workspaces,
      activeWorkspace,
      branchSwitcherWorkspace,
      currentBranch,
      onBranchSwitcherSubmit,
      onBranchSwitcherCancel,
      settingsOpen,
      settingsSection: settingsSection ?? null,
      onCloseSettings,
      settingsProps,
    }),
    [
      renamePromptState,
      worktreePromptState,
      clonePromptState,
      branchSwitcher,
      workspaces,
      activeWorkspace,
      branchSwitcherWorkspace,
      currentBranch,
      onBranchSwitcherSubmit,
      onBranchSwitcherCancel,
      settingsOpen,
      settingsSection,
      onCloseSettings,
      settingsProps,
    ]
  );
}
