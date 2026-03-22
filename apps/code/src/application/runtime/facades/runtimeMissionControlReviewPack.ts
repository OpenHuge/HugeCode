import type {
  AgentTaskSummary,
  HugeCodeReviewArtifactRef,
  HugeCodeReviewPackEvidenceRefs,
  HugeCodeReviewPackFileChangeSummary,
  HugeCodeReviewStatus,
  HugeCodeRunSummary,
  HugeCodeValidationOutcome,
  HugeCodeValidationSummary,
} from "@ku0/code-runtime-host-contract";
import { isRecoverableRuntimeTask } from "./runtimeMissionControlRunState";
import { buildTaskCheckpointState } from "./runtimeMissionControlCheckpoint";

const RUNTIME_TASK_ENTITY_PREFIX = "runtime-task:";

function pushUniqueText(values: string[], value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized || values.includes(normalized)) {
    return;
  }
  values.push(normalized);
}

export function deriveValidationOutcome(
  validations: HugeCodeValidationSummary[]
): HugeCodeValidationOutcome {
  if (validations.length === 0) {
    return "unknown";
  }
  if (validations.some((validation) => validation.outcome === "failed")) {
    return "failed";
  }
  if (validations.some((validation) => validation.outcome === "warning")) {
    return "warning";
  }
  if (validations.every((validation) => validation.outcome === "skipped")) {
    return "skipped";
  }
  return "passed";
}

export function deriveRunValidations(task: AgentTaskSummary): HugeCodeValidationSummary[] {
  return (task.steps ?? [])
    .filter((step) => step.kind === "diagnostics")
    .map((step) => {
      let outcome: HugeCodeValidationOutcome = "unknown";
      if (step.status === "failed" || step.errorCode || step.errorMessage) {
        outcome = "failed";
      } else if (step.status === "completed") {
        outcome = "passed";
      } else if (step.status === "pending") {
        outcome = "skipped";
      }
      const summary =
        step.errorMessage?.trim() ||
        step.output?.trim() ||
        step.message.trim() ||
        "Diagnostics step completed without recorded detail.";
      return {
        id: `${task.taskId}:validation:${step.index}`,
        label: `Check ${step.index + 1}`,
        outcome,
        summary,
        startedAt: step.startedAt,
        finishedAt: step.completedAt,
      };
    });
}

export function deriveRunArtifacts(task: AgentTaskSummary): HugeCodeReviewArtifactRef[] {
  const artifacts: HugeCodeReviewArtifactRef[] = [];
  const checkpoint = buildTaskCheckpointState(task);
  if (checkpoint?.checkpointId?.trim()) {
    artifacts.push({
      id: `checkpoint:${checkpoint.checkpointId}`,
      label: `Checkpoint ${checkpoint.checkpointId}`,
      kind: "evidence",
      uri: `checkpoint://${checkpoint.checkpointId}`,
    });
  }
  const traceId = checkpoint?.traceId?.trim() || task.traceId?.trim() || task.taskId;
  if (traceId) {
    artifacts.push({
      id: `trace:${traceId}`,
      label: `Trace ${traceId}`,
      kind: "log",
      uri: `trace://${traceId}`,
    });
  }
  if (task.steps.some((step) => step.kind === "write" || step.kind === "edit")) {
    artifacts.push({
      id: `diff:${task.taskId}`,
      label: "Workspace diff",
      kind: "diff",
      uri: `mission-control://runs/${task.taskId}/diff`,
    });
  }
  for (const step of task.steps ?? []) {
    if (step.kind === "diagnostics") {
      artifacts.push({
        id: `${task.taskId}:artifact:${step.index}`,
        label: `Diagnostics ${step.index + 1}`,
        kind: "validation",
        uri: `validation://${task.taskId}/${step.index}`,
      });
      continue;
    }
    if (step.kind === "bash" || step.kind === "js_repl") {
      artifacts.push({
        id: `${task.taskId}:command:${step.index}`,
        label: `Command ${step.index + 1}`,
        kind: "command",
        uri: `command://${task.taskId}/${step.index}`,
      });
    }
  }
  return artifacts;
}

