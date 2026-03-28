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
  deriveSharedWorkspaceShellUiState,
  reconcileSharedWorkspaceShellDismissedErrors,
  resolveSharedWorkspaceShellFocusTarget,
} from "./sharedWorkspaceShellComposition";
import type { SharedWorkspaceShellFocusTarget } from "./sharedWorkspaceShellContracts";
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
  const [focusTarget, setFocusTarget] = useState<SharedWorkspaceShellFocusTarget | null>(null);
  const activeSectionMeta = getSectionMeta(state.activeSection);
  const uiState = useMemo(
    () =>
      deriveSharedWorkspaceShellUiState({
        shellState: state,
        focusTarget,
        dismissedErrors,
      }),
    [
      state.activeWorkspaceId,
      state.hostStartupError,
      state.hostStartupLoadState,
      state.hasPendingWorkspaceSelection,
      state.missionError,
      state.missionLoadState,
      state.missionSummary,
      state.workspaces,
      state.workspaceError,
      state.workspaceLoadState,
      dismissedErrors,
      focusTarget,
    ]
  );

  useEffect(() => {
    setDismissedErrors((current) =>
      reconcileSharedWorkspaceShellDismissedErrors(current, uiState.shellErrors)
    );
  }, [uiState.shellErrors]);

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
    const resolvedFocusTarget = resolveSharedWorkspaceShellFocusTarget({
      focusTarget,
      missionLoadState: state.missionLoadState,
      missionItemIds: state.missionSummary.missionItems.map((item) => item.id),
      reviewItemIds: state.missionSummary.reviewItems.map((item) => item.id),
    });

    if (
      !focusTarget ||
      !resolvedFocusTarget ||
      resolvedFocusTarget === focusTarget ||
      focusTarget.itemId
    ) {
      return;
    }

    setFocusTarget((current) => {
      if (
        !current ||
        current.section !== focusTarget.section ||
        current.itemId !== focusTarget.itemId
      ) {
        return current;
      }

      return resolvedFocusTarget;
    });
  }, [
    focusTarget,
    state.missionLoadState,
    state.missionSummary.missionItems,
    state.missionSummary.reviewItems,
  ]);

  return (
    <div className={styles.shell} data-workspace-shell={state.platformHint}>
      {uiState.visibleErrors.length ? (
        <ToastViewport className={styles.toastViewport} role="region" ariaLive="assertive">
          {uiState.visibleErrors.map((error) => (
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
            options={uiState.workspaceSelectOptions}
            value={uiState.workspaceSelectValue}
            onValueChange={(value) => handleSelectWorkspace(value === "__home__" ? null : value)}
            placeholder="Select workspace"
          />
          <div className={styles.headerIdentity}>
            <p className={styles.kicker}>Workspace shell</p>
            <h1 className={styles.title}>{activeSectionMeta.title}</h1>
            <p className={styles.headerSubtitle}>{activeSectionMeta.detail}</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          {uiState.refreshLabel ? (
            <StatusBadge tone="progress" className={styles.runtimeBadge}>
              {uiState.refreshLabel}
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
            disabled={uiState.shellRefreshing}
            type="button"
          >
            <RefreshCw aria-hidden size={16} />
            {uiState.shellRefreshing ? "Refreshing..." : "Refresh"}
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
          focusedMissionId={uiState.focusedMissionId}
          focusedReviewId={uiState.focusedReviewId}
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
