import { StatusBadge } from "@ku0/design-system";
import { useEffect, useMemo } from "react";
import { deriveSharedWorkspaceOperatorAction } from "./sharedWorkspaceOperatorAction";
import type {
  SharedWorkspaceShellFocusableSection,
  SharedWorkspaceShellFocusTarget,
  SharedWorkspaceShellState,
} from "./sharedWorkspaceShellContracts";
import * as styles from "./SharedWorkspaceShell.css";

export type FocusableSection = SharedWorkspaceShellFocusableSection;
export type ShellFocusTarget = SharedWorkspaceShellFocusTarget;

export const shellSections = [
  {
    id: "home",
    label: "Home",
    title: "Home",
    detail: "Runtime framing, next actions, and shared shell health.",
  },
  {
    id: "workspaces",
    label: "Workspaces",
    title: "Workspaces",
    detail: "Workspace roster, connectivity, and workspace-level framing.",
  },
  {
    id: "missions",
    label: "Missions",
    title: "Missions",
    detail: "Live session activity, approvals, and runtime-backed progress.",
  },
  {
    id: "review",
    label: "Review",
    title: "Review",
    detail: "Review Pack readiness, validation state, and next actionability.",
  },
  {
    id: "settings",
    label: "Settings",
    title: "Settings",
    detail: "Control-plane defaults, runtime posture, and workspace settings framing.",
  },
] as const;

export type ShellSectionId = (typeof shellSections)[number]["id"];

export function getSectionMeta(section: ShellSectionId) {
  return shellSections.find((entry) => entry.id === section) ?? shellSections[0];
}

export function buildMissionActivityDomId(itemId: string) {
  return `shared-workspace-mission-${itemId}`;
}

export function buildReviewActivityDomId(itemId: string) {
  return `shared-workspace-review-${itemId}`;
}

export function ShellContentFallback() {
  return (
    <section className={styles.emptyCard}>
      <p className={styles.kicker}>Workspace shell</p>
      <h2 className={styles.cardTitle}>Select a workspace</h2>
      <p className={styles.body}>
        Choose a workspace to inspect runtime readiness, recent activity, and shared shell state.
      </p>
    </section>
  );
}

export function ReadinessSummary({
  state,
  onOpenFocusTarget,
  onNavigateSection,
}: {
  state: SharedWorkspaceShellState;
  onOpenFocusTarget: (target: ShellFocusTarget) => void;
  onNavigateSection: (section: ShellSectionId) => void;
}) {
  const missionSummaryHydrating =
    state.missionLoadState === "idle" || state.missionLoadState === "loading";
  const statValue = (value: number) => (missionSummaryHydrating ? "..." : String(value));
  const operatorAction = useMemo(
    () =>
      deriveSharedWorkspaceOperatorAction({
        loadState: state.missionLoadState,
        summary: state.missionSummary,
      }),
    [state.missionLoadState, state.missionSummary]
  );
  const showHostStartupCard =
    state.platformHint !== "web" ||
    state.hostStartupStatus !== null ||
    state.hostStartupLoadState === "loading" ||
    state.hostStartupLoadState === "refreshing";

  return (
    <>
      <section className={styles.heroCard}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Mission control summary</p>
          <h2 className={styles.cardTitle}>{state.missionSummary.workspaceLabel}</h2>
          <p className={styles.body}>
            {missionSummaryHydrating
              ? "Runtime summary is loading in the background so the shared shell can render immediately."
              : state.missionLoadState === "refreshing"
                ? "Refreshing runtime summary while keeping the shared shell interactive."
                : "Runtime framing, launch readiness, and shared workspace routing stay aligned across desktop and web wrappers."}
          </p>
        </div>
        <div className={styles.heroAside}>
          <section className={styles.operatorActionCard}>
            <div className={styles.readinessHeader}>
              <span
                aria-hidden
                className={`${styles.statusDot} ${styles.statusDotTone[operatorAction.tone]}`}
              />
              <span className={styles.readinessLabel}>Operator next</span>
            </div>
            <div className={styles.operatorActionCopy}>
              <h3 className={styles.activityTitle}>{operatorAction.label}</h3>
              <p className={styles.body}>{operatorAction.detail}</p>
            </div>
            {operatorAction.ctaLabel ? (
              <div className={styles.operatorActionFooter}>
                <button
                  className={styles.button}
                  onClick={() => {
                    if (
                      operatorAction.targetSection === "missions" ||
                      operatorAction.targetSection === "review"
                    ) {
                      onOpenFocusTarget({
                        section: operatorAction.targetSection,
                        itemId: operatorAction.targetItemId,
                      });
                      return;
                    }
                    onNavigateSection(operatorAction.targetSection);
                  }}
                  type="button"
                >
                  {operatorAction.ctaLabel}
                </button>
              </div>
            ) : null}
          </section>
          <div className={styles.statGrid}>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Tasks</span>
              <span className={styles.statValue}>{statValue(state.missionSummary.tasksCount)}</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Runs</span>
              <span className={styles.statValue}>{statValue(state.missionSummary.runsCount)}</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Approvals</span>
              <span className={styles.statValue}>
                {statValue(state.missionSummary.approvalCount)}
              </span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Review packs</span>
              <span className={styles.statValue}>
                {statValue(state.missionSummary.reviewPacksCount)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.summaryGrid}>
        <article className={styles.card}>
          <div className={styles.readinessHeader}>
            <span
              aria-hidden
              className={`${styles.statusDot} ${
                styles.statusDotTone[state.missionSummary.launchReadiness.tone]
              }`}
            />
            <span className={styles.readinessLabel}>
              {state.missionSummary.launchReadiness.label}
            </span>
          </div>
          <p className={styles.body}>{state.missionSummary.launchReadiness.detail}</p>
        </article>

        <article className={styles.card}>
          <div className={styles.readinessHeader}>
            <span
              aria-hidden
              className={`${styles.statusDot} ${
                styles.statusDotTone[state.missionSummary.continuityReadiness.tone]
              }`}
            />
            <span className={styles.readinessLabel}>
              {state.missionSummary.continuityReadiness.label}
            </span>
          </div>
          <p className={styles.body}>{state.missionSummary.continuityReadiness.detail}</p>
        </article>
        {showHostStartupCard ? (
          <article className={styles.card}>
            <div className={styles.readinessHeader}>
              <span
                aria-hidden
                className={`${styles.statusDot} ${
                  styles.statusDotTone[
                    state.hostStartupStatus?.tone ??
                      (state.hostStartupLoadState === "error"
                        ? "attention"
                        : state.hostStartupLoadState === "loading" ||
                            state.hostStartupLoadState === "refreshing"
                          ? "idle"
                          : "ready")
                  ]
                }`}
              />
              <span className={styles.readinessLabel}>
                {state.hostStartupStatus?.label ?? "Desktop host"}
              </span>
            </div>
            <p className={styles.body}>
              {state.hostStartupLoadState === "idle" || state.hostStartupLoadState === "loading"
                ? "Desktop host capabilities are hydrating after shell startup."
                : state.hostStartupLoadState === "refreshing"
                  ? "Refreshing desktop host startup status without blocking the shared shell."
                  : (state.hostStartupStatus?.detail ??
                    "Desktop host status is available once the shared shell finishes startup hydration.")}
            </p>
          </article>
        ) : null}
      </section>
    </>
  );
}

