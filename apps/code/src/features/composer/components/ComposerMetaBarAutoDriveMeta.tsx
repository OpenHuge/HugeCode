import { useId, useState } from "react";
import { joinClassNames } from "../../../utils/classNames";
import { formatCompactTokens } from "./ComposerContextUsage";
import * as autoDriveStyles from "./ComposerMetaBarAutoDriveMeta.styles.css";
import * as styles from "./ComposerMetaBar.styles.css";

type AutoDriveView = {
  source?: string | null;
  enabled: boolean;
  budget: {
    maxTokens: number;
    maxIterations: number;
    maxDurationMinutes: number;
    maxValidationFailures: number;
    maxReroutes: number;
  };
  riskPolicy: {
    allowValidationCommands: boolean;
    minimumConfidence: "low" | "medium" | "high";
  };
  preset: {
    active: "safe_default" | "tight_validation" | "fast_explore" | "custom";
  };
  controls: {
    canStart: boolean;
    canPause: boolean;
    canResume: boolean;
    canStop: boolean;
    busyAction: "starting" | "pausing" | "resuming" | "stopping" | null;
    onStart: () => void | Promise<void>;
    onPause: () => void | Promise<void>;
    onResume: () => void | Promise<void>;
    onStop: () => void | Promise<void>;
  };
  recovering: boolean;
  recoverySummary?: string | null;
  readiness: {
    readyToLaunch: boolean;
    issues: string[];
    setupProgress: number;
  };
  run?: {
    status:
      | "created"
      | "running"
      | "paused"
      | "review_ready"
      | "completed"
      | "cancelled"
      | "stopped"
      | "failed";
    stage: string;
    overallProgress: number;
    offRoute: boolean;
    rerouting: boolean;
    stopReason: string | null;
    lastValidationSummary: string | null;
    runtimeScenarioProfile?: {
      authorityScope: string | null;
      authoritySources: string[];
      representativeCommands: string[];
      componentCommands: string[];
      endToEndCommands: string[];
      samplePaths: string[];
      heldOutGuidance: string[];
      sourceSignals: string[];
      scenarioKeys: string[];
      safeBackground: boolean | null;
    } | null;
    runtimeDecisionTrace?: {
      phase: string | null;
      summary: string | null;
      selectedCandidateId: string | null;
      selectedCandidateSummary: string | null;
      selectionTags: string[];
      representativeCommand: string | null;
      authoritySources: string[];
      heldOutGuidance: string[];
    } | null;
    runtimeOutcomeFeedback?: {
      status: string | null;
      summary: string | null;
      failureClass: string | null;
      validationCommands: string[];
      humanInterventionRequired: boolean | null;
      heldOutPreserved: boolean | null;
      at: number | null;
    } | null;
    runtimeAutonomyState?: {
      independentThread: boolean | null;
      autonomyPriority: string | null;
      highPriority: boolean | null;
      escalationPressure: "low" | "medium" | "high" | null;
      unattendedContinuationAllowed: boolean | null;
      backgroundSafe: boolean | null;
      humanInterventionHotspots: string[];
    } | null;
    runtimeContinuationState?: {
      automaticFollowUpCount: number;
      status: "idle" | "continuing" | "stopped";
      lastContinuationAt: number | null;
      lastContinuationReason: string | null;
    } | null;
    lastChatgptDecisionLab?: {
      recommendedOptionId: string | null;
      recommendedOption: string | null;
      alternativeOptionIds: string[];
      decisionMemo: string | null;
      confidence: "low" | "medium" | "high" | null;
      assumptions: string[];
      followUpQuestions: string[];
    } | null;
  } | null;
  onToggleEnabled: (enabled: boolean) => void;
};

type ComposerMetaBarAutoDriveMetaProps = {
  autoDrive: AutoDriveView;
  disabled: boolean;
};

type ComposerAutoDriveStatusBarProps = {
  autoDrive: AutoDriveView;
  disabled: boolean;
  autoDriveBackendLabel: string;
  visibilityState: "hidden" | "entering" | "visible" | "exiting";
};

