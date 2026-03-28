import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import X from "lucide-react/dist/esm/icons/x";
import UserRound from "lucide-react/dist/esm/icons/user-round";
import {
  Select,
  StatusBadge,
  ToastBody,
  ToastCard,
  ToastHeader,
  ToastTitle,
  ToastViewport,
} from "@ku0/design-system";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  deriveSharedWorkspaceShellFrameState,
  deriveSharedWorkspaceShellResolvedFocusState,
  SHARED_WORKSPACE_SHELL_HOME_OPTION_VALUE,
} from "./sharedWorkspaceShellComposition";
import { useSharedWorkspaceShellState } from "./useSharedWorkspaceShellState";
import {
  getSectionMeta,
  ReadinessSummary,
  SharedWorkspaceShellSectionContent,
  shellSections,
  type ShellFocusTarget,
  type ShellSectionId,
} from "./sharedWorkspaceShellSections";
import * as styles from "./SharedWorkspaceShell.css";

type SharedWorkspaceShellProps = {
  children?: ReactNode;
};

export function SharedWorkspaceShell({ children }: SharedWorkspaceShellProps) {
  const state = useSharedWorkspaceShellState();
  const [dismissedErrors, setDismissedErrors] = useState<string[]>([]);
  const [focusTarget, setFocusTarget] = useState<ShellFocusTarget | null>(null);
  const activeSectionMeta = getSectionMeta(state.activeSection);
  const frameState = useMemo(
    () => deriveSharedWorkspaceShellFrameState(state),
    [
      state.activeWorkspaceId,
      state.hasPendingWorkspaceSelection,
      state.hostStartupError,
      state.hostStartupLoadState,
      state.missionError,
      state.missionLoadState,
      state.workspaceError,
      state.workspaceLoadState,
      state.workspaces,
    ]
  );
  const focusState = useMemo(
    () =>
      deriveSharedWorkspaceShellResolvedFocusState({
        state,
        focusTarget,
      }),
    [focusTarget, state]
  );
  const visibleErrors = useMemo(
    () => frameState.shellErrors.filter((error) => !dismissedErrors.includes(error.id)),
    [dismissedErrors, frameState.shellErrors]
  );

  useEffect(() => {
    setDismissedErrors((current) =>
      current.filter((id) => frameState.shellErrors.some((error) => error.id === id))
    );
  }, [frameState.shellErrors]);

  const handleNavigateSection = (section: ShellSectionId) => {
    setFocusTarget(null);
    state.navigateToSection(section);
  };

  const handleOpenFocusTarget = (target: ShellFocusTarget) => {
    setFocusTarget(target);
    state.navigateToSection(target.section);
  };

  const handleSelectWorkspace = (workspaceId: string | null) => {
    setFocusTarget(null);
    state.selectWorkspace(workspaceId);
  };

  useEffect(() => {
    if (!focusTarget || focusTarget.itemId || !focusState.resolvedFocusTargetItemId) {
      return;
    }

    setFocusTarget((current) => {
      if (!current || current.section !== focusTarget.section || current.itemId !== null) {
        return current;
      }

      return {
        ...current,
        itemId: focusState.resolvedFocusTargetItemId,
      };
    });
  }, [focusState.resolvedFocusTargetItemId, focusTarget]);

  return (
    <div className={styles.shell} data-workspace-shell={state.platformHint}>
      {visibleErrors.length ? (
        <ToastViewport className={styles.toastViewport} role="region" ariaLive="assertive">
          {visibleErrors.map((error) => (
            <ToastCard key={error.id} className={styles.toastCard} role="alert" tone="error">
              <ToastHeader className={styles.toastHeader}>
                <ToastTitle>{error.title}</ToastTitle>
                <button
                  aria-label={`Dismiss ${error.title}`}
                  className={styles.toastDismiss}
                  onClick={() =>
                    setDismissedErrors((current) =>
                      current.includes(error.id) ? current : [...current, error.id]
                    )
                  }
                  type="button"
                >
                  <X aria-hidden size={14} />
                </button>
              </ToastHeader>
              <ToastBody className={styles.toastBody}>{error.message}</ToastBody>
            </ToastCard>
          ))}
        </ToastViewport>
      ) : null}
      <header className={styles.header}>
        <div className={styles.headerLeading}>
          <Select
            ariaLabel="Select workspace"
            className={styles.workspaceSelect}
            triggerClassName={styles.workspaceSelectTrigger}
            menuClassName={styles.workspaceSelectMenu}
            optionClassName={styles.workspaceSelectOption}
            options={frameState.workspaceSelectOptions}
            value={frameState.workspaceSelectValue}
            onValueChange={(value) =>
              handleSelectWorkspace(
                value === SHARED_WORKSPACE_SHELL_HOME_OPTION_VALUE ? null : value
              )
            }
            placeholder="Select workspace"
          />
          <div className={styles.headerIdentity}>
            <p className={styles.kicker}>Workspace shell</p>
            <h1 className={styles.title}>{activeSectionMeta.title}</h1>
            <p className={styles.headerSubtitle}>{activeSectionMeta.detail}</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          {frameState.refreshLabel ? (
            <StatusBadge tone="progress" className={styles.runtimeBadge}>
              {frameState.refreshLabel}
            </StatusBadge>
          ) : null}
          <StatusBadge tone="progress" className={styles.runtimeBadge}>
            {state.runtimeMode}
          </StatusBadge>
          <StatusBadge tone="default" className={styles.runtimeBadge}>
            {state.platformHint}
          </StatusBadge>
          <button
            className={styles.button}
            onClick={() => {
              void state.refreshWorkspaces();
              void state.refreshMissionSummary();
              void state.refreshHostStartupStatus();
            }}
            disabled={frameState.shellRefreshing}
            type="button"
          >
            <RefreshCw aria-hidden size={16} />
            {frameState.shellRefreshing ? "Refreshing..." : "Refresh"}
          </button>
          {state.accountHref ? (
            <a className={styles.subtleButton} href={state.accountHref}>
              <UserRound aria-hidden size={16} />
              Account Center
            </a>
          ) : null}
        </div>
      </header>

      <main className={styles.content}>
        <nav aria-label="Workspace sections" className={styles.sectionNav}>
          {shellSections.map((section) => (
            <button
              key={section.id}
              className={`${styles.sectionNavButton} ${
                state.activeSection === section.id ? styles.sectionNavButtonActive : ""
              }`}
              onClick={() => handleNavigateSection(section.id)}
              type="button"
            >
              {section.label}
            </button>
          ))}
        </nav>

        <ReadinessSummary
          state={state}
          onNavigateSection={handleNavigateSection}
          onOpenFocusTarget={handleOpenFocusTarget}
        />

        <SharedWorkspaceShellSectionContent
          state={state}
          focusedMissionId={focusState.focusedMissionId}
          focusedReviewId={focusState.focusedReviewId}
          onNavigateSection={handleNavigateSection}
          onOpenFocusTarget={handleOpenFocusTarget}
          onSelectWorkspace={handleSelectWorkspace}
        />

        {children}
      </main>
    </div>
  );
}

export default SharedWorkspaceShell;
