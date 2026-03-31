import { describe, expect, expectTypeOf, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  buildCodeRuntimeRpcSpec,
  CODE_RUNTIME_RPC_CONTRACT_VERSION,
  CODE_RUNTIME_RPC_ERROR_CODES,
  CODE_RUNTIME_RPC_EXECUTION_GRAPH_FIELDS,
  CODE_RUNTIME_RPC_FEATURES,
  CODE_RUNTIME_RPC_METHOD_LIST,
  CODE_RUNTIME_RPC_METHODS,
  CODE_RUNTIME_RPC_TRANSPORTS,
  computeCodeRuntimeRpcMethodSetHash,
} from "./codeRuntimeRpc";
import {
  buildCodeRuntimeRpcCompatFields,
  cloneWithCodeRuntimeRpcCompatAliases,
  CODE_RUNTIME_PROVIDER_ALIAS_REGISTRY,
  CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES,
  CODE_RUNTIME_RPC_COMPAT_FIELD_LIFECYCLE,
  CODE_RUNTIME_RPC_METHOD_LEGACY_ALIASES,
  canonicalizeModelPool,
  canonicalizeModelProvider,
  canonicalizeOAuthProviderId,
  inferCodeRuntimeRpcMethodNotFoundCodeFromMessage,
  isCodeRuntimeRpcMethodNotFoundErrorCode,
  listCodeRuntimeRpcMethodCandidates,
} from "./codeRuntimeRpcCompat";
import type {
  AgentTaskInterventionAck,
  AgentTaskInterventionRequest,
  AgentTaskStartRequest,
  AgentTaskSummary,
  AgentTaskStepSummary,
  CodeRuntimeRpcRequestPayloadByMethod,
  KernelContextSlice,
  KernelJob,
  KernelProjectionBootstrapResponse,
  KernelProjectionDelta,
  KernelPolicyDecision,
  LiveSkillExecutionResult,
  RuntimeExecutionGraphSummary,
  SubAgentSpawnRequest,
} from "./codeRuntimeRpc";

type AssertFalse<T extends false> = T;
type HotTurnSendPayload =
  CodeRuntimeRpcRequestPayloadByMethod[typeof CODE_RUNTIME_RPC_METHODS.TURN_SEND]["payload"];
type HotRunPreparePayload =
  CodeRuntimeRpcRequestPayloadByMethod[typeof CODE_RUNTIME_RPC_METHODS.RUN_PREPARE_V2];
type HotRunIntervenePayload =
  CodeRuntimeRpcRequestPayloadByMethod[typeof CODE_RUNTIME_RPC_METHODS.RUN_INTERVENE_V2];
type HotKernelContextPayload =
  CodeRuntimeRpcRequestPayloadByMethod[typeof CODE_RUNTIME_RPC_METHODS.KERNEL_CONTEXT_SNAPSHOT_V2];
type HotKernelPoliciesPayload =
  CodeRuntimeRpcRequestPayloadByMethod[typeof CODE_RUNTIME_RPC_METHODS.KERNEL_POLICIES_EVALUATE_V2];

const HOT_TURN_SEND_WORKSPACE_IS_CANONICAL: AssertFalse<
  "workspace_id" extends keyof HotTurnSendPayload ? true : false
> = false;
const HOT_TURN_SEND_CONTEXT_IS_CANONICAL: AssertFalse<
  "context_prefix" extends keyof HotTurnSendPayload ? true : false
> = false;
const HOT_RUN_PREPARE_WORKSPACE_IS_CANONICAL: AssertFalse<
  "workspace_id" extends keyof HotRunPreparePayload ? true : false
> = false;
const HOT_RUN_PREPARE_STEP_TIMEOUT_IS_CANONICAL: AssertFalse<
  "timeout_ms" extends keyof HotRunPreparePayload["steps"][number] ? true : false
> = false;
const HOT_RUN_INTERVENE_PATCH_IS_CANONICAL: AssertFalse<
  "instruction_patch" extends keyof HotRunIntervenePayload ? true : false
> = false;
const HOT_KERNEL_CONTEXT_WORKSPACE_IS_CANONICAL: AssertFalse<
  "workspace_id" extends keyof HotKernelContextPayload ? true : false
> = false;
const HOT_KERNEL_POLICIES_WORKSPACE_IS_CANONICAL: AssertFalse<
  "workspace_id" extends keyof HotKernelPoliciesPayload ? true : false
> = false;
const HOT_KERNEL_POLICIES_PAYLOAD_BYTES_IS_CANONICAL: AssertFalse<
  "payload_bytes" extends keyof HotKernelPoliciesPayload ? true : false
> = false;
const _HOT_KERNEL_POLICIES_TOOL_ALIAS_IS_CANONICAL: AssertFalse<
  "capabilityId" extends keyof HotKernelPoliciesPayload ? true : false
> = false;

describe("code runtime rpc method consistency", () => {
  it("includes runtime kernel v2 methods in the canonical method list", () => {
    expect(CODE_RUNTIME_RPC_METHOD_LIST).toEqual(
      expect.arrayContaining([
        CODE_RUNTIME_RPC_METHODS.TEXT_FILE_READ_V1,
        CODE_RUNTIME_RPC_METHODS.TEXT_FILE_WRITE_V1,
        CODE_RUNTIME_RPC_METHODS.RUN_PREPARE_V2,
        CODE_RUNTIME_RPC_METHODS.RUN_START_V2,
        CODE_RUNTIME_RPC_METHODS.RUN_GET_V2,
        CODE_RUNTIME_RPC_METHODS.RUN_SUBSCRIBE_V2,
        CODE_RUNTIME_RPC_METHODS.REVIEW_GET_V2,
        CODE_RUNTIME_RPC_METHODS.RUN_RESUME_V2,
        CODE_RUNTIME_RPC_METHODS.RUN_INTERVENE_V2,
      ])
    );
  });

  it("generates invocation candidates for every canonical method", () => {
    for (const method of CODE_RUNTIME_RPC_METHOD_LIST) {
      const candidates = listCodeRuntimeRpcMethodCandidates(method);
      expect(candidates).toEqual([
        method,
        ...(CODE_RUNTIME_RPC_METHOD_LEGACY_ALIASES[method] ?? []),
      ]);
      expect(new Set(candidates).size).toBe(candidates.length);
    }
  });

  it("keeps legacy aliases scoped to explicit compatibility entries", () => {
    const canonicalSet = new Set<string>(CODE_RUNTIME_RPC_METHOD_LIST);
    const seenAliases = new Set<string>();
    const allowedAliasMethods = new Set<string>([
      CODE_RUNTIME_RPC_METHODS.OAUTH_PRIMARY_ACCOUNT_GET,
      CODE_RUNTIME_RPC_METHODS.OAUTH_PRIMARY_ACCOUNT_SET,
    ]);

    for (const method of CODE_RUNTIME_RPC_METHOD_LIST) {
      const aliases = CODE_RUNTIME_RPC_METHOD_LEGACY_ALIASES[method];
      if (!allowedAliasMethods.has(method)) {
        expect(aliases).toEqual([]);
      }

      for (const alias of aliases) {
        expect(canonicalSet.has(alias)).toBe(false);
        expect(seenAliases.has(alias)).toBe(false);
        seenAliases.add(alias);
      }
    }
  });
});

