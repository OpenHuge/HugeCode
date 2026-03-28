import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import X from "lucide-react/dist/esm/icons/x";
import UserRound from "lucide-react/dist/esm/icons/user-round";
import {
  Select,
  type SelectOption,
  StatusBadge,
  ToastBody,
  ToastCard,
  ToastHeader,
  ToastTitle,
  ToastViewport,
} from "@ku0/design-system";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { SharedWorkspaceShellState } from "./sharedWorkspaceShellContracts";
import { useSharedWorkspaceShellState } from "./useSharedWorkspaceShellState";
import {
  buildMissionActivityDomId,
  buildReviewActivityDomId,
  getSectionMeta,
  ReadinessSummary,
  ShellContentFallback,
  shellSections,
  type ShellFocusTarget,
  type ShellSectionId,
} from "./sharedWorkspaceShellSections";
import * as styles from "./SharedWorkspaceShell.css";

type SharedWorkspaceShellProps = {
  children?: ReactNode;
};
function WorkspaceRosterSection({
  state,
  onSelectWorkspace,
}: {
  state: SharedWorkspaceShellState;
  onSelectWorkspace: (workspaceId: string | null) => void;
}) {
  const workspaceRosterHydrating =
    state.workspaceLoadState === "idle" || state.workspaceLoadState === "loading";
  const workspaceRosterRefreshing = state.workspaceLoadState === "refreshing";

  return (
    <section className={styles.workspaceSection}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeading}>
          <p className={styles.kicker}>Workspaces</p>
          <h2 className={styles.sectionTitle}>Browse the shared workspace roster</h2>
        </div>
        <p className={styles.sectionMeta}>
          {workspaceRosterHydrating
            ? "Hydrating workspace roster"
            : workspaceRosterRefreshing
              ? "Refreshing workspace roster"
              : `${state.workspaces.length} workspace${state.workspaces.length === 1 ? "" : "s"}`}
        </p>
      </div>
      <div className={styles.workspaceGrid}>
        <button
          className={`${styles.workspaceButton} ${
            state.activeWorkspaceId === null ? styles.workspaceButtonActive : ""
          }`}
          onClick={() => onSelectWorkspace(null)}
          type="button"
        >
          <span className={styles.workspaceName}>Home</span>
          <span className={styles.workspaceMeta}>Overview and runtime framing</span>
        </button>
        {state.workspaces.map((workspace) => {
          const connectedTone = workspace.connected ? "ready" : "attention";
          return (
            <button
              className={`${styles.workspaceButton} ${
                state.activeWorkspaceId === workspace.id ? styles.workspaceButtonActive : ""
              }`}
              key={workspace.id}
              onClick={() => onSelectWorkspace(workspace.id)}
              type="button"
            >
              <span className={styles.workspaceName}>{workspace.name}</span>
              <span className={styles.workspaceMeta}>
                <span
                  aria-hidden
                  className={`${styles.statusDot} ${styles.statusDotTone[connectedTone]}`}
                />
                {workspace.connected ? "Connected" : "Needs runtime connection"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function getHomeTriagePriority(tone: "blocked" | "attention" | "ready" | "active" | "neutral") {
  if (tone === "blocked") {
    return 500;
  }
  if (tone === "attention") {
    return 400;
  }
  if (tone === "ready") {
    return 300;
  }
  if (tone === "active") {
    return 220;
  }
  return 100;
}

type HomeTriageItem = {
  id: string;
  scopeLabel: "Mission" | "Review";
  targetItemId: string;
  title: string;
  detail: string;
  tone: "blocked" | "attention" | "ready" | "active";
  statusLabel: string;
  targetSection: "missions" | "review";
  sourceOrder: number;
};

function HomeOverviewSection({
  state,
  onNavigateSection,
  onOpenFocusTarget,
  onSelectWorkspace,
}: {
  state: SharedWorkspaceShellState;
  onNavigateSection: (section: ShellSectionId) => void;
  onOpenFocusTarget: (target: ShellFocusTarget) => void;
  onSelectWorkspace: (workspaceId: string | null) => void;
}) {
  const missionSummaryHydrating =
    state.missionLoadState === "idle" || state.missionLoadState === "loading";
  const missionSummaryRefreshing = state.missionLoadState === "refreshing";
  const topMissionItem = state.missionSummary.missionItems[0] ?? null;
  const topReviewItem = state.missionSummary.reviewItems[0] ?? null;
  const triageItems = useMemo(
    () =>
      [
        ...state.missionSummary.missionItems.flatMap<HomeTriageItem>((item, index) =>
          item.tone === "neutral"
            ? []
            : [
                {
                  id: `mission:${item.id}`,
                  scopeLabel: "Mission",
                  targetItemId: item.id,
                  title: item.title,
                  detail: item.detail,
                  tone: item.tone,
                  statusLabel: item.statusLabel,
                  targetSection: "missions",
                  sourceOrder: index,
                },
              ]
        ),
        ...state.missionSummary.reviewItems.flatMap<HomeTriageItem>((item, index) =>
          item.tone === "neutral"
            ? []
            : [
                {
                  id: `review:${item.id}`,
                  scopeLabel: "Review",
                  targetItemId: item.id,
                  title: item.title,
                  detail: item.summary,
                  tone: item.tone,
                  statusLabel: item.reviewStatusLabel,
                  targetSection: "review",
                  sourceOrder: 100 + index,
                },
              ]
        ),
      ]
        .sort(
          (left, right) =>
            getHomeTriagePriority(right.tone) - getHomeTriagePriority(left.tone) ||
            left.sourceOrder - right.sourceOrder
        )
        .slice(0, 4),
    [state.missionSummary.missionItems, state.missionSummary.reviewItems]
  );

  return (
    <section className={styles.sectionStack}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeading}>
          <p className={styles.kicker}>Home</p>
          <h2 className={styles.sectionTitle}>Operator overview</h2>
        </div>
        <p className={styles.sectionMeta}>Shared shell summary across current runtime truth</p>
      </div>
      <div className={styles.overviewGrid}>
        <button
          className={styles.overviewButton}
          onClick={() => {
            if (topMissionItem) {
              onOpenFocusTarget({
                section: "missions",
                itemId: topMissionItem.id,
              });
              return;
            }
            onNavigateSection("missions");
          }}
          type="button"
        >
          <span className={styles.workspaceName}>Missions</span>
          <span className={styles.body}>
            {missionSummaryHydrating
              ? "Runtime activity is loading in the background."
              : missionSummaryRefreshing
                ? "Refreshing runtime activity while keeping the current shell summary visible."
                : topMissionItem
                  ? `${topMissionItem.statusLabel}: ${topMissionItem.title}`
                  : `${state.missionSummary.runsCount} runs, ${state.missionSummary.approvalCount} approvals pending.`}
          </span>
        </button>
        <button
          className={styles.overviewButton}
          onClick={() => {
            if (topReviewItem) {
              onOpenFocusTarget({
                section: "review",
                itemId: topReviewItem.id,
              });
              return;
            }
            onNavigateSection("review");
          }}
          type="button"
        >
          <span className={styles.workspaceName}>Review</span>
          <span className={styles.body}>
            {missionSummaryHydrating
              ? "Review signals load after the shell becomes interactive."
              : missionSummaryRefreshing
                ? "Refreshing review signals while keeping the current queue visible."
                : topReviewItem
                  ? `${topReviewItem.reviewStatusLabel}: ${topReviewItem.title}`
                  : `${state.missionSummary.reviewPacksCount} review packs published with shared status grammar.`}
          </span>
        </button>
        <button
          className={styles.overviewButton}
          onClick={() => onNavigateSection("settings")}
          type="button"
        >
          <span className={styles.workspaceName}>Settings</span>
          <span className={styles.body}>{state.settingsFraming.subtitle}</span>
        </button>
      </div>
      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>Attention queue</p>
            <h3 className={styles.activityTitle}>Operator triage</h3>
          </div>
          <p className={styles.sectionMeta}>
            {missionSummaryHydrating
              ? "Hydrating mission and review priorities"
              : missionSummaryRefreshing
                ? "Refreshing mission and review priorities"
                : "Blocked and attention items stay ahead of passive activity"}
          </p>
        </div>
        {missionSummaryHydrating ? (
          <p className={styles.body}>
            Shared mission and review queues are still hydrating in the background.
          </p>
        ) : triageItems.length > 0 ? (
          <div className={styles.triageList}>
            {triageItems.map((item) => (
              <button
                className={styles.triageCard}
                key={item.id}
                onClick={() =>
                  onOpenFocusTarget({
                    section: item.targetSection,
                    itemId: item.targetItemId,
                  })
                }
                type="button"
              >
                <div className={styles.activityHeader}>
                  <div className={styles.activityCopy}>
                    <span className={styles.triageScope}>{item.scopeLabel}</span>
                    <h4 className={styles.workspaceName}>{item.title}</h4>
                  </div>
                  <div className={styles.activityStatus}>
                    <span
                      aria-hidden
                      className={`${styles.statusDot} ${styles.activityTone[item.tone]}`}
                    />
                    <span className={styles.readinessLabel}>{item.statusLabel}</span>
                  </div>
                </div>
                <p className={styles.body}>{item.detail}</p>
              </button>
            ))}
          </div>
        ) : (
          <p className={styles.body}>
            No actionable mission or review items have been published yet.
          </p>
        )}
      </section>
      <WorkspaceRosterSection onSelectWorkspace={onSelectWorkspace} state={state} />
    </section>
  );
}

function MissionActivitySection({
  state,
  focusedMissionId,
}: {
  state: SharedWorkspaceShellState;
  focusedMissionId: string | null;
}) {
  useEffect(() => {
    if (!focusedMissionId) {
      return;
    }
    const focusedCard = document.getElementById(buildMissionActivityDomId(focusedMissionId));
    focusedCard?.scrollIntoView?.({ block: "nearest" });
    focusedCard?.focus?.({ preventScroll: true });
  }, [focusedMissionId]);

  if (state.missionLoadState === "idle" || state.missionLoadState === "loading") {
    return (
      <section className={styles.emptyCard}>
        <p className={styles.kicker}>Mission activity</p>
        <h2 className={styles.cardTitle}>Loading runtime activity</h2>
        <p className={styles.body}>
          Mission, approval, and continuity data is loading after the shell becomes interactive.
        </p>
      </section>
    );
  }

  if (state.missionSummary.missionItems.length === 0) {
    return <ShellContentFallback />;
  }

  return (
    <section className={styles.sectionStack}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeading}>
          <p className={styles.kicker}>Missions</p>
          <h2 className={styles.sectionTitle}>Mission activity</h2>
        </div>
        <p className={styles.sectionMeta}>
          {state.missionLoadState === "refreshing"
            ? "Refreshing live runs while preserving the current mission list"
            : "Live runs, approvals, and continuity highlights"}
        </p>
      </div>
      <div className={styles.activityList}>
        {state.missionSummary.missionItems.map((item) => {
          const isFocused = item.id === focusedMissionId;

          return (
            <article
              className={`${styles.activityCard} ${isFocused ? styles.focusedActivityCard : ""}`}
              id={buildMissionActivityDomId(item.id)}
              key={item.id}
              tabIndex={isFocused ? -1 : undefined}
            >
              <div className={styles.activityHeader}>
                <div className={styles.activityCopy}>
                  {isFocused ? <span className={styles.focusBadge}>Operator focus</span> : null}
                  <h3 className={styles.activityTitle}>{item.title}</h3>
                  <p className={styles.activityMeta}>{item.workspaceName}</p>
                </div>
                <div className={styles.activityStatus}>
                  <span
                    aria-hidden
                    className={`${styles.statusDot} ${styles.activityTone[item.tone]}`}
                  />
                  <span className={styles.readinessLabel}>{item.statusLabel}</span>
                </div>
              </div>
              <p className={styles.body}>{item.detail}</p>
              {item.highlights.length > 0 ? (
                <div className={styles.highlightRow}>
                  {item.highlights.map((highlight) => (
                    <span className={styles.highlightChip} key={`${item.id}:${highlight}`}>
                      {highlight}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ReviewQueueSection({
  state,
  focusedReviewId,
}: {
  state: SharedWorkspaceShellState;
  focusedReviewId: string | null;
}) {
  useEffect(() => {
    if (!focusedReviewId) {
      return;
    }
    const focusedCard = document.getElementById(buildReviewActivityDomId(focusedReviewId));
    focusedCard?.scrollIntoView?.({ block: "nearest" });
    focusedCard?.focus?.({ preventScroll: true });
  }, [focusedReviewId]);

  if (state.missionLoadState === "idle" || state.missionLoadState === "loading") {
    return (
      <section className={styles.emptyCard}>
        <p className={styles.kicker}>Review queue</p>
        <h2 className={styles.cardTitle}>Loading review signals</h2>
        <p className={styles.body}>
          Review Pack readiness is loading in the background instead of blocking shell startup.
        </p>
      </section>
    );
  }

  if (state.missionSummary.reviewItems.length === 0) {
    return <ShellContentFallback />;
  }

  return (
    <section className={styles.sectionStack}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeading}>
          <p className={styles.kicker}>Review</p>
          <h2 className={styles.sectionTitle}>Review queue</h2>
        </div>
        <p className={styles.sectionMeta}>
          {state.missionLoadState === "refreshing"
            ? "Refreshing review readiness while preserving the current queue"
            : "Review Packs remain the default finish line"}
        </p>
      </div>
      <div className={styles.activityList}>
        {state.missionSummary.reviewItems.map((item) => {
          const isFocused = item.id === focusedReviewId;

          return (
            <article
              className={`${styles.activityCard} ${isFocused ? styles.focusedActivityCard : ""}`}
              id={buildReviewActivityDomId(item.id)}
              key={item.id}
              tabIndex={isFocused ? -1 : undefined}
            >
              <div className={styles.activityHeader}>
                <div className={styles.activityCopy}>
                  {isFocused ? <span className={styles.focusBadge}>Operator focus</span> : null}
                  <h3 className={styles.activityTitle}>{item.title}</h3>
                  <p className={styles.activityMeta}>{item.workspaceName}</p>
                </div>
                <div className={styles.activityStatus}>
                  <span
                    aria-hidden
                    className={`${styles.statusDot} ${styles.activityTone[item.tone]}`}
                  />
                  <span className={styles.readinessLabel}>{item.reviewStatusLabel}</span>
                </div>
              </div>
              <p className={styles.body}>{item.summary}</p>
              <div className={styles.highlightRow}>
                <span className={styles.highlightChip}>{item.validationLabel}</span>
                {item.warningCount > 0 ? (
                  <span className={styles.highlightChip}>
                    {item.warningCount} warning{item.warningCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SettingsSection({ state }: { state: SharedWorkspaceShellState }) {
  const missionSummaryPending =
    state.missionLoadState === "idle" || state.missionLoadState === "loading";

  return (
    <section className={styles.sectionStack}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeading}>
          <p className={styles.kicker}>{state.settingsFraming.kickerLabel}</p>
          <h2 className={styles.sectionTitle}>Control-plane settings</h2>
        </div>
        <StatusBadge className={styles.runtimeBadge}>
          {state.settingsFraming.contextLabel}
        </StatusBadge>
      </div>
      <section className={styles.card}>
        <h3 className={styles.activityTitle}>{state.settingsFraming.title}</h3>
        <p className={styles.body}>{state.settingsFraming.subtitle}</p>
      </section>
      <div className={styles.settingsGrid}>
        <article className={styles.card}>
          <p className={styles.kicker}>Execution routing</p>
          <h3 className={styles.activityTitle}>{state.runtimeMode}</h3>
          <p className={styles.body}>
            Runtime mode and workspace connectivity stay in the shared control-plane frame instead
            of diverging between desktop and web.
          </p>
        </article>
        <article className={styles.card}>
          <p className={styles.kicker}>Workspace coverage</p>
          <h3 className={styles.activityTitle}>
            {missionSummaryPending
              ? `.../${state.workspaces.length}`
              : `${state.missionSummary.connectedWorkspaceCount}/${state.workspaces.length}`}
          </h3>
          <p className={styles.body}>
            Connected workspaces are counted once and reused across shell, missions, review, and
            settings summaries.
          </p>
        </article>
        <article className={styles.card}>
          <p className={styles.kicker}>Operator entry</p>
          <h3 className={styles.activityTitle}>
            {state.accountHref ? "Account Center" : "Shared shell"}
          </h3>
          <p className={styles.body}>
            Account and access surfaces remain operator-facing utilities instead of becoming a
            separate top-level product center.
          </p>
        </article>
      </div>
    </section>
  );
}

export function SharedWorkspaceShell({ children }: SharedWorkspaceShellProps) {
  const state = useSharedWorkspaceShellState();
  const [dismissedErrors, setDismissedErrors] = useState<string[]>([]);
  const [focusTarget, setFocusTarget] = useState<ShellFocusTarget | null>(null);
  const activeSectionMeta = getSectionMeta(state.activeSection);
  const workspaceSelectOptions = useMemo<SelectOption[]>(
    () => [
      {
        value: "__home__",
        label: "Home overview",
      },
      ...(state.hasPendingWorkspaceSelection && state.activeWorkspaceId
        ? [
            {
              value: state.activeWorkspaceId,
              label:
                state.workspaceLoadState === "refreshing"
                  ? "Refreshing selected workspace..."
                  : "Loading selected workspace...",
              disabled: true,
            },
          ]
        : []),
      ...state.workspaces.map((workspace) => ({
        value: workspace.id,
        label: workspace.name,
      })),
    ],
    [
      state.activeWorkspaceId,
      state.hasPendingWorkspaceSelection,
      state.workspaceLoadState,
      state.workspaces,
    ]
  );
  const workspaceSelectValue = state.activeWorkspaceId ?? "__home__";
  const shellErrors = useMemo(
    () =>
      [
        state.workspaceError
          ? {
              id: `workspace:${state.workspaceError}`,
              title: "Workspace roster unavailable",
              message: state.workspaceError,
            }
          : null,
        state.missionError
          ? {
              id: `mission:${state.missionError}`,
              title: "Mission summary unavailable",
              message: state.missionError,
            }
          : null,
        state.hostStartupError
          ? {
              id: `host:${state.hostStartupError}`,
              title: "Desktop host status unavailable",
              message: state.hostStartupError,
            }
          : null,
      ].filter((error): error is { id: string; title: string; message: string } => error !== null),
    [state.hostStartupError, state.missionError, state.workspaceError]
  );
  const visibleErrors = useMemo(
    () => shellErrors.filter((error) => !dismissedErrors.includes(error.id)),
    [dismissedErrors, shellErrors]
  );

  useEffect(() => {
    setDismissedErrors((current) =>
      current.filter((id) => shellErrors.some((error) => error.id === id))
    );
  }, [shellErrors]);

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
    if (!focusTarget || focusTarget.itemId) {
      return;
    }
    if (state.missionLoadState === "idle" || state.missionLoadState === "loading") {
      return;
    }

    const resolvedItemId =
      focusTarget.section === "missions"
        ? (state.missionSummary.missionItems[0]?.id ?? null)
        : (state.missionSummary.reviewItems[0]?.id ?? null);

    if (!resolvedItemId) {
      return;
    }

    setFocusTarget((current) => {
      if (!current || current.section !== focusTarget.section || current.itemId !== null) {
        return current;
      }

      return {
        ...current,
        itemId: resolvedItemId,
      };
    });
  }, [
    focusTarget,
    state.missionLoadState,
    state.missionSummary.missionItems,
    state.missionSummary.reviewItems,
  ]);

  const focusedMissionId =
    focusTarget?.section === "missions"
      ? (focusTarget.itemId ?? state.missionSummary.missionItems[0]?.id ?? null)
      : null;
  const focusedReviewId =
    focusTarget?.section === "review"
      ? (focusTarget.itemId ?? state.missionSummary.reviewItems[0]?.id ?? null)
      : null;
  const shellHydrating =
    state.workspaceLoadState === "idle" ||
    state.workspaceLoadState === "loading" ||
    state.missionLoadState === "idle" ||
    state.missionLoadState === "loading" ||
    state.hostStartupLoadState === "idle" ||
    state.hostStartupLoadState === "loading";
  const shellRefreshing =
    state.workspaceLoadState === "refreshing" ||
    state.missionLoadState === "refreshing" ||
    state.hostStartupLoadState === "refreshing";
  const refreshLabel = shellRefreshing
    ? "Refreshing shell"
    : shellHydrating
      ? "Hydrating shell"
      : null;

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
            options={workspaceSelectOptions}
            value={workspaceSelectValue}
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
          {refreshLabel ? (
            <StatusBadge tone="progress" className={styles.runtimeBadge}>
              {refreshLabel}
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
            disabled={shellRefreshing}
            type="button"
          >
            <RefreshCw aria-hidden size={16} />
            {shellRefreshing ? "Refreshing..." : "Refresh"}
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

        {state.activeSection === "home" ? (
          <HomeOverviewSection
            state={state}
            onNavigateSection={handleNavigateSection}
            onOpenFocusTarget={handleOpenFocusTarget}
            onSelectWorkspace={handleSelectWorkspace}
          />
        ) : null}
        {state.activeSection === "workspaces" ? (
          <WorkspaceRosterSection onSelectWorkspace={handleSelectWorkspace} state={state} />
        ) : null}
        {state.activeSection === "missions" ? (
          <MissionActivitySection focusedMissionId={focusedMissionId} state={state} />
        ) : null}
        {state.activeSection === "review" ? (
          <ReviewQueueSection focusedReviewId={focusedReviewId} state={state} />
        ) : null}
        {state.activeSection === "settings" ? <SettingsSection state={state} /> : null}

        {children}
      </main>
    </div>
  );
}

export default SharedWorkspaceShell;
