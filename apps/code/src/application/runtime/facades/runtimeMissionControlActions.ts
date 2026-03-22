import type { RuntimeAgentTaskSummary } from "../types/webMcpBridge";

export type RuntimeResumeBatchOutcome =
  | {
      status: "accepted";
    }
  | {
      status: "rejected" | "failed";
      errorLabel: string | null;
    };

export function collectInterruptibleRuntimeTasks(tasks: RuntimeAgentTaskSummary[]) {
  return tasks.filter(
    (task) =>
      task.status === "queued" || task.status === "running" || task.status === "awaiting_approval"
  );
}

export function summarizeResumeBatchResults(outcomes: RuntimeResumeBatchOutcome[]) {
  let acceptedCount = 0;
  let rejectedByRuntimeCount = 0;
  let failedCount = 0;
  const errorDetails: string[] = [];

  for (const outcome of outcomes) {
    if (outcome.status === "accepted") {
      acceptedCount += 1;
      continue;
    }
    if (outcome.status === "rejected") {
      rejectedByRuntimeCount += 1;
    } else {
      failedCount += 1;
    }
    if (outcome.errorLabel) {
      errorDetails.push(outcome.errorLabel);
    }
  }

  const segments = [`Resumed ${acceptedCount} recoverable run(s).`];
  if (rejectedByRuntimeCount > 0) {
    segments.push(`${rejectedByRuntimeCount} rejected by runtime.`);
  }
  if (failedCount > 0) {
    segments.push(`${failedCount} failed to call resume.`);
  }

  return {
    info: segments.join(" "),
    error: errorDetails.length > 0 ? `Resume errors: ${errorDetails[0]}` : null,
  };
}
