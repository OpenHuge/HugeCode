import {
  type CanonicalModelPool,
  type CanonicalModelProvider,
  CODE_RUNTIME_RPC_ERROR_CODES,
  type CodeRuntimeRpcMethod,
  CODE_RUNTIME_RPC_METHOD_LIST,
  CODE_RUNTIME_RPC_METHODS,
  type ModelPool,
  type ModelProvider,
  type OAuthProviderId,
} from "./codeRuntimeRpc.js";

export const CODE_RUNTIME_RPC_METHOD_LEGACY_ALIASES = Object.freeze({
  ...CODE_RUNTIME_RPC_METHOD_LIST.reduce(
    (accumulator, method) => {
      accumulator[method] = [];
      return accumulator;
    },
    {} as Record<CodeRuntimeRpcMethod, readonly string[]>
  ),
  [CODE_RUNTIME_RPC_METHODS.OAUTH_PRIMARY_ACCOUNT_GET]: ["oauth_primary_account_get"],
  [CODE_RUNTIME_RPC_METHODS.OAUTH_PRIMARY_ACCOUNT_SET]: ["oauth_primary_account_set"],
});

const CODE_RUNTIME_RPC_METHOD_SET: ReadonlySet<string> = new Set(CODE_RUNTIME_RPC_METHOD_LIST);

const CODE_RUNTIME_RPC_ALIAS_TO_METHOD: Readonly<Record<string, CodeRuntimeRpcMethod>> =
  Object.freeze(
    Object.entries(CODE_RUNTIME_RPC_METHOD_LEGACY_ALIASES).reduce(
      (accumulator, [canonicalMethod, aliases]) => {
        for (const alias of aliases) {
          accumulator[alias] = canonicalMethod as CodeRuntimeRpcMethod;
        }
        return accumulator;
      },
      {} as Record<string, CodeRuntimeRpcMethod>
    )
  );

export function resolveCodeRuntimeRpcMethod(method: string): CodeRuntimeRpcMethod | null {
  if (CODE_RUNTIME_RPC_METHOD_SET.has(method)) {
    return method as CodeRuntimeRpcMethod;
  }
  return CODE_RUNTIME_RPC_ALIAS_TO_METHOD[method] ?? null;
}

export function listCodeRuntimeRpcMethodCandidates(
  method: CodeRuntimeRpcMethod
): readonly string[] {
  const aliases = CODE_RUNTIME_RPC_METHOD_LEGACY_ALIASES[method] ?? [];
  return [method, ...aliases];
}

export function listCodeRuntimeRpcAllMethods(): readonly string[] {
  const methods = new Set<string>();
  for (const method of CODE_RUNTIME_RPC_METHOD_LIST) {
    methods.add(method);
    for (const alias of CODE_RUNTIME_RPC_METHOD_LEGACY_ALIASES[method] ?? []) {
      methods.add(alias);
    }
  }
  return [...methods].sort((left, right) => left.localeCompare(right));
}

export type CodeRuntimeRpcCompatLifecycle = "stillNeeded" | "softDeprecated" | "removableNow";

function defineCodeRuntimeRpcCompatFieldRegistry<
  const StillNeeded extends Record<string, string>,
  const SoftDeprecated extends Record<string, string>,
  const RemovableNow extends Record<string, string>,
>(groups: {
  stillNeeded: StillNeeded;
  softDeprecated: SoftDeprecated;
  removableNow: RemovableNow;
}) {
  const registry = Object.freeze({
    ...Object.fromEntries(
      Object.entries(groups.stillNeeded).map(([field, alias]) => [
        field,
        { alias, lifecycle: "stillNeeded" as const },
      ])
    ),
    ...Object.fromEntries(
      Object.entries(groups.softDeprecated).map(([field, alias]) => [
        field,
        { alias, lifecycle: "softDeprecated" as const },
      ])
    ),
    ...Object.fromEntries(
      Object.entries(groups.removableNow).map(([field, alias]) => [
        field,
        { alias, lifecycle: "removableNow" as const },
      ])
    ),
  });

  return {
    groups: Object.freeze(groups),
    registry: registry as {
      readonly [Field in keyof StillNeeded]: {
        readonly alias: StillNeeded[Field];
        readonly lifecycle: "stillNeeded";
      };
    } & {
      readonly [Field in keyof SoftDeprecated]: {
        readonly alias: SoftDeprecated[Field];
        readonly lifecycle: "softDeprecated";
      };
    } & {
      readonly [Field in keyof RemovableNow]: {
        readonly alias: RemovableNow[Field];
        readonly lifecycle: "removableNow";
      };
    },
  };
}

