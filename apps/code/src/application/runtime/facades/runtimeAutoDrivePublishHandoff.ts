import type {
  AutoDriveIterationSummary,
  AutoDrivePublishHandoff,
  AutoDriveRunRecord,
} from "../types/autoDrive";

function summarizeEndState(items: string[]): string {
  if (items.length === 0) {
    return "- (none provided)";
  }
  return items.map((item) => `- ${item}`).join("\n");
}

function summarizeValidation(summary: AutoDriveIterationSummary): string {
  if (!summary.validation.ran) {
    return "- Validation was not run in the final iteration.";
  }
  if (summary.validation.commands.length === 0) {
    return "- Validation commands were not specified.";
  }
  return summary.validation.commands.map((command) => `- \`${command}\``).join("\n");
}

function buildReviewTitle(run: AutoDriveRunRecord): string {
  return `feat(autodrive): ${run.destination.title}`.slice(0, 120);
}

function buildReviewBody(params: {
  run: AutoDriveRunRecord;
  summary: AutoDriveIterationSummary;
  branchName: string;
}): string {
  return [
    "## Summary",
    params.summary.summaryText,
    "",
    "## Destination",
    summarizeEndState(params.run.destination.desiredEndState),
    "",
    "## Validation",
    summarizeValidation(params.summary),
    "",
    "## Publish",
    `- Isolated branch: \`${params.branchName}\``,
    `- Commit message: ${params.run.latestPublishOutcome?.commitMessage ?? "(none)"}`,
    "",
    "## Notes",
    "- This branch was created by AutoDrive push-candidate automation.",
    "- Use this draft as an operator-reviewed PR handoff, not an auto-merge signal.",
  ].join("\n");
}

function buildReviewChecklist(summary: AutoDriveIterationSummary): string[] {
  return [
    "Confirm destination and scope alignment before review.",
    summary.validation.success === true
      ? "Validation evidence is green; verify no missing edge-case checks."
      : "Validation is incomplete or failed; rerun required checks before PR.",
    "Manually inspect changed files and blocker notes before merge.",
  ];
}

function shellQuote(value: string): string {
  const replacement = `'` + `"` + `'` + `"` + `'`;
  return `'${value.split("'").join(replacement)}'`;
}

function buildOperatorCommands(params: {
  runId: string;
  branchName: string;
  reviewTitle: string;
}): string[] {
  const bodyPath = `.hugecode/runs/${params.runId}/publish/pr-body.md`;
  return [
    `gh pr create --head ${shellQuote(params.branchName)} --title ${shellQuote(params.reviewTitle)} --body-file ${shellQuote(bodyPath)}`,
    `gh pr view --head ${shellQuote(params.branchName)} --web`,
  ];
}

function buildHandoffMarkdown(handoff: AutoDrivePublishHandoff): string {
  return [
    "# AutoDrive Publish Handoff",
    "",
    `Run ID: ${handoff.runId}`,
    `Branch: ${handoff.publish.branchName}`,
    `Commit message: ${handoff.publish.commitMessage ?? "(none)"}`,
    `Created at: ${new Date(handoff.createdAt).toISOString()}`,
    "",
    "## Review Draft Title",
    handoff.reviewDraft.title,
    "",
    "## Review Draft Body",
    handoff.reviewDraft.body,
    "",
    "## Review Checklist",
    ...handoff.reviewDraft.checklist.map((item) => `- ${item}`),
    "",
    "## Operator Commands",
    ...handoff.operatorCommands.map((command) => `- \`${command}\``),
  ].join("\n");
}

export function buildAutoDrivePublishHandoff(params: {
  run: AutoDriveRunRecord;
  latestSummary: AutoDriveIterationSummary | null;
}): { handoff: AutoDrivePublishHandoff; markdown: string } | null {
  const summary = params.latestSummary;
  const outcome = params.run.latestPublishOutcome;
  if (
    !summary ||
    !outcome ||
    outcome.mode !== "push_candidate" ||
    outcome.status !== "completed" ||
    !outcome.pushed ||
    !outcome.branchName
  ) {
    return null;
  }

  const reviewTitle = buildReviewTitle(params.run);
  const reviewBody = buildReviewBody({
    run: params.run,
    summary,
    branchName: outcome.branchName,
  });
  const handoff: AutoDrivePublishHandoff = {
    schemaVersion: "autodrive-publish-handoff/v1",
    runId: params.run.runId,
    workspaceId: params.run.workspaceId,
    threadId: params.run.threadId,
    createdAt: outcome.createdAt,
    publish: {
      branchName: outcome.branchName,
      commitMessage: outcome.commitMessage,
      summary: outcome.summary,
    },
    destination: {
      title: params.run.destination.title,
      desiredEndState: params.run.destination.desiredEndState,
    },
    validation: {
      commands: summary.validation.commands,
      success: summary.validation.success,
      summary: summary.validation.summary,
    },
    evidence: {
      summaryText: summary.summaryText,
      changedFiles: summary.changedFiles,
      blockers: summary.blockers,
    },
    reviewDraft: {
      title: reviewTitle,
      body: reviewBody,
      checklist: buildReviewChecklist(summary),
    },
    operatorCommands: buildOperatorCommands({
      runId: params.run.runId,
      branchName: outcome.branchName,
      reviewTitle,
    }),
  };

  return {
    handoff,
    markdown: buildHandoffMarkdown(handoff),
  };
}
