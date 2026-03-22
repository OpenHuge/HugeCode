import type { ReasonEffort } from "@ku0/code-runtime-host-contract";
import type {
  AutoDriveContextSnapshot,
  AutoDriveExecutionConfig,
  AutoDrivePublishOutcome,
  AutoDriveRouteProposal,
  AutoDriveRunRecord,
} from "../types/autoDrive";

export function coerceReasonEffort(value: string | null | undefined): ReasonEffort | null {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return null;
}

export function resolveBaseExecutionConfig(run: AutoDriveRunRecord): AutoDriveExecutionConfig {
  return {
    accessMode: run.execution?.accessMode ?? "on-request",
    modelId: run.execution?.modelId ?? null,
    reasoningEffort: coerceReasonEffort(run.execution?.reasoningEffort ?? null),
  };
}

export function deriveAdaptiveExecutionConfig(
  run: AutoDriveRunRecord,
  context: AutoDriveContextSnapshot
): AutoDriveExecutionConfig {
  const base = resolveBaseExecutionConfig(run);
  if (
    context.executionTuning.cautionLevel === "high" ||
    context.executionTuning.validationCommandPreference === "full"
  ) {
    return {
      ...base,
      reasoningEffort: "high",
    };
  }
  if (
    context.executionTuning.cautionLevel === "elevated" ||
    context.executionTuning.publishPriority !== "none"
  ) {
    return {
      ...base,
      reasoningEffort:
        base.reasoningEffort === "high" ? "high" : (base.reasoningEffort ?? "medium"),
    };
  }
  if (base.reasoningEffort === null && run.destination.routePreference === "speed_first") {
    return {
      ...base,
      reasoningEffort: "low",
    };
  }
  return base;
}

export function sameExecutionConfig(
  left: AutoDriveExecutionConfig | null,
  right: AutoDriveExecutionConfig
): boolean {
  return (
    left !== null &&
    left.accessMode === right.accessMode &&
    left.modelId === right.modelId &&
    left.reasoningEffort === right.reasoningEffort
  );
}

function normalizeCommand(command: string | null | undefined): string | null {
  if (typeof command !== "string") {
    return null;
  }
  const normalized = command.trim();
  return normalized.length > 0 ? normalized : null;
}

export function resolveValidationCommands(params: {
  context: AutoDriveContextSnapshot;
  proposal: AutoDriveRouteProposal;
}): string[] {
  const validateFast = normalizeCommand(params.context.repo.scripts.validateFast);
  const validateFull = normalizeCommand(params.context.repo.scripts.validate);
  const commands = params.proposal.currentWaypoint.validationPlan
    .map((command) => normalizeCommand(command))
    .filter((command): command is string => command !== null);

  if (commands.length === 0) {
    return [];
  }

  return [
    ...new Set(
      commands.map((command) => {
        if (
          params.context.executionTuning.validationCommandPreference === "full" &&
          validateFull &&
          command === validateFast
        ) {
          return validateFull;
        }
        if (
          params.context.executionTuning.validationCommandPreference === "fast" &&
          validateFast &&
          command === validateFull
        ) {
          return validateFast;
        }
        return command;
      })
    ),
  ];
}

export function shouldPromoteBranchOnlyToPush(params: {
  context: AutoDriveContextSnapshot;
  branchOnlyOutcome: AutoDrivePublishOutcome | null;
}): boolean {
  return Boolean(
    params.context.executionTuning.publishPriority === "push_candidate" &&
    params.branchOnlyOutcome?.status === "completed" &&
    params.context.publishReadiness.recommendedMode === "branch_only" &&
    params.context.publishReadiness.reasonCodes.length === 1 &&
    params.context.publishReadiness.reasonCodes[0] === "dirty_working_tree" &&
    params.context.git.remote &&
    params.context.git.behind === 0
  );
}