describe("code runtime rpc compatibility helpers", () => {
  it("keeps hot rpc request payload types canonical-only", () => {
    expectTypeOf(HOT_TURN_SEND_WORKSPACE_IS_CANONICAL).toEqualTypeOf<false>();
    expectTypeOf(HOT_TURN_SEND_CONTEXT_IS_CANONICAL).toEqualTypeOf<false>();
    expectTypeOf(HOT_RUN_PREPARE_WORKSPACE_IS_CANONICAL).toEqualTypeOf<false>();
    expectTypeOf(HOT_RUN_PREPARE_STEP_TIMEOUT_IS_CANONICAL).toEqualTypeOf<false>();
    expectTypeOf(HOT_RUN_INTERVENE_PATCH_IS_CANONICAL).toEqualTypeOf<false>();
    expectTypeOf(HOT_KERNEL_CONTEXT_WORKSPACE_IS_CANONICAL).toEqualTypeOf<false>();
    expectTypeOf(HOT_KERNEL_POLICIES_WORKSPACE_IS_CANONICAL).toEqualTypeOf<false>();
    expectTypeOf(HOT_KERNEL_POLICIES_PAYLOAD_BYTES_IS_CANONICAL).toEqualTypeOf<false>();
  });

  it("includes requestId compat alias mapping", () => {
    expect(CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES).toHaveProperty("requestId", "request_id");
    expect(CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES).toHaveProperty(
      "checkExecPolicy",
      "check_exec_policy"
    );
    expect(CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES).toHaveProperty("codexBin", "codex_bin");
    expect(CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES).toHaveProperty("integrationId", "integration_id");
    expect(CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES).toHaveProperty(
      "instructionPatch",
      "instruction_patch"
    );
    expect(CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES).toHaveProperty("autoDrive", "auto_drive");
    expect(CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES).toHaveProperty("missionBrief", "mission_brief");
    expect(CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES).toHaveProperty("taskSource", "task_source");
    expect(CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES).toHaveProperty(
      "validationPresetId",
      "validation_preset_id"
    );
    expect(CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES).toHaveProperty(
      "relaunchContext",
      "relaunch_context"
    );
    expect(CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES).toHaveProperty("taskSource", "task_source");
    expect(CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES).toHaveProperty(
      "backendOperability",
      "backend_operability"
    );
    expect(CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES).toHaveProperty(
      "missionLinkage",
      "mission_linkage"
    );
    expect(CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES).toHaveProperty(
      "reviewActionability",
      "review_actionability"
    );
    expect(CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES).toHaveProperty(
      "sessionBoundary",
      "session_boundary"
    );
    expect(CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES).toHaveProperty("continuation", "continuation");
    expect(CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES).toHaveProperty(
      "nextOperatorAction",
      "next_operator_action"
    );
    expect(CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES).toHaveProperty("trustTier", "trust_tier");
    expect(CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES).toHaveProperty(
      "dataSensitivity",
      "data_sensitivity"
    );
    expect(CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES).toHaveProperty(
      "allowedToolClasses",
      "allowed_tool_classes"
    );
  });

  it("builds both camelCase and snake_case fields for key ids", () => {
    const payload = buildCodeRuntimeRpcCompatFields({
      workspaceId: "ws-1",
      sessionId: "session-1",
      threadId: "thread-1",
      requestId: "request-1",
      provider: "openai",
      modelId: "model-1",
      reasonEffort: "high",
      accessMode: "on-request",
      validationPresetId: "standard",
    });
    const payloadRecord = payload as Record<string, unknown>;

    for (const [camelCaseField, snakeCaseField] of Object.entries(
      CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES
    )) {
      if (camelCaseField in payloadRecord) {
        expect(payloadRecord[snakeCaseField]).toBe(payloadRecord[camelCaseField]);
      }
    }
    expect(payloadRecord.requestId).toBe("request-1");
    expect(payloadRecord.request_id).toBe("request-1");
    expect(payloadRecord.provider).toBe("openai");
    expect(payloadRecord.validationPresetId).toBe("standard");
    expect(payloadRecord.validation_preset_id).toBe("standard");
  });

  it("tracks lifecycle classification for every compat field alias", () => {
    const classifiedFields = new Set([
      ...CODE_RUNTIME_RPC_COMPAT_FIELD_LIFECYCLE.stillNeeded,
      ...CODE_RUNTIME_RPC_COMPAT_FIELD_LIFECYCLE.softDeprecated,
      ...CODE_RUNTIME_RPC_COMPAT_FIELD_LIFECYCLE.removableNow,
    ]);

    expect(classifiedFields).toEqual(new Set(Object.keys(CODE_RUNTIME_RPC_COMPAT_FIELD_ALIASES)));
    expect(CODE_RUNTIME_RPC_COMPAT_FIELD_LIFECYCLE.removableNow).toEqual([
      "missionLinkage",
      "reviewActionability",
      "sessionBoundary",
      "continuation",
      "nextOperatorAction",
      "takeoverBundle",
      "runSummary",
      "reviewPackSummary",
    ]);
  });

  it("recursively mirrors registered compat aliases through nested payloads", () => {
    const payload = cloneWithCodeRuntimeRpcCompatAliases({
      workspaceId: "ws-1",
      policy: {
        trustTier: "trusted",
        dataSensitivity: "restricted",
        approvalPolicy: "checkpoint-required",
        allowedToolClasses: ["read", "write"],
      },
      missionBrief: {
        preferredBackendIds: ["backend-a"],
        evaluationPlan: {
          representativeCommands: ["pnpm test"],
          samplePaths: ["tests", "fixtures"],
        },
      },
      autoDrive: {
        scenarioProfile: {
          representativeCommands: ["pnpm test"],
          scenarioKeys: ["validation-recovery"],
        },
        decisionTrace: {
          summary: "Launch uses workspace graph and representative eval lane.",
          selectionTags: ["workspace_graph", "eval_first"],
        },
        outcomeFeedback: {
          status: "launch_prepared",
          summary: "Runtime prepared AutoDrive launch context.",
        },
        autonomyState: {
          independentThread: true,
          unattendedContinuationAllowed: false,
        },
      },
      steps: [
        {
          timeoutMs: 500,
          requiresApproval: true,
        },
      ],
    }) as Record<string, unknown>;

    expect(payload.workspace_id).toBe("ws-1");
    expect(payload.policy).toEqual({
      trustTier: "trusted",
      trust_tier: "trusted",
      dataSensitivity: "restricted",
      data_sensitivity: "restricted",
      approvalPolicy: "checkpoint-required",
      approval_policy: "checkpoint-required",
      allowedToolClasses: ["read", "write"],
      allowed_tool_classes: ["read", "write"],
    });
    expect(payload.mission_brief).toEqual({
      preferredBackendIds: ["backend-a"],
      preferred_backend_ids: ["backend-a"],
      evaluationPlan: {
        representativeCommands: ["pnpm test"],
        representative_commands: ["pnpm test"],
        samplePaths: ["tests", "fixtures"],
        sample_paths: ["tests", "fixtures"],
      },
      evaluation_plan: {
        representativeCommands: ["pnpm test"],
        representative_commands: ["pnpm test"],
        samplePaths: ["tests", "fixtures"],
        sample_paths: ["tests", "fixtures"],
      },
    });
    expect(payload.auto_drive).toEqual({
      scenarioProfile: {
        representativeCommands: ["pnpm test"],
        representative_commands: ["pnpm test"],
        scenarioKeys: ["validation-recovery"],
        scenario_keys: ["validation-recovery"],
      },
      scenario_profile: {
        representativeCommands: ["pnpm test"],
        representative_commands: ["pnpm test"],
        scenarioKeys: ["validation-recovery"],
        scenario_keys: ["validation-recovery"],
      },
      decisionTrace: {
        summary: "Launch uses workspace graph and representative eval lane.",
        selectionTags: ["workspace_graph", "eval_first"],
        selection_tags: ["workspace_graph", "eval_first"],
      },
      decision_trace: {
        summary: "Launch uses workspace graph and representative eval lane.",
        selectionTags: ["workspace_graph", "eval_first"],
        selection_tags: ["workspace_graph", "eval_first"],
      },
      outcomeFeedback: {
        status: "launch_prepared",
        summary: "Runtime prepared AutoDrive launch context.",
      },
      outcome_feedback: {
        status: "launch_prepared",
        summary: "Runtime prepared AutoDrive launch context.",
      },
      autonomyState: {
        independentThread: true,
        independent_thread: true,
        unattendedContinuationAllowed: false,
        unattended_continuation_allowed: false,
      },
      autonomy_state: {
        independentThread: true,
        independent_thread: true,
        unattendedContinuationAllowed: false,
        unattended_continuation_allowed: false,
      },
    });
    expect(payload.steps).toEqual([
      {
        timeoutMs: 500,
        timeout_ms: 500,
        requiresApproval: true,
        requires_approval: true,
      },
    ]);
  });

  it("builds both camelCase and snake_case fields for research orchestration payloads", () => {
    const payload = buildCodeRuntimeRpcCompatFields({
      scopeProfile: "research",
      allowedSkillIds: ["network-analysis", "core-read"],
      allowNetwork: true,
      workspaceReadPaths: ["docs", "packages/code-runtime-service-rs/src"],
      parentRunId: "research-run-1",
      maxSubQueries: 4,
      maxParallel: 3,
      preferDomains: ["openai.com", "modelcontextprotocol.io"],
      recencyDays: 90,
      fetchPageContent: true,
      workspaceContextPaths: ["docs/architecture/runtime"],
    });
    const payloadRecord = payload as Record<string, unknown>;

    expect(payloadRecord.scopeProfile).toBe("research");
    expect(payloadRecord.scope_profile).toBe("research");
    expect(payloadRecord.allowedSkillIds).toEqual(["network-analysis", "core-read"]);
    expect(payloadRecord.allowed_skill_ids).toEqual(["network-analysis", "core-read"]);
    expect(payloadRecord.allowNetwork).toBe(true);
    expect(payloadRecord.allow_network).toBe(true);
    expect(payloadRecord.workspaceReadPaths).toEqual([
      "docs",
      "packages/code-runtime-service-rs/src",
    ]);
    expect(payloadRecord.workspace_read_paths).toEqual([
      "docs",
      "packages/code-runtime-service-rs/src",
    ]);
    expect(payloadRecord.parentRunId).toBe("research-run-1");
    expect(payloadRecord.parent_run_id).toBe("research-run-1");
    expect(payloadRecord.maxSubQueries).toBe(4);
    expect(payloadRecord.max_sub_queries).toBe(4);
    expect(payloadRecord.maxParallel).toBe(3);
    expect(payloadRecord.max_parallel).toBe(3);
    expect(payloadRecord.preferDomains).toEqual(["openai.com", "modelcontextprotocol.io"]);
    expect(payloadRecord.prefer_domains).toEqual(["openai.com", "modelcontextprotocol.io"]);
    expect(payloadRecord.recencyDays).toBe(90);
    expect(payloadRecord.recency_days).toBe(90);
    expect(payloadRecord.fetchPageContent).toBe(true);
    expect(payloadRecord.fetch_page_content).toBe(true);
    expect(payloadRecord.workspaceContextPaths).toEqual(["docs/architecture/runtime"]);
    expect(payloadRecord.workspace_context_paths).toEqual(["docs/architecture/runtime"]);
  });

  it("builds both camelCase and snake_case fields for agent task intervention and autodrive payloads", () => {
    const startRequest: AgentTaskStartRequest = {
      workspaceId: "ws-1",
      taskSource: {
        kind: "github_issue",
        title: "Stabilize runtime mission control",
        reference: "#42",
        url: "https://github.com/ku0/hypecode/issues/42",
        issueNumber: 42,
        repo: {
          owner: "ku0",
          name: "hypecode",
          fullName: "ku0/hypecode",
          remoteUrl: "https://github.com/ku0/hypecode.git",
        },
        workspaceId: "ws-1",
      },
      accessMode: "on-request",
      executionMode: "distributed",
      preferredBackendIds: ["backend-a"],
      missionBrief: {
        objective: "Stabilize runtime mission control",
        doneDefinition: ["Mission control uses runtime-owned relaunch context."],
        constraints: ["Do not widen backend scheduling scope."],
        riskLevel: "medium",
        requiredCapabilities: ["code", "review"],
        maxSubtasks: 2,
        preferredBackendIds: ["backend-a"],
        permissionSummary: {
          accessMode: "on-request",
          allowNetwork: false,
        },
        evaluationPlan: {
          representativeCommands: ["pnpm test"],
          componentCommands: ["pnpm test:component"],
          endToEndCommands: ["pnpm test:e2e:smoke"],
          samplePaths: ["tests", "fixtures"],
          heldOutGuidance: ["Keep one held-out scenario untouched."],
          sourceSignals: ["test_command", "e2e_map"],
        },
      },
      relaunchContext: {
        sourceTaskId: "task-0",
        sourceRunId: "run-0",
        summary: "Retry from runtime-owned relaunch context.",
        failureClass: "validation_failed",
        recommendedActions: ["retry", "switch_profile_and_retry"],
      },
      autoDrive: {
        destination: {
          title: "Stabilize runtime mission control",
          desiredEndState: ["Mission control task lifecycle is runtime-backed."],
          doneDefinition: {
            arrivalCriteria: ["AutoDrive controls use runtime state."],
            requiredValidation: ["pnpm validate"],
            waypointIndicators: ["pause", "resume", "reroute"],
          },
          hardBoundaries: ["Do not widen design-system scope."],
          routePreference: "stability_first",
        },
        budget: {
          maxTokens: 6000,
          maxIterations: 3,
          maxDurationMs: 600000,
          maxFilesPerIteration: 6,
          maxNoProgressIterations: 2,
          maxValidationFailures: 2,
          maxReroutes: 2,
        },
        riskPolicy: {
          pauseOnDestructiveChange: true,
          pauseOnDependencyChange: true,
          pauseOnLowConfidence: true,
          pauseOnHumanCheckpoint: true,
          allowNetworkAnalysis: false,
          allowValidationCommands: true,
          minimumConfidence: "medium",
        },
        contextPolicy: {
          scope: "workspace_graph",
          workspaceReadPaths: ["/repo", "/peer"],
          workspaceContextPaths: ["/repo/AGENTS.md", "/repo/README.md"],
          authoritySources: ["repo_authority", "workspace_graph"],
        },
        decisionPolicy: {
          independentThread: true,
          autonomyPriority: "operator",
          promptStrategy: "workspace_graph_first",
          researchMode: "repository_only",
        },
        scenarioProfile: {
          authorityScope: "workspace_graph",
          representativeCommands: ["pnpm test"],
          scenarioKeys: ["validation-recovery"],
          safeBackground: false,
        },
        decisionTrace: {
          summary: "Launch uses workspace graph and representative eval lane.",
          selectedCandidateId: "launch_autodrive",
          selectionTags: ["workspace_graph", "eval_first"],
        },
        outcomeFeedback: {
          status: "launch_prepared",
          summary: "Runtime prepared AutoDrive launch context.",
        },
        autonomyState: {
          independentThread: true,
          highPriority: true,
          unattendedContinuationAllowed: false,
        },
      },
      autonomyRequest: {
        autonomyProfile: "night_operator",
        sourceScope: "workspace_graph_and_public_web",
        queueBudget: {
          maxQueuedActions: 2,
          maxRuntimeMinutes: 10,
          maxAutoContinuations: 2,
        },
        wakePolicy: {
          mode: "auto_queue",
          safeFollowUp: true,
          allowAutomaticContinuation: true,
          allowedActions: ["continue", "approve", "clarify", "reroute", "pair", "hold"],
          stopGates: ["destructive_change_requires_review", "dependency_change_requires_review"],
        },
        researchPolicy: {
          mode: "staged",
          allowNetworkAnalysis: true,
          requireCitations: true,
          allowPrivateContextStage: true,
        },
      },
      steps: [{ kind: "read", input: "Implement runtime-first AutoDrive." }],
    };
    const interventionRequest: AgentTaskInterventionRequest = {
      taskId: "task-1",
      action: "switch_profile_and_retry",
      instructionPatch: "Retry with the balanced delegate profile and explicit validation.",
      executionProfileId: "balanced-delegate",
      preferredBackendIds: ["backend-a"],
      relaunchContext: {
        sourceTaskId: "task-1",
        sourceRunId: "run-1",
        sourceReviewPackId: "review-pack:run-1",
        summary: "Retry after validation failure with full runtime context.",
        failureClass: "validation_failed",
        recommendedActions: ["switch_profile_and_retry"],
      },
    };

    const startPayload = buildCodeRuntimeRpcCompatFields(startRequest) as Record<string, unknown>;
    const interventionPayload = buildCodeRuntimeRpcCompatFields(interventionRequest) as Record<
      string,
      unknown
    >;

    expect(startPayload.autoDrive.destination).toEqual(startRequest.autoDrive?.destination);
    expect(startPayload.autoDrive.budget).toEqual(startRequest.autoDrive?.budget);
    expect(startPayload.autoDrive.riskPolicy).toMatchObject({
      ...startRequest.autoDrive?.riskPolicy,
      allow_network_analysis: false,
    });
    expect(startPayload.auto_drive).toEqual(startPayload.autoDrive);
    expect(startPayload.autoDrive.contextPolicy).toMatchObject({
      scope: "workspace_graph",
      workspaceReadPaths: ["/repo", "/peer"],
      workspace_read_paths: ["/repo", "/peer"],
      authoritySources: ["repo_authority", "workspace_graph"],
      authority_sources: ["repo_authority", "workspace_graph"],
    });
    expect(startPayload.autoDrive.context_policy).toMatchObject({
      scope: "workspace_graph",
    });
    expect(startPayload.autoDrive.decisionPolicy).toMatchObject({
      independentThread: true,
      independent_thread: true,
      autonomyPriority: "operator",
      autonomy_priority: "operator",
      promptStrategy: "workspace_graph_first",
      prompt_strategy: "workspace_graph_first",
      researchMode: "repository_only",
      research_mode: "repository_only",
    });
    expect(startPayload.autoDrive.decision_policy).toMatchObject({
      independentThread: true,
    });
    expect(startPayload.autoDrive.scenarioProfile).toMatchObject({
      authorityScope: "workspace_graph",
      authority_scope: "workspace_graph",
      scenarioKeys: ["validation-recovery"],
      scenario_keys: ["validation-recovery"],
    });
    expect(startPayload.autoDrive.scenario_profile).toMatchObject({
      representativeCommands: ["pnpm test"],
      representative_commands: ["pnpm test"],
    });
    expect(startPayload.autoDrive.decisionTrace).toMatchObject({
      selectedCandidateId: "launch_autodrive",
      selected_candidate_id: "launch_autodrive",
    });
    expect(startPayload.autoDrive.decision_trace).toMatchObject({
      selectionTags: ["workspace_graph", "eval_first"],
      selection_tags: ["workspace_graph", "eval_first"],
    });
    expect(startPayload.autoDrive.outcomeFeedback).toMatchObject({
      status: "launch_prepared",
    });
    expect(startPayload.autoDrive.outcome_feedback).toMatchObject({
      summary: "Runtime prepared AutoDrive launch context.",
    });
    expect(startPayload.autoDrive.autonomyState).toMatchObject({
      highPriority: true,
      high_priority: true,
    });
    expect(startPayload.autoDrive.autonomy_state).toMatchObject({
      unattendedContinuationAllowed: false,
      unattended_continuation_allowed: false,
    });
    expect(startPayload.taskSource).toEqual(
      expect.objectContaining({
        kind: "github_issue",
        workspaceId: "ws-1",
        workspace_id: "ws-1",
      })
    );
    expect(startPayload.task_source).toEqual(startPayload.taskSource);
    expect(startPayload.missionBrief).toEqual(
      expect.objectContaining({
        preferredBackendIds: ["backend-a"],
        preferred_backend_ids: ["backend-a"],
        maxSubtasks: 2,
        max_subtasks: 2,
        evaluationPlan: expect.objectContaining({
          representativeCommands: ["pnpm test"],
          representative_commands: ["pnpm test"],
          endToEndCommands: ["pnpm test:e2e:smoke"],
          end_to_end_commands: ["pnpm test:e2e:smoke"],
        }),
        evaluation_plan: expect.objectContaining({
          samplePaths: ["tests", "fixtures"],
          sample_paths: ["tests", "fixtures"],
        }),
      })
    );
    expect(startPayload.mission_brief).toEqual(startPayload.missionBrief);
    expect(startPayload.relaunchContext).toEqual(
      expect.objectContaining({
        sourceTaskId: "task-0",
        sourceRunId: "run-0",
        summary: "Retry from runtime-owned relaunch context.",
        failureClass: "validation_failed",
        failure_class: "validation_failed",
      })
    );
    expect(startPayload.relaunch_context).toEqual(startPayload.relaunchContext);
    expect(startPayload.autonomyRequest).toMatchObject({
      autonomyProfile: "night_operator",
      autonomy_profile: "night_operator",
      sourceScope: "workspace_graph_and_public_web",
      source_scope: "workspace_graph_and_public_web",
    });
    expect(startPayload.autonomyRequest.queueBudget).toMatchObject({
      maxQueuedActions: 2,
      max_queued_actions: 2,
      maxRuntimeMinutes: 10,
      max_runtime_minutes: 10,
    });
    expect(startPayload.autonomyRequest.wakePolicy).toMatchObject({
      safeFollowUp: true,
      safe_follow_up: true,
      allowAutomaticContinuation: true,
      allow_automatic_continuation: true,
      allowedActions: ["continue", "approve", "clarify", "reroute", "pair", "hold"],
      allowed_actions: ["continue", "approve", "clarify", "reroute", "pair", "hold"],
    });
    expect(startPayload.autonomyRequest.researchPolicy).toMatchObject({
      allowNetworkAnalysis: true,
      allow_network_analysis: true,
      requireCitations: true,
      require_citations: true,
      allowPrivateContextStage: true,
      allow_private_context_stage: true,
    });
    expect(startPayload.autonomy_request).toEqual(startPayload.autonomyRequest);
    expect(interventionPayload.instructionPatch).toBe(interventionRequest.instructionPatch);
    expect(interventionPayload.instruction_patch).toBe(interventionRequest.instructionPatch);
    expect(interventionPayload.relaunchContext).toEqual(
      expect.objectContaining({
        sourceTaskId: "task-1",
        sourceRunId: "run-1",
        sourceReviewPackId: "review-pack:run-1",
        failureClass: "validation_failed",
        failure_class: "validation_failed",
      })
    );
    expect(interventionPayload.relaunch_context).toEqual(interventionPayload.relaunchContext);
  });

  it("builds both camelCase and snake_case fields for execution graph summaries", () => {
    const payload = buildCodeRuntimeRpcCompatFields({
      executionGraph: {
        graphId: "graph-1",
        nodes: [
          {
            id: "node-plan-1",
            kind: "plan",
            status: "running",
            preferredBackendIds: ["worker-plan"],
            resolvedBackendId: "worker-plan",
            placementLifecycleState: "confirmed",
          },
        ],
        edges: [],
      },
    } as Record<string, unknown>);
    const payloadRecord = payload as Record<string, unknown>;

    expect(payloadRecord.executionGraph).toEqual(
      expect.objectContaining({
        graphId: "graph-1",
        nodes: [
          expect.objectContaining({
            preferredBackendIds: ["worker-plan"],
            preferred_backend_ids: ["worker-plan"],
          }),
        ],
        edges: [],
      })
    );
    expect(payloadRecord.execution_graph).toEqual(payloadRecord.executionGraph);
  });

  it("builds both camelCase and snake_case fields for task source payloads", () => {
    const startRequest: AgentTaskStartRequest = {
      workspaceId: "ws-1",
      accessMode: "on-request",
      executionMode: "single",
      taskSource: {
        kind: "github_issue",
        label: "GitHub issue #42",
        title: "Stabilize runtime task source mapping",
        externalId: "openai/hypecode#42",
        canonicalUrl: "https://github.com/openai/hypecode/issues/42",
        sourceTaskId: "planning-task-42",
        sourceRunId: "planning-run-42",
      },
      validationPresetId: "standard",
      steps: [{ kind: "read", input: "Inspect runtime task source compatibility." }],
    };

    const payload = buildCodeRuntimeRpcCompatFields(startRequest) as Record<string, unknown>;

    expect(payload.taskSource).toEqual(startRequest.taskSource);
    expect(payload.task_source).toEqual(startRequest.taskSource);
    expect(payload.validationPresetId).toBe("standard");
    expect(payload.validation_preset_id).toBe("standard");
  });

  it("accepts review scope profile payloads and typed live-skill metadata", () => {
    const spawnRequest: SubAgentSpawnRequest = {
      workspaceId: "ws-1",
      scopeProfile: "review",
      allowNetwork: true,
      allowedSkillIds: ["core-read", "core-bash"],
      workspaceReadPaths: ["docs", "packages/code-runtime-service-rs/src"],
      parentRunId: "review-run-1",
    };

    expect(spawnRequest.scopeProfile).toBe("review");

    const executionResult: LiveSkillExecutionResult = {
      runId: "live-skill-run-1",
      skillId: "research-orchestrator",
      status: "completed",
      message: "ok",
      output: "summary",
      network: null,
      artifacts: [],
      metadata: {
        profileUsed: "review",
        approvalEvents: [
          {
            status: "approved",
            approvalId: "approval-1",
            reason: "approved in test",
            action: "write",
            approval: {
              decision: "approved",
              resolutionStatus: "approved",
              resolutionReason: "approved in test",
              resolutionAction: "write",
            },
          },
        ],
        checkpointState: {
          state: "completed",
          checkpointId: "checkpoint-1",
          recovered: false,
        },
        compactionSummary: {
          triggered: false,
          executed: false,
        },
        evalTags: ["runtime", "review"],
      },
    };

    expect(executionResult.metadata.profileUsed).toBe("review");
    expect(executionResult.metadata.approvalEvents?.[0]?.approval?.resolutionStatus).toBe(
      "approved"
    );
    expect(executionResult.metadata.checkpointState?.state).toBe("completed");
    expect(executionResult.metadata.compactionSummary?.triggered).toBe(false);
    expect(executionResult.metadata.evalTags).toEqual(["runtime", "review"]);
  });

  it("accepts typed agent task step observability metadata", () => {
    const stepSummary: AgentTaskStepSummary = {
      index: 1,
      kind: "edit",
      role: "coder",
      status: "completed",
      message: "ok",
      runId: "run-1",
      output: "done",
      metadata: {
        toolCapabilities: {
          defaultRequiresApproval: true,
          mutationKind: "edit",
          parallelSafe: false,
          requiresReadEvidence: true,
          skillId: "core-edit",
        },
        inspector: {
          decision: "allow",
        },
        approval: {
          decision: "approved",
          required: true,
          reused: false,
          requestReason: "Destructive operation requires approval.",
          requestSource: "capability_default",
          resolutionStatus: "approved",
          resolutionReason: "approved in test",
          resolutionAction: "edit",
          scopeKind: "file-target",
          scopeKey: "workspace:ws-1:file:docs/test.md",
          scopeTarget: "docs/test.md",
        },
        safety: {
          guard: "taskScopedReadBeforeMutation",
          path: "docs/test.md",
          requiresFreshRead: false,
          lastReadStepIndex: 1,
          lastMutationStepIndex: null,
        },
      },
      startedAt: 1,
      updatedAt: 2,
      completedAt: 3,
      errorCode: null,
      errorMessage: null,
      approvalId: "approval-1",
    };

    expect(stepSummary.metadata.toolCapabilities?.skillId).toBe("core-edit");
    expect(stepSummary.metadata.inspector?.decision).toBe("allow");
    expect(stepSummary.metadata.approval?.requestSource).toBe("capability_default");
    expect(stepSummary.metadata.safety?.guard).toBe("taskScopedReadBeforeMutation");
  });

  it("accepts typed agent task intervention and autodrive summaries", () => {
    const taskSummary: AgentTaskSummary = {
      taskId: "task-1",
      workspaceId: "ws-1",
      threadId: "thread-1",
      requestId: "request-1",
      title: "Runtime-first AutoDrive",
      status: "paused",
      accessMode: "on-request",
      executionMode: "distributed",
      provider: "openai",
      modelId: "gpt-5",
      routedProvider: "openai",
      routedModelId: "gpt-5",
      routedPool: "default",
      routedSource: "workspace-default",
      currentStep: 1,
      createdAt: 1,
      updatedAt: 2,
      startedAt: 1,
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      pendingApprovalId: null,
      executionProfileId: "autonomous-delegate",
      executionProfile: {
        id: "autonomous-delegate",
        name: "Autonomous Delegate",
        description: "Runtime-owned execution profile",
        executionMode: "distributed",
        autonomy: "autonomous_delegate",
        supervisionLabel: "Checkpointed autonomy with targeted intervention",
        accessMode: "on-request",
        routingStrategy: "workspace_default",
        toolPosture: "workspace_safe",
        approvalSensitivity: "standard",
        identitySource: "runtime_agent_task",
      },
      profileReadiness: {
        ready: true,
        health: "ready",
        summary: "Profile is ready for delegated execution.",
        issues: [],
      },
      routing: {
        backendId: "backend-a",
        provider: "openai",
        providerLabel: "openai",
        pool: "default",
        routeLabel: "backend-a / openai / default",
        routeHint: "Placed on backend backend-a.",
        health: "ready",
        resolutionSource: "explicit_preference",
        lifecycleState: "confirmed",
        enabledAccountCount: 0,
        readyAccountCount: 0,
        enabledPoolCount: 0,
      },
      approvalState: {
        status: "not_required",
        approvalId: null,
        label: "No pending approval",
        summary: "This run does not currently require an approval decision.",
      },
      reviewDecision: null,
      reviewPackId: "review-pack:task-1",
      intervention: {
        actions: [],
        primaryAction: "resume",
      },
      operatorState: {
        health: "healthy",
        headline: "Run is controllable",
        detail: "Placed on backend backend-a.",
      },
      nextAction: {
        label: "Resume paused run",
        action: "resume",
        detail: "This run is paused and can continue from its latest checkpoint.",
      },
      publishHandoff: {
        jsonPath: ".hugecode/runs/task-1/publish/handoff.json",
        markdownPath: ".hugecode/runs/task-1/publish/handoff.md",
        reason: "completed",
        summary: "AutoDrive prepared publish handoff.",
        at: 2,
        branchName: "autodrive/runtime-truth-task-1",
        reviewTitle: "Ship runtime truth",
      },
      checkpointId: "checkpoint-1",
      traceId: "trace-1",
      recovered: false,
      checkpointState: {
        state: "running",
        lifecycleState: "paused",
        checkpointId: "checkpoint-1",
        traceId: "trace-1",
        recovered: false,
        updatedAt: 2,
        resumeReady: true,
        recoveredAt: null,
        summary: "Run is paused and can continue from its latest checkpoint.",
      },
      executionGraph: {
        graphId: "graph-1",
        nodes: [
          {
            id: "node-plan-1",
            kind: "plan",
            status: "running",
            preferredBackendIds: ["worker-plan"],
            resolvedBackendId: "worker-plan",
            placementLifecycleState: "confirmed",
          },
        ],
        edges: [],
      } satisfies RuntimeExecutionGraphSummary,
      backendId: "backend-a",
      rootTaskId: "task-1",
      parentTaskId: null,
      childTaskIds: [],
      distributedStatus: "running",
      autoDrive: {
        enabled: true,
        destination: {
          title: "Runtime-first AutoDrive",
          desiredEndState: ["Replace local ledger state."],
        },
        navigation: {
          activeWaypoint: "Wire runtime controls",
          completedWaypoints: [],
          pendingWaypoints: ["Review reroute action"],
          lastProgressAt: 2,
          rerouteCount: 1,
          validationFailureCount: 0,
          noProgressIterations: 0,
        },
        stop: {
          reason: "paused",
          summary: "Operator paused the route from mission control.",
          at: 2,
        },
      },
      steps: [],
    };
    const interventionAck: AgentTaskInterventionAck = {
      accepted: true,
      action: "switch_profile_and_retry",
      taskId: "task-1",
      status: "queued",
      outcome: "spawned",
      spawnedTaskId: "task-2",
      checkpointId: "checkpoint-2",
    };

    expect(taskSummary.status).toBe("paused");
    expect(taskSummary.checkpointState?.resumeReady).toBe(true);
    expect(taskSummary.executionProfile?.id).toBe("autonomous-delegate");
    expect(taskSummary.routing?.lifecycleState).toBe("confirmed");
    expect(taskSummary.nextAction?.action).toBe("resume");
    expect(taskSummary.publishHandoff?.branchName).toBe("autodrive/runtime-truth-task-1");
    expect(taskSummary.reviewPackId).toBe("review-pack:task-1");
    expect(taskSummary.executionGraph?.graphId).toBe("graph-1");
    expect(taskSummary.executionGraph?.nodes[0]?.kind).toBe("plan");
    expect(taskSummary.executionGraph?.nodes[0]?.preferredBackendIds).toEqual(["worker-plan"]);
    expect(taskSummary.executionGraph?.nodes[0]?.resolvedBackendId).toBe("worker-plan");
    expect(taskSummary.executionGraph?.nodes[0]?.placementLifecycleState).toBe("confirmed");
    expect(taskSummary.autoDrive?.navigation?.activeWaypoint).toBe("Wire runtime controls");
    expect(interventionAck.spawnedTaskId).toBe("task-2");
  });

  it("builds both camelCase and snake_case fields for account/pool ids", () => {
    const payload = buildCodeRuntimeRpcCompatFields({
      accountId: "account-1",
      poolId: "pool-1",
    });
    const payloadRecord = payload as Record<string, unknown>;

    expect(payloadRecord.accountId).toBe("account-1");
    expect(payloadRecord.account_id).toBe("account-1");
    expect(payloadRecord.poolId).toBe("pool-1");
    expect(payloadRecord.pool_id).toBe("pool-1");
  });

  it("builds both camelCase and snake_case fields for runtime truth metadata", () => {
    const runtimePayload = buildCodeRuntimeRpcCompatFields({
      backendOperability: {
        state: "ready",
        placementEligible: true,
        summary: "Ready for placement.",
        reasons: [],
      },
      missionLinkage: {
        workspaceId: "ws-1",
        taskId: "task-1",
        runId: "run-1",
        missionTaskId: "task-1",
        taskEntityKind: "run",
        recoveryPath: "run",
        navigationTarget: {
          kind: "run",
          workspaceId: "ws-1",
          taskId: "task-1",
          runId: "run-1",
        },
        summary: "Linkage ready.",
      },
      reviewActionability: {
        state: "ready",
        summary: "Review ready.",
        degradedReasons: [],
        actions: [
          {
            action: "retry",
            enabled: true,
            supported: true,
            reason: null,
          },
        ],
      },
      takeoverBundle: {
        state: "ready",
        pathKind: "review",
        primaryAction: "open_review_pack",
        summary: "Open Review Pack to continue.",
        blockingReason: null,
        recommendedAction: "Open Review Pack and continue from runtime truth.",
        target: {
          kind: "review_pack",
          workspaceId: "ws-1",
          taskId: "task-1",
          runId: "run-1",
          reviewPackId: "review-pack:task-1",
        },
        checkpointId: "checkpoint-1",
        traceId: "trace-1",
        reviewPackId: "review-pack:task-1",
        publishHandoff: null,
        reviewActionability: {
          state: "ready",
          summary: "Review ready.",
          degradedReasons: [],
          actions: [],
        },
      },
      sessionBoundary: {
        workspaceId: "ws-1",
        taskId: "task-1",
        runId: "run-1",
        missionTaskId: "task-1",
        sessionKind: "run",
        threadId: null,
        requestId: null,
        reviewPackId: "review-pack:task-1",
        checkpointId: "checkpoint-1",
        traceId: "trace-1",
        navigationTarget: {
          kind: "run",
          workspaceId: "ws-1",
          taskId: "task-1",
          runId: "run-1",
        },
      },
      continuation: {
        state: "ready",
        pathKind: "review",
        source: "takeover_bundle",
        summary: "Open Review Pack to continue.",
        detail: "Open Review Pack to continue.",
        recommendedAction: "Open Review Pack and continue from runtime truth.",
        target: {
          kind: "review_pack",
          workspaceId: "ws-1",
          taskId: "task-1",
          runId: "run-1",
          reviewPackId: "review-pack:task-1",
        },
        reviewPackId: "review-pack:task-1",
        reviewActionability: null,
        sessionBoundary: {
          workspaceId: "ws-1",
          taskId: "task-1",
          runId: "run-1",
          missionTaskId: "task-1",
          sessionKind: "run",
          threadId: null,
          requestId: null,
          reviewPackId: "review-pack:task-1",
          checkpointId: "checkpoint-1",
          traceId: "trace-1",
          navigationTarget: {
            kind: "run",
            workspaceId: "ws-1",
            taskId: "task-1",
            runId: "run-1",
          },
        },
      },
      nextOperatorAction: {
        action: "open_review_pack",
        label: "Open review",
        detail: "Open Review Pack to continue.",
        source: "continuation",
        target: {
          kind: "review_pack",
          workspaceId: "ws-1",
          taskId: "task-1",
          runId: "run-1",
          reviewPackId: "review-pack:task-1",
        },
        sessionBoundary: {
          workspaceId: "ws-1",
          taskId: "task-1",
          runId: "run-1",
          missionTaskId: "task-1",
          sessionKind: "run",
          threadId: null,
          requestId: null,
          reviewPackId: "review-pack:task-1",
          checkpointId: "checkpoint-1",
          traceId: "trace-1",
          navigationTarget: {
            kind: "run",
            workspaceId: "ws-1",
            taskId: "task-1",
            runId: "run-1",
          },
        },
      },
    });
    const payloadRecord = runtimePayload as Record<string, unknown>;

    expect(payloadRecord.backendOperability).toBe(runtimePayload.backendOperability);
    expect(payloadRecord.backend_operability).toBe(runtimePayload.backendOperability);
    expect(payloadRecord.missionLinkage).toBe(runtimePayload.missionLinkage);
    expect(payloadRecord.mission_linkage).toBe(runtimePayload.missionLinkage);
    expect(payloadRecord.reviewActionability).toBe(runtimePayload.reviewActionability);
    expect(payloadRecord.review_actionability).toBe(runtimePayload.reviewActionability);
    expect(payloadRecord.sessionBoundary).toBe(runtimePayload.sessionBoundary);
    expect(payloadRecord.session_boundary).toBe(runtimePayload.sessionBoundary);
    expect(payloadRecord.continuation).toBe(runtimePayload.continuation);
    expect(payloadRecord.takeoverBundle).toBe(runtimePayload.takeoverBundle);
    expect(payloadRecord.takeover_bundle).toBe(runtimePayload.takeoverBundle);
    expect(payloadRecord.nextOperatorAction).toBe(runtimePayload.nextOperatorAction);
    expect(payloadRecord.next_operator_action).toBe(runtimePayload.nextOperatorAction);
  });
});