type AutoDrivePresentation = {
  headerStatusLabel: string | null;
  launchStatusLabel: string;
  headline: string;
  detail: string;
  presetLabel: string;
  validationLabel: string;
  hardStopBudgetLabel: string;
  startActionLabel: string;
  pauseActionLabel: string;
  resumeActionLabel: string;
  stopActionLabel: string;
  summaryState: "off" | "on" | "running" | "paused" | "arrived" | "stopped" | "failed";
  summaryLine: string;
  isBreathing: boolean;
  browserLaneLabel: string | null;
  decisionLabLabel: string | null;
};

function isRuntimeManagedAutoDriveSource(source: string | null | undefined): boolean {
  return source === "runtime_snapshot_v1";
}

function formatAutoDriveStatus(
  status: NonNullable<NonNullable<AutoDriveView["run"]>["status"]>
): string {
  switch (status) {
    case "created":
      return "Ready";
    case "running":
      return "Running";
    case "paused":
      return "Paused";
    case "review_ready":
    case "completed":
      return "Arrived";
    case "cancelled":
    case "stopped":
      return "Stopped";
    case "failed":
      return "Failed";
    default:
      return "Ready";
  }
}

function formatStageLabel(stage: string): string {
  const normalized = stage.replaceAll("_", " ").trim();
  return normalized.length > 0 ? normalized : "idle";
}

function formatDraftBudgetPressure(budget: AutoDriveView["budget"]): "Low" | "Medium" | "High" {
  if (
    budget.maxTokens < 1_500 ||
    budget.maxIterations <= 1 ||
    budget.maxDurationMinutes <= 1 ||
    budget.maxReroutes <= 1
  ) {
    return "High";
  }
  if (
    budget.maxTokens < 4_000 ||
    budget.maxIterations <= 2 ||
    budget.maxDurationMinutes <= 5 ||
    budget.maxReroutes <= 2
  ) {
    return "Medium";
  }
  return "Low";
}

function formatBudgetProfileLabel(autoDrive: AutoDriveView): string {
  return `${formatDraftBudgetPressure(autoDrive.budget)} budget pressure`;
}

function formatPresetLabel(activePreset: AutoDriveView["preset"]["active"]): string {
  switch (activePreset) {
    case "safe_default":
      return "Safety default";
    case "tight_validation":
      return "Tight validation";
    case "fast_explore":
      return "Fast explore";
    case "custom":
    default:
      return "Custom";
  }
}

function formatValidationLabel(autoDrive: AutoDriveView): string {
  if (!autoDrive.riskPolicy.allowValidationCommands) {
    return "Manual";
  }
  if (
    autoDrive.riskPolicy.minimumConfidence === "high" ||
    autoDrive.budget.maxValidationFailures <= 1
  ) {
    return "Strict";
  }
  if (
    autoDrive.riskPolicy.minimumConfidence === "low" ||
    autoDrive.budget.maxValidationFailures >= 3
  ) {
    return "Flexible";
  }
  return "Balanced";
}

function formatHardStopBudgetLabel(autoDrive: AutoDriveView): string {
  return `${formatCompactTokens(autoDrive.budget.maxTokens)} tokens · ${autoDrive.budget.maxIterations} iterations · ${autoDrive.budget.maxDurationMinutes}m`;
}

function formatRouteStateLabel(run: NonNullable<AutoDriveView["run"]>): string {
  if (run.status === "review_ready" || run.status === "completed") {
    return "Destination reached";
  }
  if (run.status === "paused") {
    return "Awaiting review";
  }
  if (run.status === "cancelled" || run.status === "stopped") {
    return run.offRoute ? "Stopped off route" : "Stopped safely";
  }
  if (run.status === "failed") {
    return "Route failed";
  }
  if (run.rerouting) {
    return "Rerouting";
  }
  return run.offRoute ? "Off route" : "On route";
}

function isBrowserReproFixVerifyScenario(run: NonNullable<AutoDriveView["run"]>): boolean {
  return run.runtimeScenarioProfile?.scenarioKeys.includes("browser_repro_fix_verify") ?? false;
}

