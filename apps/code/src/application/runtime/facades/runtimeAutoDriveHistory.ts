import type {
  AutoDriveControllerDeps,
  AutoDriveHistoricalPublishCorridor,
  AutoDrivePublishHandoff,
  AutoDriveRunRecord,
} from "../types/autoDrive";

const RUN_ARTIFACT_PATH_PATTERN = /^\.hugecode\/runs\/([^/]+)\/run\.json$/;
const HANDOFF_ARTIFACT_PATH_PATTERN = /^\.hugecode\/runs\/([^/]+)\/publish\/handoff\.json$/;
const TITLE_STOPWORDS = new Set(
  "implement build improve refine add update autodrive route corridor publish composer meta area flow".split(
    " "
  )
);

function tokenizeTitle(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !TITLE_STOPWORDS.has(token));
}

function scoreTitleMatch(left: string, right: string): number {
  const normalizedLeft = left.trim().toLowerCase();
  const normalizedRight = right.trim().toLowerCase();
  if (normalizedLeft.length > 0 && normalizedLeft === normalizedRight) {
    return 1;
  }
  const leftTokens = new Set(tokenizeTitle(left));
  const rightTokens = new Set(tokenizeTitle(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

export async function loadHistoricalAutoDriveRuns(params: {
  deps: AutoDriveControllerDeps;
  workspaceId: string;
  workspaceFiles: string[];
  currentRunId: string;
}): Promise<AutoDriveRunRecord[]> {
  const runArtifactPaths = params.workspaceFiles.filter((path) =>
    RUN_ARTIFACT_PATH_PATTERN.test(path)
  );
  if (runArtifactPaths.length === 0) {
    return [];
  }

  const historicalRuns = await Promise.all(
    runArtifactPaths.map(async (path) => {
      const match = path.match(RUN_ARTIFACT_PATH_PATTERN);
      if (!match || match[1] === params.currentRunId) {
        return null;
      }
      try {
        const file = await params.deps.readWorkspaceFile(params.workspaceId, path);
        const parsed = JSON.parse(file.content) as AutoDriveRunRecord;
        return parsed.schemaVersion === "autodrive-run/v2" ? parsed : null;
      } catch {
        return null;
      }
    })
  );

  return historicalRuns
    .filter((run): run is AutoDriveRunRecord => run !== null)
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, 6);
}

export async function loadHistoricalAutoDrivePublishHandoffs(params: {
  deps: AutoDriveControllerDeps;
  workspaceId: string;
  workspaceFiles: string[];
  currentRunId: string;
}): Promise<AutoDrivePublishHandoff[]> {
  const handoffArtifactPaths = params.workspaceFiles.filter((path) =>
    HANDOFF_ARTIFACT_PATH_PATTERN.test(path)
  );
  if (handoffArtifactPaths.length === 0) {
    return [];
  }

  const handoffs = await Promise.all(
    handoffArtifactPaths.map(async (path) => {
      const match = path.match(HANDOFF_ARTIFACT_PATH_PATTERN);
      if (!match || match[1] === params.currentRunId) {
        return null;
      }
      try {
        const file = await params.deps.readWorkspaceFile(params.workspaceId, path);
        const parsed = JSON.parse(file.content) as AutoDrivePublishHandoff;
        return parsed.schemaVersion === "autodrive-publish-handoff/v1" ? parsed : null;
      } catch {
        return null;
      }
    })
  );

  return handoffs
    .filter((handoff): handoff is AutoDrivePublishHandoff => handoff !== null)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 6);
}

export function findBestHistoricalPublishCorridor(params: {
  destinationTitle: string;
  handoffs: AutoDrivePublishHandoff[];
}): AutoDriveHistoricalPublishCorridor | null {
  const matches = params.handoffs
    .map((handoff) => ({
      handoff,
      matchScore: scoreTitleMatch(params.destinationTitle, handoff.destination.title),
    }))
    .filter(({ matchScore }) => matchScore >= 0.45)
    .sort(
      (left, right) =>
        right.matchScore - left.matchScore || right.handoff.createdAt - left.handoff.createdAt
    );
  const best = matches[0];
  if (!best) {
    return null;
  }
  return {
    runId: best.handoff.runId,
    destinationTitle: best.handoff.destination.title,
    summaryText: best.handoff.evidence.summaryText,
    changedFiles: best.handoff.evidence.changedFiles,
    validationCommands: best.handoff.validation.commands,
    validationSummary: best.handoff.validation.summary,
    createdAt: best.handoff.createdAt,
    matchScore: best.matchScore,
  };
}

export function findHistoricalPublishFailureSummary(params: {
  destinationTitle: string;
  runs: AutoDriveRunRecord[];
}): string | null {
  const matches = params.runs
    .map((run) => ({
      run,
      matchScore: scoreTitleMatch(params.destinationTitle, run.destination.title),
    }))
    .filter(
      ({ run, matchScore }) =>
        matchScore >= 0.45 &&
        run.latestPublishOutcome?.status === "failed" &&
        run.latestPublishOutcome.summary.trim().length > 0
    )
    .sort(
      (left, right) =>
        right.matchScore - left.matchScore || right.run.updatedAt - left.run.updatedAt
    );
  return matches[0]?.run.latestPublishOutcome?.summary ?? null;
}

export function hasHistoricalPublishedCorridor(params: {
  destinationTitle: string;
  runs: AutoDriveRunRecord[];
}): boolean {
  return params.runs.some((run) => {
    const matchScore = scoreTitleMatch(params.destinationTitle, run.destination.title);
    return (
      matchScore >= 0.45 &&
      run.latestPublishOutcome?.status === "completed" &&
      run.latestPublishOutcome.mode === "push_candidate" &&
      run.latestPublishOutcome.pushed === true
    );
  });
}