describe("code runtime rpc v2 features", () => {
  it("advertises the runtime kernel prepare feature", () => {
    expect(CODE_RUNTIME_RPC_FEATURES).toContain("runtime_kernel_prepare_v2");
  });

  it("does not advertise the retired mission-control summary compat feature", () => {
    expect(CODE_RUNTIME_RPC_FEATURES).not.toContain("runtime_mission_control_summary_v1");
  });

  it("changes the canonical method hash when v2 runtime methods are present", () => {
    const hash = computeCodeRuntimeRpcMethodSetHash(CODE_RUNTIME_RPC_METHOD_LIST);
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(10);
  });
});

describe("agent and oauth rpc methods", () => {
  it("lists canonical candidates for rpc capabilities handshake", () => {
    expect(listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.RPC_CAPABILITIES)).toEqual([
      "code_rpc_capabilities",
    ]);
  });

  it("lists canonical candidates for oauth account list", () => {
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.OAUTH_ACCOUNTS_LIST)
    ).toEqual(["code_oauth_accounts_list"]);
  });

  it("lists canonical+legacy candidates for oauth primary account methods", () => {
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.OAUTH_PRIMARY_ACCOUNT_GET)
    ).toEqual(["code_oauth_primary_account_get", "oauth_primary_account_get"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.OAUTH_PRIMARY_ACCOUNT_SET)
    ).toEqual(["code_oauth_primary_account_set", "oauth_primary_account_set"]);
  });

  it("lists canonical candidates for oauth pool members list", () => {
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_MEMBERS_LIST)
    ).toEqual(["code_oauth_pool_members_list"]);
  });

  it("lists canonical candidates for oauth pool apply", () => {
    expect(listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.OAUTH_POOL_APPLY)).toEqual([
      "code_oauth_pool_apply",
    ]);
  });

  it("lists canonical candidates for oauth chatgpt auth tokens refresh", () => {
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.OAUTH_CHATGPT_AUTH_TOKENS_REFRESH)
    ).toEqual(["code_oauth_chatgpt_auth_tokens_refresh"]);
  });

  it("lists canonical candidates for codex oauth login start and cancel", () => {
    expect(CODE_RUNTIME_RPC_METHOD_LIST).toContain("code_oauth_codex_login_start");
    expect(CODE_RUNTIME_RPC_METHOD_LIST).toContain("code_oauth_codex_login_cancel");
    expect(
      listCodeRuntimeRpcMethodCandidates(
        "code_oauth_codex_login_start" as (typeof CODE_RUNTIME_RPC_METHOD_LIST)[number]
      )
    ).toEqual(["code_oauth_codex_login_start"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(
        "code_oauth_codex_login_cancel" as (typeof CODE_RUNTIME_RPC_METHOD_LIST)[number]
      )
    ).toEqual(["code_oauth_codex_login_cancel"]);
  });

  it("lists canonical candidates for cockpit-tools codex import", () => {
    expect(
      listCodeRuntimeRpcMethodCandidates(
        CODE_RUNTIME_RPC_METHODS.OAUTH_CODEX_ACCOUNTS_IMPORT_FROM_COCKPIT_TOOLS
      )
    ).toEqual(["code_oauth_codex_accounts_import_from_cockpit_tools"]);
  });

  it("exposes canonical candidates for runtime run start v2", () => {
    expect(listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.RUN_START_V2)).toEqual([
      "code_runtime_run_start_v2",
    ]);
  });

  it("exposes canonical candidates for runtime run cancel v2", () => {
    expect(listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.RUN_CANCEL_V2)).toEqual([
      "code_runtime_run_cancel_v2",
    ]);
  });

  it("exposes canonical candidates for runtime run resume v2", () => {
    expect(listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.RUN_RESUME_V2)).toEqual([
      "code_runtime_run_resume_v2",
    ]);
  });

  it("exposes canonical candidates for runtime run intervention v2", () => {
    expect(listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.RUN_INTERVENE_V2)).toEqual([
      "code_runtime_run_intervene_v2",
    ]);
  });

  it("exposes canonical candidates for runtime run get and subscribe v2", () => {
    expect(listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.RUN_GET_V2)).toEqual([
      "code_runtime_run_get_v2",
    ]);
    expect(listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.RUN_SUBSCRIBE_V2)).toEqual([
      "code_runtime_run_subscribe_v2",
    ]);
  });

  it("exposes canonical candidates for sub-agent session methods", () => {
    expect(listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.SUB_AGENT_SPAWN)).toEqual([
      "code_sub_agent_spawn",
    ]);
    expect(listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.SUB_AGENT_SEND)).toEqual([
      "code_sub_agent_send",
    ]);
    expect(listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.SUB_AGENT_WAIT)).toEqual([
      "code_sub_agent_wait",
    ]);
    expect(listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.SUB_AGENT_STATUS)).toEqual([
      "code_sub_agent_status",
    ]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.SUB_AGENT_INTERRUPT)
    ).toEqual(["code_sub_agent_interrupt"]);
    expect(listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.SUB_AGENT_CLOSE)).toEqual([
      "code_sub_agent_close",
    ]);
  });

  it("exposes canonical candidates for backend pool and distributed task graph methods", () => {
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.MISSION_CONTROL_SNAPSHOT_V1)
    ).toEqual(["code_mission_control_snapshot_v1"]);
    expect(CODE_RUNTIME_RPC_METHOD_LIST).not.toContain("code_mission_control_summary_v1");
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.RUNTIME_BACKENDS_LIST)
    ).toEqual(["code_runtime_backends_list"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.RUNTIME_BACKEND_UPSERT)
    ).toEqual(["code_runtime_backend_upsert"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.RUNTIME_BACKEND_REMOVE)
    ).toEqual(["code_runtime_backend_remove"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.RUNTIME_BACKEND_SET_STATE)
    ).toEqual(["code_runtime_backend_set_state"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.DISTRIBUTED_TASK_GRAPH)
    ).toEqual(["code_distributed_task_graph"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_METRICS_RECORD)
    ).toEqual(["code_runtime_tool_metrics_record"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_METRICS_READ)
    ).toEqual(["code_runtime_tool_metrics_read"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_METRICS_RESET)
    ).toEqual(["code_runtime_tool_metrics_reset"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_GUARDRAIL_EVALUATE)
    ).toEqual(["code_runtime_tool_guardrail_evaluate"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(
        CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_GUARDRAIL_RECORD_OUTCOME
      )
    ).toEqual(["code_runtime_tool_guardrail_record_outcome"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.RUNTIME_TOOL_GUARDRAIL_READ)
    ).toEqual(["code_runtime_tool_guardrail_read"]);
    expect(listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.BOOTSTRAP_SNAPSHOT)).toEqual(
      ["code_bootstrap_snapshot"]
    );
    expect(listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.RPC_BATCH)).toEqual([
      "code_rpc_batch",
    ]);
  });

  it("exposes canonical candidates for thread live subscription methods", () => {
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.THREAD_LIVE_SUBSCRIBE)
    ).toEqual(["code_thread_live_subscribe"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.THREAD_LIVE_UNSUBSCRIBE)
    ).toEqual(["code_thread_live_unsubscribe"]);
  });

  it("exposes canonical candidates for extension/session/security v1 methods", () => {
    expect(listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.CODEX_EXEC_RUN_V1)).toEqual([
      "code_codex_exec_run_v1",
    ]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.CODEX_CLOUD_TASKS_LIST_V1)
    ).toEqual(["code_codex_cloud_tasks_list_v1"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.CODEX_CONFIG_PATH_GET_V1)
    ).toEqual(["code_codex_config_path_get_v1"]);
    expect(listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.CODEX_DOCTOR_V1)).toEqual([
      "code_codex_doctor_v1",
    ]);
    expect(listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.CODEX_UPDATE_V1)).toEqual([
      "code_codex_update_v1",
    ]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.COLLABORATION_MODES_LIST_V1)
    ).toEqual(["code_collaboration_modes_list_v1"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.MCP_SERVER_STATUS_LIST_V1)
    ).toEqual(["code_mcp_server_status_list_v1"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.EXTENSION_CATALOG_LIST_V2)
    ).toEqual(["code_extension_catalog_list_v2"]);
    expect(listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.EXTENSION_GET_V2)).toEqual([
      "code_extension_get_v2",
    ]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.EXTENSION_INSTALL_V2)
    ).toEqual(["code_extension_install_v2"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.EXTENSION_UPDATE_V2)
    ).toEqual(["code_extension_update_v2"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.EXTENSION_SET_STATE_V2)
    ).toEqual(["code_extension_set_state_v2"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.EXTENSION_REMOVE_V2)
    ).toEqual(["code_extension_remove_v2"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.EXTENSION_REGISTRY_SEARCH_V2)
    ).toEqual(["code_extension_registry_search_v2"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.EXTENSION_REGISTRY_SOURCES_V2)
    ).toEqual(["code_extension_registry_sources_v2"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.EXTENSION_PERMISSIONS_EVALUATE_V2)
    ).toEqual(["code_extension_permissions_evaluate_v2"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.EXTENSION_HEALTH_READ_V2)
    ).toEqual(["code_extension_health_read_v2"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.EXTENSION_TOOLS_LIST_V2)
    ).toEqual(["code_extension_tools_list_v2"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.EXTENSION_RESOURCE_READ_V2)
    ).toEqual(["code_extension_resource_read_v2"]);
    expect(listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.SESSION_EXPORT_V1)).toEqual([
      "code_session_export_v1",
    ]);
    expect(listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.SESSION_IMPORT_V1)).toEqual([
      "code_session_import_v1",
    ]);
    expect(listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.SESSION_DELETE_V1)).toEqual([
      "code_session_delete_v1",
    ]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.SECURITY_PREFLIGHT_V1)
    ).toEqual(["code_security_preflight_v1"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.WORKSPACE_DIAGNOSTICS_LIST_V1)
    ).toEqual(["code_workspace_diagnostics_list_v1"]);
    expect(
      listCodeRuntimeRpcMethodCandidates(CODE_RUNTIME_RPC_METHODS.RUNTIME_DIAGNOSTICS_EXPORT_V1)
    ).toEqual(["code_runtime_diagnostics_export_v1"]);
  });
});

