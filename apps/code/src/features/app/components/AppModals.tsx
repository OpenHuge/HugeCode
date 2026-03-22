import { lazy, memo, Suspense } from "react";
import type { WorkspaceInfo } from "../../../types";
import type { BranchSwitcherState } from "../../git/hooks/useBranchSwitcher";
import type { BranchSwitcherSelection } from "../../git/types/branchWorkflow";
import { useGitBranches } from "../../git/hooks/useGitBranches";
import { SettingsModalHeader } from "../../settings/components/SettingsModalHeader";
import type { SettingsViewProps } from "../../settings/components/SettingsView";
import { loadSettingsView } from "../../settings/components/settingsViewLoader";
import type { useRenameThreadPrompt } from "../../threads/hooks/useRenameThreadPrompt";
import type { useClonePrompt } from "../../workspaces/hooks/useClonePrompt";
import type { useWorktreePrompt } from "../../workspaces/hooks/useWorktreePrompt";
import { ModalShell } from "../../../design-system";
import "@ku0/code-workspace-client/settings-shell/SettingsModalChrome.global.css";

const RenameThreadPrompt = lazy(() =>
  import("../../threads/components/RenameThreadPrompt").then((module) => ({
    default: module.RenameThreadPrompt,
  }))
);
const WorktreePrompt = lazy(() =>
  import("../../workspaces/components/WorktreePrompt").then((module) => ({
    default: module.WorktreePrompt,
  }))
);
const ClonePrompt = lazy(() =>
  import("../../workspaces/components/ClonePrompt").then((module) => ({
    default: module.ClonePrompt,
  }))
);
const BranchSwitcherPrompt = lazy(() =>
  import("../../git/components/BranchSwitcherPrompt").then((module) => ({
    default: module.BranchSwitcherPrompt,
  }))
);
const SettingsView = lazy(loadSettingsView);

