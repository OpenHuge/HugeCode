import type {
  HugeCodeEvidenceState,
  HugeCodeReviewActionabilitySummary,
  HugeCodeReviewStatus,
  AgentTaskSummary,
} from "@ku0/code-runtime-host-contract";
import { getHugeCodeReviewActionAvailability } from "@ku0/code-runtime-host-contract";
import {
  prepareMissionInterventionDraft,
  type MissionInterventionDraft,
  type RuntimeTaskLauncherInterventionIntent,
} from "./runtimeTaskInterventionDraftFacade";
import type { RepositoryExecutionContract } from "./runtimeRepositoryExecutionContract";
import { buildRuntimeClarifyInstruction } from "./runtimeReviewInterventionInstruction";
import {
  resolveReviewContinuationDefaults,
  resolveRuntimeFollowUpPreferredBackendIds,
  type ReviewContinuationDefaults,
  type RuntimeFollowUpPlacementInput,
} from "./runtimeReviewContinuationFacade";

export type RuntimeReviewPackDecisionActionId =
  | "accept"
  | "reject"
  | "retry"
  | "clarify"
  | "switch_profile_and_retry"
  | "continue_in_pair";

export type RuntimeReviewPackDecisionActionTarget = {
  kind: "review_decision";
  requestId: string;
  status: "approved" | "rejected";
};

export type RuntimeReviewPackDecisionActionModel<TNavigationTarget> = {
  id: RuntimeReviewPackDecisionActionId;
  label: string;
  detail: string;
  enabled: boolean;
  disabledReason: string | null;
  navigationTarget: TNavigationTarget | null;
  interventionDraft: MissionInterventionDraft | null;
  actionTarget: RuntimeReviewPackDecisionActionTarget | null;
};

export type RuntimeReviewPackDecisionActionabilitySummary = {
  summary: string;
  details: string[];
  sourceLabel: string;
  usesFallback: boolean;
};

export type ReviewPackDecisionState = {
  status: "pending" | "accepted" | "rejected";
  reviewPackId: string;
  summary: string;
};

export type ReviewInterventionAvailability = {
  action: string;
  enabled: boolean;
  supported: boolean;
  reason: string | null;
};

type ReviewPackInterventionActionConfig = {
  id: Extract<
    RuntimeReviewPackDecisionActionModel<unknown>["id"],
    "retry" | "clarify" | "switch_profile_and_retry" | "continue_in_pair"
  >;
  label: string;
  detail: (nextActionDetail: string | null | undefined) => string;
  unavailableDetail: string;
  actionIds: string[];
  intent: RuntimeTaskLauncherInterventionIntent;
  transformInstruction?: (instruction: string) => string;
};

type RuntimeReviewPackInterventionDecisionActionsInput<TNavigationTarget> = {
  navigationTarget: TNavigationTarget;
  readOnlyReason: string | null;
  runtimeInterventionsSupported: boolean;
  nextActionDetail: string | null | undefined;
  title: string;
  instruction: string | null;
  executionProfileId: string | null | undefined;
  preferredBackendIds: string[] | undefined;
  sourceTaskId: string;
  sourceRunId: string;
  sourceReviewPackId: string;
  taskSource?: AgentTaskSummary["taskSource"] | null;
  validationPresetId?: string | null;
  accessMode?: AgentTaskSummary["accessMode"] | null;
  repositoryExecutionContract?: RepositoryExecutionContract | null;
  reviewActionability?: HugeCodeReviewActionabilitySummary | null;
  actions: ReviewInterventionAvailability[] | null | undefined;
};

type RuntimeReviewPackDecisionActionsInput<TNavigationTarget> = {
  reviewDecision: ReviewPackDecisionState;
  evidenceState: HugeCodeEvidenceState;
  reviewStatus: HugeCodeReviewStatus;
  readOnlyReason: string | null;
  reviewActionability?: HugeCodeReviewActionabilitySummary | null;
  interventionActions: RuntimeReviewPackDecisionActionModel<TNavigationTarget>[];
};

export type RuntimeReviewPackFollowUpState<TNavigationTarget> = {
  readOnlyReason: string | null;
  runtimeInterventionsSupported: boolean;
  preferredBackendIds: string[] | undefined;
  continuationDefaults: ReviewContinuationDefaults | null;
  decisionActionability: RuntimeReviewPackDecisionActionabilitySummary;
  interventionActions: RuntimeReviewPackDecisionActionModel<TNavigationTarget>[];
  decisionActions: RuntimeReviewPackDecisionActionModel<TNavigationTarget>[];
};