describe("rpc capability constants", () => {
  it("exposes contract version", () => {
    expect(CODE_RUNTIME_RPC_CONTRACT_VERSION).toBe("2026-03-25");
  });

  it("exposes required feature flags", () => {
    expect(CODE_RUNTIME_RPC_FEATURES).toEqual(
      expect.arrayContaining([
        "rpc_capabilities_handshake",
        "method_not_found_error_code",
        "oauth_account_pool",
        "prompt_library_mutation",
        "live_skills_core_agents",
        "provider_catalog",
        "agent_orchestrator_v1",
        "canonical_methods_only",
        "distributed_runtime_v1",
        "durable_task_log_v1",
        "workspace_lane_sharding_v1",
        "event_replay_durable_v1",
        "multi_backend_pool_v1",
        "distributed_subtask_graph_v1",
        "backend_placement_observability_v1",
        "sub_agent_sessions_v1",
        "execution_mode_v2",
        "agent_task_durability_v1",
        "agent_task_resume_v1",
        "runtime_tool_lifecycle_v2",
        "runtime_tool_metrics_v1",
        "runtime_tool_guardrails_v1",
        "runtime_autonomy_safety_v1",
        "runtime_kernel_v2",
        "runtime_kernel_projection_v3",
        "runtime_stream_backpressure_v1",
        "runtime_lifecycle_sweeper_v1",
        "runtime_lifecycle_consistency_v1",
        "runtime_distributed_state_cas_v1",
        "runtime_stream_guardrails_v1",
        "runtime_lifecycle_observability_v1",
        "runtime_distributed_lease_observability_v1",
        "runtime_backend_registry_persistence_v1",
        "runtime_backend_operability_v1",
        "runtime_acp_readiness_probe_v1",
        "runtime_review_actionability_v1",
        "runtime_review_linkage_v1",
        "runtime_truth_contract_core_v1",
        "runtime_fault_injection_test_v1",
        "oauth_chatgpt_auth_tokens_refresh_v1",
        "oauth_codex_login_control_v1",
        "workspace_diagnostics_list_v1",
        "runtime_extension_lifecycle_v1",
        "runtime_session_portability_v1",
        "runtime_security_preflight_v1",
        "runtime_diagnostics_export_v1",
        "runtime_codex_exec_run_v1",
        "runtime_codex_cloud_tasks_read_v1",
        "runtime_codex_execpolicy_preflight_v1",
        "runtime_codex_unified_rpc_migration_v1",
        "runtime_host_deprecated",
        "app_server_protocol_v2_2026_03_25",
        "contract_frozen_2026_03_25",
      ])
    );
  });
});

