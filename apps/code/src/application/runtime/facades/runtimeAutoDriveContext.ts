import {
  buildCommitMomentum,
  buildExecutionFeedbackSignal,
  buildRouteStagnationSignal,
} from "./runtimeAutoDriveRouteSignals";
import {
  findBestHistoricalPublishCorridor,
  findHistoricalPublishFailureSummary,
  hasHistoricalPublishedCorridor,
  loadHistoricalAutoDrivePublishHandoffs,
  loadHistoricalAutoDriveRuns,
} from "./runtimeAutoDriveHistory";
import {
  buildCollaboratorIntent,
  buildIntentModel,
  buildOpportunityQueue,
  buildPublishReadiness,
  dedupeNonEmpty,
  extractWorkspaceMarkers,
} from "./runtimeAutoDriveContextSignals";
import {
  buildStartState,
  DEFAULT_GIT_WINDOW,
  loadCommitEvidence,
  maybeRunExternalResearch,
  readRelevantDocs,
  readRepoBacklog,
  readThreadContext,
} from "./runtimeAutoDriveContextSources";
import type {
  AutoDriveContextSnapshot,
  AutoDriveControllerDeps,
  AutoDriveIterationSummary,
  AutoDriveRunRecord,
} from "../types/autoDrive";

export async function synthesizeAutoDriveContext(params: {
  deps: AutoDriveControllerDeps;
  run: AutoDriveRunRecord;
  iteration: number;
  previousSummary: AutoDriveIterationSummary | null;
}): Promise<AutoDriveContextSnapshot> {
  const { deps, run, iteration, previousSummary } = params;
  const [gitStatus, gitLog, workspaceFiles, gitBranches, gitRemote] = await Promise.all([
    deps.getGitStatus(run.workspaceId),
    deps.getGitLog(run.workspaceId, DEFAULT_GIT_WINDOW),
    deps.getWorkspaceFiles(run.workspaceId),
    deps.listGitBranches(run.workspaceId),
    deps.getGitRemote ? deps.getGitRemote(run.workspaceId) : Promise.resolve(null),
  ]);
  const [docs, commits, researchResult, repoBacklog, threadContext] = await Promise.all([
    readRelevantDocs(deps, run.workspaceId, workspaceFiles),
    loadCommitEvidence(deps, run.workspaceId, gitLog.entries),
    maybeRunExternalResearch({ deps, run, previousSummary }),
    readRepoBacklog(deps, run.workspaceId),
    readThreadContext(deps, {
      workspaceId: run.workspaceId,
      threadId: run.threadId,
    }),
  ]);
  const historicalRuns = await loadHistoricalAutoDriveRuns({
    deps,
    workspaceId: run.workspaceId,
    workspaceFiles,
    currentRunId: run.runId,
  });
  const historicalPublishHandoffs = await loadHistoricalAutoDrivePublishHandoffs({
    deps,
    workspaceId: run.workspaceId,
    workspaceFiles,
    currentRunId: run.runId,
  });
  const historicalPublishCorridor = findBestHistoricalPublishCorridor({
    destinationTitle: run.destination.title,
    handoffs: historicalPublishHandoffs,
  });
  const historicalPublishFailureSummary = findHistoricalPublishFailureSummary({
    destinationTitle: run.destination.title,
    runs: historicalRuns,
  });

  const ruleEvidence = docs.ruleEvidence;
  const commitMomentum = buildCommitMomentum({
    run,
    commits,
    previousSummary,
    threadContext,
  });
  const routeStagnation = buildRouteStagnationSignal({
    run,
    previousSummary,
  });
  const executionFeedback = buildExecutionFeedbackSignal({
    run,
    previousSummary,
    routeStagnation,
    hasHistoricalPublishedCorridor:
      historicalPublishCorridor !== null ||
      hasHistoricalPublishedCorridor({
        destinationTitle: run.destination.title,
        runs: historicalRuns,
      }),
    historicalPublishFailureSummary,
  });
  const collaboratorIntent = buildCollaboratorIntent(run, commits, ruleEvidence, commitMomentum);
  const relevantFiles = [
    ...new Set([
      ...workspaceFiles
        .filter((path) => /Composer|runtime|mission|thread|autodrive/i.test(path))
        .slice(0, 8),
      ...gitStatus.files.map((file) => file.path),
      ...(previousSummary?.suggestedNextAreas ?? []),
    ]),
  ].slice(0, 12);
  const branch = gitBranches.currentBranch ?? gitStatus.branchName ?? null;
  const changedPaths = gitStatus.files.map((file) => file.path);
  const blockers = dedupeNonEmpty(
    [
      ...(previousSummary?.blockers ?? run.blockers),
      ...routeStagnation.repeatedBlockers,
      routeStagnation.isStagnating ? routeStagnation.summary : null,
    ],
    6
  );
  const intent = buildIntentModel({
    run,
    previousSummary,
    collaboratorIntent,
    momentum: commitMomentum,
    routeStagnation,
    ruleEvidence,
    externalResearch: researchResult.externalResearch,
    repoBacklog,
    threadContext,
    relevantFiles,
    blockers,
  });
  const opportunities = buildOpportunityQueue({
    run,
    previousSummary,
    intent,
    collaboratorIntent,
    momentum: commitMomentum,
    routeStagnation,
    executionFeedback,
    externalResearch: researchResult.externalResearch,
    repoBacklog,
    threadContext,
    blockers,
    changedPaths,
    repoEvaluation: docs.evaluation,
    historicalPublishCorridor,
    gitBehind: gitLog.behind,
  });
  const startState = buildStartState({
    run,
    destination: run.destination,
    previousSummary,
    gitBranch: branch,
    gitChangedPaths: changedPaths,
    commits,
    collaboratorIntent,
  });
  const publishReadiness = buildPublishReadiness({
    previousSummary,
    blockers,
    changedPaths,
    git: {
      remote: gitRemote,
      upstream: gitLog.upstream,
      behind: gitLog.behind,
    },
    stopRisk: startState.system.stopRisk,
  });

  return {
    schemaVersion: "autodrive-context/v2",
    runId: run.runId,
    iteration,
    destination: run.destination,
    startState,
    repo: {
      packageManager: docs.packageManager,
      workspaceMarkers: extractWorkspaceMarkers(workspaceFiles),
      scripts: docs.scripts,
      evaluation: docs.evaluation,
      ruleEvidence,
      relevantDocs: docs.docs,
      relevantFiles,
    },
    git: {
      branch,
      remote: gitRemote,
      upstream: gitLog.upstream,
      ahead: gitLog.ahead,
      behind: gitLog.behind,
      recentCommits: commits,
      workingTree: {
        dirty: gitStatus.files.length > 0,
        stagedCount: gitStatus.stagedFiles.length,
        unstagedCount: gitStatus.unstagedFiles.length,
        changedPaths,
        totalAdditions: gitStatus.totalAdditions,
        totalDeletions: gitStatus.totalDeletions,
      },
    },
    collaboratorIntent,
    intent,
    opportunities,
    executionTuning: executionFeedback,
    publishReadiness,
    publishHistory: {
      bestCorridor: historicalPublishCorridor,
      latestFailureSummary: historicalPublishFailureSummary,
    },
    repoBacklog,
    threadContext,
    previousSummary,
    blockers,
    completedSubgoals: [
      ...new Set([...run.completedSubgoals, ...(previousSummary?.completedSubgoals ?? [])]),
    ],
    externalResearch: researchResult.externalResearch,
    researchPolicy: researchResult.researchPolicy,
    synthesizedAt: deps.now?.() ?? Date.now(),
  };
}