type RuntimeReviewPackFollowUpStateInput<TNavigationTarget> = {
  source: string;
  placement: RuntimeFollowUpPlacementInput | null | undefined;
  routingBackendId: string | null | undefined;
  contract: RepositoryExecutionContract | null;
  taskSource?: AgentTaskSummary["taskSource"] | null;
  runtimeDefaults: {
    sourceTaskId: string;
    sourceRunId: string;
    sourceReviewPackId: string;
    taskSource?: AgentTaskSummary["taskSource"] | null;
    executionProfileId?: string | null;
    accessMode?: AgentTaskSummary["accessMode"] | null;
    validationPresetId?: string | null;
    relaunchContext?: AgentTaskSummary["relaunchContext"] | null;
  } | null;
  navigationTarget: TNavigationTarget;
  nextActionDetail: string | null | undefined;
  title: string;
  instruction: string | null;
  actions: ReviewInterventionAvailability[] | null | undefined;
  reviewActionability?: HugeCodeReviewActionabilitySummary | null;
  reviewDecision: ReviewPackDecisionState;
  evidenceState: HugeCodeEvidenceState;
  reviewStatus: HugeCodeReviewStatus;
  fallbackProfileId?: string | null;
};

const REVIEW_PACK_INTERVENTION_ACTIONS: ReviewPackInterventionActionConfig[] = [
  {
    id: "retry",
    label: "Retry run",
    detail: (nextActionDetail) =>
      nextActionDetail ??
      "Prepare a retry from the action center with the recorded review context.",
    unavailableDetail: "Retry is not currently available for this run.",
    actionIds: ["retry"],
    intent: "retry",
  },
  {
    id: "clarify",
    label: "Clarify",
    detail: () =>
      "Prepare a clarification relaunch from the action center while preserving the recorded review context.",
    unavailableDetail: "Clarify is not currently available for this run.",
    actionIds: ["continue_with_clarification"],
    intent: "clarify",
    transformInstruction: buildRuntimeClarifyInstruction,
  },
  {
    id: "switch_profile_and_retry",
    label: "Switch profile and retry",
    detail: () => "Prepare a relaunch on a different execution profile from the action center.",
    unavailableDetail: "Switch profile is not currently available for this run.",
    actionIds: ["switch_profile_and_retry"],
    intent: "switch_profile",
  },
  {
    id: "continue_in_pair",
    label: "Continue in pair",
    detail: () =>
      "Escalate this mission into pair mode while preserving the review context and runtime lineage.",
    unavailableDetail: "Pair escalation is not currently available for this run.",
    actionIds: ["escalate_to_pair_mode"],
    intent: "pair_mode",
  },
];

function isConfirmedReadyPlacement(placement: RuntimeFollowUpPlacementInput | null | undefined) {
  return placement?.lifecycleState === "confirmed" && placement.readiness === "ready";
}

export function resolveRuntimeReviewReadOnlyReason(input: {
  source: string;
  placement: RuntimeFollowUpPlacementInput | null | undefined;
}) {
  if (input.source !== "runtime_snapshot_v1") {
    return "Mission-control snapshot is unavailable. Accept, reject, and follow-up actions stay blocked until runtime truth is restored.";
  }
  if (input.placement && !isConfirmedReadyPlacement(input.placement)) {
    return "Placement is not runtime-confirmed yet. Accept, reject, and follow-up actions stay read-only until routing reaches a confirmed ready state.";
  }
  return null;
}

function createReviewDecisionActionTarget(
  requestId: string,
  status: "approved" | "rejected"
): RuntimeReviewPackDecisionActionTarget {
  return {
    kind: "review_decision",
    requestId,
    status,
  };
}