describe("kernel v2 contract types", () => {
  it("exposes orthogonal execution profile and continuation fields for kernel jobs", () => {
    const job: KernelJob = {
      id: "job-1",
      workspaceId: "ws-1",
      threadId: "thread-1",
      title: "Kernel-native runtime projection",
      status: "running",
      provider: "openai",
      modelId: "gpt-5.4",
      backendId: "backend-a",
      preferredBackendIds: ["backend-a"],
      executionProfile: {
        placement: "remote",
        interactivity: "background",
        isolation: "container_sandbox",
        network: "restricted",
        authority: "delegated",
      },
      createdAt: 1,
      updatedAt: 2,
      startedAt: 1,
      completedAt: null,
      continuation: {
        checkpointId: "checkpoint-1",
        resumeSupported: true,
        recovered: false,
        summary: "Checkpoint is ready for resume or handoff.",
      },
      metadata: {
        legacyExecutionMode: "distributed",
      },
    };

    expect(job.executionProfile.placement).toBe("remote");
    expect(job.executionProfile.interactivity).toBe("background");
    expect(job.continuation.resumeSupported).toBe(true);
    expect(job.metadata?.legacyExecutionMode).toBe("distributed");
  });

  it("exposes typed kernel context and policy decisions", () => {
    const contextSlice: KernelContextSlice = {
      scope: {
        kind: "workspace",
        workspaceId: "ws-1",
      },
      revision: 7,
      snapshot: {
        workspaces: 1,
        terminalSessions: 2,
      },
      latestEvent: {
        eventId: "runtime.updated:7",
      },
      sources: ["state_fabric", "runtime_metrics"],
    };
    const decision: KernelPolicyDecision = {
      decision: "ask",
      reason: "Mutation requires an approval checkpoint.",
      policyMode: "balanced",
      evaluatedAt: 7,
      metadata: {
        requiresApproval: true,
      },
    };

    expect(contextSlice.scope.kind).toBe("workspace");
    expect(contextSlice.latestEvent?.eventId).toBe("runtime.updated:7");
    expect(decision.decision).toBe("ask");
    expect(decision.metadata?.requiresApproval).toBe(true);
  });

  it("exposes projection bootstrap and delta envelopes for kernel-native slices", () => {
    const bootstrap: KernelProjectionBootstrapResponse = {
      revision: 9,
      sliceRevisions: {
        mission_control: 9,
        jobs: 9,
      },
      slices: {
        mission_control: {
          source: "runtime_snapshot_v1",
          generatedAt: 9,
          workspaces: [],
          tasks: [],
          runs: [],
          reviewPacks: [],
        },
        jobs: [],
      },
    };
    const delta: KernelProjectionDelta = {
      revision: 10,
      scopes: ["mission_control", "jobs"],
      ops: [
        {
          type: "replace",
          scope: "mission_control",
          value: bootstrap.slices.mission_control,
        },
        {
          type: "resync_required",
          scope: "jobs",
          reason: "subscriber_lagged",
        },
      ],
    };

    expect(bootstrap.sliceRevisions.mission_control).toBe(9);
    expect(delta.ops[0]).toMatchObject({
      type: "replace",
      scope: "mission_control",
    });
    expect(delta.ops[1]).toMatchObject({
      type: "resync_required",
      scope: "jobs",
      reason: "subscriber_lagged",
    });
  });
});