const CODE_RUNTIME_RPC_COMPAT_FIELD_REGISTRY_DEFINITION = defineCodeRuntimeRpcCompatFieldRegistry({
  stillNeeded: {
    accountId: "account_id",
    poolId: "pool_id",
    previousAccountId: "previous_account_id",
    chatgptWorkspaceId: "chatgpt_workspace_id",
    workspaceId: "workspace_id",
    forceOAuth: "force_oauth",
    sessionId: "session_id",
    requestId: "request_id",
    turnId: "turn_id",
    threadId: "thread_id",
    subscriptionId: "subscription_id",
    modelId: "model_id",
    reasonEffort: "reason_effort",
    serviceTier: "service_tier",
    missionMode: "mission_mode",
    executionProfileId: "execution_profile_id",
    reviewProfileId: "review_profile_id",
    validationPresetId: "validation_preset_id",
    defaultBackendId: "default_backend_id",
    accessMode: "access_mode",
    displayName: "display_name",
    dryRun: "dry_run",
    fileId: "file_id",
    changeId: "change_id",
    branchName: "branch_name",
    promptId: "prompt_id",
    targetScope: "target_scope",
    skillId: "skill_id",
    taskId: "task_id",
    backendId: "backend_id",
    backendOperability: "backend_operability",
    integrationId: "integration_id",
    extensionId: "extension_id",
    resourceId: "resource_id",
    approvalId: "approval_id",
    executionMode: "execution_mode",
    requiredCapabilities: "required_capabilities",
    maxSubtasks: "max_subtasks",
    preferredBackendIds: "preferred_backend_ids",
    evaluationPlan: "evaluation_plan",
    representativeCommands: "representative_commands",
    componentCommands: "component_commands",
    endToEndCommands: "end_to_end_commands",
    samplePaths: "sample_paths",
    heldOutGuidance: "held_out_guidance",
    sourceSignals: "source_signals",
    planVersion: "plan_version",
    planSummary: "plan_summary",
    currentMilestoneId: "current_milestone_id",
    estimatedDurationMinutes: "estimated_duration_minutes",
    estimatedWorkerRuns: "estimated_worker_runs",
    parallelismHint: "parallelism_hint",
    clarificationQuestions: "clarification_questions",
    milestones: "milestones",
    validationLanes: "validation_lanes",
    skillPlan: "skill_plan",
    validationLaneIds: "validation_lane_ids",
    acceptanceCriteria: "acceptance_criteria",
    sourcePlanVersion: "source_plan_version",
    sourceRecordId: "source_record_id",
    planChangeSummary: "plan_change_summary",
    approvedPlanVersion: "approved_plan_version",
    preparedPlanVersion: "prepared_plan_version",
    plan: "plan",
    placementFallbackReasonCode: "placement_fallback_reason_code",
    resumeBackendId: "resume_backend_id",
    placementScoreBreakdown: "placement_score_breakdown",
    taskSource: "task_source",
    githubSource: "github_source",
    launchHandshake: "launch_handshake",
    instructionPatch: "instruction_patch",
    missionBrief: "mission_brief",
    relaunchContext: "relaunch_context",
    autoDrive: "auto_drive",
    autonomyRequest: "autonomy_request",
    autonomyProfile: "autonomy_profile",
    wakePolicy: "wake_policy",
    sourceScope: "source_scope",
    researchPolicy: "research_policy",
    queueBudget: "queue_budget",
    maxQueuedActions: "max_queued_actions",
    maxRuntimeMinutes: "max_runtime_minutes",
    maxAutoContinuations: "max_auto_continuations",
    safeFollowUp: "safe_follow_up",
    allowAutomaticContinuation: "allow_automatic_continuation",
    allowedActions: "allowed_actions",
    stopGates: "stop_gates",
    allowNetworkAnalysis: "allow_network_analysis",
    requireCitations: "require_citations",
    allowPrivateContextStage: "allow_private_context_stage",
    intentSnapshot: "intent_snapshot",
    primaryGoal: "primary_goal",
    dominantDirection: "dominant_direction",
    opportunityQueue: "opportunity_queue",
    selectedOpportunityId: "selected_opportunity_id",
    selectionSummary: "selection_summary",
    whySelected: "why_selected",
    whyNow: "why_now",
    nextWakeAction: "next_wake_action",
    researchTrace: "research_trace",
    sourceCitations: "source_citations",
    sourceKind: "source_kind",
    trustLevel: "trust_level",
    claimSummary: "claim_summary",
    sensitiveContextMixed: "sensitive_context_mixed",
    executionEligibility: "execution_eligibility",
    wakeState: "wake_state",
    nextEligibleAction: "next_eligible_action",
    blockingReasons: "blocking_reasons",
    wakeReason: "wake_reason",
    queuePosition: "queue_position",
    wakePolicySummary: "wake_policy_summary",
    contextPolicy: "context_policy",
    decisionPolicy: "decision_policy",
    scenarioProfile: "scenario_profile",
    decisionTrace: "decision_trace",
    outcomeFeedback: "outcome_feedback",
    autonomyState: "autonomy_state",
    autonomyPriority: "autonomy_priority",
    promptStrategy: "prompt_strategy",
    researchMode: "research_mode",
    independentThread: "independent_thread",
    authoritySources: "authority_sources",
    authorityScope: "authority_scope",
    scenarioKeys: "scenario_keys",
    safeBackground: "safe_background",
    selectionTags: "selection_tags",
    selectedCandidateId: "selected_candidate_id",
    selectedCandidateSummary: "selected_candidate_summary",
    scoreBreakdown: "score_breakdown",
    reasonCode: "reason_code",
    failureClass: "failure_class",
    validationCommands: "validation_commands",
    humanInterventionRequired: "human_intervention_required",
    heldOutPreserved: "held_out_preserved",
    highPriority: "high_priority",
    escalationPressure: "escalation_pressure",
    unattendedContinuationAllowed: "unattended_continuation_allowed",
    backgroundSafe: "background_safe",
    humanInterventionHotspots: "human_intervention_hotspots",
    representativeCommand: "representative_command",
    maxConcurrency: "max_concurrency",
    scopeProfile: "scope_profile",
    allowedSkillIds: "allowed_skill_ids",
    allowNetwork: "allow_network",
    workspaceReadPaths: "workspace_read_paths",
    parentRunId: "parent_run_id",
    maxSubQueries: "max_sub_queries",
    costTier: "cost_tier",
    latencyClass: "latency_class",
    maxParallel: "max_parallel",
    preferDomains: "prefer_domains",
    recencyDays: "recency_days",
    fetchPageContent: "fetch_page_content",
    workspaceContextPaths: "workspace_context_paths",
    rolloutState: "rollout_state",
    trustTier: "trust_tier",
    dataSensitivity: "data_sensitivity",
    transportConfig: "transport_config",
    allowedToolClasses: "allowed_tool_classes",
    rootTaskId: "root_task_id",
    parentTaskId: "parent_task_id",
    childTaskIds: "child_task_ids",
    reviewGate: "review_gate",
    reviewFindings: "review_findings",
    reviewRunId: "review_run_id",
    skillUsage: "skill_usage",
    autofixCandidate: "autofix_candidate",
    executionGraph: "execution_graph",
    distributedStatus: "distributed_status",
    fromTaskId: "from_task_id",
    toTaskId: "to_task_id",
    requiresApproval: "requires_approval",
    approvalReason: "approval_reason",
    timeoutMs: "timeout_ms",
    pollIntervalMs: "poll_interval_ms",
    maxBytes: "max_bytes",
    maxItems: "max_items",
    usageRefresh: "usage_refresh",
    redactionLevel: "redaction_level",
    includeTaskSummaries: "include_task_summaries",
    includeEventTail: "include_event_tail",
    includeProviderDetails: "include_provider_details",
    includeAgentTasks: "include_agent_tasks",
    includeZipBase64: "include_zip_base64",
    codexBin: "codex_bin",
    codexArgs: "codex_args",
    outputSchema: "output_schema",
    approvalPolicy: "approval_policy",
    sandboxMode: "sandbox_mode",
    forceRefetch: "force_refetch",
    checkPackageAdvisory: "check_package_advisory",
    checkExecPolicy: "check_exec_policy",
    execPolicyRules: "exec_policy_rules",
    includeScreenshot: "include_screenshot",
    toolName: "tool_name",
    expectedUpdatedAt: "expected_updated_at",
    contextPrefix: "context_prefix",
  },
  softDeprecated: {},
  removableNow: {
    missionLinkage: "mission_linkage",
    reviewActionability: "review_actionability",
    sessionBoundary: "session_boundary",
    continuation: "continuation",
    nextOperatorAction: "next_operator_action",
    takeoverBundle: "takeover_bundle",
    runSummary: "run_summary",
    reviewPackSummary: "review_pack_summary",
  },
} as const);