function readStepMutationPath(step: AgentTaskSummary["steps"][number]): string | null {
  const safetyPath =
    typeof step.metadata?.safety?.path === "string" ? step.metadata.safety.path : null;
  if (safetyPath?.trim()) {
    return safetyPath.trim();
  }
  const approvalScopeTarget =
    step.metadata?.approval?.scopeKind === "file-target" &&
    typeof step.metadata.approval.scopeTarget === "string"
      ? step.metadata.approval.scopeTarget
      : null;
  if (approvalScopeTarget?.trim()) {
    return approvalScopeTarget.trim();
  }
  return null;
}

export function deriveRunChangedPaths(task: AgentTaskSummary): string[] {
  const changedPaths: string[] = [];
  for (const step of task.steps ?? []) {
    if (step.kind !== "write" && step.kind !== "edit") {
      continue;
    }
    pushUniqueText(changedPaths, readStepMutationPath(step));
  }
  return changedPaths;
}

export function buildReviewPackFileChanges(
  changedPaths: string[]
): HugeCodeReviewPackFileChangeSummary {
  const totalCount = changedPaths.length;
  return {
    paths: changedPaths,
    totalCount,
    summary:
      totalCount > 0
        ? `${totalCount} runtime-recorded file change${totalCount === 1 ? "" : "s"}`
        : "Runtime file changes unavailable",
    missingReason:
      totalCount > 0
        ? null
        : "The runtime did not record explicit file-target mutations for this review pack.",
  };
}

export function buildReviewPackEvidenceRefs(
  run: Pick<HugeCodeRunSummary, "ledger" | "artifacts" | "checkpoint">
): HugeCodeReviewPackEvidenceRefs {
  const artifacts = run.artifacts ?? [];
  return {
    traceId: run.checkpoint?.traceId ?? run.ledger?.traceId ?? null,
    checkpointId: run.checkpoint?.checkpointId ?? run.ledger?.checkpointId ?? null,
    diffArtifactIds: artifacts
      .filter((artifact) => artifact.kind === "diff")
      .map((artifact) => artifact.id),
    validationArtifactIds: artifacts
      .filter((artifact) => artifact.kind === "validation")
      .map((artifact) => artifact.id),
    logArtifactIds: artifacts
      .filter((artifact) => artifact.kind === "log")
      .map((artifact) => artifact.id),
    commandArtifactIds: artifacts
      .filter((artifact) => artifact.kind === "command")
      .map((artifact) => artifact.id),
  };
}

export function deriveRunWarnings(task: AgentTaskSummary, routingHint?: string | null): string[] {
  const warnings: string[] = [];
  const checkpoint = buildTaskCheckpointState(task);
  pushUniqueText(warnings, task.errorMessage);
  if (task.status === "awaiting_approval") {
    pushUniqueText(warnings, "Run is waiting on operator input.");
  }
  if (task.status === "interrupted" && isRecoverableRuntimeTask(task)) {
    pushUniqueText(
      warnings,
      checkpoint?.summary ?? "Run was interrupted and can resume from a checkpoint."
    );
  }
  pushUniqueText(warnings, routingHint);
  for (const step of task.steps ?? []) {
    pushUniqueText(warnings, step.errorMessage);
  }
  return warnings;
}

export function buildReviewPackAssumptions(
  run: HugeCodeRunSummary,
  reviewStatus: HugeCodeReviewStatus
) {
  const assumptions: string[] = [];
  pushUniqueText(
    assumptions,
    run.title?.trim() ? `Objective carried into review: ${run.title.trim()}.` : null
  );
  if (run.executionProfile?.name) {
    pushUniqueText(
      assumptions,
      `Review assumes the "${run.executionProfile.name}" execution profile guardrails were enforced during execution.`
    );
  }
  if (reviewStatus === "incomplete_evidence") {
    pushUniqueText(
      assumptions,
      "Acceptance should be treated as provisional until missing evidence is re-collected or reviewed elsewhere."
    );
  }
  return assumptions;
}

