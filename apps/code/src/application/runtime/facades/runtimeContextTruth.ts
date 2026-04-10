import type {
  ActiveInvocationCatalogExecutionPlane,
  AgentTaskSourceSummary,
  HugeCodeExecutionProfile,
  RuntimeCapabilityCatalogV2,
  RuntimeCapabilityDescriptorV2,
  RuntimeContextArtifactRefV2,
  RuntimeContextSourceFamilyV2,
  RuntimeContextPlaneV2,
  RuntimeContextTruthSourceV2,
  RuntimeContextTruthV2,
  RuntimeDelegationContractV2,
  RuntimeEvalPlaneV2,
  RuntimeGuidanceLayerV2,
  RuntimeGuidanceStackV2,
  RuntimeReviewIntentV2,
  RuntimeRunPrepareV2Response,
  RuntimeToolingPlaneV2,
  RuntimeTriageSummaryV2,
} from "@ku0/code-runtime-host-contract";
import type { ResolvedRepositoryExecutionDefaults } from "./runtimeRepositoryExecutionContract";

type BuildRuntimeContextTruthInput = {
  taskSource: AgentTaskSourceSummary | null | undefined;
  repositoryDefaults: Pick<
    ResolvedRepositoryExecutionDefaults,
    | "executionProfileId"
    | "reviewProfileId"
    | "validationPresetId"
    | "owner"
    | "triagePriority"
    | "triageRiskLevel"
    | "triageTags"
    | "repoInstructions"
    | "repoSkillIds"
    | "sourceInstructions"
    | "sourceSkillIds"
    | "reviewProfile"
  >;
  contractLabel?: string | null;
  hasRepoInstructions?: boolean;
  explicitInstruction?: string | null;
};

type BuildRuntimeDelegationContractInput = {
  contextTruth: RuntimeContextTruthV2;
  triageSummary?: RuntimeTriageSummaryV2 | null;
  missingContext?: string[] | null;
  approvalBatchCount?: number;
  continuationSummary?: string | null;
  continuePathLabel?: string | null;
  nextOperatorAction?: string | null;
  blocked?: boolean;
};

type BuildRuntimeToolingPlaneInput = {
  selectedExecutionProfile: Pick<
    HugeCodeExecutionProfile,
    | "id"
    | "name"
    | "accessMode"
    | "networkPolicy"
    | "toolPosture"
    | "approvalSensitivity"
    | "validationPresetId"
  >;
  preferredBackendIds?: string[] | null;
  routedProvider?: string | null;
  reviewProfileId?: string | null;
  validationPresetId?: string | null;
};

type BuildRuntimeEvalPlaneInput = Pick<
  BuildRuntimeContextTruthInput,
  "taskSource" | "repositoryDefaults"
> &
  Pick<
    BuildRuntimeToolingPlaneInput,
    "selectedExecutionProfile" | "reviewProfileId" | "validationPresetId"
  >;

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