function buildRuntimeReviewPackDecisionActionability(input: {
  readOnlyReason: string | null;
  reviewActionability?: HugeCodeReviewActionabilitySummary | null;
  actions: ReviewInterventionAvailability[] | null | undefined;
}): RuntimeReviewPackDecisionActionabilitySummary {
  if (input.readOnlyReason) {
    return {
      summary: input.readOnlyReason,
      details: [
        "Decision source: Runtime routing gate.",
        "Review decisions and follow-up actions stay read-only until runtime routing confirms the placement.",
      ],
      sourceLabel: "Runtime routing gate",
      usesFallback: false,
    };
  }

  if ((input.reviewActionability?.actions.length ?? 0) > 0) {
    return {
      summary: "Decision availability is backed by canonical runtime review actionability.",
      details: [
        "Decision source: Canonical runtime review actionability.",
        "Accept, reject, and follow-up availability are coming from the runtime-published review action set.",
      ],
      sourceLabel: "Canonical runtime review actionability",
      usesFallback: false,
    };
  }

  return {
    summary:
      "Canonical runtime review actionability is unavailable. Follow-up and review decisions stay disabled until runtime publishes the action set.",
    details: [
      "Decision source: Runtime review actionability unavailable.",
      "This surface no longer reconstructs follow-up actions or default review policy in page-local logic.",
    ],
    sourceLabel: "Runtime review actionability unavailable",
    usesFallback: false,
  };
}

export function getInterventionAvailability(
  reviewActionability: HugeCodeReviewActionabilitySummary | null | undefined,
  actions: ReviewInterventionAvailability[] | null | undefined,
  actionIds: string[]
) {
  return getHugeCodeReviewActionAvailability({
    reviewActionability,
    actionIds,
  });
}

export function buildRuntimeReviewPackInterventionDecisionActions<TNavigationTarget>(
  input: RuntimeReviewPackInterventionDecisionActionsInput<TNavigationTarget>
): RuntimeReviewPackDecisionActionModel<TNavigationTarget>[] {
  const baseInstruction = input.instruction?.trim() ?? "";
  const interventionUnavailableReason = input.readOnlyReason
    ? input.readOnlyReason
    : !input.runtimeInterventionsSupported
      ? "Interventions are unavailable because runtime mission-control data is missing."
      : null;

  return REVIEW_PACK_INTERVENTION_ACTIONS.map((config) => {
    const availability = getInterventionAvailability(
      input.reviewActionability,
      input.actions,
      config.actionIds
    );
    const draft =
      input.runtimeInterventionsSupported && baseInstruction.length > 0
        ? prepareMissionInterventionDraft({
            title: input.title,
            instruction: config.transformInstruction
              ? config.transformInstruction(baseInstruction)
              : baseInstruction,
            intent: config.intent,
            executionProfileId: input.executionProfileId,
            preferredBackendIds: input.preferredBackendIds,
            sourceTaskId: input.sourceTaskId,
            sourceRunId: input.sourceRunId,
            sourceReviewPackId: input.sourceReviewPackId,
            taskSource: input.taskSource ?? null,
            validationPresetId: input.validationPresetId ?? null,
            accessMode: input.accessMode ?? null,
            repositoryExecutionContract: input.repositoryExecutionContract ?? null,
          })
        : null;
    const enabled = availability?.enabled === true && draft !== null;
    return {
      id: config.id,
      label: config.label,
      detail: config.detail(input.nextActionDetail),
      enabled,
      disabledReason: enabled
        ? null
        : (availability?.reason ?? interventionUnavailableReason ?? config.unavailableDetail),
      navigationTarget: input.navigationTarget,
      interventionDraft: draft,
      actionTarget: null,
    };
  });
}

