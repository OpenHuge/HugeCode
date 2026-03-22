import type {
  AgentTaskSummary,
  HugeCodeRunOperatorEvent,
  HugeCodeRunOperatorSnapshot,
  HugeCodeRunState,
  HugeCodeRunSummary,
  HugeCodeTaskAccountability,
} from "@ku0/code-runtime-host-contract";
import { buildTaskCheckpointState } from "./runtimeMissionControlCheckpoint";

function getRuntimeLabel(
  executionMode: HugeCodeRunSummary["executionProfile"] extends infer Profile
    ? Profile extends { executionMode: infer ExecutionMode }
      ? ExecutionMode | null
      : never
    : never
): string | null {
  switch (executionMode) {
    case "local_interactive":
      return "local interactive";
    case "local_background":
      return "local background";
    case "desktop_sandbox":
      return "desktop sandbox";
    case "remote_sandbox":
      return "remote sandbox";
    default:
      return null;
  }
}

function describeStepActivity(
  step: AgentTaskSummary["steps"][number] | null | undefined
): string | null {
  if (!step) {
    return null;
  }
  const message = step.message?.trim() ?? "";
  if (message.length > 0) {
    return message;
  }
  const kind = step.kind?.trim() ?? "";
  if (kind.length > 0) {
    return `${kind} step ${step.index + 1}`;
  }
  return null;
}

function buildOperatorBlocker(task: AgentTaskSummary, runState: HugeCodeRunState): string | null {
  if (task.pendingApprovalId || task.status === "awaiting_approval") {
    return task.errorMessage?.trim() || "Run is waiting for an operator approval decision.";
  }
  if (runState === "paused") {
    return "Run is paused and waiting for resume.";
  }
  if (runState === "failed" || runState === "cancelled") {
    return task.errorMessage?.trim() || "Run needs operator follow-up before it can continue.";
  }
  return null;
}

function buildOperatorRecentEvents(
  task: AgentTaskSummary,
  runState: HugeCodeRunState
): NonNullable<HugeCodeRunOperatorSnapshot["recentEvents"]> {
  const events: HugeCodeRunOperatorEvent[] = task.steps
    .slice(-4)
    .map((step): HugeCodeRunOperatorEvent | null => {
      const detail = describeStepActivity(step);
      if (!detail) {
        return null;
      }
      return {
        kind:
          step.status === "completed"
            ? ("tool_finish" as const)
            : step.status === "queued"
              ? ("tool_start" as const)
              : ("status_transition" as const),
        label:
          step.status === "completed"
            ? `${step.kind} completed`
            : step.status === "queued"
              ? `${step.kind} queued`
              : `${step.kind} ${step.status}`,
        detail,
        at: step.completedAt ?? step.updatedAt ?? step.startedAt ?? null,
      };
    })
    .filter((event): event is NonNullable<typeof event> => event !== null);

  if (task.pendingApprovalId || task.status === "awaiting_approval") {
    events.push({
      kind: "approval_wait",
      label: "Approval wait",
      detail: "Runtime paused for an operator decision.",
      at: task.updatedAt,
    });
  }
  if (task.recovered) {
    const checkpoint = buildTaskCheckpointState(task);
    events.push({
      kind: "recovered",
      label: "Recovered from checkpoint",
      detail:
        checkpoint?.summary ??
        (checkpoint?.checkpointId
          ? `Checkpoint ${checkpoint.checkpointId}`
          : "Checkpoint preserved."),
      at: task.updatedAt,
    });
  }
  if (runState === "failed" || runState === "cancelled" || runState === "paused") {
    events.push({
      kind: "blocked",
      label: `Run ${runState.replace("_", " ")}`,
      detail: buildOperatorBlocker(task, runState) ?? "Run requires operator follow-up.",
      at: task.updatedAt,
    });
  }

  return events.sort((left, right) => (right.at ?? 0) - (left.at ?? 0)).slice(0, 5);
}