function matchesBrowserBlockedSignal(value: string | null | undefined): boolean {
  const normalized = value?.trim();
  if (!normalized) {
    return false;
  }
  return /browser session blocked|chatgpt login|browser unavailable|login required|auth(entication)? required|workspace deactivated/i.test(
    normalized
  );
}

function extractBrowserBlockedReason(run: NonNullable<AutoDriveView["run"]>): string | null {
  const candidates = [
    run.runtimeOutcomeFeedback?.summary,
    run.runtimeOutcomeFeedback?.failureClass,
    run.stopReason,
    run.runtimeContinuationState?.lastContinuationReason,
  ];
  for (const candidate of candidates) {
    if (matchesBrowserBlockedSignal(candidate)) {
      return candidate?.trim() ?? null;
    }
  }
  return null;
}

function extractBrowserGapReason(run: NonNullable<AutoDriveView["run"]>): string | null {
  const candidates = [
    run.runtimeContinuationState?.lastContinuationReason,
    run.runtimeOutcomeFeedback?.summary,
    run.stopReason,
  ];
  for (const candidate of candidates) {
    const normalized = candidate?.trim();
    if (!normalized) {
      continue;
    }
    if (
      /browser verification gap remains|rerun .*real browser path|confirm the real browser path/i.test(
        normalized
      )
    ) {
      return normalized;
    }
  }
  return null;
}

type BrowserFixLoopPresentation = {
  headline: string;
  detail: string;
  summaryState: AutoDrivePresentation["summaryState"];
  browserLaneLabel: string;
  summaryLine: string;
};

function buildBrowserFixLoopPresentation(
  run: NonNullable<AutoDriveView["run"]>,
  launchStatusLabel: string
): BrowserFixLoopPresentation | null {
  if (!isBrowserReproFixVerifyScenario(run)) {
    return null;
  }

  const blockedReason = extractBrowserBlockedReason(run);
  if (blockedReason) {
    return {
      headline: "Browser session blocked",
      detail: blockedReason,
      summaryState: "failed",
      browserLaneLabel: "Session blocked",
      summaryLine: `${launchStatusLabel} · Browser session blocked`,
    };
  }

  const gapReason = extractBrowserGapReason(run);
  if (gapReason) {
    return {
      headline: "Browser verification gap remains",
      detail: gapReason,
      summaryState: "paused",
      browserLaneLabel: "Verification gap",
      summaryLine: `${launchStatusLabel} · Browser verification gap remains`,
    };
  }

  if (run.status === "review_ready" || run.status === "completed") {
    return {
      headline: "Browser verification passed",
      detail:
        formatOutcomeSummary(run) ??
        "The runtime recorded the browser repro and final verification path.",
      summaryState: "arrived",
      browserLaneLabel: "Verification passed",
      summaryLine: `${launchStatusLabel} · Browser verification passed`,
    };
  }

  return {
    headline: "Browser repro confirmed",
    detail:
      "The route is anchored to a live browser path. Land the code change, then return to the real browser and capture final verification evidence before stopping.",
    summaryState: run.status === "paused" ? "paused" : "running",
    browserLaneLabel: "Live repro",
    summaryLine: `${launchStatusLabel} · Browser repro confirmed`,
  };
}

function formatOutcomeSummary(run: NonNullable<AutoDriveView["run"]>): string | null {
  if (run.status === "review_ready" || run.status === "completed") {
    return run.stopReason ?? "The destination arrival criteria were satisfied.";
  }
  if (run.status === "paused") {
    return run.stopReason ?? "AutoDrive paused for review.";
  }
  if (run.status === "cancelled" || run.status === "stopped") {
    return run.stopReason ?? "AutoDrive stopped safely before reaching the destination.";
  }
  if (run.status === "failed") {
    return run.stopReason ?? "AutoDrive failed before reaching the destination.";
  }
  return null;
}

function formatOutcomeLabel(run: NonNullable<AutoDriveView["run"]>): string {
  if (run.status === "review_ready" || run.status === "completed") {
    return "Arrival summary";
  }
  if (run.status === "paused") {
    return "Paused for review";
  }
  if (run.status === "failed") {
    return "Failure reason";
  }
  return "Stop reason";
}

