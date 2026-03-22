import type { AutoDriveIterationSummary, AutoDriveRunRecord } from "../types/autoDrive";

export function buildAutoDrivePublishRecoveryArtifact(params: {
  run: AutoDriveRunRecord;
  latestSummary: AutoDriveIterationSummary | null;
}): { markdown: string; retryScript: string | null } | null {
  const outcome = params.run.latestPublishOutcome;
  const latestSummary = params.latestSummary;
  const operatorActions = outcome?.operatorActions ?? [];

  if (!outcome || outcome.status !== "failed" || operatorActions.length === 0) {
    return null;
  }

  const retryCommands = operatorActions
    .flatMap((item) => {
      const commands: string[] = [];
      if (item.includes("`gh auth login`")) {
        commands.push("gh auth login");
      }
      const pushMatch = item.match(/`git push origin ([^`]+)`/);
      if (pushMatch?.[1]) {
        commands.push(`git checkout ${outcome.branchName ?? pushMatch[1]}`);
        commands.push(`git push origin ${pushMatch[1]}`);
        if (outcome.restoreBranch) {
          commands.push(`git checkout ${outcome.restoreBranch}`);
        }
      }
      return commands;
    })
    .filter((command, index, commands) => commands.indexOf(command) === index);

  return {
    markdown: [
      "# AutoDrive Publish Recovery",
      "",
      `Run ID: ${params.run.runId}`,
      `Destination: ${params.run.destination.title}`,
      `Stop reason: ${params.run.lastStopReason?.code ?? "none"}`,
      `Publish summary: ${outcome.summary}`,
      `Branch: ${outcome.branchName ?? "(none)"}`,
      `Commit message: ${outcome.commitMessage ?? "(none)"}`,
      "",
      "## Operator Actions",
      ...operatorActions.map((item) => `- ${item}`),
      "",
      "## Latest Summary",
      latestSummary?.summaryText ?? "No summary available.",
    ].join("\n"),
    retryScript:
      retryCommands.length === 0
        ? null
        : ["#!/usr/bin/env bash", "set -euo pipefail", "", ...retryCommands].join("\n"),
  };
}