function buildWorkspaceEvidenceBuckets(input: {
  changedPaths: string[];
  artifacts: NonNullable<HugeCodeRunSummary["artifacts"]>;
  validations: NonNullable<HugeCodeRunSummary["validations"]>;
  noteItems: Array<{ id: string; label: string; detail: string | null }>;
}) {
  const diffItems = input.artifacts
    .filter((artifact) => artifact.kind === "diff")
    .map((artifact) => ({
      id: artifact.id,
      label: artifact.label,
      detail: "diff",
      uri: artifact.uri ?? null,
    }));
  const validationItems = [
    ...input.validations.map((validation) => ({
      id: validation.id,
      label: validation.label,
      detail: validation.summary,
      uri: null,
    })),
    ...input.artifacts
      .filter((artifact) => artifact.kind === "validation")
      .map((artifact) => ({
        id: artifact.id,
        label: artifact.label,
        detail: "validation artifact",
        uri: artifact.uri ?? null,
      })),
  ];
  const commandItems = input.artifacts
    .filter((artifact) => artifact.kind === "command")
    .map((artifact) => ({
      id: artifact.id,
      label: artifact.label,
      detail: "command trace",
      uri: artifact.uri ?? null,
    }));
  const logItems = input.artifacts
    .filter((artifact) => artifact.kind === "log")
    .map((artifact) => ({
      id: artifact.id,
      label: artifact.label,
      detail: "runtime log",
      uri: artifact.uri ?? null,
    }));

  return [
    {
      kind: "changedFiles" as const,
      label: "Changed files",
      summary:
        input.changedPaths.length > 0
          ? `${input.changedPaths.length} file${input.changedPaths.length === 1 ? "" : "s"} recorded.`
          : "No changed files were published.",
      items: input.changedPaths.map((path) => ({
        id: path,
        label: path,
        detail: "Runtime-recorded changed path",
        uri: null,
      })),
      missingReason:
        input.changedPaths.length > 0 ? null : "Runtime did not publish changed-file evidence.",
    },
    {
      kind: "diffs" as const,
      label: "Diffs",
      summary:
        diffItems.length > 0
          ? `${diffItems.length} diff artifact${diffItems.length === 1 ? "" : "s"} linked.`
          : "No diff artifact was published.",
      items: diffItems,
      missingReason: diffItems.length > 0 ? null : "Runtime did not publish diff evidence.",
    },
    {
      kind: "validations" as const,
      label: "Validations",
      summary:
        validationItems.length > 0
          ? `${validationItems.length} validation item${validationItems.length === 1 ? "" : "s"} published.`
          : "No validation evidence was published.",
      items: validationItems,
      missingReason:
        validationItems.length > 0 ? null : "Runtime did not publish validation evidence.",
    },
    {
      kind: "commands" as const,
      label: "Commands",
      summary:
        commandItems.length > 0
          ? `${commandItems.length} command artifact${commandItems.length === 1 ? "" : "s"} linked.`
          : "No command evidence was published.",
      items: commandItems,
      missingReason: commandItems.length > 0 ? null : "Runtime did not publish command evidence.",
    },
    {
      kind: "logs" as const,
      label: "Logs",
      summary:
        logItems.length > 0
          ? `${logItems.length} log artifact${logItems.length === 1 ? "" : "s"} linked.`
          : "No log evidence was published.",
      items: logItems,
      missingReason: logItems.length > 0 ? null : "Runtime did not publish runtime logs.",
    },
    {
      kind: "memoryOrNotes" as const,
      label: "Memory and notes",
      summary:
        input.noteItems.length > 0
          ? `${input.noteItems.length} runtime note${input.noteItems.length === 1 ? "" : "s"} attached.`
          : "No memory or notes were published.",
      items: input.noteItems.map((item) => ({
        ...item,
        uri: null,
      })),
      missingReason:
        input.noteItems.length > 0
          ? null
          : "Runtime did not publish memory, notes, or handoff annotations.",
    },
  ];
}