export function buildRuntimeReviewPackDecisionActions<TNavigationTarget>(
  input: RuntimeReviewPackDecisionActionsInput<TNavigationTarget>
): RuntimeReviewPackDecisionActionModel<TNavigationTarget>[] {
  const reviewDecisionPending = input.reviewDecision.status === "pending";
  const acceptAvailability = getHugeCodeReviewActionAvailability({
    reviewActionability: input.reviewActionability ?? null,
    actionIds: ["accept_result"],
  });
  const rejectAvailability = getHugeCodeReviewActionAvailability({
    reviewActionability: input.reviewActionability ?? null,
    actionIds: ["reject_result"],
  });
  const acceptedReason =
    input.reviewDecision.status === "accepted"
      ? input.reviewDecision.summary || "This result was already accepted in review."
      : null;
  const rejectedReason =
    input.reviewDecision.status === "rejected"
      ? input.reviewDecision.summary || "This result was already rejected in review."
      : null;
  const evidenceIncompleteReason =
    input.evidenceState === "incomplete" || input.reviewStatus === "incomplete_evidence"
      ? "Runtime evidence is incomplete. Collect the missing review pack evidence before accepting or rejecting this result."
      : null;
  const reviewDecisionEnabled =
    reviewDecisionPending &&
    evidenceIncompleteReason === null &&
    input.readOnlyReason === null &&
    acceptAvailability?.enabled === true;
  const reviewDecisionDisabledReason = !reviewDecisionPending
    ? (acceptedReason ?? rejectedReason)
    : (evidenceIncompleteReason ?? input.readOnlyReason ?? acceptAvailability?.reason ?? null);
  const rejectDecisionEnabled =
    reviewDecisionPending &&
    evidenceIncompleteReason === null &&
    input.readOnlyReason === null &&
    rejectAvailability?.enabled === true;
  const rejectDecisionDisabledReason = !reviewDecisionPending
    ? (acceptedReason ?? rejectedReason)
    : (evidenceIncompleteReason ?? input.readOnlyReason ?? rejectAvailability?.reason ?? null);

  return [
    {
      id: "accept",
      label: "Accept result",
      detail: "Mark the run as accepted after reviewing evidence, warnings, and rollback posture.",
      enabled: reviewDecisionEnabled,
      disabledReason: reviewDecisionDisabledReason,
      navigationTarget: null,
      interventionDraft: null,
      actionTarget: reviewDecisionEnabled
        ? createReviewDecisionActionTarget(input.reviewDecision.reviewPackId, "approved")
        : null,
    },
    {
      id: "reject",
      label: "Reject result",
      detail:
        "Reject this result and send it back for another pass with explicit operator feedback.",
      enabled: rejectDecisionEnabled,
      disabledReason: rejectDecisionDisabledReason,
      navigationTarget: null,
      interventionDraft: null,
      actionTarget: rejectDecisionEnabled
        ? createReviewDecisionActionTarget(input.reviewDecision.reviewPackId, "rejected")
        : null,
    },
    ...input.interventionActions,
  ];
}

export function buildRuntimeReviewPackFollowUpState<TNavigationTarget>(
  input: RuntimeReviewPackFollowUpStateInput<TNavigationTarget>
): RuntimeReviewPackFollowUpState<TNavigationTarget> {
  const readOnlyReason = resolveRuntimeReviewReadOnlyReason({
    source: input.source,
    placement: input.placement,
  });
  const runtimeInterventionsSupported = readOnlyReason === null;
  const preferredBackendIds = resolveRuntimeFollowUpPreferredBackendIds(
    input.placement,
    input.routingBackendId
  );
  const continuationDefaults = input.runtimeDefaults
    ? resolveReviewContinuationDefaults({
        contract: input.contract,
        taskSource: input.taskSource ?? null,
        runtimeDefaults: {
          ...input.runtimeDefaults,
          preferredBackendIds,
        },
        fallbackProfileId: input.fallbackProfileId ?? input.runtimeDefaults.executionProfileId,
      })
    : null;
  const interventionActions = input.runtimeDefaults
    ? buildRuntimeReviewPackInterventionDecisionActions({
        navigationTarget: input.navigationTarget,
        readOnlyReason,
        runtimeInterventionsSupported,
        nextActionDetail: input.nextActionDetail,
        title: input.title,
        instruction: input.instruction,
        executionProfileId: input.runtimeDefaults.executionProfileId ?? null,
        preferredBackendIds,
        sourceTaskId: input.runtimeDefaults.sourceTaskId,
        sourceRunId: input.runtimeDefaults.sourceRunId,
        sourceReviewPackId: input.runtimeDefaults.sourceReviewPackId,
        taskSource: input.taskSource ?? null,
        accessMode: input.runtimeDefaults.accessMode ?? null,
        validationPresetId: input.runtimeDefaults.validationPresetId ?? null,
        repositoryExecutionContract: input.contract,
        reviewActionability: input.reviewActionability ?? null,
        actions: input.actions,
      })
    : [];
  const decisionActions = buildRuntimeReviewPackDecisionActions({
    reviewDecision: input.reviewDecision,
    evidenceState: input.evidenceState,
    reviewStatus: input.reviewStatus,
    readOnlyReason,
    reviewActionability: input.reviewActionability ?? null,
    interventionActions,
  });
  const decisionActionability = buildRuntimeReviewPackDecisionActionability({
    readOnlyReason,
    reviewActionability: input.reviewActionability ?? null,
    actions: input.actions,
  });

  return {
    readOnlyReason,
    runtimeInterventionsSupported,
    preferredBackendIds,
    continuationDefaults,
    decisionActionability,
    interventionActions,
    decisionActions,
  };
}
