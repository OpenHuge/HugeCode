import type {
  AutoDriveContextSnapshot,
  AutoDriveControllerDeps,
  AutoDriveIterationSummary,
  AutoDrivePublishOutcome,
  AutoDriveRunRecord,
} from "../types/autoDrive";
import { defaultNow } from "./runtimeAutoDriveControllerSupport";
import {
  buildFallbackCommitMessage,
  buildPublishBranchName,
  sanitizeCommitMessage,
} from "./runtimeAutoDrivePublish";
import {
  buildPublishFailureOperatorActions,
  shouldAvoidAutomaticPushFromHistory,
} from "./runtimeAutoDrivePublishRecovery";
import { shouldPromoteBranchOnlyToPush } from "./runtimeAutoDriveExecution";

export async function createBranchOnlyCandidate(params: {
  deps: AutoDriveControllerDeps;
  run: AutoDriveRunRecord;
  summary: AutoDriveIterationSummary;
}): Promise<AutoDrivePublishOutcome | null> {
  const { deps, run, summary } = params;
  if (summary.validation.success !== true) {
    return null;
  }
  if (!deps.stageGitAll || !deps.commitGit) {
    return {
      mode: "branch_only",
      status: "failed",
      summary:
        "Branch-only publish candidate could not run because git commit controls are unavailable.",
      commitMessage: null,
      branchName: null,
      pushed: false,
      createdAt: defaultNow(deps),
    };
  }

  let commitMessage: string | null = null;
  try {
    commitMessage = sanitizeCommitMessage(
      deps.generateCommitMessage ? await deps.generateCommitMessage(run.workspaceId) : null
    );
  } catch {
    commitMessage = null;
  }
  const finalCommitMessage = commitMessage ?? buildFallbackCommitMessage(run, summary);

  try {
    await deps.stageGitAll(run.workspaceId);
    await deps.commitGit(run.workspaceId, finalCommitMessage);
    return {
      mode: "branch_only",
      status: "completed",
      summary: `Created a branch-only commit candidate with message: ${finalCommitMessage}`,
      commitMessage: finalCommitMessage,
      branchName: null,
      pushed: false,
      createdAt: defaultNow(deps),
    };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : "unknown git publish error";
    return {
      mode: "branch_only",
      status: "failed",
      summary: `Branch-only publish candidate failed: ${detail}`,
      commitMessage: finalCommitMessage,
      branchName: null,
      pushed: false,
      createdAt: defaultNow(deps),
    };
  }
}

export async function pushPublishCandidate(params: {
  deps: AutoDriveControllerDeps;
  run: AutoDriveRunRecord;
  context: AutoDriveContextSnapshot;
  commitMessage: string | null;
}): Promise<AutoDrivePublishOutcome> {
  const { deps, run, context } = params;
  const createdAt = defaultNow(deps);
  if (!deps.createGitBranch || !deps.checkoutGitBranch || !deps.pushGit || !context.git.branch) {
    return {
      mode: "push_candidate",
      status: "failed",
      summary: "Push candidate could not run because branch push controls are unavailable.",
      commitMessage: params.commitMessage,
      branchName: null,
      pushed: false,
      createdAt,
    };
  }

  const originalBranch = context.git.branch;
  const branchName = buildPublishBranchName(run, createdAt);
  let switchedToCandidate = false;
  let pushed = false;

  try {
    await deps.createGitBranch(run.workspaceId, branchName);
    await deps.checkoutGitBranch(run.workspaceId, branchName);
    switchedToCandidate = true;
    await deps.pushGit(run.workspaceId);
    pushed = true;
    await deps.checkoutGitBranch(run.workspaceId, originalBranch);
    return {
      mode: "push_candidate",
      status: "completed",
      summary: `Pushed isolated publish candidate branch ${branchName}.`,
      commitMessage: params.commitMessage,
      branchName,
      pushed,
      createdAt,
    };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : "unknown push error";
    if (switchedToCandidate) {
      try {
        await deps.checkoutGitBranch(run.workspaceId, originalBranch);
      } catch {
        const failedRestoreOutcome: AutoDrivePublishOutcome = {
          mode: "push_candidate",
          status: "failed",
          summary: `Push candidate branch ${branchName} changed local checkout and restore failed after: ${detail}`,
          commitMessage: params.commitMessage,
          branchName,
          restoreBranch: originalBranch,
          pushed,
          createdAt,
        };
        return {
          ...failedRestoreOutcome,
          operatorActions: buildPublishFailureOperatorActions({
            publishOutcome: failedRestoreOutcome,
            originalBranch,
          }),
        };
      }
    }
    const failedOutcome: AutoDrivePublishOutcome = {
      mode: "push_candidate",
      status: "failed",
      summary: `Push candidate failed: ${detail}`,
      commitMessage: params.commitMessage,
      branchName,
      restoreBranch: originalBranch,
      pushed,
      createdAt,
    };
    return {
      ...failedOutcome,
      operatorActions: buildPublishFailureOperatorActions({
        publishOutcome: failedOutcome,
        originalBranch,
      }),
    };
  }
}

export async function maybePublishGoalReachedOutcome(params: {
  deps: AutoDriveControllerDeps;
  run: AutoDriveRunRecord;
  context: AutoDriveContextSnapshot;
  summary: AutoDriveIterationSummary;
}): Promise<AutoDrivePublishOutcome | null> {
  const branchOnlyOutcome =
    params.context.publishReadiness.recommendedMode === "branch_only"
      ? await createBranchOnlyCandidate({
          deps: params.deps,
          run: params.run,
          summary: params.summary,
        })
      : null;
  if (params.context.publishReadiness.recommendedMode === "push_candidate") {
    if (shouldAvoidAutomaticPushFromHistory(params.context)) {
      return createBranchOnlyCandidate({
        deps: params.deps,
        run: params.run,
        summary: params.summary,
      });
    }
    return pushPublishCandidate({
      deps: params.deps,
      run: params.run,
      context: params.context,
      commitMessage: branchOnlyOutcome?.commitMessage ?? null,
    });
  }
  if (
    shouldPromoteBranchOnlyToPush({
      context: params.context,
      branchOnlyOutcome,
    })
  ) {
    return pushPublishCandidate({
      deps: params.deps,
      run: params.run,
      context: params.context,
      commitMessage: branchOnlyOutcome?.commitMessage ?? null,
    });
  }
  return branchOnlyOutcome;
}