describe("frozen rpc contract spec", () => {
  it("builds deterministic method-set hash from canonical methods", () => {
    const methods = CODE_RUNTIME_RPC_METHOD_LIST;
    const hash = computeCodeRuntimeRpcMethodSetHash(methods);
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
    expect(hash).toBe(computeCodeRuntimeRpcMethodSetHash([...methods]));
  });

  it("builds frozen rpc spec payload", () => {
    const spec = buildCodeRuntimeRpcSpec();
    expect(spec.contractVersion).toBe(CODE_RUNTIME_RPC_CONTRACT_VERSION);
    expect(spec.methods).toEqual(
      [...CODE_RUNTIME_RPC_METHOD_LIST].sort((left, right) => left.localeCompare(right))
    );
    expect(spec.methodSetHash).toBe(computeCodeRuntimeRpcMethodSetHash(spec.methods));
    expect(spec.features).toEqual(CODE_RUNTIME_RPC_FEATURES);
    expect(spec.errorCodes).toEqual(CODE_RUNTIME_RPC_ERROR_CODES);
    expect(spec.transports).toEqual(CODE_RUNTIME_RPC_TRANSPORTS);
  });

  it("builds a stable frozen payload shape", () => {
    const spec = buildCodeRuntimeRpcSpec();
    expect(spec).toEqual(buildCodeRuntimeRpcSpec());
  });

  it("exposes executionGraph baseline fields in the frozen spec JSON", () => {
    const spec = JSON.parse(
      readFileSync(
        new URL(
          "../../../docs/runtime/spec/code-runtime-rpc-spec.2026-03-22.json",
          import.meta.url
        ),
        "utf8"
      )
    ) as {
      rpc: {
        executionGraphFields?: readonly string[];
      };
    };

    expect(spec.rpc.executionGraphFields).toEqual(CODE_RUNTIME_RPC_EXECUTION_GRAPH_FIELDS);
    expect(spec.rpc.executionGraphFields).toEqual(buildCodeRuntimeRpcSpec().executionGraphFields);
  });

  it("keeps the canonical runtime rpc shell thin and delegating to split modules", () => {
    const shellSource = readFileSync(new URL("./codeRuntimeRpc.ts", import.meta.url), "utf8");

    expect(shellSource.split("\n").length).toBeLessThanOrEqual(140);
    expect(shellSource).not.toMatch(/from "\.\/hugeCodeMissionControl\.js"/);
    expect(shellSource).not.toMatch(/from "\.\/code-runtime-rpc\/runtimeRunsAndSubAgents\.js"/);
    expect(shellSource).not.toMatch(/export (interface|type) RuntimeRun/);
  });

  it("does not expose legacy alias payload fields for hot rpc request maps", () => {
    const requestMapSource = readFileSync(
      new URL("./code-runtime-rpc/requestPayloadMap.ts", import.meta.url),
      "utf8"
    );

    const turnSendSection = requestMapSource.slice(
      requestMapSource.indexOf("[CODE_RUNTIME_RPC_METHODS.TURN_SEND]"),
      requestMapSource.indexOf("[CODE_RUNTIME_RPC_METHODS.TURN_INTERRUPT]")
    );
    expect(turnSendSection).not.toContain("TurnSendRequestCompat");
    expect(turnSendSection).not.toContain("request_id");
    expect(turnSendSection).not.toContain("context_prefix");
    expect(turnSendSection).not.toContain("preferred_backend_ids");

    const runPrepareSection = requestMapSource.slice(
      requestMapSource.indexOf("[CODE_RUNTIME_RPC_METHODS.RUN_PREPARE_V2]"),
      requestMapSource.indexOf("[CODE_RUNTIME_RPC_METHODS.RUN_START_V2]")
    );
    expect(runPrepareSection).not.toContain("workspace_id");
    expect(runPrepareSection).not.toContain("request_id");
    expect(runPrepareSection).not.toContain("preferred_backend_ids");
    expect(runPrepareSection).not.toContain("timeout_ms");

    const runStartSection = requestMapSource.slice(
      requestMapSource.indexOf("[CODE_RUNTIME_RPC_METHODS.RUN_START_V2]"),
      requestMapSource.indexOf("[CODE_RUNTIME_RPC_METHODS.RUN_CANCEL_V2]")
    );
    expect(runStartSection).not.toContain("workspace_id");
    expect(runStartSection).not.toContain("request_id");
    expect(runStartSection).not.toContain("preferred_backend_ids");
    expect(runStartSection).not.toContain("timeout_ms");

    const runInterveneSection = requestMapSource.slice(
      requestMapSource.indexOf("[CODE_RUNTIME_RPC_METHODS.RUN_INTERVENE_V2]"),
      requestMapSource.indexOf("[CODE_RUNTIME_RPC_METHODS.RUN_GET_V2]")
    );
    expect(runInterveneSection).not.toContain("run_id");
    expect(runInterveneSection).not.toContain("instruction_patch");
    expect(runInterveneSection).not.toContain("preferred_backend_ids");
  });
});

