import { Button, WorkspaceChromePill } from "../../../design-system";
import { revealItemInDir } from "../../../application/runtime/facades/desktopHostFacade";
import Check from "lucide-react/dist/esm/icons/check";
import Copy from "lucide-react/dist/esm/icons/copy";
import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PopoverSurface } from "../../../design-system";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import type { OpenAppTarget, WorkspaceInfo } from "../../../types";
import { normalizePathForDisplay, revealInFileManagerLabel } from "../../../utils/platformPaths";
import { RecentThreadStrip } from "./RecentThreadStrip";
import { useDismissibleMenu } from "../hooks/useDismissibleMenu";
import type { WorkspaceLaunchScriptsState } from "../hooks/useWorkspaceLaunchScripts";
import { MainHeaderRightActions } from "./MainHeaderRightActions";
import type { RecentThreadItem } from "./RecentThreadStrip";
import { formatHeaderBranchLabel } from "../utils/headerBranchLabel";
import { MainHeaderShell, type MainHeaderShellProps } from "./MainHeaderShell";

const MainHeaderBranchMenu = lazy(() =>
  import("./MainHeaderBranchMenu").then((module) => ({
    default: module.MainHeaderBranchMenu,
  }))
);

type MainHeaderProps = {
  leadingNode?: ReactNode;
  workspace: WorkspaceInfo;
  worktreeLabel?: string | null;
  disableBranchMenu?: boolean;
  parentPath?: string | null;
  worktreePath?: string | null;
  openTargets: OpenAppTarget[];
  openAppIconById: Record<string, string>;
  selectedOpenAppId: string;
  onSelectOpenAppId: (id: string) => void;
  branchName: string;
  canManageBranches?: boolean;
  onRefreshGitStatus: () => void;
  canCopyThread?: boolean;
  onCopyThread?: () => void | Promise<void>;
  onToggleTerminal: () => void;
  isTerminalOpen: boolean;
  showTerminalButton?: boolean;
  showWorkspaceTools?: boolean;
  extraActionsNode?: ReactNode;
  headerActionsNode?: ReactNode;
  renderHeaderActions?: boolean;
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
  recentThreads?: RecentThreadItem[];
  onSelectRecentThread?: (threadId: string) => void;
  worktreeRename?: {
    name: string;
    error: string | null;
    notice: string | null;
    isSubmitting: boolean;
    isDirty: boolean;
    upstream?: {
      oldBranch: string;
      newBranch: string;
      error: string | null;
      isSubmitting: boolean;
      onConfirm: () => void;
    } | null;
    onFocus: () => void;
    onChange: (value: string) => void;
    onCancel: () => void;
    onCommit: () => void;
  };
};

export type { MainHeaderShellProps };
export { MainHeaderShell };

