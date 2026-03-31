import type {
  AgentTaskMissionBrief,
  RuntimeMissionPlanV2,
  RuntimeRunPrepareV2Request,
  RuntimeRunPrepareV2Response,
  RuntimeRunStartRequest,
} from "@ku0/code-runtime-host-contract";

function mergePlanIntoMissionBrief(
  missionBrief: AgentTaskMissionBrief | null | undefined,
  plan: RuntimeMissionPlanV2
): AgentTaskMissionBrief | null {
  if (!missionBrief) {
    return null;
  }
  return {
    ...missionBrief,
    planVersion: plan.planVersion,
    planSummary: plan.summary,
    currentMilestoneId: plan.currentMilestoneId,
    estimatedDurationMinutes: plan.estimatedDurationMinutes,
    estimatedWorkerRuns: plan.estimatedWorkerRuns,
    parallelismHint: plan.parallelismHint,
    clarificationQuestions: plan.clarifyingQuestions,
    milestones: plan.milestones,
    validationLanes: plan.validationLanes,
    skillPlan: plan.skillPlan,
  };
}

export function buildRuntimeRunStartRequestFromPreparation(input: {
  request: RuntimeRunPrepareV2Request;
  preparation: RuntimeRunPrepareV2Response;
}): RuntimeRunStartRequest {
  const missionBrief = mergePlanIntoMissionBrief(
    input.request.missionBrief,
    input.preparation.plan
  );
  return {
    ...input.request,
    ...(missionBrief ? { missionBrief } : {}),
    approvedPlanVersion: input.preparation.plan.planVersion,
  };
}