describe("rpc transport contract", () => {
  it("exposes canonical rpc, sse, and ws transports", () => {
    expect(CODE_RUNTIME_RPC_TRANSPORTS.rpc.endpointPath).toBe("/rpc");
    expect(CODE_RUNTIME_RPC_TRANSPORTS.events.endpointPath).toBe("/events");
    expect(CODE_RUNTIME_RPC_TRANSPORTS.ws.endpointPath).toBe("/ws");
    expect(CODE_RUNTIME_RPC_TRANSPORTS.rpc.channel).toBe("rpc");
    expect(CODE_RUNTIME_RPC_TRANSPORTS.events.channel).toBe("events");
    expect(CODE_RUNTIME_RPC_TRANSPORTS.ws.channel).toBe("duplex");
    expect(CODE_RUNTIME_RPC_TRANSPORTS.events.replay).toEqual({
      mode: "header",
      key: "Last-Event-ID",
    });
    expect(CODE_RUNTIME_RPC_TRANSPORTS.ws.replay).toEqual({
      mode: "query",
      key: "lastEventId",
    });
  });
});

describe("provider alias registry", () => {
  it("keeps alias entries unique", () => {
    const seenAliases = new Set<string>();
    for (const entry of CODE_RUNTIME_PROVIDER_ALIAS_REGISTRY) {
      for (const alias of entry.aliases) {
        expect(seenAliases.has(alias)).toBe(false);
        seenAliases.add(alias);
      }
    }
  });
});