export function SettingsLoadingFallback() {
  return (
    <ModalShell
      className="settings-overlay settings-overlay--chatgpt"
      cardClassName="settings-window settings-window--chatgpt"
      ariaLabel="Loading settings"
    >
      <SettingsModalHeader
        title="Loading settings"
        subtitle="Fetching the settings workspace so the first open does not feel like a dead click."
        contextLabel="Preparing"
        contextTone="progress"
      />
      <div className="settings-body">
        <div className="settings-detail">
          <div className="settings-detail-surface">
            <div className="settings-content settings-detail-scroll">
              <div className="settings-content-inner">
                <p aria-live="polite">Loading settings sections...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

type RenamePromptState = ReturnType<typeof useRenameThreadPrompt>["renamePrompt"];

type WorktreePromptState = ReturnType<typeof useWorktreePrompt>["worktreePrompt"];

type ClonePromptState = ReturnType<typeof useClonePrompt>["clonePrompt"];

export type AppModalsProps = {
  renamePrompt: RenamePromptState;
  onRenamePromptChange: (value: string) => void;
  onRenamePromptCancel: () => void;
  onRenamePromptConfirm: () => void;
  worktreePrompt: WorktreePromptState;
  onWorktreePromptNameChange: (value: string) => void;
  onWorktreePromptChange: (value: string) => void;
  onWorktreePromptCopyAgentsMdChange: (value: boolean) => void;
  onWorktreeSetupScriptChange: (value: string) => void;
  onWorktreePromptCancel: () => void;
  onWorktreePromptConfirm: () => void;
  clonePrompt: ClonePromptState;
  onClonePromptCopyNameChange: (value: string) => void;
  onClonePromptChooseCopiesFolder: () => void;
  onClonePromptUseSuggestedFolder: () => void;
  onClonePromptClearCopiesFolder: () => void;
  onClonePromptCancel: () => void;
  onClonePromptConfirm: () => void;
  branchSwitcher: BranchSwitcherState;
  workspaces: WorkspaceInfo[];
  activeWorkspace: WorkspaceInfo | null;
  branchSwitcherWorkspace: WorkspaceInfo | null;
  currentBranch: string | null;
  onBranchSwitcherSubmit: (selection: BranchSwitcherSelection) => void | Promise<void>;
  onBranchSwitcherCancel: () => void;
  settingsOpen: boolean;
  settingsSection: SettingsViewProps["initialSection"] | null;
  onCloseSettings: () => void;
  settingsProps: Omit<SettingsViewProps, "initialSection" | "onClose">;
};

export const AppModals = memo(function AppModals({
  renamePrompt,
  onRenamePromptChange,
  onRenamePromptCancel,
  onRenamePromptConfirm,
  worktreePrompt,
  onWorktreePromptNameChange,
  onWorktreePromptChange,
  onWorktreePromptCopyAgentsMdChange,
  onWorktreeSetupScriptChange,
  onWorktreePromptCancel,
  onWorktreePromptConfirm,
  clonePrompt,
  onClonePromptCopyNameChange,
  onClonePromptChooseCopiesFolder,
  onClonePromptUseSuggestedFolder,
  onClonePromptClearCopiesFolder,
  onClonePromptCancel,
  onClonePromptConfirm,
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
}: AppModalsProps) {
  const { branches: worktreeBranches } = useGitBranches({
    activeWorkspace: worktreePrompt?.workspace ?? null,
  });
  const { branches: branchSwitcherBranches } = useGitBranches({
    activeWorkspace: branchSwitcher ? branchSwitcherWorkspace : null,
  });

  return (
    <>
      {renamePrompt && (
        <Suspense fallback={null}>
          <RenameThreadPrompt
            currentName={renamePrompt.originalName}
            name={renamePrompt.name}
            onChange={onRenamePromptChange}
            onCancel={onRenamePromptCancel}
            onConfirm={onRenamePromptConfirm}
          />
        </Suspense>
      )}
      {worktreePrompt && (
        <Suspense fallback={null}>
          <WorktreePrompt
            workspaceName={worktreePrompt.workspace.name}
            name={worktreePrompt.name}
            branch={worktreePrompt.branch}
            branchWasEdited={worktreePrompt.branchWasEdited}
            branchSuggestions={worktreeBranches}
            copyAgentsMd={worktreePrompt.copyAgentsMd}
            setupScript={worktreePrompt.setupScript}
            scriptError={worktreePrompt.scriptError}
            error={worktreePrompt.error}
            isBusy={worktreePrompt.isSubmitting}
            isSavingScript={worktreePrompt.isSavingScript}
            onNameChange={onWorktreePromptNameChange}
            onChange={onWorktreePromptChange}
            onCopyAgentsMdChange={onWorktreePromptCopyAgentsMdChange}
            onSetupScriptChange={onWorktreeSetupScriptChange}
            onCancel={onWorktreePromptCancel}
            onConfirm={onWorktreePromptConfirm}
          />
        </Suspense>
      )}
      {clonePrompt && (
        <Suspense fallback={null}>
          <ClonePrompt
            workspaceName={clonePrompt.workspace.name}
            copyName={clonePrompt.copyName}
            copiesFolder={clonePrompt.copiesFolder}
            suggestedCopiesFolder={clonePrompt.suggestedCopiesFolder}
            error={clonePrompt.error}
            isBusy={clonePrompt.isSubmitting}
            onCopyNameChange={onClonePromptCopyNameChange}
            onChooseCopiesFolder={onClonePromptChooseCopiesFolder}
            onUseSuggestedCopiesFolder={onClonePromptUseSuggestedFolder}
            onClearCopiesFolder={onClonePromptClearCopiesFolder}
            onCancel={onClonePromptCancel}
            onConfirm={onClonePromptConfirm}
          />
        </Suspense>
      )}
      {branchSwitcher && (
        <Suspense fallback={null}>
          <BranchSwitcherPrompt
            branches={branchSwitcherBranches}
            workspaces={workspaces}
            activeWorkspace={activeWorkspace}
            currentBranch={currentBranch}
            onSubmit={onBranchSwitcherSubmit}
            onCancel={onBranchSwitcherCancel}
          />
        </Suspense>
      )}
      {settingsOpen && (
        <Suspense fallback={<SettingsLoadingFallback />}>
          <SettingsView
            {...settingsProps}
            onClose={onCloseSettings}
            initialSection={settingsSection ?? undefined}
          />
        </Suspense>
      )}
    </>
  );
});
