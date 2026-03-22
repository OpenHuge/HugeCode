import type {
  AutoDriveCollaboratorIntent,
  AutoDriveExecutionTuning,
  AutoDriveExternalResearchEntry,
  AutoDriveHistoricalPublishCorridor,
  AutoDriveIntentModel,
  AutoDriveIterationSummary,
  AutoDriveOpportunityCandidate,
  AutoDriveOpportunityQueue,
  AutoDriveRepoBacklog,
  AutoDriveRepoEvaluationProfile,
  AutoDriveThreadContext,
} from "../types/autoDrive";
import type { CommitMomentumSignal, RouteStagnationSignal } from "./runtimeAutoDriveRouteSignals";

type AutoDriveOpportunityCandidateDraft = Omit<
  AutoDriveOpportunityCandidate,
  "score" | "scoreBreakdown" | "selectionTags"
> & {
  baseScore: number;
};

type AutoDriveOpportunityScoringInput = {
  candidates: AutoDriveOpportunityCandidateDraft[];
  intent: Pick<AutoDriveIntentModel, "directionHypotheses">;
  collaboratorIntent: Pick<AutoDriveCollaboratorIntent, "conflictRisk" | "confidence">;
  momentum: CommitMomentumSignal;
  routeStagnation: RouteStagnationSignal;
  executionTuning: AutoDriveExecutionTuning;
  externalResearch: AutoDriveExternalResearchEntry[];
  repoBacklog: AutoDriveRepoBacklog;
  repoEvaluation?: AutoDriveRepoEvaluationProfile | null;
  threadContext: AutoDriveThreadContext | null;
  blockers: string[];
  changedPaths: string[];
  previousSummary: Pick<AutoDriveIterationSummary, "validation"> | null;
  historicalPublishCorridor: AutoDriveHistoricalPublishCorridor | null;
  git: {
    behind: number;
  };
};

type ScoreReason = NonNullable<AutoDriveOpportunityCandidate["scoreBreakdown"]>[number];

function pushReason(
  reasons: ScoreReason[],
  reasonCode: string,
  label: string,
  delta: number
): void {
  if (delta === 0) {
    return;
  }
  reasons.push({ reasonCode, label, delta });
}

