import { useMemo } from "react";
import { deriveSharedWorkspaceOperatorAction } from "./sharedWorkspaceOperatorAction";
import { useSharedWorkspaceShellState } from "./useSharedWorkspaceShellState";
import * as styles from "./SharedWorkspaceShell.css";

export type FocusableSection = "missions" | "review";

export type ShellFocusTarget = {
  section: FocusableSection;
  itemId: string;
};

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

export type SharedWorkspaceShellState = ReturnType<typeof useSharedWorkspaceShellState>;
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
  const missionSummaryRefreshing = state.missionLoadState === "refreshing";
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
              : missionSummaryRefreshing
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
                      operatorAction.targetItemId &&
                      (operatorAction.targetSection === "missions" ||
                        operatorAction.targetSection === "review")
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