export const CODE_RUNTIME_RPC_COMPAT_FIELD_REGISTRY =
  CODE_RUNTIME_RPC_COMPAT_FIELD_REGISTRY_DEFINITION.registry;

export const CODE_RUNTIME_RPC_COMPAT_FIELD_LIFECYCLE = Object.freeze({
  stillNeeded: Object.freeze(
    Object.keys(CODE_RUNTIME_RPC_COMPAT_FIELD_REGISTRY_DEFINITION.groups.stillNeeded)
  ),
  softDeprecated: Object.freeze(
    Object.keys(CODE_RUNTIME_RPC_COMPAT_FIELD_REGISTRY_DEFINITION.groups.softDeprecated)
  ),
  removableNow: Object.freeze(
    Object.keys(CODE_RUNTIME_RPC_COMPAT_FIELD_REGISTRY_DEFINITION.groups.removableNow)
  ),
}) as {
  readonly stillNeeded: ReadonlyArray<keyof typeof CODE_RUNTIME_RPC_COMPAT_FIELD_REGISTRY>;
  readonly softDeprecated: ReadonlyArray<keyof typeof CODE_RUNTIME_RPC_COMPAT_FIELD_REGISTRY>;
  readonly removableNow: ReadonlyArray<keyof typeof CODE_RUNTIME_RPC_COMPAT_FIELD_REGISTRY>;
};