describe("provider and pool canonicalization helpers", () => {
  it("maps oauth provider aliases to canonical ids", () => {
    expect(canonicalizeOAuthProviderId("antigravity")).toBe("gemini");
    expect(canonicalizeOAuthProviderId("anti-gravity")).toBe("gemini");
    expect(canonicalizeOAuthProviderId("google")).toBe("gemini");
    expect(canonicalizeOAuthProviderId("openai")).toBe("codex");
    expect(canonicalizeOAuthProviderId("claude")).toBe("claude_code");
    expect(canonicalizeOAuthProviderId("claude_code_local")).toBe(null);
    expect(canonicalizeOAuthProviderId("unsupported")).toBe(null);
  });

  it("maps model provider aliases to canonical providers", () => {
    expect(canonicalizeModelProvider("antigravity")).toBe("google");
    expect(canonicalizeModelProvider("anti-gravity")).toBe("google");
    expect(canonicalizeModelProvider("gemini")).toBe("google");
    expect(canonicalizeModelProvider("claude-code")).toBe("anthropic");
    expect(canonicalizeModelProvider("claude_code_local")).toBe("claude_code_local");
    expect(canonicalizeModelProvider("codex")).toBe("openai");
    expect(canonicalizeModelProvider("local")).toBe("local");
    expect(canonicalizeModelProvider("unknown")).toBe("unknown");
    expect(canonicalizeModelProvider("unsupported")).toBe(null);
  });

  it("maps model pool aliases to canonical pools", () => {
    expect(canonicalizeModelPool("antigravity")).toBe("gemini");
    expect(canonicalizeModelPool("anti-gravity")).toBe("gemini");
    expect(canonicalizeModelPool("gemini")).toBe("gemini");
    expect(canonicalizeModelPool("claude_code_local")).toBe(null);
    expect(canonicalizeModelPool("codex")).toBe("codex");
    expect(canonicalizeModelPool("auto")).toBe("auto");
    expect(canonicalizeModelPool("unsupported")).toBe(null);
  });
});

describe("method-not-found error code detection", () => {
  it("accepts canonical METHOD_NOT_FOUND code", () => {
    expect(
      isCodeRuntimeRpcMethodNotFoundErrorCode(CODE_RUNTIME_RPC_ERROR_CODES.METHOD_NOT_FOUND)
    ).toBe(true);
  });

  it("rejects non method-not-found codes", () => {
    expect(
      isCodeRuntimeRpcMethodNotFoundErrorCode(CODE_RUNTIME_RPC_ERROR_CODES.INTERNAL_ERROR)
    ).toBe(false);
    expect(isCodeRuntimeRpcMethodNotFoundErrorCode("")).toBe(false);
    expect(isCodeRuntimeRpcMethodNotFoundErrorCode(null)).toBe(false);
  });

  it("normalizes desktop-host/web message variants into METHOD_NOT_FOUND", () => {
    const messages = [
      "Unsupported RPC method: code_workspaces_list",
      "Unknown command code_workspaces_list",
      "Command `code_workspaces_list` not found",
      "method not found",
      "invalid args for command invoke: command code_workspaces_list not found",
    ];

    for (const message of messages) {
      expect(inferCodeRuntimeRpcMethodNotFoundCodeFromMessage(message)).toBe(
        CODE_RUNTIME_RPC_ERROR_CODES.METHOD_NOT_FOUND
      );
    }
  });

  it("does not infer METHOD_NOT_FOUND for unrelated messages", () => {
    expect(inferCodeRuntimeRpcMethodNotFoundCodeFromMessage("runtime internal error")).toBe(null);
    expect(inferCodeRuntimeRpcMethodNotFoundCodeFromMessage("")).toBe(null);
    expect(inferCodeRuntimeRpcMethodNotFoundCodeFromMessage(undefined)).toBe(null);
  });
});
