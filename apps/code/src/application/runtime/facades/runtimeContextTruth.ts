import type {
  AgentTaskSourceSummary,
  RuntimeContextSourceFamilyV2,
  RuntimeContextTruthSourceV2,
  RuntimeContextTruthV2,
  RuntimeDelegationContractV2,
  RuntimeGuidanceLayerV2,
  RuntimeGuidanceStackV2,
  RuntimeReviewIntentV2,
} from "@ku0/code-runtime-host-contract";
import type { ResolvedRepositoryExecutionDefaults } from "./runtimeRepositoryExecutionContract";

type BuildRuntimeContextTruthInput = {
  taskSource: AgentTaskSourceSummary | null | undefined;
  repositoryDefaults: Pick<
    ResolvedRepositoryExecutionDefaults,
    "executionProfileId" | "reviewProfileId" | "validationPresetId"
  >;
  contractLabel?: string | null;
  hasRepoInstructions?: boolean;
  explicitInstruction?: string | null;
};

type BuildRuntimeDelegationContractInput = {
  contextTruth: RuntimeContextTruthV2;
  missingContext?: string[] | null;
  approvalBatchCount?: number;
  continuationSummary?: string | null;
  continuePathLabel?: string | null;
  nextOperatorAction?: string | null;
  blocked?: boolean;
};

function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNonEmptyList(value: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const entry of value) {
    const normalized = readOptionalText(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    items.push(normalized);
  }
  return items;
}

export function classifyRuntimeContextSourceFamily(
  kind: AgentTaskSourceSummary["kind"] | null | undefined
): RuntimeContextSourceFamilyV2 {
  switch (kind) {
    case "github_issue":
    case "github_pr_followup":
      return "github";
    case "github_discussion":
      return "discussion";
    case "note":
      return "note";
    case "customer_feedback":
      return "feedback";
    case "doc":
      return "doc";
    case "call_summary":
      return "call";
    case "schedule":
      return "schedule";
    case "external_runtime":
      return "runtime";
    case "external_ref":
      return "external";
    case "manual":
    case "manual_thread":
    case "autodrive":
    default:
      return "manual";
  }
}

export function inferRuntimeReviewIntent(
  input: Pick<BuildRuntimeContextTruthInput, "taskSource" | "repositoryDefaults">
): RuntimeReviewIntentV2 {
  if (readOptionalText(input.repositoryDefaults.reviewProfileId)) {
    return "review";
  }
  switch (input.taskSource?.kind) {
    case "github_pr_followup":
      return "review";
    case "github_issue":
    case "github_discussion":
    case "customer_feedback":
    case "call_summary":
      return "triage";
    default:
      return "execute";
  }
}

function buildRuntimeContextTruthSource(
  taskSource: AgentTaskSourceSummary | null | undefined
): RuntimeContextTruthSourceV2 | null {
  if (!taskSource) {
    return null;
  }
  const label =
    readOptionalText(taskSource.label) ??
    readOptionalText(taskSource.title) ??
    readOptionalText(taskSource.reference) ??
    "Task source";
  const summaryParts = readNonEmptyList([
    taskSource.title ?? null,
    taskSource.reference ?? null,
    taskSource.repo?.fullName ?? null,
  ]);
  return {
    kind: taskSource.kind,
    family: classifyRuntimeContextSourceFamily(taskSource.kind),
    label,
    summary: summaryParts.join(" · ") || label,
    source: readOptionalText(taskSource.kind),
    reference: readOptionalText(taskSource.reference),
    canonicalUrl:
      readOptionalText(taskSource.canonicalUrl) ??
      readOptionalText(taskSource.url) ??
      readOptionalText(taskSource.externalId),
    primary: true,
  };
}