export const CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES = Object.freeze(
  Object.fromEntries(
    Object.entries(CODE_RUNTIME_RPC_COMPAT_FIELD_REGISTRY).map(([field, descriptor]) => [
      field,
      descriptor.alias,
    ])
  )
) as {
  readonly [Field in keyof typeof CODE_RUNTIME_RPC_COMPAT_FIELD_REGISTRY]: (typeof CODE_RUNTIME_RPC_COMPAT_FIELD_REGISTRY)[Field]["alias"];
};

export type CodeRuntimeRpcCompatField = keyof typeof CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES;

type CodeRuntimeRpcCompatValues = Partial<Record<CodeRuntimeRpcCompatField, unknown>>;

export type CodeRuntimeRpcCompatAliasFields<Fields extends CodeRuntimeRpcCompatValues> = {
  [Field in keyof Fields as Field extends CodeRuntimeRpcCompatField
    ? (typeof CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES)[Field]
    : never]: Fields[Field];
};

type RuntimeProviderAliasSpec = {
  providerId: CanonicalModelProvider;
  pool: CanonicalModelPool | null;
  oauthProviderId: OAuthProviderId | null;
  aliases: readonly string[];
};

export const CODE_RUNTIME_PROVIDER_ALIAS_REGISTRY = Object.freeze([
  {
    providerId: "openai",
    pool: "codex",
    oauthProviderId: "codex",
    aliases: ["openai", "codex", "openai-codex"],
  },
  {
    providerId: "anthropic",
    pool: "claude",
    oauthProviderId: "claude_code",
    aliases: ["anthropic", "claude", "claude_code", "claude-code"],
  },
  {
    providerId: "claude_code_local",
    pool: null,
    oauthProviderId: null,
    aliases: ["claude_code_local"],
  },
  {
    providerId: "google",
    pool: "gemini",
    oauthProviderId: "gemini",
    aliases: ["google", "gemini", "antigravity", "anti-gravity", "gemini-antigravity"],
  },
  {
    providerId: "local",
    pool: null,
    oauthProviderId: null,
    aliases: ["local"],
  },
  {
    providerId: "unknown",
    pool: null,
    oauthProviderId: null,
    aliases: ["unknown"],
  },
] satisfies readonly RuntimeProviderAliasSpec[]);