function formatPrimaryActionLabel(run: AutoDriveView["run"]): string {
  if (!run) {
    return "Start AutoDrive";
  }
  if (
    run.status === "review_ready" ||
    run.status === "completed" ||
    run.status === "cancelled" ||
    run.status === "stopped" ||
    run.status === "failed"
  ) {
    return "Restart AutoDrive";
  }
  return "Start AutoDrive";
}

function formatBusyActionLabel(
  action: NonNullable<AutoDriveView["controls"]["busyAction"]>
): string {
  switch (action) {
    case "starting":
      return "Launching route...";
    case "pausing":
      return "Pausing route...";
    case "resuming":
      return "Resuming route...";
    case "stopping":
      return "Stopping route...";
    default:
      return "Processing...";
  }
}

function formatBusyActionDetail(
  action: NonNullable<AutoDriveView["controls"]["busyAction"]>
): string {
  switch (action) {
    case "starting":
      return "AutoDrive is dispatching the first route leg from the current repo state.";
    case "pausing":
      return "Pause requested. AutoDrive is yielding control as soon as the active waypoint hands off.";
    case "resuming":
      return "AutoDrive is restoring the route context and re-entering the next safe waypoint.";
    case "stopping":
      return "Stop requested. AutoDrive is cancelling the active route before it advances any further.";
    default:
      return "A route control action is in progress.";
  }
}

function formatRecoveryLabel(recovering: boolean): string {
  return recovering ? "Restoring route state..." : "Route state ready";
}

function formatRecoverySummary(autoDrive: AutoDriveView): string | null {
  const normalizedSummary = autoDrive.recoverySummary?.trim();
  return normalizedSummary && normalizedSummary.length > 0 ? normalizedSummary : null;
}

function humanizeRuntimeToken(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  return normalized.replaceAll("_", " ");
}

function capitalizePhrase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatRuntimeAuthority(run: NonNullable<AutoDriveView["run"]>): string | null {
  const authorityScope = humanizeRuntimeToken(run.runtimeScenarioProfile?.authorityScope);
  if (authorityScope) {
    return authorityScope;
  }
  const firstAuthoritySource = humanizeRuntimeToken(
    run.runtimeDecisionTrace?.authoritySources[0] ?? run.runtimeScenarioProfile?.authoritySources[0]
  );
  return firstAuthoritySource ? capitalizePhrase(firstAuthoritySource) : null;
}

function formatRuntimeEvalLane(run: NonNullable<AutoDriveView["run"]>): string | null {
  return (
    run.runtimeDecisionTrace?.representativeCommand ??
    run.runtimeOutcomeFeedback?.validationCommands[0] ??
    run.runtimeScenarioProfile?.representativeCommands[0] ??
    null
  );
}

