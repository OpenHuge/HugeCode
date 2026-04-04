import type { AgentTaskRelaunchContext, AgentTaskSummary } from "@ku0/code-runtime-host-contract";
import type { RepositoryExecutionContract } from "./runtimeRepositoryExecutionContract";
import { buildRuntimeClarifyInstruction } from "./runtimeReviewInterventionInstruction";
import {
  prepareReviewContinuationDraft,
  type ReviewContinuationDraft,
  type ReviewContinuationIntent,
} from "./runtimeReviewContinuationFacade";

export type RuntimeTaskLauncherInterventionIntent = ReviewContinuationIntent;

export type MissionInterventionDraft = ReviewContinuationDraft & {
  relaunchContext?: AgentTaskRelaunchContext | null;
};

export type RuntimeTaskLauncherSourceDraft = {
  taskId: string;
  title: string | null;
  instruction: string;
  intent: RuntimeTaskLauncherInterventionIntent;
  profileId: string;
  preferredBackendIds?: string[];
  reviewProfileId: string | null;
  taskSource?: MissionInterventionDraft["taskSource"];
  validationPresetId?: string | null;
  accessMode?: MissionInterventionDraft["accessMode"];
  relaunchContext?: AgentTaskRelaunchContext | null;
  fieldOrigins: MissionInterventionDraft["fieldOrigins"];
};

export type RuntimeTaskLauncherDraft = MissionInterventionDraft & {
  sourceDraft: RuntimeTaskLauncherSourceDraft;
  infoMessage: string;
};

export type PrepareRuntimeTaskLauncherDraftInput = {
  task: AgentTaskSummary;
  intent: RuntimeTaskLauncherInterventionIntent;
  executionProfileId?: string | null;
  fallbackProfileId?: string;
  preferredBackendIds?: string[];
  sourceRunId?: string | null;
  sourceReviewPackId?: string | null;
  repositoryExecutionContract?: RepositoryExecutionContract | null;
};

export type PrepareMissionInterventionDraftInput = {
  title?: string | null;
  instruction: string;
  intent: RuntimeTaskLauncherInterventionIntent;
  executionProfileId?: string | null;
  fallbackProfileId?: string;
  preferredBackendIds?: string[];
  relaunchContext?: AgentTaskRelaunchContext | null;
  sourceTaskId: string;
  sourceRunId: string;
  sourceReviewPackId?: string | null;
  taskSource?: AgentTaskSummary["taskSource"] | null;
  validationPresetId?: string | null;
  accessMode?: AgentTaskSummary["accessMode"] | null;
  repositoryExecutionContract?: RepositoryExecutionContract | null;
};

type PrepareRuntimeTaskLauncherDraftResult =
  | {
      ok: true;
      draft: RuntimeTaskLauncherDraft;
    }
  | {
      ok: false;
      error: string;
    };

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildRuntimeTaskReplayBrief(task: AgentTaskSummary): string {
  const relaunchSummary = readString(task.relaunchContext?.summary);
  if (relaunchSummary) {
    return relaunchSummary;
  }
  const sections: string[] = [];
  const title = readString(task.title);
  if (title) {
    sections.push(title);
  }

  for (const step of task.steps ?? []) {
    const output = readString(step.output);
    if (output) {
      sections.push(output);
      break;
    }
    const message = readString(step.message);
    if (message) {
      sections.push(message);
      break;
    }
  }

  if (sections.length === 0 && task.errorMessage) {
    sections.push(task.errorMessage);
  }

  return sections.join("\n\n").trim();
}

function buildInfoMessage(
  task: AgentTaskSummary,
  intent: RuntimeTaskLauncherInterventionIntent
): string {
  const taskId = task.taskId;
  if (intent === "switch_profile") {
    return `Run ${taskId} loaded into the launcher. Choose a new execution profile, then relaunch with the recorded source context.`;
  }
  if (intent === "pair_mode") {
    return `Run ${taskId} loaded into the launcher for pair-mode escalation with the recorded source context.`;
  }
  const sourceLabel = readString(task.taskSource?.label);
  const relaunchSummary = readString(task.relaunchContext?.summary);
  const suffix = [sourceLabel ? `Source-linked launch: ${sourceLabel}.` : null, relaunchSummary]
    .filter((entry): entry is string => entry !== null)
    .join(" ");
  if (suffix.length > 0) {
    return `Run ${taskId} loaded into the launcher for ${intent.replaceAll("_", " ")}. ${suffix}`;
  }
  return `Run ${taskId} loaded into the launcher for ${intent.replaceAll("_", " ")}.`;
}