export function buildReviewPackReproductionGuidance(
  validations: HugeCodeValidationSummary[],
  checksPerformed: string[],
  artifacts: HugeCodeReviewArtifactRef[]
) {
  const steps: string[] = [];
  for (const validation of validations) {
    pushUniqueText(steps, `Re-run ${validation.label}: ${validation.summary}`);
  }
  if (steps.length === 0 && checksPerformed.length > 0) {
    pushUniqueText(steps, `Re-run recorded checks: ${checksPerformed.join(", ")}.`);
  }
  for (const artifact of artifacts) {
    if (
      (artifact.kind === "validation" || artifact.kind === "log" || artifact.kind === "command") &&
      artifact.uri
    ) {
      pushUniqueText(steps, `Inspect ${artifact.label} at ${artifact.uri}.`);
    }
  }
  return steps;
}

export function buildReviewPackRollbackGuidance(
  run: HugeCodeRunSummary,
  artifacts: HugeCodeReviewArtifactRef[]
) {
  const guidance: string[] = [];
  const diffArtifacts = artifacts.filter((artifact) => artifact.kind === "diff");
  if (diffArtifacts.length > 0) {
    pushUniqueText(
      guidance,
      `Use ${diffArtifacts.map((artifact) => artifact.label).join(", ")} as the rollback reference before reverting affected files.`
    );
  }
  if (!run.taskId.startsWith(RUNTIME_TASK_ENTITY_PREFIX)) {
    pushUniqueText(
      guidance,
      "Open the mission thread to retry, narrow scope, or reroute instead of making an untracked follow-up edit."
    );
  }
  return guidance;
}

export function buildReviewPackBackendAudit(run: HugeCodeRunSummary) {
  const details: string[] = [];
  pushUniqueText(
    details,
    run.routing?.providerLabel ? `Provider: ${run.routing.providerLabel}` : null
  );
  pushUniqueText(details, run.routing?.pool ? `Pool: ${run.routing.pool}` : null);
  pushUniqueText(details, run.routing?.health ? `Routing health: ${run.routing.health}` : null);
  if (
    run.routing?.readyAccountCount !== undefined &&
    run.routing?.readyAccountCount !== null &&
    run.routing?.enabledAccountCount !== undefined &&
    run.routing?.enabledAccountCount !== null
  ) {
    pushUniqueText(
      details,
      `Ready accounts: ${run.routing.readyAccountCount}/${run.routing.enabledAccountCount}`
    );
  }
  if (run.routing?.enabledPoolCount !== undefined && run.routing?.enabledPoolCount !== null) {
    pushUniqueText(details, `Enabled pools: ${run.routing.enabledPoolCount}`);
  }
  pushUniqueText(details, run.routing?.routeHint ?? null);

  return {
    summary:
      run.routing?.routeLabel ??
      (run.executionProfile?.name
        ? `Executed with ${run.executionProfile.name}`
        : "Routing information unavailable"),
    details,
    missingReason: run.routing?.routeLabel
      ? null
      : "The runtime did not publish backend audit details for this review pack.",
  };
}

export function deriveRunCompletionReason(task: AgentTaskSummary): string | null {
  if (task.errorMessage?.trim()) {
    return task.errorMessage.trim();
  }
  switch (task.status) {
    case "completed":
      return "Run completed.";
    case "failed":
      return "Run failed.";
    case "cancelled":
      return "Run was cancelled.";
    case "interrupted":
      return isRecoverableRuntimeTask(task)
        ? "Run was interrupted but can resume from a checkpoint."
        : "Run was interrupted.";
    default:
      return null;
  }
}