function normalizeAlias(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function resolveProviderAliasSpec(
  value: string | null | undefined
): RuntimeProviderAliasSpec | null {
  const normalized = normalizeAlias(value);
  if (!normalized) {
    return null;
  }
  return (
    CODE_RUNTIME_PROVIDER_ALIAS_REGISTRY.find((entry) => entry.aliases.includes(normalized)) ?? null
  );
}

export function canonicalizeOAuthProviderId(
  provider: string | null | undefined
): OAuthProviderId | null {
  return resolveProviderAliasSpec(provider)?.oauthProviderId ?? null;
}

export function canonicalizeModelProvider(
  provider: ModelProvider | string | null | undefined
): CanonicalModelProvider | null {
  return resolveProviderAliasSpec(provider)?.providerId ?? null;
}

export function canonicalizeModelPool(
  pool: ModelPool | string | null | undefined
): CanonicalModelPool | null {
  const normalized = normalizeAlias(pool);
  if (!normalized) {
    return null;
  }
  if (normalized === "auto") {
    return "auto";
  }
  return resolveProviderAliasSpec(pool)?.pool ?? null;
}

export function buildCodeRuntimeRpcCompatFields<Fields extends CodeRuntimeRpcCompatValues>(
  values: Fields
): CodeRuntimeRpcCompatAliasFields<Fields> {
  return cloneWithCodeRuntimeRpcCompatAliases(values) as CodeRuntimeRpcCompatAliasFields<Fields>;
}

function isCompatAliasRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneCompatAliasValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneCompatAliasValue(entry)) as T;
  }
  if (!isCompatAliasRecord(value)) {
    return value;
  }

  const cloned: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    cloned[key] = cloneCompatAliasValue(nestedValue);
  }

  for (const [canonicalField, snakeCaseField] of Object.entries(
    CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES
  )) {
    const hasCanonicalField = Object.hasOwn(cloned, canonicalField);
    const hasAliasField = Object.hasOwn(cloned, snakeCaseField);
    if (!hasCanonicalField && !hasAliasField) {
      continue;
    }

    const nextValue = hasCanonicalField ? cloned[canonicalField] : cloned[snakeCaseField];
    if (!hasCanonicalField) {
      cloned[canonicalField] = nextValue;
    }
    if (!hasAliasField) {
      cloned[snakeCaseField] = nextValue;
    }
  }

  return cloned as T;
}

export function cloneWithCodeRuntimeRpcCompatAliases<Payload>(payload: Payload): Payload {
  return cloneCompatAliasValue(payload);
}

const METHOD_NOT_FOUND_ERROR_CODES: ReadonlySet<string> = new Set([
  CODE_RUNTIME_RPC_ERROR_CODES.METHOD_NOT_FOUND,
  "METHOD_NOT_FOUND_ERROR",
  "METHOD-NOT-FOUND",
  "method_not_found",
  "method-not-found",
]);

const METHOD_NOT_FOUND_MESSAGE_PATTERNS = [
  /^unsupported rpc method:/i,
  /\bmethod not found\b/i,
  /\bunknown method\b/i,
  /\bunknown command\b/i,
  /\bcommand .* not found\b/i,
  /\binvalid args .* command .* not found\b/i,
];

export function isCodeRuntimeRpcMethodNotFoundErrorCode(code: unknown): boolean {
  if (typeof code !== "string") {
    return false;
  }
  return METHOD_NOT_FOUND_ERROR_CODES.has(code.trim());
}

export function inferCodeRuntimeRpcMethodNotFoundCodeFromMessage(
  message: unknown
): typeof CODE_RUNTIME_RPC_ERROR_CODES.METHOD_NOT_FOUND | null {
  if (typeof message !== "string") {
    return null;
  }
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!METHOD_NOT_FOUND_MESSAGE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return null;
  }
  return CODE_RUNTIME_RPC_ERROR_CODES.METHOD_NOT_FOUND;
}
