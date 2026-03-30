import type {
  AccessMode,
  AgentTaskSourceSummary,
  HugeCodeReviewPackSummary,
  HugeCodeRunSummary,
} from "@ku0/code-runtime-host-contract";
import type { RepositoryExecutionContract } from "./runtimeRepositoryExecutionContract";
import { resolveReviewProfileDefaults } from "./runtimeReviewIntelligenceSummary";
import { summarizeReviewContinuationActionability } from "./runtimeReviewContinuationFacade";
import type { RuntimeAgentControl } from "../types/webMcpBridge";

export type ReviewAutofixProposalPreview = {
  reason: string;
  instructionPatch: string;
};

function buildReviewAgentInstruction(input: {
  run: Pick<
    HugeCodeRunSummary,
    | "id"
    | "state"
    | "checkpoint"
    | "reviewPackId"
    | "title"
    | "summary"
    | "warnings"
    | "validations"
    | "changedPaths"
    | "continuation"
    | "takeoverBundle"
    | "actionability"
    | "missionLinkage"
    | "publishHandoff"
    | "reviewPackId"
    | "continuation"
  >;
  reviewPack?: Pick<
    HugeCodeReviewPackSummary,
    | "id"
    | "checkpoint"
    | "summary"
    | "warningCount"
    | "warnings"
    | "validations"
    | "continuation"
    | "recommendedNextAction"
    | "takeoverBundle"
    | "actionability"
    | "missionLinkage"
    | "publishHandoff"
    | "continuation"
  > | null;
}): string {
  const continuation = summarizeReviewContinuationActionability({
    runState: input.run.state,
    checkpoint: input.reviewPack?.checkpoint ?? input.run.checkpoint ?? null,
    takeoverBundle: input.reviewPack?.takeoverBundle ?? input.run.takeoverBundle ?? null,
    actionability: input.reviewPack?.actionability ?? input.run.actionability ?? null,
    missionLinkage: input.reviewPack?.missionLinkage ?? input.run.missionLinkage ?? null,
    publishHandoff: input.reviewPack?.publishHandoff ?? input.run.publishHandoff ?? null,
    reviewPackId: input.reviewPack?.id ?? input.run.reviewPackId ?? null,
    continuation: input.reviewPack?.continuation ?? input.run.continuation ?? null,
  });
  const operatorExpectation =
    continuation.state !== "missing"
      ? continuation.recommendedAction
      : (input.reviewPack?.recommendedNextAction ?? null);
  const sections = [
    `Review the delegated run ${input.run.id}.`,
    input.reviewPack?.summary ?? input.run.summary ?? input.run.title ?? null,
    input.reviewPack?.warningCount || (input.run.warnings?.length ?? 0) > 0
      ? `Warnings: ${(input.reviewPack?.warnings ?? input.run.warnings ?? []).join(" | ")}`
      : null,
    (input.reviewPack?.validations?.length ?? input.run.validations?.length ?? 0) > 0
      ? `Validation evidence: ${(input.reviewPack?.validations ?? input.run.validations ?? [])
          .map((validation) => `${validation.label}=${validation.outcome}`)
          .join(", ")}`
      : null,
    (input.run.changedPaths?.length ?? 0) > 0
      ? `Changed paths: ${input.run.changedPaths?.join(", ")}`
      : null,
    operatorExpectation ? `Operator expectation: ${operatorExpectation}` : null,
    "Produce structured review findings for correctness, validation, security, policy alignment, and required follow-up clarification.",
  ];
  return sections.filter((value): value is string => Boolean(value)).join("\n\n");
}

export async function runReviewAgent(input: {
  runtimeControl: Pick<RuntimeAgentControl, "startTask">;
  workspaceId: string;
  run: HugeCodeRunSummary;
  reviewPack?: HugeCodeReviewPackSummary | null;
  taskSource?: AgentTaskSourceSummary | null;
  repositoryExecutionContract?: RepositoryExecutionContract | null;
  reviewProfileId?: string | null;
  preferredBackendIds?: string[] | null;
  accessMode?: AccessMode | null;
}) {
  const resolvedDefaults = resolveReviewProfileDefaults({
    contract: input.repositoryExecutionContract ?? null,
    taskSource: input.taskSource ?? input.run.taskSource ?? null,
    explicitReviewProfileId: input.reviewProfileId ?? null,
    runtimeReviewProfileId: input.run.reviewProfileId ?? null,
    runtimeValidationPresetId: input.run.executionProfile?.validationPresetId ?? null,
  });
  return await input.runtimeControl.startTask({
    workspaceId: input.workspaceId,
    title: input.run.title?.trim() ? `Review: ${input.run.title.trim()}` : `Review ${input.run.id}`,
    taskSource:
      input.taskSource ??
      ({
        kind: "external_runtime",
        title: input.run.title ?? input.run.summary ?? `Review ${input.run.id}`,
        sourceTaskId: input.run.taskId,
        sourceRunId: input.run.id,
      } satisfies AgentTaskSourceSummary),
    reviewProfileId: resolvedDefaults.reviewProfileId,
    validationPresetId: resolvedDefaults.validationPresetId,
    instruction: buildReviewAgentInstruction({
      run: input.run,
      reviewPack: input.reviewPack ?? null,
    }),
    stepKind: "read",
    accessMode: input.accessMode ?? "read-only",
    ...(input.preferredBackendIds ? { preferredBackendIds: [...input.preferredBackendIds] } : {}),
  });
}

export async function applyReviewAutofix(input: {
  runtimeControl: Pick<RuntimeAgentControl, "interveneTask">;
  taskId: string;
  autofixCandidate: { id: string; summary: string; status: "available" | "applied" | "blocked" };
}) {
  if (input.autofixCandidate.status !== "available") {
    throw new Error("Review autofix is unavailable for this run.");
  }
  if (typeof input.runtimeControl.interveneTask !== "function") {
    throw new Error(
      "Runtime review autofix is unavailable because task intervention is unsupported."
    );
  }
  const proposalPreview = buildReviewAutofixProposalPreview(input.autofixCandidate);
  return await input.runtimeControl.interveneTask({
    taskId: input.taskId,
    action: "retry",
    reason: proposalPreview.reason,
    instructionPatch: proposalPreview.instructionPatch,
  });
}

export function buildReviewAutofixProposalPreview(input: {
  id: string;
  summary: string;
  status: "available" | "applied" | "blocked";
}): ReviewAutofixProposalPreview {
  return {
    reason: `Apply review autofix ${input.id}`,
    instructionPatch: `Apply the bounded autofix candidate before continuing:\n- ${input.summary}`,
  };
}