export function prepareMissionInterventionDraft(
  input: PrepareMissionInterventionDraftInput
): MissionInterventionDraft | null {
  const continuationDraft = prepareReviewContinuationDraft({
    contract: input.repositoryExecutionContract ?? null,
    taskSource: input.taskSource ?? null,
    runtimeDefaults: {
      sourceTaskId: input.sourceTaskId,
      sourceRunId: input.sourceRunId,
      sourceReviewPackId: input.sourceReviewPackId ?? null,
      taskSource: input.taskSource ?? null,
      executionProfileId: input.executionProfileId ?? null,
      preferredBackendIds: input.preferredBackendIds,
      accessMode: input.accessMode ?? null,
      validationPresetId: input.validationPresetId ?? null,
      relaunchContext: input.relaunchContext ?? null,
    },
    intent: input.intent,
    title: input.title?.trim() ?? "",
    instruction: input.instruction,
    fallbackProfileId: readString(input.fallbackProfileId) ?? null,
  });
  if (!continuationDraft) {
    return null;
  }

  return {
    ...continuationDraft,
    ...(continuationDraft.relaunchContext
      ? { relaunchContext: continuationDraft.relaunchContext }
      : {}),
  };
}

export function prepareRuntimeTaskLauncherDraft(
  input: PrepareRuntimeTaskLauncherDraftInput
): PrepareRuntimeTaskLauncherDraftResult {
  const draftInstruction = buildRuntimeTaskReplayBrief(input.task);
  if (draftInstruction.length === 0) {
    return {
      ok: false,
      error: `Run ${input.task.taskId} does not have enough context to relaunch from Mission Control.`,
    };
  }

  const profileId =
    readString(input.executionProfileId) ??
    readString(input.task.executionProfileId) ??
    readString(input.fallbackProfileId);
  if (!profileId) {
    return {
      ok: false,
      error: `Run ${input.task.taskId} does not have a runtime-published execution profile for relaunch.`,
    };
  }
  const nextInstruction =
    input.intent === "clarify"
      ? buildRuntimeClarifyInstruction(draftInstruction)
      : draftInstruction;
  const interventionDraft = prepareMissionInterventionDraft({
    title: input.task.title ?? "",
    instruction: nextInstruction,
    intent: input.intent,
    executionProfileId: profileId,
    preferredBackendIds: input.preferredBackendIds,
    relaunchContext: input.task.relaunchContext ?? null,
    sourceTaskId: input.task.taskId,
    sourceRunId:
      readString(input.sourceRunId) ??
      readString(input.task.relaunchContext?.sourceRunId) ??
      input.task.taskId,
    sourceReviewPackId:
      input.sourceReviewPackId ??
      readString(input.task.relaunchContext?.sourceReviewPackId) ??
      null,
    taskSource: input.task.taskSource ?? null,
    accessMode: input.task.accessMode,
    validationPresetId: input.task.executionProfile?.validationPresetId ?? null,
    repositoryExecutionContract: input.repositoryExecutionContract ?? null,
  });
  if (!interventionDraft) {
    return {
      ok: false,
      error: `Run ${input.task.taskId} cannot be relaunched because runtime continuation defaults are incomplete.`,
    };
  }

  return {
    ok: true,
    draft: {
      ...interventionDraft,
      sourceDraft: {
        taskId: input.task.taskId,
        title: input.task.title ?? null,
        instruction: nextInstruction,
        intent: input.intent,
        profileId: interventionDraft.profileId,
        ...(interventionDraft.preferredBackendIds
          ? { preferredBackendIds: interventionDraft.preferredBackendIds }
          : {}),
        reviewProfileId: interventionDraft.reviewProfileId,
        taskSource: interventionDraft.taskSource,
        validationPresetId: interventionDraft.validationPresetId,
        accessMode: interventionDraft.accessMode,
        ...(interventionDraft.relaunchContext
          ? { relaunchContext: interventionDraft.relaunchContext }
          : {}),
        fieldOrigins: interventionDraft.fieldOrigins,
      },
      infoMessage: buildInfoMessage(input.task, input.intent),
    },
  };
}