function formatRuntimeAutonomyPosture(run: NonNullable<AutoDriveView["run"]>): string | null {
  const parts: string[] = [];
  const autonomyPriority = humanizeRuntimeToken(run.runtimeAutonomyState?.autonomyPriority);
  if (autonomyPriority) {
    parts.push(`${capitalizePhrase(autonomyPriority)} priority`);
  }
  if (run.runtimeAutonomyState?.independentThread) {
    parts.push("Independent thread");
  }
  if ((run.runtimeAutonomyState?.humanInterventionHotspots.length ?? 0) > 0) {
    parts.push("Human review hotspots");
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatRuntimeFeedback(run: NonNullable<AutoDriveView["run"]>): string | null {
  return (
    run.runtimeOutcomeFeedback?.summary ??
    run.runtimeDecisionTrace?.summary ??
    run.lastValidationSummary ??
    null
  );
}

function buildNextActionSummary(run: NonNullable<AutoDriveView["run"]>): string {
  if (run.status === "paused") {
    return "Resume the current route or stop and hand control back to the operator.";
  }
  if (run.status === "review_ready" || run.status === "completed") {
    return "Review the arrival summary, then restart only if you want a fresh route.";
  }
  if (run.status === "cancelled" || run.status === "stopped") {
    return "Inspect the stop reason before restarting a new route.";
  }
  if (run.status === "failed") {
    return "Investigate the failure, then relaunch from a safer waypoint.";
  }
  if (run.rerouting) {
    return "Let AutoDrive replan before advancing the next waypoint.";
  }
  return "Advance the active leg and verify its arrival criteria before moving on.";
}

function formatDecisionLabLabel(run: NonNullable<AutoDriveView["run"]>): string | null {
  const decisionLab = run.lastChatgptDecisionLab;
  if (!decisionLab) {
    return null;
  }
  const parts: string[] = [];
  const recommendation =
    decisionLab.recommendedOptionId?.trim() || decisionLab.recommendedOption?.trim() || null;
  if (recommendation) {
    parts.push(recommendation);
  }
  if (decisionLab.confidence) {
    parts.push(`${capitalizePhrase(decisionLab.confidence)} confidence`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Decision recorded";
}

function formatAutoDriveRailHeadline(autoDrive: AutoDriveView): string {
  if (autoDrive.controls.busyAction) {
    return formatBusyActionLabel(autoDrive.controls.busyAction);
  }
  if (!isRuntimeManagedAutoDriveSource(autoDrive.source ?? null)) {
    return autoDrive.run ? "Read-only fallback" : "Runtime snapshot unavailable";
  }
  if (autoDrive.recovering) {
    return formatRecoverySummary(autoDrive) ?? "Restoring route state";
  }
  if (!autoDrive.enabled && !autoDrive.run) {
    return "Manual compose";
  }
  if (autoDrive.run) {
    if (formatOutcomeSummary(autoDrive.run)) {
      return formatOutcomeLabel(autoDrive.run);
    }
    return `${formatRouteStateLabel(autoDrive.run)} in ${formatStageLabel(autoDrive.run.stage)}`;
  }
  if (!autoDrive.readiness.readyToLaunch) {
    return autoDrive.enabled ? `Setup ${autoDrive.readiness.setupProgress}%` : "Manual compose";
  }
  return autoDrive.enabled ? "Ready to launch" : "Manual compose";
}

function formatAutoDriveRailDetail(autoDrive: AutoDriveView): string {
  if (autoDrive.controls.busyAction) {
    return formatBusyActionDetail(autoDrive.controls.busyAction);
  }
  if (!isRuntimeManagedAutoDriveSource(autoDrive.source ?? null)) {
    return "Displayed route state is unavailable because the live mission-control snapshot is missing. Runtime-owned start, pause, resume, and stop controls stay disabled until runtime truth returns.";
  }
  if (autoDrive.recovering) {
    return (
      formatRecoverySummary(autoDrive) ??
      "Reloading the latest route snapshot before new controls are enabled."
    );
  }
  if (!autoDrive.enabled && !autoDrive.run) {
    return "AutoDrive is off. Keep composing normally, or turn it on when you want supervised autonomous execution.";
  }
  if (autoDrive.run) {
    return formatOutcomeSummary(autoDrive.run) ?? buildNextActionSummary(autoDrive.run);
  }
  if (!autoDrive.readiness.readyToLaunch) {
    return autoDrive.enabled
      ? (autoDrive.readiness.issues[0] ??
          "Complete the remaining launch checks before handing control to AutoDrive.")
      : "AutoDrive stays inactive until you turn it on.";
  }
  return autoDrive.enabled
    ? "AutoDrive is ready. Start a supervised route when you want the runtime to take over."
    : "Turn on AutoDrive when you want the runtime to continue without manual turn-by-turn control.";
}

function buildAutoDrivePresentation(autoDrive: AutoDriveView): AutoDrivePresentation {
  const autoDriveRunStatus = autoDrive.run ? formatAutoDriveStatus(autoDrive.run.status) : null;
  const autoDriveBusyLabel = autoDrive.controls.busyAction
    ? formatBusyActionLabel(autoDrive.controls.busyAction)
    : null;
  const autoDriveRecoveryLabel = formatRecoveryLabel(autoDrive.recovering);
  const headerStatusLabel =
    autoDriveBusyLabel ??
    (!isRuntimeManagedAutoDriveSource(autoDrive.source ?? null)
      ? "Degraded"
      : autoDrive.recovering
        ? autoDriveRecoveryLabel
        : autoDrive.run
          ? autoDriveRunStatus
          : !autoDrive.enabled
            ? "Off"
            : autoDrive.readiness.readyToLaunch
              ? "On"
              : `${autoDrive.readiness.issues.length || 1} checks`);
  const launchStatusLabel = autoDrive.run
    ? `${Math.max(0, Math.min(100, Math.round(autoDrive.run.overallProgress)))}% route`
    : autoDrive.enabled
      ? autoDrive.readiness.readyToLaunch
        ? "Ready to launch"
        : `${autoDrive.readiness.setupProgress}% ready`
      : "Manual mode";
  const browserFixLoopPresentation = autoDrive.run
    ? buildBrowserFixLoopPresentation(autoDrive.run, launchStatusLabel)
    : null;
  const headline = browserFixLoopPresentation?.headline ?? formatAutoDriveRailHeadline(autoDrive);
  const detail = browserFixLoopPresentation?.detail ?? formatAutoDriveRailDetail(autoDrive);
  const startActionLabel =
    autoDrive.controls.busyAction === "starting"
      ? formatBusyActionLabel("starting")
      : formatPrimaryActionLabel(autoDrive.run);
  const pauseActionLabel =
    autoDrive.controls.busyAction === "pausing" ? formatBusyActionLabel("pausing") : "Pause";
  const resumeActionLabel =
    autoDrive.controls.busyAction === "resuming" ? formatBusyActionLabel("resuming") : "Resume";
  const stopActionLabel =
    autoDrive.controls.busyAction === "stopping" ? formatBusyActionLabel("stopping") : "Stop";
  const summaryState =
    browserFixLoopPresentation?.summaryState ??
    (!isRuntimeManagedAutoDriveSource(autoDrive.source ?? null)
      ? "failed"
      : autoDrive.run?.status === "paused"
        ? "paused"
        : autoDrive.run?.status === "review_ready" || autoDrive.run?.status === "completed"
          ? "arrived"
          : autoDrive.run?.status === "cancelled" || autoDrive.run?.status === "stopped"
            ? "stopped"
            : autoDrive.run?.status === "failed"
              ? "failed"
              : autoDrive.run
                ? "running"
                : autoDrive.enabled
                  ? "on"
                  : "off");

  return {
    headerStatusLabel,
    launchStatusLabel,
    headline,
    detail,
    presetLabel: formatPresetLabel(autoDrive.preset.active),
    validationLabel: formatValidationLabel(autoDrive),
    hardStopBudgetLabel: formatHardStopBudgetLabel(autoDrive),
    startActionLabel,
    pauseActionLabel,
    resumeActionLabel,
    stopActionLabel,
    summaryState,
    summaryLine:
      browserFixLoopPresentation?.summaryLine ??
      (autoDrive.run
        ? `${launchStatusLabel} · ${headline}`
        : autoDrive.readiness.readyToLaunch
          ? `${launchStatusLabel} · ${formatBudgetProfileLabel(autoDrive)}`
          : `${launchStatusLabel} · ${detail}`),
    isBreathing:
      autoDrive.controls.busyAction !== null ||
      autoDrive.run?.status === "running" ||
      autoDrive.run?.status === "created",
    browserLaneLabel: browserFixLoopPresentation?.browserLaneLabel ?? null,
    decisionLabLabel: autoDrive.run ? formatDecisionLabLabel(autoDrive.run) : null,
  };
}

export function ComposerMetaBarAutoDriveMeta({
  autoDrive,
  disabled,
}: ComposerMetaBarAutoDriveMetaProps) {
  const switchState = autoDrive.enabled ? "on" : "off";

  return (
    <div className={autoDriveStyles.root}>
      <button
        type="button"
        role="switch"
        className={joinClassNames(autoDriveStyles.switchButton, "composer-autodrive-switch")}
        aria-label="Toggle AutoDrive"
        aria-checked={autoDrive.enabled}
        disabled={disabled}
        data-state={switchState}
        onClick={() => autoDrive.onToggleEnabled(!autoDrive.enabled)}
      >
        <span
          className={autoDriveStyles.switchTrack}
          data-testid="autodrive-trigger-state"
          data-state={switchState}
          aria-hidden
        >
          <span className={autoDriveStyles.switchLabel} data-state={switchState}>
            Auto
          </span>
          <span
            className={autoDriveStyles.switchThumb}
            data-testid="autodrive-trigger-thumb"
            data-state={switchState}
          />
        </span>
      </button>
    </div>
  );
}

export function ComposerAutoDriveStatusBar({
  autoDrive,
  disabled,
  autoDriveBackendLabel,
  visibilityState,
}: ComposerAutoDriveStatusBarProps) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const presentation = buildAutoDrivePresentation(autoDrive);

  return (
    <div
      className={autoDriveStyles.statusRailPresence}
      data-visibility={visibilityState}
      aria-hidden={visibilityState === "hidden" ? "true" : undefined}
    >
      <section
        className={autoDriveStyles.statusRail}
        data-state={presentation.summaryState}
        data-breathing={presentation.isBreathing ? "true" : "false"}
        aria-label="AutoDrive status rail"
      >
        <button
          type="button"
          className={autoDriveStyles.statusRailToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((current) => !current)}
        >
          <span className={autoDriveStyles.statusRailLead}>
            <span className={autoDriveStyles.statusSignal} data-state={presentation.summaryState} />
            <span className={autoDriveStyles.statusTitle}>AutoDrive</span>
            {presentation.headerStatusLabel ? (
              <span className={styles.autoDriveHeaderBadge}>{presentation.headerStatusLabel}</span>
            ) : null}
          </span>
          <span className={autoDriveStyles.statusSummary}>{presentation.summaryLine}</span>
          <span className={autoDriveStyles.statusRailMeta}>
            <span className={styles.autoDriveStatusChip}>{presentation.launchStatusLabel}</span>
            <svg
              className={autoDriveStyles.triggerCaret}
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden
            >
              <path
                d="M2.25 4.5 6 8l3.75-3.5"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>

        {expanded ? (
          <div id={panelId} className={autoDriveStyles.expandedPanel}>
            <div
              className={autoDriveStyles.statusCard}
              data-testid="autodrive-status-card"
              data-state={presentation.summaryState}
            >
              <strong className={autoDriveStyles.headline}>{presentation.headline}</strong>
              <span className={autoDriveStyles.detail}>{presentation.detail}</span>
              <div className={autoDriveStyles.summaryGrid}>
                <div className={autoDriveStyles.summaryItem}>
                  <span className={autoDriveStyles.summaryLabel}>Route preset</span>
                  <span className={autoDriveStyles.summaryValue}>{presentation.presetLabel}</span>
                </div>
                <div className={autoDriveStyles.summaryItem}>
                  <span className={autoDriveStyles.summaryLabel}>Validation</span>
                  <span className={autoDriveStyles.summaryValue}>
                    {presentation.validationLabel}
                  </span>
                </div>
                <div className={autoDriveStyles.summaryItem}>
                  <span className={autoDriveStyles.summaryLabel}>Backend preference</span>
                  <span className={autoDriveStyles.summaryValue}>{autoDriveBackendLabel}</span>
                </div>
                <div className={autoDriveStyles.summaryItem}>
                  <span className={autoDriveStyles.summaryLabel}>Hard-stop budget</span>
                  <span className={autoDriveStyles.summaryValue}>
                    {presentation.hardStopBudgetLabel}
                  </span>
                </div>
                {autoDrive.run ? (
                  <>
                    {presentation.browserLaneLabel ? (
                      <div className={autoDriveStyles.summaryItem}>
                        <span className={autoDriveStyles.summaryLabel}>Browser lane</span>
                        <span className={autoDriveStyles.summaryValue}>
                          {presentation.browserLaneLabel}
                        </span>
                      </div>
                    ) : null}
                    {presentation.decisionLabLabel ? (
                      <div className={autoDriveStyles.summaryItem}>
                        <span className={autoDriveStyles.summaryLabel}>Decision lab</span>
                        <span className={autoDriveStyles.summaryValue}>
                          {presentation.decisionLabLabel}
                        </span>
                      </div>
                    ) : null}
                    {formatRuntimeAuthority(autoDrive.run) ? (
                      <div className={autoDriveStyles.summaryItem}>
                        <span className={autoDriveStyles.summaryLabel}>Runtime authority</span>
                        <span className={autoDriveStyles.summaryValue}>
                          {formatRuntimeAuthority(autoDrive.run)}
                        </span>
                      </div>
                    ) : null}
                    {formatRuntimeEvalLane(autoDrive.run) ? (
                      <div className={autoDriveStyles.summaryItem}>
                        <span className={autoDriveStyles.summaryLabel}>Eval lane</span>
                        <span className={autoDriveStyles.summaryValue}>
                          {formatRuntimeEvalLane(autoDrive.run)}
                        </span>
                      </div>
                    ) : null}
                    {formatRuntimeAutonomyPosture(autoDrive.run) ? (
                      <div className={autoDriveStyles.summaryItem}>
                        <span className={autoDriveStyles.summaryLabel}>Autonomy posture</span>
                        <span className={autoDriveStyles.summaryValue}>
                          {formatRuntimeAutonomyPosture(autoDrive.run)}
                        </span>
                      </div>
                    ) : null}
                    {formatRuntimeFeedback(autoDrive.run) ? (
                      <div className={autoDriveStyles.summaryItem}>
                        <span className={autoDriveStyles.summaryLabel}>Runtime feedback</span>
                        <span className={autoDriveStyles.summaryValue}>
                          {formatRuntimeFeedback(autoDrive.run)}
                        </span>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>

            {autoDrive.controls.canStart ||
            autoDrive.controls.canPause ||
            autoDrive.controls.canResume ||
            autoDrive.controls.canStop ? (
              <div className={autoDriveStyles.actionRail}>
                {autoDrive.controls.canStart ? (
                  <button
                    type="button"
                    aria-label={presentation.startActionLabel}
                    className={joinClassNames(
                      styles.autoDriveAction,
                      styles.autoDriveActionTone.primary
                    )}
                    disabled={disabled}
                    onClick={() => {
                      void autoDrive.controls.onStart();
                    }}
                  >
                    {presentation.startActionLabel}
                  </button>
                ) : null}
                {autoDrive.controls.canPause ? (
                  <button
                    type="button"
                    aria-label={
                      presentation.pauseActionLabel === "Pause"
                        ? "Pause AutoDrive"
                        : presentation.pauseActionLabel
                    }
                    className={styles.autoDriveAction}
                    disabled={disabled}
                    onClick={() => {
                      void autoDrive.controls.onPause();
                    }}
                  >
                    {presentation.pauseActionLabel}
                  </button>
                ) : null}
                {autoDrive.controls.canResume ? (
                  <button
                    type="button"
                    aria-label={
                      presentation.resumeActionLabel === "Resume"
                        ? "Resume AutoDrive"
                        : presentation.resumeActionLabel
                    }
                    className={styles.autoDriveAction}
                    disabled={disabled}
                    onClick={() => {
                      void autoDrive.controls.onResume();
                    }}
                  >
                    {presentation.resumeActionLabel}
                  </button>
                ) : null}
                {autoDrive.controls.canStop ? (
                  <button
                    type="button"
                    aria-label={
                      presentation.stopActionLabel === "Stop"
                        ? "Stop AutoDrive"
                        : presentation.stopActionLabel
                    }
                    className={joinClassNames(
                      styles.autoDriveAction,
                      styles.autoDriveActionTone.danger
                    )}
                    disabled={disabled}
                    onClick={() => {
                      void autoDrive.controls.onStop();
                    }}
                  >
                    {presentation.stopActionLabel}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