export function buildRuntimeGuidanceStack(
  input: BuildRuntimeContextTruthInput
): RuntimeGuidanceStackV2 {
  const layers: RuntimeGuidanceLayerV2[] = [];
  if (input.hasRepoInstructions) {
    layers.push({
      id: "repo-instructions",
      scope: "repo",
      summary: "Repo instructions remain the baseline contract for launch, review, and follow-up.",
      source: "AGENTS.md",
      priority: 10,
      instructions: [
        "Prefer runtime-owned truth over page-local heuristics.",
        "Keep launch, review, and continuation semantics aligned.",
      ],
      skillIds: [],
    });
  }
  if (readOptionalText(input.contractLabel)) {
    layers.push({
      id: "review-profile",
      scope: "review_profile",
      summary: `Repository execution contract ${input.contractLabel} resolves review and validation defaults.`,
      source: ".hugecode/repository-execution-contract.json",
      priority: 30,
      instructions: [
        "Apply repo defaults before inventing source-local routing or validation policy.",
      ],
      skillIds: [],
    });
  }
  if (input.taskSource) {
    layers.push({
      id: "source-guidance",
      scope: "source",
      summary: `Source kind ${input.taskSource.kind} enters the same governed run path as manual work.`,
      source: input.taskSource.kind,
      priority: 40,
      instructions: ["Normalize source-linked work into canonical task/run/review semantics."],
      skillIds: [],
    });
  }
  if (readOptionalText(input.explicitInstruction)) {
    layers.push({
      id: "launch-guidance",
      scope: "launch",
      summary: "The explicit task instruction is the highest-precedence launch guidance.",
      source: "launch_instruction",
      priority: 100,
      instructions: ["Favor the operator's explicit objective when guidance layers conflict."],
      skillIds: [],
    });
  }
  return {
    summary:
      layers.length > 0
        ? `Guidance resolves through ${layers
            .slice()
            .sort((left, right) => right.priority - left.priority)
            .map((layer) => layer.scope)
            .join(" -> ")}.`
        : "No guidance layers were inferred.",
    precedence: layers
      .slice()
      .sort((left, right) => right.priority - left.priority)
      .map((layer) => layer.scope),
    layers,
  };
}

export function buildRuntimeContextTruth(
  input: BuildRuntimeContextTruthInput
): RuntimeContextTruthV2 {
  const source = buildRuntimeContextTruthSource(input.taskSource);
  const reviewIntent = inferRuntimeReviewIntent(input);
  const sourceMetadata = readNonEmptyList([
    input.taskSource?.repo?.fullName ?? null,
    input.taskSource?.reference ?? null,
    input.taskSource?.canonicalUrl ?? null,
  ]);
  return {
    summary:
      source === null
        ? "Runtime will treat this launch as a manual context pack."
        : `Runtime normalized ${source.family} context into the canonical governed run path.`,
    canonicalTaskSource: source,
    sources: source ? [source] : [],
    executionProfileId: readOptionalText(input.repositoryDefaults.executionProfileId),
    reviewProfileId: readOptionalText(input.repositoryDefaults.reviewProfileId),
    validationPresetId: readOptionalText(input.repositoryDefaults.validationPresetId),
    reviewIntent,
    ownerSummary: "Human owner stays accountable; the runtime agent executes the delegated work.",
    sourceMetadata,
    consumers: ["run", "review_pack", "takeover", "follow_up"],
  };
}

export function buildRuntimeDelegationContract(
  input: BuildRuntimeDelegationContractInput
): RuntimeDelegationContractV2 {
  const missingContext = input.missingContext ?? [];
  const hasApprovalPressure = (input.approvalBatchCount ?? 0) > 0;
  const blocked = input.blocked === true;
  const state: RuntimeDelegationContractV2["state"] = blocked
    ? "blocked"
    : missingContext.length > 0
      ? "needs_clarification"
      : input.continuePathLabel === "Review Pack"
        ? "review"
        : input.continuePathLabel === "Mission thread" || input.continuePathLabel === "Mission run"
          ? "resume"
          : "launch_ready";
  const nextOperatorAction =
    readOptionalText(input.nextOperatorAction) ??
    (blocked
      ? "Resolve the blocked runtime condition before delegating further work."
      : missingContext.length > 0
        ? `Clarify missing context: ${missingContext.join(", ")}.`
        : hasApprovalPressure
          ? "Launch the run and expect approval checkpoints on mutation steps."
          : (input.continuationSummary ??
            "Launch the run and review the resulting Review Pack before accepting outcomes."));
  return {
    summary:
      state === "launch_ready"
        ? "Delegate the work, then review a compact evidence artifact instead of supervising the full transcript."
        : "Delegation remains governed: the human owner decides, the agent executes, and the next operator action is explicit.",
    state,
    humanOwner: "Operator",
    agentExecutor: "Runtime agent",
    accountability: input.contextTruth.ownerSummary,
    nextOperatorAction,
    continueVia: readOptionalText(input.continuePathLabel),
  };
}