export function buildRunOperatorSnapshot(input: {
  task: AgentTaskSummary;
  runState: HugeCodeRunState;
  executionProfile: HugeCodeRunSummary["executionProfile"];
  routing: HugeCodeRunSummary["routing"];
  workspaceRoot: string | null;
}): HugeCodeRunOperatorSnapshot {
  const currentStep =
    typeof input.task.currentStep === "number"
      ? (input.task.steps[input.task.currentStep] ?? null)
      : null;
  const currentActivity =
    describeStepActivity(currentStep) ??
    input.task.steps
      .slice()
      .reverse()
      .map((step) => describeStepActivity(step))
      .find((entry): entry is string => Boolean(entry)) ??
    null;
  const runtimeLabel = getRuntimeLabel(input.executionProfile?.executionMode ?? null);
  const modelId = input.task.routedModelId ?? input.task.modelId ?? null;
  const backendId = input.routing?.backendId ?? input.task.backendId ?? null;
  const blocker = buildOperatorBlocker(input.task, input.runState);
  const recentEvents = buildOperatorRecentEvents(input.task, input.runState);
  const summary =
    currentActivity && backendId
      ? `${currentActivity} on ${backendId}.`
      : (currentActivity ?? `Run is ${input.runState.replace("_", " ")}.`);

  return {
    summary,
    runtimeLabel,
    provider: input.task.routedProvider ?? input.task.provider ?? null,
    modelId,
    reasoningEffort: input.task.reasonEffort ?? null,
    backendId,
    machineId: null,
    machineSummary: backendId
      ? "Backend known, machine not published."
      : "Machine binding unavailable.",
    workspaceRoot: input.workspaceRoot,
    currentActivity,
    blocker,
    recentEvents,
  };
}

export function buildRunWorkspaceEvidence(input: {
  run: Pick<
    HugeCodeRunSummary,
    | "changedPaths"
    | "artifacts"
    | "validations"
    | "missionBrief"
    | "publishHandoff"
    | "relaunchContext"
  >;
}) {
  const noteItems = [
    input.run.missionBrief
      ? {
          id: "mission-brief",
          label: "Mission brief",
          detail: input.run.missionBrief.objective,
        }
      : null,
    input.run.publishHandoff
      ? {
          id: "publish-handoff",
          label: "Publish handoff",
          detail: input.run.publishHandoff.summary ?? input.run.publishHandoff.reviewTitle ?? null,
        }
      : null,
    input.run.relaunchContext?.summary
      ? {
          id: "relaunch-context",
          label: "Relaunch context",
          detail: input.run.relaunchContext.summary,
        }
      : null,
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return {
    summary: "Runtime published inspectable workspace evidence for this run.",
    buckets: buildWorkspaceEvidenceBuckets({
      changedPaths: input.run.changedPaths ?? [],
      artifacts: input.run.artifacts ?? [],
      validations: input.run.validations ?? [],
      noteItems,
    }),
  };
}

export function buildTaskAccountability(input: {
  run: Pick<HugeCodeRunSummary, "state" | "updatedAt" | "finishedAt" | "reviewDecision"> | null;
  createdAt: number | null;
}): HugeCodeTaskAccountability | null {
  if (!input.run) {
    return null;
  }
  const reviewDecision = input.run.reviewDecision ?? null;
  if (reviewDecision?.status === "accepted") {
    return {
      lifecycle: "done",
      claimedBy: "local-operator",
      claimedAt: input.createdAt,
      lifecycleUpdatedAt: reviewDecision.decidedAt ?? input.run.finishedAt ?? input.run.updatedAt,
    };
  }
  if (input.run.state === "review_ready") {
    return {
      lifecycle: "in_review",
      claimedBy: "local-operator",
      claimedAt: input.createdAt,
      lifecycleUpdatedAt: input.run.finishedAt ?? input.run.updatedAt,
    };
  }
  if (input.run.state === "queued" || input.run.state === "preparing") {
    return {
      lifecycle: "claimed",
      claimedBy: "local-operator",
      claimedAt: input.createdAt,
      lifecycleUpdatedAt: input.createdAt ?? input.run.updatedAt,
    };
  }
  return {
    lifecycle: "executing",
    claimedBy: "local-operator",
    claimedAt: input.createdAt,
    lifecycleUpdatedAt: input.run.updatedAt,
  };
}