export function MainHeader({
  leadingNode,
  workspace,
  worktreeLabel = null,
  disableBranchMenu = false,
  parentPath = null,
  worktreePath = null,
  openTargets,
  openAppIconById,
  selectedOpenAppId,
  onSelectOpenAppId,
  branchName,
  canManageBranches = true,
  onRefreshGitStatus,
  canCopyThread = false,
  onCopyThread,
  onToggleTerminal,
  isTerminalOpen,
  showTerminalButton = true,
  showWorkspaceTools = true,
  extraActionsNode,
  headerActionsNode,
  renderHeaderActions = true,
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
  recentThreads = [],
  onSelectRecentThread,
  worktreeRename,
}: MainHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const launchScriptErrorRef = useRef<string | null>(null);
  const newLaunchScriptErrorRef = useRef<string | null>(null);
  const launchScriptEntryErrorRef = useRef<string | null>(null);
  const worktreeRenameErrorRef = useRef<string | null>(null);
  const worktreeUpstreamErrorRef = useRef<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const infoRef = useRef<HTMLDivElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const renameConfirmRef = useRef<HTMLButtonElement | null>(null);
  const renameOnCancel = worktreeRename?.onCancel;
  const branchMenuEnabled = canManageBranches;
  const resolvedWorktreePath = worktreePath ?? workspace.path;
  const displayWorktreePath = useMemo(
    () => normalizePathForDisplay(resolvedWorktreePath),
    [resolvedWorktreePath]
  );
  const workspaceTitleTooltip = useMemo(() => {
    const normalizedPath = displayWorktreePath.trim();
    if (!normalizedPath) {
      return workspace.name;
    }
    return `${workspace.name}\n${normalizedPath}`;
  }, [displayWorktreePath, workspace.name]);
  const branchLabel = useMemo(() => formatHeaderBranchLabel(branchName), [branchName]);
  const staticBranchLabel = useMemo(
    () => formatHeaderBranchLabel(worktreeLabel?.trim() || branchName),
    [branchName, worktreeLabel]
  );
  const relativeWorktreePath = useMemo(() => {
    const normalizedWorktreePath = displayWorktreePath.replace(/[\\/]+$/, "");
    if (!parentPath) {
      return normalizedWorktreePath;
    }
    const normalizedParentPath = normalizePathForDisplay(parentPath).replace(/[\\/]+$/, "");
    const comparableWorktreePath = normalizedWorktreePath.replace(/\\/g, "/");
    const comparableParentPath = normalizedParentPath.replace(/\\/g, "/");
    return comparableWorktreePath.startsWith(`${comparableParentPath}/`)
      ? normalizedWorktreePath.slice(normalizedParentPath.length + 1)
      : normalizedWorktreePath;
  }, [displayWorktreePath, parentPath]);
  const cdCommand = useMemo(() => `cd "${relativeWorktreePath}"`, [relativeWorktreePath]);
  useDismissibleMenu({
    isOpen: menuOpen,
    containerRef: menuRef,
    onClose: () => setMenuOpen(false),
  });

  useDismissibleMenu({
    isOpen: infoOpen,
    containerRef: infoRef,
    onClose: () => setInfoOpen(false),
  });

  useEffect(() => {
    if (!infoOpen && renameOnCancel) {
      renameOnCancel();
    }
  }, [infoOpen, renameOnCancel]);

  useEffect(() => {
    if (launchScriptError && launchScriptError !== launchScriptErrorRef.current) {
      pushErrorToast({
        title: "Couldn’t save action",
        message: launchScriptError,
      });
    }
    launchScriptErrorRef.current = launchScriptError;
  }, [launchScriptError]);

  useEffect(() => {
    const nextError = launchScriptsState?.newError ?? null;
    if (nextError && nextError !== newLaunchScriptErrorRef.current) {
      pushErrorToast({
        title: "Couldn’t create action",
        message: nextError,
      });
    }
    newLaunchScriptErrorRef.current = nextError;
  }, [launchScriptsState?.newError]);

  useEffect(() => {
    const nextError =
      Object.values(launchScriptsState?.errorById ?? {}).find(
        (value): value is string => typeof value === "string" && value.trim().length > 0
      ) ??
      launchScriptsState?.error ??
      null;
    if (nextError && nextError !== launchScriptEntryErrorRef.current) {
      pushErrorToast({
        title: "Couldn’t update action",
        message: nextError,
      });
    }
    launchScriptEntryErrorRef.current = nextError;
  }, [launchScriptsState?.error, launchScriptsState?.errorById]);

  useEffect(() => {
    const nextError = worktreeRename?.error ?? null;
    if (nextError && nextError !== worktreeRenameErrorRef.current) {
      pushErrorToast({
        title: "Couldn’t rename worktree",
        message: nextError,
      });
    }
    worktreeRenameErrorRef.current = nextError;
  }, [worktreeRename?.error]);

  useEffect(() => {
    const nextError = worktreeRename?.upstream?.error ?? null;
    if (nextError && nextError !== worktreeUpstreamErrorRef.current) {
      pushErrorToast({
        title: "Couldn’t update upstream branch",
        message: nextError,
      });
    }
    worktreeUpstreamErrorRef.current = nextError;
  }, [worktreeRename?.upstream?.error]);

  const resolvedHeaderActionsNode = headerActionsNode ?? (
    <MainHeaderRightActions
      path={resolvedWorktreePath}
      openTargets={openTargets}
      openAppIconById={openAppIconById}
      selectedOpenAppId={selectedOpenAppId}
      onSelectOpenAppId={onSelectOpenAppId}
      canCopyThread={canCopyThread}
      onCopyThread={onCopyThread}
      onToggleTerminal={onToggleTerminal}
      isTerminalOpen={isTerminalOpen}
      showTerminalButton={showTerminalButton}
      showWorkspaceTools={showWorkspaceTools}
      extraActionsNode={extraActionsNode}
      launchScript={launchScript}
      launchScriptEditorOpen={launchScriptEditorOpen}
      launchScriptDraft={launchScriptDraft}
      launchScriptSaving={launchScriptSaving}
      launchScriptError={launchScriptError}
      onRunLaunchScript={onRunLaunchScript}
      onOpenLaunchScriptEditor={onOpenLaunchScriptEditor}
      onCloseLaunchScriptEditor={onCloseLaunchScriptEditor}
      onLaunchScriptDraftChange={onLaunchScriptDraftChange}
      onSaveLaunchScript={onSaveLaunchScript}
      launchScriptsState={launchScriptsState}
    />
  );

  return (
    <MainHeaderShell
      leadingNode={leadingNode}
      identityNode={
        <div className="workspace-title-stack">
          <div className="workspace-title-line">
            <span className="workspace-title" title={workspaceTitleTooltip}>
              {workspace.name}
            </span>
            {disableBranchMenu ? (
              <div className="workspace-branch-static-row" ref={infoRef}>
                <WorkspaceChromePill
                  onClick={() => setInfoOpen((prev) => !prev)}
                  aria-haspopup="dialog"
                  aria-expanded={infoOpen}
                  data-desktop-drag-region="false"
                  aria-label={worktreeLabel?.trim() || branchName}
                  title={worktreeLabel?.trim() || branchName}
                  label={staticBranchLabel}
                  trailing={
                    <span className="workspace-branch-caret" aria-hidden>
                      ›
                    </span>
                  }
                  active={infoOpen}
                  className="workspace-branch-static-pill"
                />
                {infoOpen && (
                  <PopoverSurface className="worktree-info-popover" role="dialog">
                    {worktreeRename && (
                      <div className="worktree-info-rename">
                        <span className="worktree-info-label">Name</span>
                        <div className="worktree-info-command">
                          <input
                            ref={renameInputRef}
                            className="worktree-info-input"
                            value={worktreeRename.name}
                            onFocus={() => {
                              worktreeRename.onFocus();
                              renameInputRef.current?.select();
                            }}
                            onChange={(event) => worktreeRename.onChange(event.target.value)}
                            onBlur={(event) => {
                              const nextTarget = event.relatedTarget as Node | null;
                              if (
                                renameConfirmRef.current &&
                                nextTarget &&
                                renameConfirmRef.current.contains(nextTarget)
                              ) {
                                return;
                              }
                              if (!worktreeRename.isSubmitting && worktreeRename.isDirty) {
                                worktreeRename.onCommit();
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Escape") {
                                event.preventDefault();
                                if (!worktreeRename.isSubmitting) {
                                  worktreeRename.onCancel();
                                }
                              }
                              if (event.key === "Enter" && !worktreeRename.isSubmitting) {
                                event.preventDefault();
                                worktreeRename.onCommit();
                              }
                            }}
                            data-desktop-drag-region="false"
                            disabled={worktreeRename.isSubmitting}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="worktree-info-confirm"
                            ref={renameConfirmRef}
                            onClick={() => worktreeRename.onCommit()}
                            disabled={worktreeRename.isSubmitting || !worktreeRename.isDirty}
                            aria-label="Confirm rename"
                            title="Confirm rename"
                          >
                            <Check aria-hidden />
                          </Button>
                        </div>
                        {worktreeRename.notice && (
                          <span className="worktree-info-subtle">{worktreeRename.notice}</span>
                        )}
                        {worktreeRename.upstream && (
                          <div className="worktree-info-upstream">
                            <span className="worktree-info-subtle">
                              Do you want to update the upstream branch to{" "}
                              <strong>{worktreeRename.upstream.newBranch}</strong>?
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="worktree-info-upstream-button"
                              onClick={worktreeRename.upstream.onConfirm}
                              disabled={worktreeRename.upstream.isSubmitting}
                            >
                              Update upstream
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="worktree-info-title">Worktree</div>
                    <div className="worktree-info-row">
                      <span className="worktree-info-label">
                        Terminal{parentPath ? " (repo root)" : ""}
                      </span>
                      <div className="worktree-info-command">
                        <code className="worktree-info-code">{cdCommand}</code>
                        <button
                          type="button"
                          className="worktree-info-copy"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(cdCommand);
                            } catch (error) {
                              pushErrorToast({
                                title: "Couldn’t copy command",
                                message:
                                  error instanceof Error
                                    ? error.message
                                    : "Unable to copy command to clipboard.",
                              });
                            }
                          }}
                          data-desktop-drag-region="false"
                          aria-label="Copy command"
                          title="Copy command"
                        >
                          <Copy aria-hidden />
                        </button>
                      </div>
                      <span className="worktree-info-subtle">
                        Open this worktree in your terminal.
                      </span>
                    </div>
                    <div className="worktree-info-row">
                      <span className="worktree-info-label">Reveal</span>
                      <button
                        type="button"
                        className="worktree-info-reveal"
                        onClick={async () => {
                          try {
                            await revealItemInDir(resolvedWorktreePath);
                          } catch (error) {
                            pushErrorToast({
                              title: `Couldn’t open in ${revealInFileManagerLabel()}`,
                              message:
                                error instanceof Error
                                  ? error.message
                                  : "Unable to reveal this worktree path.",
                            });
                          }
                        }}
                        data-desktop-drag-region="false"
                      >
                        {revealInFileManagerLabel()}
                      </button>
                    </div>
                  </PopoverSurface>
                )}
              </div>
            ) : (
              <div className="workspace-branch-menu" ref={menuRef}>
                <WorkspaceChromePill
                  onClick={branchMenuEnabled ? () => setMenuOpen((prev) => !prev) : undefined}
                  aria-haspopup={branchMenuEnabled ? "menu" : undefined}
                  aria-expanded={branchMenuEnabled ? menuOpen : undefined}
                  aria-label={branchName}
                  disabled={!branchMenuEnabled}
                  title={
                    branchMenuEnabled ? branchName : `Git branch actions unavailable\n${branchName}`
                  }
                  data-desktop-drag-region="false"
                  label={<span className="workspace-branch">{branchLabel}</span>}
                  trailing={
                    <span className="workspace-branch-caret" aria-hidden>
                      ›
                    </span>
                  }
                  active={menuOpen}
                  className="workspace-branch-pill"
                />
                {branchMenuEnabled && menuOpen && (
                  <Suspense fallback={null}>
                    <MainHeaderBranchMenu
                      workspace={workspace}
                      branchName={branchName}
                      onRefreshGitStatus={onRefreshGitStatus}
                      onClose={() => setMenuOpen(false)}
                    />
                  </Suspense>
                )}
              </div>
            )}
            {recentThreads && recentThreads.length > 1 ? (
              <RecentThreadStrip threads={recentThreads} onSelectThread={onSelectRecentThread} />
            ) : null}
          </div>
        </div>
      }
      actionsNode={renderHeaderActions ? resolvedHeaderActionsNode : null}
    />
  );
}
