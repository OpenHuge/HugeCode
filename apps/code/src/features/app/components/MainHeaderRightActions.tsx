import Check from "lucide-react/dist/esm/icons/check";
import Copy from "lucide-react/dist/esm/icons/copy";
import Terminal from "lucide-react/dist/esm/icons/terminal";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { WorkspaceHeaderAction, WorkspaceHeaderActionCopyGlyphs } from "../../../design-system";
import type { OpenAppTarget } from "../../../types";
import type { WorkspaceLaunchScriptsState } from "../hooks/useWorkspaceLaunchScripts";
import { LaunchScriptButton } from "./LaunchScriptButton";
import { LaunchScriptEntryButton } from "./LaunchScriptEntryButton";
import { OpenAppMenu } from "./OpenAppMenu";

export type MainHeaderRightActionsProps = {
  path: string;
  openTargets: OpenAppTarget[];
  openAppIconById: Record<string, string>;
  selectedOpenAppId: string;
  onSelectOpenAppId: (id: string) => void;
  canCopyThread?: boolean;
  onCopyThread?: () => void | Promise<void>;
  onToggleTerminal: () => void;
  isTerminalOpen: boolean;
  showTerminalButton?: boolean;
  showWorkspaceTools?: boolean;
  extraActionsNode?: ReactNode;
  launchScript?: string | null;
  launchScriptEditorOpen?: boolean;
  launchScriptDraft?: string;
  launchScriptSaving?: boolean;
  launchScriptError?: string | null;
  onRunLaunchScript?: () => void;
  onOpenLaunchScriptEditor?: () => void;
  onCloseLaunchScriptEditor?: () => void;
  onLaunchScriptDraftChange?: (value: string) => void;
  onSaveLaunchScript?: () => void;
  launchScriptsState?: WorkspaceLaunchScriptsState;
};

export function MainHeaderRightActions({
  path,
  openTargets,
  openAppIconById,
  selectedOpenAppId,
  onSelectOpenAppId,
  canCopyThread = false,
  onCopyThread,
  onToggleTerminal,
  isTerminalOpen,
  showTerminalButton = true,
  showWorkspaceTools = true,
  extraActionsNode,
  launchScript = null,
  launchScriptEditorOpen = false,
  launchScriptDraft = "",
  launchScriptSaving = false,
  launchScriptError = null,
  onRunLaunchScript,
  onOpenLaunchScriptEditor,
  onCloseLaunchScriptEditor,
  onLaunchScriptDraftChange,
  onSaveLaunchScript,
  launchScriptsState,
}: MainHeaderRightActionsProps) {
  const [copyFeedback, setCopyFeedback] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyClick = async () => {
    if (!onCopyThread) {
      return;
    }
    try {
      await onCopyThread();
      setCopyFeedback(true);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopyFeedback(false);
      }, 1200);
    } catch {
      // Errors are handled upstream in the copy handler.
    }
  };

  return (
    <>
      {showWorkspaceTools ? (
        <OpenAppMenu
          path={path}
          openTargets={openTargets}
          selectedOpenAppId={selectedOpenAppId}
          onSelectOpenAppId={onSelectOpenAppId}
          iconById={openAppIconById}
        />
      ) : null}
      {showWorkspaceTools &&
      onRunLaunchScript &&
      onOpenLaunchScriptEditor &&
      onCloseLaunchScriptEditor &&
      onLaunchScriptDraftChange &&
      onSaveLaunchScript ? (
        <div className="launch-script-cluster">
          <LaunchScriptButton
            launchScript={launchScript}
            editorOpen={launchScriptEditorOpen}
            draftScript={launchScriptDraft}
            isSaving={launchScriptSaving}
            error={launchScriptError}
            onRun={onRunLaunchScript}
            onOpenEditor={onOpenLaunchScriptEditor}
            onCloseEditor={onCloseLaunchScriptEditor}
            onDraftChange={onLaunchScriptDraftChange}
            onSave={onSaveLaunchScript}
            showNew={Boolean(launchScriptsState)}
            newEditorOpen={launchScriptsState?.newEditorOpen}
            newDraftScript={launchScriptsState?.newDraftScript}
            newDraftIcon={launchScriptsState?.newDraftIcon}
            newDraftLabel={launchScriptsState?.newDraftLabel}
            newError={launchScriptsState?.newError ?? null}
            onOpenNew={launchScriptsState?.onOpenNew}
            onCloseNew={launchScriptsState?.onCloseNew}
            onNewDraftChange={launchScriptsState?.onNewDraftScriptChange}
            onNewDraftIconChange={launchScriptsState?.onNewDraftIconChange}
            onNewDraftLabelChange={launchScriptsState?.onNewDraftLabelChange}
            onCreateNew={launchScriptsState?.onCreateNew}
          />
          {launchScriptsState?.launchScripts.map((entry) => (
            <LaunchScriptEntryButton
              key={entry.id}
              entry={entry}
              editorOpen={launchScriptsState.editorOpenId === entry.id}
              draftScript={launchScriptsState.draftScript}
              draftIcon={launchScriptsState.draftIcon}
              draftLabel={launchScriptsState.draftLabel}
              isSaving={launchScriptsState.isSaving}
              error={launchScriptsState.errorById[entry.id] ?? null}
              onRun={() => launchScriptsState.onRunScript(entry.id)}
              onOpenEditor={() => launchScriptsState.onOpenEditor(entry.id)}
              onCloseEditor={launchScriptsState.onCloseEditor}
              onDraftChange={launchScriptsState.onDraftScriptChange}
              onDraftIconChange={launchScriptsState.onDraftIconChange}
              onDraftLabelChange={launchScriptsState.onDraftLabelChange}
              onSave={launchScriptsState.onSaveScript}
              onDelete={launchScriptsState.onDeleteScript}
            />
          ))}
        </div>
      ) : null}
      {showTerminalButton ? (
        <WorkspaceHeaderAction
          onClick={onToggleTerminal}
          data-tauri-drag-region="false"
          aria-label="Toggle terminal panel"
          title="Terminal"
          active={isTerminalOpen}
          segment="icon"
          icon={<Terminal size={16} aria-hidden />}
        />
      ) : null}
      <WorkspaceHeaderAction
        onClick={handleCopyClick}
        disabled={!canCopyThread || !onCopyThread}
        data-tauri-drag-region="false"
        aria-label="Copy thread"
        title="Copy thread"
        copied={copyFeedback}
        segment="icon"
        icon={
          <WorkspaceHeaderActionCopyGlyphs
            copied={copyFeedback}
            copyIcon={<Copy size={16} />}
            checkIcon={<Check size={16} />}
          />
        }
      >
        {null}
      </WorkspaceHeaderAction>
      {extraActionsNode}
    </>
  );
}