function buildDedupeKey(taskSource: AgentTaskSourceSummary | null | undefined): string | null {
  if (!taskSource) {
    return null;
  }
  return readNonEmptyList([
    taskSource.kind,
    taskSource.canonicalUrl ?? null,
    taskSource.url ?? null,
    taskSource.reference ?? null,
    taskSource.externalId ?? null,
    taskSource.title ?? null,
  ])
    .join("::")
    .toLowerCase();
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
      instructions: input.repositoryDefaults.repoInstructions.length
        ? input.repositoryDefaults.repoInstructions
        : [
            "Prefer runtime-owned truth over page-local heuristics.",
            "Keep launch, review, and continuation semantics aligned.",
          ],
      skillIds: input.repositoryDefaults.repoSkillIds,
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
  if (input.taskSource || input.repositoryDefaults.sourceInstructions.length > 0) {
    layers.push({
      id: "source-guidance",
      scope: "source",
      summary: input.taskSource
        ? `Source kind ${input.taskSource.kind} enters the same governed run path as manual work.`
        : "Source-linked launch guidance refines repo defaults for this intake path.",
      source: input.taskSource?.kind ?? "source_mapping",
      priority: 40,
      instructions: input.repositoryDefaults.sourceInstructions.length
        ? input.repositoryDefaults.sourceInstructions
        : ["Normalize source-linked work into canonical task/run/review semantics."],
      skillIds: input.repositoryDefaults.sourceSkillIds,
    });
  }
  if (input.repositoryDefaults.reviewProfile) {
    layers.push({
      id: "review-profile-skills",
      scope: "review_profile",
      summary: `Review profile ${input.repositoryDefaults.reviewProfile.label} contributes reusable review skills.`,
      source: input.repositoryDefaults.reviewProfile.id,
      priority: 60,
      instructions: [],
      skillIds: input.repositoryDefaults.reviewProfile.allowedSkillIds,
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

export function buildRuntimeTriageSummary(
  input: BuildRuntimeContextTruthInput
): RuntimeRunPrepareV2Response["triageSummary"] {
  const owner = readOptionalText(input.repositoryDefaults.owner);
  const priority = input.repositoryDefaults.triagePriority ?? null;
  const riskLevel = input.repositoryDefaults.triageRiskLevel ?? null;
  const tags = readNonEmptyList(input.repositoryDefaults.triageTags);
  const dedupeKey = buildDedupeKey(input.taskSource);
  const summary = [
    owner ? `Owner ${owner}` : "Owner unassigned",
    priority ? `Priority ${priority}` : null,
    riskLevel ? `Risk ${riskLevel}` : null,
    tags.length > 0 ? `Tags ${tags.join(", ")}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
  return {
    owner,
    priority,
    riskLevel,
    tags,
    dedupeKey,
    summary,
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
    input.repositoryDefaults.owner ?? null,
    input.repositoryDefaults.triagePriority ?? null,
    input.repositoryDefaults.triageRiskLevel ?? null,
    ...input.repositoryDefaults.triageTags,
  ]);
  const ownerSummary = readOptionalText(input.repositoryDefaults.owner) ?? "Human owner";
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
    ownerSummary: `${ownerSummary} stays accountable; the runtime agent executes the delegated work.`,
    sourceMetadata,
    consumers: ["run", "review_pack", "takeover", "follow_up"],
  };
}

export function buildRuntimeContextPlane(
  input: BuildRuntimeContextTruthInput
): RuntimeContextPlaneV2 {
  const source = buildRuntimeContextTruthSource(input.taskSource);
  const repoInstructionCount = input.repositoryDefaults.repoInstructions.length;
  const memoryRefs: RuntimeContextPlaneV2["memoryRefs"] = [];
  const artifactRefs: RuntimeContextArtifactRefV2[] = [];

  if (input.hasRepoInstructions || repoInstructionCount > 0) {
    memoryRefs.push({
      id: "repo-guidance",
      label: "Repo guidance memory",
      kind: "repo_instruction_surface",
      summary:
        repoInstructionCount > 0
          ? `Keep ${repoInstructionCount} repo instruction entries available outside the live window.`
          : "Keep repository guidance surfaces available outside the live window.",
      storage: "workspace_manifest",
      persistenceScope: "workspace",
      sourceRef: readOptionalText(input.contractLabel) ?? "AGENTS.md",
    });
  }

  if (source) {
    memoryRefs.push({
      id: "task-source-digest",
      label: source.label,
      kind: "task_source_digest",
      summary: "Persist the normalized task source digest across launch, review, and follow-up.",
      storage: source.canonicalUrl ? "external_reference" : "runtime_memory",
      persistenceScope: "run",
      sourceRef: source.canonicalUrl ?? source.reference,
    });
    artifactRefs.push({
      id: "task-source-snapshot",
      label: `${source.label} snapshot`,
      kind: "task_source_snapshot",
      summary: "Reference the source snapshot without replaying the full launch transcript.",
      mimeType: "application/json",
      locator: source.canonicalUrl,
      sourceRef: source.reference ?? source.kind,
    });
  }

  const reviewProfileId = readOptionalText(input.repositoryDefaults.reviewProfileId);
  if (reviewProfileId) {
    memoryRefs.push({
      id: "review-guidance",
      label: `Review profile ${reviewProfileId}`,
      kind: "review_guidance",
      summary: "Preserve review guidance separately from the live prompt window.",
      storage: "workspace_manifest",
      persistenceScope: "workspace",
      sourceRef: reviewProfileId,
    });
  }

  const validationPresetId = readOptionalText(input.repositoryDefaults.validationPresetId);
  if (validationPresetId) {
    artifactRefs.push({
      id: `validation-plan:${validationPresetId}`,
      label: `Validation preset ${validationPresetId}`,
      kind: "validation_plan",
      summary: "Carry validation defaults as a reusable artifact for launch and continuation.",
      mimeType: "application/json",
      sourceRef: validationPresetId,
    });
  }

  return {
    summary:
      source === null
        ? "Manual launch context stays compact by separating workspace memory from replayable artifacts."
        : `Runtime can preserve ${source.family} context through stable memory and artifact references.`,
    memoryRefs,
    artifactRefs,
    compactionSummary: {
      triggered: false,
      executed: false,
      source: "runtime_prepare_v2",
    },
    workingSetPolicy: {
      selectionStrategy: "balanced",
      toolExposureProfile: "slim",
      tokenBudgetTarget: 1500,
      refreshMode: "on_prepare",
      retentionMode: memoryRefs.length > 0 ? "window_and_memory" : "window_only",
      preferColdFetch: true,
      compactBeforeDelegation: true,
    },
  };
}

function buildRuntimeCapabilityCatalog(
  input: BuildRuntimeToolingPlaneInput
): RuntimeCapabilityCatalogV2 {
  const capabilities: RuntimeCapabilityDescriptorV2[] = [
    {
      id: "workspace.read",
      label: "Workspace read",
      summary: "Read repository files and runtime evidence inside the selected workspace.",
      kind: "workspace_read",
      readiness: "ready",
      safetyLevel: "read",
      source: input.selectedExecutionProfile.id,
    },
  ];

  if (input.selectedExecutionProfile.accessMode !== "read-only") {
    capabilities.push({
      id: "workspace.write",
      label: "Workspace write",
      summary:
        input.selectedExecutionProfile.accessMode === "on-request"
          ? "Mutation is available behind operator approval."
          : "Mutation is available directly in the selected sandbox.",
      kind: "workspace_write",
      readiness: input.selectedExecutionProfile.accessMode === "on-request" ? "attention" : "ready",
      safetyLevel: "write",
      source: input.selectedExecutionProfile.id,
    });
  }

  capabilities.push({
    id: "network.fetch",
    label: "Network fetch",
    summary:
      input.selectedExecutionProfile.networkPolicy === "offline"
        ? "Network access is blocked by the execution profile."
        : input.selectedExecutionProfile.networkPolicy === "restricted"
          ? "Network access is available with runtime restrictions."
          : "Network access follows the default execution profile policy.",
    kind: "network_fetch",
    readiness:
      input.selectedExecutionProfile.networkPolicy === "offline"
        ? "blocked"
        : input.selectedExecutionProfile.networkPolicy === "restricted"
          ? "attention"
          : "ready",
    safetyLevel: "read",
    source: input.selectedExecutionProfile.id,
  });

  const validationPresetId =
    readOptionalText(input.validationPresetId) ??
    readOptionalText(input.selectedExecutionProfile.validationPresetId);
  if (validationPresetId) {
    capabilities.push({
      id: `validation:${validationPresetId}`,
      label: "Validation plan",
      summary: `Validation preset ${validationPresetId} is attached to the governed run.`,
      kind: "validation",
      readiness: "ready",
      safetyLevel: "read",
      source: validationPresetId,
    });
  }

  const reviewProfileId = readOptionalText(input.reviewProfileId);
  if (reviewProfileId) {
    capabilities.push({
      id: `review:${reviewProfileId}`,
      label: "Review skill lane",
      summary: `Review profile ${reviewProfileId} remains available as a bounded review capability.`,
      kind: "review_skill",
      readiness: "ready",
      safetyLevel: "read",
      source: reviewProfileId,
    });
  }

  return {
    summary: `Execution profile ${input.selectedExecutionProfile.id} exposes ${capabilities.length} governed launch capabilities.`,
    catalogId: `launch:${input.selectedExecutionProfile.id}`,
    generatedAt: null,
    capabilities,
  };
}

function buildRuntimeToolingInvocationCatalogRef(input: {
  executionProfileId: string;
}): NonNullable<RuntimeToolingPlaneV2["invocationCatalogRef"]> {
  const execution: ActiveInvocationCatalogExecutionPlane = {
    bindings: [
      {
        bindingKind: "runtime_run",
        host: "runtime",
        count: 1,
        readyCount: 1,
        blockedCount: 0,
        notRequiredCount: 0,
        requirementKeys: ["runtime_service"],
      },
    ],
    requirements: [{ key: "runtime_service", count: 1 }],
  };

  return {
    catalogId: `launch:${input.executionProfileId}`,
    summary:
      "Launch-scoped invocation catalog publishes the canonical runtime run dispatch path and its host requirements before execution begins.",
    generatedAt: null,
    execution,
    provenance: ["runtime_prepare", "execution_profile"],
  };
}

export function buildRuntimeToolingPlane(
  input: BuildRuntimeToolingPlaneInput
): RuntimeToolingPlaneV2 {
  const preferredBackendIds = readNonEmptyList(input.preferredBackendIds ?? []);
  const routedProvider = readOptionalText(input.routedProvider);
  const capabilityCatalog = buildRuntimeCapabilityCatalog(input);
  const invocationCatalogRef = buildRuntimeToolingInvocationCatalogRef({
    executionProfileId: input.selectedExecutionProfile.id,
  });
  return {
    summary:
      "Launch inherits a stable capability catalog and sandbox contract; runtime can later refine it with live invocation truth without changing the interface.",
    capabilityCatalog,
    invocationCatalogRef,
    sandboxRef: {
      id: `sandbox:${input.selectedExecutionProfile.id}`,
      label: `${input.selectedExecutionProfile.name} sandbox`,
      summary:
        routedProvider === null
          ? "Runtime will resolve provider placement using the selected execution profile and backend preferences."
          : `Runtime will route this launch through provider ${routedProvider}.`,
      accessMode: input.selectedExecutionProfile.accessMode,
      executionProfileId: input.selectedExecutionProfile.id,
      preferredBackendIds,
      routedProvider,
      networkPolicy: input.selectedExecutionProfile.networkPolicy,
      filesystemPolicy:
        input.selectedExecutionProfile.accessMode === "read-only"
          ? "read_only"
          : "workspace_scoped",
      toolPosture: input.selectedExecutionProfile.toolPosture,
      approvalSensitivity: input.selectedExecutionProfile.approvalSensitivity,
    },
    mcpSources: [],
    toolCallRefs: [],
    toolResultRefs: [],
  };
}

export function buildRuntimeEvalPlane(input: BuildRuntimeEvalPlaneInput): RuntimeEvalPlaneV2 {
  const taskFamily = input.taskSource?.kind ?? "manual";
  const executionProfileName = readOptionalText(input.selectedExecutionProfile.name) ?? "Runtime";
  const validationPresetId =
    readOptionalText(input.validationPresetId) ??
    readOptionalText(input.selectedExecutionProfile.validationPresetId);
  const reviewProfileId = readOptionalText(input.reviewProfileId);
  const evalCases: RuntimeEvalPlaneV2["evalCases"] = [
    {
      id: `launch:${input.selectedExecutionProfile.id}`,
      label: `${executionProfileName} launch baseline`,
      taskFamily,
      summary: "Keep governed launch preparation stable across model upgrades and route changes.",
      successEnvelope:
        "Prepare should keep task/run/review semantics stable while preserving validation and routing visibility.",
      modelBaseline: `${executionProfileName} execution profile`,
      regressionBudget:
        "No regression in launch plan shape, validation attachment, or backend inspectability.",
      source: "runtime_prepare",
      trackedWorkarounds: [],
    },
  ];

  if (validationPresetId) {
    evalCases.push({
      id: `validation:${validationPresetId}`,
      label: `Validation preset ${validationPresetId}`,
      taskFamily: "validation",
      summary: "Validation defaults stay attached as durable governed evidence.",
      successEnvelope:
        "Validation commands, preset identity, and review handoff remain reusable across model releases.",
      modelBaseline: validationPresetId,
      regressionBudget: "No regression in validation-plan publication or attachment semantics.",
      source: "repository_contract",
      trackedWorkarounds: [],
    });
  }

  if (reviewProfileId) {
    evalCases.push({
      id: `review:${reviewProfileId}`,
      label: `Review profile ${reviewProfileId}`,
      taskFamily: "review",
      summary:
        "Review evidence should remain compact and artifact-backed rather than transcript-bound.",
      successEnvelope:
        "Review Pack inputs, review focus, and continuation handoff stay stable when models improve.",
      modelBaseline: reviewProfileId,
      regressionBudget:
        "No regression in review artifact publication or review-actionability hints.",
      source: "repository_contract",
      trackedWorkarounds: [],
    });
  }

  return {
    summary:
      "Runtime publishes upgrade-stable eval cases so model improvements delete workarounds instead of redefining product contracts.",
    evalCases,
    modelReleasePlaybook: [
      "Re-run governed eval cases before adopting a new default model or route.",
      "Delete model-specific prompt or orchestration workarounds that the new baseline makes unnecessary.",
      "Only widen product behavior after the eval plane shows stable launch, validation, and review evidence.",
    ],
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
    humanOwner: readOptionalText(input.triageSummary?.owner) ?? "Operator",
    agentExecutor: "Runtime agent",
    accountability: input.contextTruth.ownerSummary,
    nextOperatorAction,
    continueVia: readOptionalText(input.continuePathLabel),
  };
}