function dedupe(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

function summarizeSelection(candidate: AutoDriveOpportunityCandidate | null): string | null {
  if (!candidate) {
    return null;
  }
  const positiveReasons = (candidate.scoreBreakdown ?? [])
    .filter((entry) => entry.delta > 0)
    .sort((left, right) => right.delta - left.delta)
    .slice(0, 2)
    .map((entry) => entry.label.toLowerCase());
  if (positiveReasons.length === 0) {
    return `${candidate.title} leads the queue.`;
  }
  return `${candidate.title} leads because ${positiveReasons.join(" and ")}.`;
}

function scoreCandidate(
  draft: AutoDriveOpportunityCandidateDraft,
  input: AutoDriveOpportunityScoringInput
): AutoDriveOpportunityCandidate {
  const reasons: ScoreReason[] = [];
  const tags: string[] = [];
  const primaryHypothesis = input.intent.directionHypotheses[0] ?? null;
  const validationFailed = input.previousSummary?.validation.success === false;
  const validationPassed = input.previousSummary?.validation.success === true;
  const sparseRouteEvidence = primaryHypothesis?.confidence === "low";

  pushReason(reasons, "base_score", "baseline priority", draft.baseScore);

  switch (draft.id) {
    case "advance_primary_surface": {
      const hypothesisDelta =
        primaryHypothesis?.confidence === "high"
          ? 12
          : primaryHypothesis?.confidence === "medium"
            ? 8
            : 2;
      pushReason(reasons, "primary_hypothesis", "strong route hypothesis", hypothesisDelta);
      if ((primaryHypothesis?.dominantSignalKinds.length ?? 0) >= 2) {
        pushReason(reasons, "multi_signal_alignment", "multi-signal alignment", 5);
      }
      if (input.collaboratorIntent.conflictRisk === "high") {
        pushReason(reasons, "collaborator_conflict_penalty", "high collaborator conflict", -14);
      }
      if (input.routeStagnation.isStagnating) {
        pushReason(reasons, "stagnation_penalty", "route stagnation detected", -12);
      }
      if (validationFailed) {
        pushReason(reasons, "validation_penalty", "recent validation failure", -10);
      }
      if (input.executionTuning.publishPriority !== "none") {
        pushReason(reasons, "publish_pressure_penalty", "publish corridor takes precedence", -8);
      }
      tags.push("primary_route");
      break;
    }
    case "use_fresh_research": {
      if (input.externalResearch.length > 0) {
        pushReason(reasons, "fresh_research", "fresh research is available", 18);
        tags.push("research_first");
      }
      if (sparseRouteEvidence) {
        pushReason(reasons, "sparse_route_evidence", "route evidence is sparse", 16);
      }
      if (validationFailed) {
        pushReason(reasons, "validation_penalty", "recent validation failure", -8);
      }
      if (input.executionTuning.publishPriority !== "none") {
        pushReason(reasons, "publish_pressure_penalty", "publish corridor takes precedence", -12);
      }
      break;
    }
    case "triage_external_backlog": {
      if (
        (input.repoBacklog.openIssues ?? 0) > 0 ||
        (input.repoBacklog.openPullRequests ?? 0) > 0
      ) {
        pushReason(reasons, "external_backlog", "external backlog pressure is active", 14);
        tags.push("backlog_pressure");
      }
      if (input.repoBacklog.highlights.length >= 2) {
        pushReason(reasons, "backlog_density", "multiple backlog highlights exist", 6);
      }
      if (validationFailed) {
        pushReason(reasons, "validation_penalty", "recent validation failure", -6);
      }
      break;
    }
    case "align_with_thread_history": {
      if ((input.threadContext?.recentUserPrompts.length ?? 0) > 0) {
        pushReason(reasons, "thread_prompt_alignment", "recent operator prompts are available", 12);
        tags.push("thread_alignment");
      }
      if (input.threadContext?.longTermMemorySummary) {
        pushReason(reasons, "thread_memory", "long-term thread memory is available", 8);
      }
      if (input.collaboratorIntent.conflictRisk === "high") {
        pushReason(reasons, "thread_anchor", "thread anchor reduces drift under conflict", 6);
      }
      if (input.executionTuning.publishPriority === "push_candidate") {
        pushReason(reasons, "publish_pressure_penalty", "publish corridor takes precedence", -10);
      }
      break;
    }
    case "follow_recent_commit_momentum": {
      if (input.momentum.alignedSummaries.length > 0) {
        pushReason(reasons, "aligned_momentum", "recent commits align with the destination", 10);
        tags.push("commit_momentum");
      }
      if (input.momentum.alignmentScore >= 0.55) {
        pushReason(reasons, "high_alignment_score", "commit alignment is strong", 8);
      }
      if (input.collaboratorIntent.confidence === "low") {
        pushReason(reasons, "low_momentum_confidence", "momentum evidence is still sparse", -14);
      }
      if (input.momentum.hasHighDivergence) {
        pushReason(
          reasons,
          "momentum_divergence_penalty",
          "momentum is diverging from the route",
          -16
        );
      }
      if (input.collaboratorIntent.conflictRisk === "high") {
        pushReason(reasons, "collaborator_conflict_penalty", "high collaborator conflict", -12);
      }
      if (input.routeStagnation.isStagnating) {
        pushReason(reasons, "stagnation_penalty", "route stagnation detected", -10);
      }
      if (validationFailed) {
        pushReason(reasons, "validation_penalty", "recent validation failure", -8);
      }
      break;
    }
    case "break_route_stagnation": {
      if (input.routeStagnation.isStagnating) {
        pushReason(reasons, "route_stagnation", "route stagnation is active", 24);
        tags.push("reroute");
      } else {
        pushReason(reasons, "stagnation_inactive_penalty", "no stagnation signal is active", -18);
      }
      if (input.routeStagnation.repeatedAreas.length > 0) {
        pushReason(reasons, "repeated_surface", "the same surfaces are repeating", 6);
      }
      if (input.executionTuning.publishPriority === "push_candidate") {
        pushReason(reasons, "publish_pressure_penalty", "publish corridor takes precedence", -18);
      }
      break;
    }
    case "prepare_publish_corridor": {
      if (input.executionTuning.publishPriority === "prepare_branch") {
        pushReason(reasons, "prepare_publish_corridor", "publish corridor needs preparation", 22);
        tags.push("publish_corridor");
      } else {
        pushReason(reasons, "publish_inactive_penalty", "publish preparation is not active", -20);
      }
      if (
        input.executionTuning.reasons.includes("historical_publish_failure") ||
        input.executionTuning.reasons.includes("publish_failed")
      ) {
        pushReason(reasons, "historical_publish_failure", "recent publish attempts failed", 10);
      }
      if (input.changedPaths.some((path) => /autodrive|publish|ledger/i.test(path))) {
        pushReason(reasons, "publish_surface_ready", "publish-related paths already changed", 6);
      }
      break;
    }
    case "push_publish_candidate": {
      if (input.executionTuning.publishPriority === "push_candidate") {
        pushReason(reasons, "push_publish_candidate", "publish corridor is ready to push", 22);
        tags.push("publish_corridor");
      } else {
        pushReason(reasons, "publish_inactive_penalty", "publish push is not active", -24);
      }
      if (input.historicalPublishCorridor) {
        pushReason(
          reasons,
          "historical_publish_corridor",
          "matching historical publish corridor exists",
          10
        );
      }
      if (validationPassed) {
        pushReason(reasons, "validated_publish_path", "validation already passed on the route", 8);
      }
      if (input.git.behind > 0) {
        pushReason(
          reasons,
          "behind_remote_penalty",
          "remote is ahead of the workspace branch",
          -14
        );
      }
      if (input.blockers.length > 0) {
        pushReason(reasons, "blocker_penalty", "active blockers remain", -10);
      }
      break;
    }
    case "resolve_active_blocker": {
      if (input.blockers.length > 0) {
        pushReason(reasons, "active_blocker", "active blockers need resolution", 20);
        tags.push("blocker_resolution");
      } else {
        pushReason(reasons, "no_blocker_penalty", "no blocker is active", -18);
      }
      if (validationFailed) {
        pushReason(reasons, "validation_failed", "validation failed and needs resolution", 6);
      }
      break;
    }
    case "tighten_validation_loop": {
      if (validationFailed) {
        pushReason(reasons, "validation_failed", "recent validation failed", 22);
        tags.push("validation_recovery");
      }
      if ((input.repoEvaluation?.representativeCommands.length ?? 0) > 0) {
        pushReason(reasons, "representative_eval_lane", "representative eval lane is available", 8);
      }
      if ((input.repoEvaluation?.samplePaths.length ?? 0) > 0) {
        pushReason(reasons, "held_out_samples", "held-out samples can catch route drift", 6);
        tags.push("eval_corpus");
      }
      if ((input.repoEvaluation?.scenarioKeys.length ?? 0) > 0) {
        pushReason(reasons, "scenario_map", "scenario map is available", 4);
      }
      if (input.executionTuning.validationCommandPreference === "full") {
        pushReason(reasons, "full_validation_preferred", "full validation is preferred", 8);
      }
      if (input.collaboratorIntent.conflictRisk === "high") {
        pushReason(reasons, "conflict_safe_route", "validation is safer under high conflict", 6);
      }
      if (input.executionTuning.publishPriority === "push_candidate") {
        pushReason(reasons, "publish_pressure_penalty", "publish push takes precedence", -16);
      }
      break;
    }
    case "stabilize_working_tree": {
      if (input.changedPaths.length > 0) {
        pushReason(reasons, "dirty_working_tree", "the working tree already contains changes", 14);
        tags.push("working_tree");
      } else {
        pushReason(reasons, "clean_tree_penalty", "the working tree is already clean", -18);
      }
      if (
        input.executionTuning.publishPriority === "prepare_branch" &&
        input.changedPaths.some((path) => /autodrive|publish|ledger/i.test(path))
      ) {
        pushReason(
          reasons,
          "publish_stabilization",
          "current changes are already in the publish corridor",
          8
        );
      }
      break;
    }
    default:
      break;
  }

  const score = reasons.reduce((total, entry) => total + entry.delta, 0);
  return {
    id: draft.id,
    title: draft.title,
    summary: draft.summary,
    rationale: draft.rationale,
    repoAreas: draft.repoAreas,
    score,
    confidence: draft.confidence,
    risk: draft.risk,
    scoreBreakdown: reasons,
    selectionTags: dedupe(tags),
  };
}

export function scoreAutoDriveOpportunityQueue(
  input: AutoDriveOpportunityScoringInput
): AutoDriveOpportunityQueue {
  const ranked = input.candidates
    .map((candidate) => scoreCandidate(candidate, input))
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, 5);
  const selected = ranked[0] ?? null;
  return {
    selectedCandidateId: selected?.id ?? null,
    selectionSummary: summarizeSelection(selected),
    candidates: ranked,
  };
}