type WorkspaceSelectionProps = {
  state: SharedWorkspaceShellState;
  onSelectWorkspace: (workspaceId: string | null) => void;
};

export function WorkspaceRosterSection({ state, onSelectWorkspace }: WorkspaceSelectionProps) {
  const workspaceRosterHydrating =
    state.workspaceLoadState === "idle" || state.workspaceLoadState === "loading";

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
            : state.workspaceLoadState === "refreshing"
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

type SharedWorkspaceSectionActions = WorkspaceSelectionProps & {
  onNavigateSection: (section: ShellSectionId) => void;
  onOpenFocusTarget: (target: ShellFocusTarget) => void;
};

export function HomeOverviewSection({
  state,
  onNavigateSection,
  onOpenFocusTarget,
  onSelectWorkspace,
}: SharedWorkspaceSectionActions) {
  const missionSummaryHydrating =
    state.missionLoadState === "idle" || state.missionLoadState === "loading";
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
              : state.missionLoadState === "refreshing"
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
              : state.missionLoadState === "refreshing"
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
              : state.missionLoadState === "refreshing"
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

export function MissionActivitySection({
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

export function ReviewQueueSection({
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

export function SettingsSection({ state }: { state: SharedWorkspaceShellState }) {
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

export function SharedWorkspaceShellSectionContent({
  state,
  focusedMissionId,
  focusedReviewId,
  onNavigateSection,
  onOpenFocusTarget,
  onSelectWorkspace,
}: SharedWorkspaceSectionActions & {
  focusedMissionId: string | null;
  focusedReviewId: string | null;
}) {
  if (state.activeSection === "home") {
    return (
      <HomeOverviewSection
        state={state}
        onNavigateSection={onNavigateSection}
        onOpenFocusTarget={onOpenFocusTarget}
        onSelectWorkspace={onSelectWorkspace}
      />
    );
  }

  if (state.activeSection === "workspaces") {
    return <WorkspaceRosterSection onSelectWorkspace={onSelectWorkspace} state={state} />;
  }

  if (state.activeSection === "missions") {
    return <MissionActivitySection focusedMissionId={focusedMissionId} state={state} />;
  }

  if (state.activeSection === "review") {
    return <ReviewQueueSection focusedReviewId={focusedReviewId} state={state} />;
  }

  return <SettingsSection state={state} />;
}
